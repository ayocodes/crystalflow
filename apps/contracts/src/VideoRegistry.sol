// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PointsRegistry.sol";

contract VideoRegistry {
    uint256 public constant UPLOAD_POINTS = 10;
    uint256 public constant CONVICTION_PERIOD = 900;

    struct Conviction {
        address challenger;
        string proofCid;
        uint256 timestamp;
        ConvictionStatus status;
    }

    struct VideoIndex {
        string id;
        string storageCid;
        address uploader;
        address indexer;
        uint256 uploadTime;
        uint256 convictionPeriodEnd;
        VideoStatus status;
        Conviction[] convictions;
    }

    enum VideoStatus {
        Pending,
        Finalized,
        Challenged
    }

    enum ConvictionStatus {
        Active,
        Resolved,
        Dismissed
    }

    mapping(string => VideoIndex) private videos;
    string[] private videoIds;
    PointsRegistry public pointsRegistry;

    event VideoIndexed(
        string indexed videoId,
        address indexed uploader,
        address indexed indexer,
        string storageCid,
        uint256 uploadTime,
        uint256 convictionPeriodEnd
    );
    event VideoFinalized(string indexed videoId);
    event VideoChallenged(string indexed videoId);

    event ConvictionSubmitted(
        string indexed videoId,
        uint256 convictionIndex,
        address indexed challenger,
        string proofCid,
        uint256 timestamp
    );
    event ConvictionResolved(string indexed videoId, uint256 convictionIndex, bool upheld);
    event ConvictionDismissed(string indexed videoId, uint256 convictionIndex);

    error VideoAlreadyExists();
    error VideoNotFound();
    error EmptyVideoId();
    error EmptyCid();
    error Unauthorized();
    error InvalidStatus();
    error ConvictionPeriodActive();
    error ConvictionPeriodEnded();
    error ConvictionNotFound();

    constructor(address _pointsRegistry) {
        pointsRegistry = PointsRegistry(_pointsRegistry);
    }

    function submitIndex(string memory videoId, string memory storageCid) external {
        if (bytes(videoId).length == 0) revert EmptyVideoId();
        if (bytes(storageCid).length == 0) revert EmptyCid();
        if (bytes(videos[videoId].id).length != 0) revert VideoAlreadyExists();

        uint256 currentTime = block.timestamp;
        uint256 convictionEnd = currentTime + CONVICTION_PERIOD;

        VideoIndex storage video = videos[videoId];
        video.id = videoId;
        video.storageCid = storageCid;
        video.uploader = msg.sender;
        video.indexer = msg.sender;
        video.uploadTime = currentTime;
        video.convictionPeriodEnd = convictionEnd;
        video.status = VideoStatus.Pending;

        videoIds.push(videoId);

        pointsRegistry.awardPoints(msg.sender, UPLOAD_POINTS);

        emit VideoIndexed(videoId, msg.sender, msg.sender, storageCid, currentTime, convictionEnd);
    }

    function submitConviction(string memory videoId, string memory proofCid) external {
        if (bytes(proofCid).length == 0) revert EmptyCid();

        VideoIndex storage video = videos[videoId];
        if (bytes(video.id).length == 0) revert VideoNotFound();
        if (block.timestamp >= video.convictionPeriodEnd) revert ConvictionPeriodEnded();

        Conviction memory newConviction = Conviction({
            challenger: msg.sender,
            proofCid: proofCid,
            timestamp: block.timestamp,
            status: ConvictionStatus.Active
        });

        video.convictions.push(newConviction);
        uint256 convictionIndex = video.convictions.length - 1;

        if (video.status == VideoStatus.Pending) {
            video.status = VideoStatus.Challenged;
            emit VideoChallenged(videoId);
        }

        emit ConvictionSubmitted(
            videoId,
            convictionIndex,
            msg.sender,
            proofCid,
            block.timestamp
        );
    }

    function resolveConviction(
        string memory videoId,
        uint256 convictionIndex,
        bool upheld
    ) external {
        VideoIndex storage video = videos[videoId];
        if (bytes(video.id).length == 0) revert VideoNotFound();
        if (convictionIndex >= video.convictions.length) revert ConvictionNotFound();

        Conviction storage conviction = video.convictions[convictionIndex];
        if (conviction.status != ConvictionStatus.Active) revert InvalidStatus();

        conviction.status = ConvictionStatus.Resolved;
        emit ConvictionResolved(videoId, convictionIndex, upheld);
    }

    function dismissConviction(string memory videoId, uint256 convictionIndex) external {
        VideoIndex storage video = videos[videoId];
        if (bytes(video.id).length == 0) revert VideoNotFound();
        if (convictionIndex >= video.convictions.length) revert ConvictionNotFound();

        Conviction storage conviction = video.convictions[convictionIndex];
        if (conviction.status != ConvictionStatus.Active) revert InvalidStatus();

        conviction.status = ConvictionStatus.Dismissed;
        emit ConvictionDismissed(videoId, convictionIndex);
    }

    function finalizeVideo(string memory videoId) external {
        VideoIndex storage video = videos[videoId];
        if (bytes(video.id).length == 0) revert VideoNotFound();
        if (video.status != VideoStatus.Pending) revert InvalidStatus();
        if (block.timestamp < video.convictionPeriodEnd) revert ConvictionPeriodActive();

        video.status = VideoStatus.Finalized;
        emit VideoFinalized(videoId);
    }

    function getVideo(string memory videoId) external view returns (VideoIndex memory) {
        VideoIndex memory video = videos[videoId];
        if (bytes(video.id).length == 0) revert VideoNotFound();
        return video;
    }

    function getConviction(
        string memory videoId,
        uint256 convictionIndex
    ) external view returns (Conviction memory) {
        VideoIndex storage video = videos[videoId];
        if (bytes(video.id).length == 0) revert VideoNotFound();
        if (convictionIndex >= video.convictions.length) revert ConvictionNotFound();
        return video.convictions[convictionIndex];
    }

    function getConvictionCount(string memory videoId) external view returns (uint256) {
        VideoIndex storage video = videos[videoId];
        if (bytes(video.id).length == 0) revert VideoNotFound();
        return video.convictions.length;
    }

    function getAllVideoIds() external view returns (string[] memory) {
        return videoIds;
    }

    function getVideoCount() external view returns (uint256) {
        return videoIds.length;
    }

    function isInConvictionPeriod(string memory videoId) external view returns (bool) {
        VideoIndex storage video = videos[videoId];
        if (bytes(video.id).length == 0) return false;
        return block.timestamp < video.convictionPeriodEnd;
    }
}
