// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PredictionMarket.sol";
import "../src/PointsRegistry.sol";
import "../src/AgentRegistry.sol";

contract PredictionMarketTest is Test {
    PredictionMarket public market;
    PointsRegistry public pointsRegistry;
    AgentRegistry public agentRegistry;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address outsider = makeAddr("outsider");

    string marketId;

    function setUp() public {
        agentRegistry = new AgentRegistry();
        pointsRegistry = new PointsRegistry(address(this));
        market = new PredictionMarket(address(pointsRegistry), address(agentRegistry));

        // Authorize prediction market to award points (all three addresses must be non-zero)
        pointsRegistry.setContracts(makeAddr("dummyVideoReg"), address(market), makeAddr("dummyConvReg"));

        // Register agents
        vm.prank(alice);
        agentRegistry.register(AgentRegistry.Role.Scout, "Alice", "");

        vm.prank(bob);
        agentRegistry.register(AgentRegistry.Role.Sentinel, "Bob", "");

        vm.prank(carol);
        agentRegistry.register(AgentRegistry.Role.Curator, "Carol", "");
    }

    // ── Helpers ──

    function _createDefaultMarket() internal returns (string memory) {
        vm.prank(alice);
        return market.createMarket("vid_1", "Is this video authentic?");
    }

    // ── Create market ──

    function test_createMarket() public {
        string memory id = _createDefaultMarket();

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.videoId, "vid_1");
        assertEq(m.question, "Is this video authentic?");
        assertEq(m.creator, alice);
        assertFalse(m.resolved);
        assertEq(m.yesVotes, 0);
        assertEq(m.noVotes, 0);
        assertEq(uint8(m.status), uint8(PredictionMarket.MarketStatus.Active));
        assertEq(m.expiresAt, m.createdAt + market.MARKET_DURATION());
    }

    function test_createMarket_incrementsCount() public {
        _createDefaultMarket();
        assertEq(market.getMarketCount(), 1);

        vm.prank(bob);
        market.createMarket("vid_2", "Another question?");

        assertEq(market.getMarketCount(), 2);
    }

    function test_createMarket_recordsActivity() public {
        _createDefaultMarket();
        assertEq(market.getActivityCount(), 1);

        PredictionMarket.Activity[] memory activities = market.getAllActivities();
        assertEq(uint8(activities[0].activityType), uint8(PredictionMarket.ActivityType.MarketCreated));
        assertEq(activities[0].user, alice);
    }

    function testRevert_createMarket_notActiveAgent() public {
        vm.prank(outsider);
        vm.expectRevert(PredictionMarket.NotActiveAgent.selector);
        market.createMarket("vid_1", "Question?");
    }

    function testRevert_createMarket_emptyVideoId() public {
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.EmptyVideoId.selector);
        market.createMarket("", "Question?");
    }

    function testRevert_createMarket_emptyQuestion() public {
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.EmptyQuestion.selector);
        market.createMarket("vid_1", "");
    }

    // ── Voting ──

    function test_voteYes() public {
        string memory id = _createDefaultMarket();

        vm.prank(bob);
        market.voteYes(id);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.yesVotes, 1);
        assertEq(m.noVotes, 0);

        PredictionMarket.Position memory pos = market.getPosition(id, bob);
        assertEq(pos.yesVotes, 1);
        assertEq(pos.noVotes, 0);
    }

    function test_voteNo() public {
        string memory id = _createDefaultMarket();

        vm.prank(carol);
        market.voteNo(id);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.yesVotes, 0);
        assertEq(m.noVotes, 1);

        PredictionMarket.Position memory pos = market.getPosition(id, carol);
        assertEq(pos.yesVotes, 0);
        assertEq(pos.noVotes, 1);
    }

    function test_voteMultiple_sameUser() public {
        string memory id = _createDefaultMarket();

        vm.startPrank(bob);
        market.voteYes(id);
        market.voteYes(id);
        market.voteNo(id);
        vm.stopPrank();

        PredictionMarket.Position memory pos = market.getPosition(id, bob);
        assertEq(pos.yesVotes, 2);
        assertEq(pos.noVotes, 1);

        // Should only be tracked as one voter
        address[] memory voters = market.getMarketVoters(id);
        assertEq(voters.length, 1);
    }

    function test_voteRecordsActivity() public {
        string memory id = _createDefaultMarket();

        vm.prank(bob);
        market.voteYes(id);

        // 1 for create + 1 for vote = 2
        assertEq(market.getActivityCount(), 2);
    }

    function testRevert_vote_marketNotFound() public {
        vm.prank(bob);
        vm.expectRevert(PredictionMarket.MarketNotFound.selector);
        market.voteYes("nonexistent");
    }

    function testRevert_vote_marketExpired() public {
        string memory id = _createDefaultMarket();

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);

        vm.prank(bob);
        vm.expectRevert(PredictionMarket.MarketExpired.selector);
        market.voteYes(id);
    }

    // ── Market odds ──

    function test_getMarketOdds_noVotes() public {
        string memory id = _createDefaultMarket();

        (uint256 yPct, uint256 nPct) = market.getMarketOdds(id);
        assertEq(yPct, 50);
        assertEq(nPct, 50);
    }

    function test_getMarketOdds_withVotes() public {
        string memory id = _createDefaultMarket();

        vm.prank(bob);
        market.voteYes(id);

        vm.prank(carol);
        market.voteYes(id);

        vm.prank(alice);
        market.voteNo(id);

        // 2 yes, 1 no => 66% yes, 34% no (integer math)
        (uint256 yPct, uint256 nPct) = market.getMarketOdds(id);
        assertEq(yPct, 66);
        assertEq(nPct, 34);
    }

    // ── Close market ──

    function test_closeMarket() public {
        string memory id = _createDefaultMarket();

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);

        market.closeMarket(id);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.status), uint8(PredictionMarket.MarketStatus.Closed));
    }

    function testRevert_closeMarket_notExpired() public {
        string memory id = _createDefaultMarket();

        vm.expectRevert(PredictionMarket.MarketNotExpired.selector);
        market.closeMarket(id);
    }

    function testRevert_closeMarket_alreadyClosed() public {
        string memory id = _createDefaultMarket();

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);
        market.closeMarket(id);

        vm.expectRevert(PredictionMarket.MarketAlreadyResolved.selector);
        market.closeMarket(id);
    }

    // ── Resolve market ──

    function test_resolveMarket_yesWins() public {
        string memory id = _createDefaultMarket();

        vm.prank(bob);
        market.voteYes(id);

        vm.prank(carol);
        market.voteNo(id);

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);

        vm.prank(alice);
        market.resolveMarket(id, true);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertTrue(m.resolved);
        assertTrue(m.winningSide);
        assertEq(uint8(m.status), uint8(PredictionMarket.MarketStatus.Resolved));
    }

    function test_resolveMarket_awardsPointsToWinners() public {
        string memory id = _createDefaultMarket();

        vm.prank(bob);
        market.voteYes(id);

        vm.prank(carol);
        market.voteNo(id);

        uint256 bobPointsBefore = pointsRegistry.getPoints(bob);
        uint256 carolPointsBefore = pointsRegistry.getPoints(carol);

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);

        // Yes wins => bob gets points, carol does not
        vm.prank(alice);
        market.resolveMarket(id, true);

        assertEq(pointsRegistry.getPoints(bob), bobPointsBefore + market.WINNER_POINTS());
        assertEq(pointsRegistry.getPoints(carol), carolPointsBefore);
    }

    function test_resolveMarket_noWins_awardsNoVoters() public {
        string memory id = _createDefaultMarket();

        vm.prank(bob);
        market.voteYes(id);

        vm.prank(carol);
        market.voteNo(id);

        uint256 bobPointsBefore = pointsRegistry.getPoints(bob);
        uint256 carolPointsBefore = pointsRegistry.getPoints(carol);

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);

        // No wins => carol gets points, bob does not
        vm.prank(alice);
        market.resolveMarket(id, false);

        assertEq(pointsRegistry.getPoints(bob), bobPointsBefore);
        assertEq(pointsRegistry.getPoints(carol), carolPointsBefore + market.WINNER_POINTS());
    }

    function testRevert_resolveMarket_notActiveAgent() public {
        string memory id = _createDefaultMarket();

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);

        vm.prank(outsider);
        vm.expectRevert(PredictionMarket.NotActiveAgent.selector);
        market.resolveMarket(id, true);
    }

    function testRevert_resolveMarket_notExpired() public {
        string memory id = _createDefaultMarket();

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketNotExpired.selector);
        market.resolveMarket(id, true);
    }

    function testRevert_resolveMarket_alreadyResolved() public {
        string memory id = _createDefaultMarket();

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);

        vm.prank(alice);
        market.resolveMarket(id, true);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.MarketAlreadyResolved.selector);
        market.resolveMarket(id, false);
    }

    // ── Expiry checks ──

    function test_isMarketExpired_false() public {
        string memory id = _createDefaultMarket();
        assertFalse(market.isMarketExpired(id));
    }

    function test_isMarketExpired_true() public {
        string memory id = _createDefaultMarket();

        vm.warp(block.timestamp + market.MARKET_DURATION() + 1);
        assertTrue(market.isMarketExpired(id));
    }

    function test_isMarketExpired_nonexistent() public {
        assertFalse(market.isMarketExpired("nonexistent"));
    }

    // ── Deactivated agent cannot create/resolve ──

    function testRevert_createMarket_deactivatedAgent() public {
        vm.prank(alice);
        agentRegistry.deactivate(1);

        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NotActiveAgent.selector);
        market.createMarket("vid_1", "Question?");
    }

    // ── Recent activities ──

    function test_getRecentActivities() public {
        _createDefaultMarket();

        PredictionMarket.Activity[] memory recent = market.getRecentActivities(10);
        assertEq(recent.length, 1);
    }
}
