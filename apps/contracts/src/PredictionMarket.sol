// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PointsRegistry.sol";
import "./AgentRegistry.sol";

/**
 * @title PredictionMarket
 * @notice YES/NO prediction markets for CrystalFlow video convictions
 * @dev Simplified vote-based markets. Only registered agents can create/resolve.
 *      Activities stored on-chain for dashboard without graph indexer.
 */
contract PredictionMarket {
    // Constants
    uint256 public constant MARKET_DURATION = 2700; // 45 minutes
    uint256 public constant WINNER_POINTS = 5;
    uint256 public constant MAX_STORED_ACTIVITIES = 1000;

    // Structs
    struct Market {
        string id;
        string videoId;
        string question;
        address creator;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 yesVotes;
        uint256 noVotes;
        bool resolved;
        bool winningSide;
        MarketStatus status;
    }

    enum MarketStatus {
        Active,
        Closed,
        Resolved
    }

    struct Position {
        uint256 yesVotes;
        uint256 noVotes;
    }

    struct Activity {
        ActivityType activityType;
        address user;
        string marketId;
        bool isYes;
        uint256 timestamp;
    }

    enum ActivityType {
        MarketCreated,
        VoteCast,
        MarketClosed,
        MarketResolved
    }

    // State
    mapping(string => Market) private markets;
    mapping(string => mapping(address => Position)) private positions;
    mapping(string => address[]) private marketVoters;
    mapping(string => Activity[]) private marketActivities;
    Activity[] private allActivities;
    string[] private marketIds;
    uint256 private marketCounter;

    PointsRegistry public pointsRegistry;
    AgentRegistry public agentRegistry;

    // Events
    event MarketCreated(
        string indexed marketId,
        string indexed videoId,
        string question,
        address indexed creator,
        uint256 expiresAt
    );
    event VoteCast(
        string indexed marketId,
        address indexed voter,
        bool isYes,
        uint256 amount
    );
    event MarketResolved(
        string indexed marketId,
        bool winningSide,
        uint256 yesVotes,
        uint256 noVotes
    );
    event MarketClosed(string indexed marketId);

    // Errors
    error EmptyVideoId();
    error EmptyQuestion();
    error MarketNotFound();
    error MarketExpired();
    error MarketNotExpired();
    error MarketAlreadyResolved();
    error InvalidVoteAmount();
    error NotActiveAgent();

    constructor(address _pointsRegistry, address _agentRegistry) {
        pointsRegistry = PointsRegistry(_pointsRegistry);
        agentRegistry = AgentRegistry(_agentRegistry);
    }

    modifier onlyActiveAgent() {
        if (!agentRegistry.isActiveAgent(msg.sender)) revert NotActiveAgent();
        _;
    }

    /**
     * @notice Create a new prediction market (agents only)
     */
    function createMarket(
        string memory videoId,
        string memory question
    ) external onlyActiveAgent returns (string memory) {
        if (bytes(videoId).length == 0) revert EmptyVideoId();
        if (bytes(question).length == 0) revert EmptyQuestion();

        marketCounter++;
        string memory marketId = string(
            abi.encodePacked("market_", _uint2str(marketCounter))
        );

        uint256 createdAt = block.timestamp;
        uint256 expiresAt = createdAt + MARKET_DURATION;

        markets[marketId] = Market({
            id: marketId,
            videoId: videoId,
            question: question,
            creator: msg.sender,
            createdAt: createdAt,
            expiresAt: expiresAt,
            yesVotes: 0,
            noVotes: 0,
            resolved: false,
            winningSide: false,
            status: MarketStatus.Active
        });

        marketIds.push(marketId);

        Activity memory activity = Activity({
            activityType: ActivityType.MarketCreated,
            user: msg.sender,
            marketId: marketId,
            isYes: false,
            timestamp: block.timestamp
        });
        marketActivities[marketId].push(activity);
        if (allActivities.length < MAX_STORED_ACTIVITIES) {
            allActivities.push(activity);
        }

        emit MarketCreated(marketId, videoId, question, msg.sender, expiresAt);

        return marketId;
    }

    function voteYes(string memory marketId) external {
        _vote(marketId, true, 1);
    }

    function voteNo(string memory marketId) external {
        _vote(marketId, false, 1);
    }

    function _vote(string memory marketId, bool isYes, uint256 amount) internal {
        Market storage market = markets[marketId];
        if (bytes(market.id).length == 0) revert MarketNotFound();
        if (block.timestamp >= market.expiresAt) revert MarketExpired();
        if (market.resolved) revert MarketAlreadyResolved();
        if (amount == 0) revert InvalidVoteAmount();

        Position storage position = positions[marketId][msg.sender];
        bool isNewVoter = (position.yesVotes == 0 && position.noVotes == 0);

        if (isYes) {
            position.yesVotes += amount;
            market.yesVotes += amount;
        } else {
            position.noVotes += amount;
            market.noVotes += amount;
        }

        if (isNewVoter) {
            marketVoters[marketId].push(msg.sender);
        }

        Activity memory activity = Activity({
            activityType: ActivityType.VoteCast,
            user: msg.sender,
            marketId: marketId,
            isYes: isYes,
            timestamp: block.timestamp
        });
        marketActivities[marketId].push(activity);
        if (allActivities.length < MAX_STORED_ACTIVITIES) {
            allActivities.push(activity);
        }

        emit VoteCast(marketId, msg.sender, isYes, amount);
    }

    /**
     * @notice Close an expired market. Permissionless by design -- anyone can
     *         close a market once it has passed its expiry. This is intentional
     *         for the hackathon to avoid relying on a single keeper.
     */
    function closeMarket(string memory marketId) external {
        Market storage market = markets[marketId];
        if (bytes(market.id).length == 0) revert MarketNotFound();
        if (block.timestamp < market.expiresAt) revert MarketNotExpired();
        if (market.status != MarketStatus.Active) revert MarketAlreadyResolved();

        market.status = MarketStatus.Closed;

        Activity memory activity = Activity({
            activityType: ActivityType.MarketClosed,
            user: msg.sender,
            marketId: marketId,
            isYes: false,
            timestamp: block.timestamp
        });
        marketActivities[marketId].push(activity);
        if (allActivities.length < MAX_STORED_ACTIVITIES) {
            allActivities.push(activity);
        }

        emit MarketClosed(marketId);
    }

    /**
     * @notice Resolve a market and award points to winners (agents only)
     */
    function resolveMarket(string memory marketId, bool winningSide) external onlyActiveAgent {
        Market storage market = markets[marketId];
        if (bytes(market.id).length == 0) revert MarketNotFound();
        if (block.timestamp < market.expiresAt) revert MarketNotExpired();
        if (market.resolved) revert MarketAlreadyResolved();

        market.resolved = true;
        market.winningSide = winningSide;
        market.status = MarketStatus.Resolved;

        // Award points to winning voters
        address[] memory voters = marketVoters[marketId];
        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            Position memory position = positions[marketId][voter];

            bool isWinner = winningSide
                ? (position.yesVotes > 0)
                : (position.noVotes > 0);
            if (isWinner) {
                pointsRegistry.awardPoints(voter, WINNER_POINTS);
            }
        }

        Activity memory activity = Activity({
            activityType: ActivityType.MarketResolved,
            user: msg.sender,
            marketId: marketId,
            isYes: winningSide,
            timestamp: block.timestamp
        });
        marketActivities[marketId].push(activity);
        if (allActivities.length < MAX_STORED_ACTIVITIES) {
            allActivities.push(activity);
        }

        emit MarketResolved(marketId, winningSide, market.yesVotes, market.noVotes);
    }

    // ── View functions ──

    function getMarket(string memory marketId) external view returns (Market memory) {
        Market memory market = markets[marketId];
        if (bytes(market.id).length == 0) revert MarketNotFound();
        return market;
    }

    function getPosition(
        string memory marketId,
        address user
    ) external view returns (Position memory) {
        return positions[marketId][user];
    }

    function getAllMarketIds() external view returns (string[] memory) {
        return marketIds;
    }

    function getMarketCount() external view returns (uint256) {
        return marketIds.length;
    }

    function getMarketVoters(
        string memory marketId
    ) external view returns (address[] memory) {
        return marketVoters[marketId];
    }

    function getMarketOdds(
        string memory marketId
    ) external view returns (uint256 yesPercentage, uint256 noPercentage) {
        Market memory market = markets[marketId];
        if (bytes(market.id).length == 0) revert MarketNotFound();

        uint256 totalVotes = market.yesVotes + market.noVotes;
        if (totalVotes == 0) {
            return (50, 50);
        }

        yesPercentage = (market.yesVotes * 100) / totalVotes;
        noPercentage = 100 - yesPercentage;
    }

    function isMarketExpired(string memory marketId) external view returns (bool) {
        Market memory market = markets[marketId];
        if (bytes(market.id).length == 0) return false;
        return block.timestamp >= market.expiresAt;
    }

    function getMarketActivities(
        string memory marketId
    ) external view returns (Activity[] memory) {
        return marketActivities[marketId];
    }

    function getAllActivities() external view returns (Activity[] memory) {
        return allActivities;
    }

    function getRecentActivities(uint256 count) external view returns (Activity[] memory) {
        uint256 totalActivities = allActivities.length;
        if (count > totalActivities) {
            count = totalActivities;
        }

        Activity[] memory recent = new Activity[](count);
        uint256 startIndex = totalActivities - count;

        for (uint256 i = 0; i < count; i++) {
            recent[i] = allActivities[startIndex + i];
        }

        return recent;
    }

    function getActivityCount() external view returns (uint256) {
        return allActivities.length;
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
