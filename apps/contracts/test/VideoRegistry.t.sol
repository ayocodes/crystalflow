// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/VideoRegistry.sol";
import "../src/PointsRegistry.sol";

contract VideoRegistryTest is Test {
    VideoRegistry public videoRegistry;
    PointsRegistry public pointsRegistry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        pointsRegistry = new PointsRegistry(address(this));
        videoRegistry = new VideoRegistry(address(pointsRegistry));

        // Authorize videoRegistry to award points (all three addresses must be non-zero)
        pointsRegistry.setContracts(address(videoRegistry), makeAddr("dummyPredMarket"), makeAddr("dummyConvReg"));
    }

    // ── Submit index ──

    function test_submitIndex() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "bafyabc123");

        VideoRegistry.VideoIndex memory v = videoRegistry.getVideo("vid_1");
        assertEq(v.id, "vid_1");
        assertEq(v.storageCid, "bafyabc123");
        assertEq(v.uploader, alice);
        assertEq(v.indexer, alice);
        assertEq(uint8(v.status), uint8(VideoRegistry.VideoStatus.Pending));
        assertEq(v.convictionPeriodEnd, v.uploadTime + videoRegistry.CONVICTION_PERIOD());
    }

    function test_submitIndex_awardsPoints() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "bafyabc123");

        assertEq(pointsRegistry.getPoints(alice), videoRegistry.UPLOAD_POINTS());
    }

    function test_submitIndex_multiple() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        videoRegistry.submitIndex("vid_2", "cid2");

        assertEq(videoRegistry.getVideoCount(), 2);

        string[] memory ids = videoRegistry.getAllVideoIds();
        assertEq(ids.length, 2);
    }

    function testRevert_submitIndex_emptyId() public {
        vm.prank(alice);
        vm.expectRevert(VideoRegistry.EmptyVideoId.selector);
        videoRegistry.submitIndex("", "cid");
    }

    function testRevert_submitIndex_emptyCid() public {
        vm.prank(alice);
        vm.expectRevert(VideoRegistry.EmptyCid.selector);
        videoRegistry.submitIndex("vid_1", "");
    }

    function testRevert_submitIndex_duplicate() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        vm.expectRevert(VideoRegistry.VideoAlreadyExists.selector);
        videoRegistry.submitIndex("vid_1", "cid2");
    }

    // ── Conviction period checks ──

    function test_isInConvictionPeriod_true() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        assertTrue(videoRegistry.isInConvictionPeriod("vid_1"));
    }

    function test_isInConvictionPeriod_false_afterExpiry() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        // Warp past conviction period (900 seconds)
        vm.warp(block.timestamp + 901);

        assertFalse(videoRegistry.isInConvictionPeriod("vid_1"));
    }

    function test_isInConvictionPeriod_nonexistent() public {
        assertFalse(videoRegistry.isInConvictionPeriod("nonexistent"));
    }

    // ── Submit conviction ──

    function test_submitConviction() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        videoRegistry.submitConviction("vid_1", "proof_cid_1");

        assertEq(videoRegistry.getConvictionCount("vid_1"), 1);

        VideoRegistry.Conviction memory c = videoRegistry.getConviction("vid_1", 0);
        assertEq(c.challenger, bob);
        assertEq(c.proofCid, "proof_cid_1");
        assertEq(uint8(c.status), uint8(VideoRegistry.ConvictionStatus.Active));
    }

    function test_submitConviction_changesStatusToChallenged() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        videoRegistry.submitConviction("vid_1", "proof_cid_1");

        VideoRegistry.VideoIndex memory v = videoRegistry.getVideo("vid_1");
        assertEq(uint8(v.status), uint8(VideoRegistry.VideoStatus.Challenged));
    }

    function testRevert_submitConviction_videoNotFound() public {
        vm.prank(bob);
        vm.expectRevert(VideoRegistry.VideoNotFound.selector);
        videoRegistry.submitConviction("nonexistent", "proof");
    }

    function testRevert_submitConviction_emptyCid() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        vm.expectRevert(VideoRegistry.EmptyCid.selector);
        videoRegistry.submitConviction("vid_1", "");
    }

    function testRevert_submitConviction_periodEnded() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.warp(block.timestamp + 901);

        vm.prank(bob);
        vm.expectRevert(VideoRegistry.ConvictionPeriodEnded.selector);
        videoRegistry.submitConviction("vid_1", "proof");
    }

    // ── Resolve / dismiss conviction ──

    function test_resolveConviction() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        videoRegistry.submitConviction("vid_1", "proof");

        videoRegistry.resolveConviction("vid_1", 0, true);

        VideoRegistry.Conviction memory c = videoRegistry.getConviction("vid_1", 0);
        assertEq(uint8(c.status), uint8(VideoRegistry.ConvictionStatus.Resolved));
    }

    function test_dismissConviction() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        videoRegistry.submitConviction("vid_1", "proof");

        videoRegistry.dismissConviction("vid_1", 0);

        VideoRegistry.Conviction memory c = videoRegistry.getConviction("vid_1", 0);
        assertEq(uint8(c.status), uint8(VideoRegistry.ConvictionStatus.Dismissed));
    }

    function testRevert_resolveConviction_notFound() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.expectRevert(VideoRegistry.ConvictionNotFound.selector);
        videoRegistry.resolveConviction("vid_1", 99, true);
    }

    function testRevert_resolveConviction_alreadyResolved() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.prank(bob);
        videoRegistry.submitConviction("vid_1", "proof");

        videoRegistry.resolveConviction("vid_1", 0, true);

        vm.expectRevert(VideoRegistry.InvalidStatus.selector);
        videoRegistry.resolveConviction("vid_1", 0, false);
    }

    // ── Finalization ──

    function test_finalizeVideo() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        // Warp past conviction period
        vm.warp(block.timestamp + 901);

        videoRegistry.finalizeVideo("vid_1");

        VideoRegistry.VideoIndex memory v = videoRegistry.getVideo("vid_1");
        assertEq(uint8(v.status), uint8(VideoRegistry.VideoStatus.Finalized));
    }

    function testRevert_finalizeVideo_convictionPeriodActive() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        vm.expectRevert(VideoRegistry.ConvictionPeriodActive.selector);
        videoRegistry.finalizeVideo("vid_1");
    }

    function testRevert_finalizeVideo_notPending() public {
        vm.prank(alice);
        videoRegistry.submitIndex("vid_1", "cid1");

        // Challenge it to change status
        vm.prank(bob);
        videoRegistry.submitConviction("vid_1", "proof");

        vm.warp(block.timestamp + 901);

        vm.expectRevert(VideoRegistry.InvalidStatus.selector);
        videoRegistry.finalizeVideo("vid_1");
    }

    function testRevert_finalizeVideo_notFound() public {
        vm.expectRevert(VideoRegistry.VideoNotFound.selector);
        videoRegistry.finalizeVideo("nonexistent");
    }
}
