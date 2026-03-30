// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PointsRegistry.sol";

contract PointsRegistryTest is Test {
    PointsRegistry public registry;

    address deployer;
    address videoReg = makeAddr("videoRegistry");
    address predMarket = makeAddr("predictionMarket");
    address convReg = makeAddr("convictionRegistry");
    address alice = makeAddr("alice");
    address outsider = makeAddr("outsider");

    function setUp() public {
        deployer = address(this);
        registry = new PointsRegistry();
        registry.setContracts(videoReg, predMarket, convReg);
    }

    // ── setContracts ──

    function test_setContracts() public {
        assertEq(registry.videoRegistry(), videoReg);
        assertEq(registry.predictionMarket(), predMarket);
        assertEq(registry.convictionRegistry(), convReg);
    }

    function test_setContracts_updateable() public {
        address newVideoReg = makeAddr("newVideoReg");
        registry.setContracts(newVideoReg, predMarket, convReg);
        assertEq(registry.videoRegistry(), newVideoReg);
    }

    function testRevert_setContracts_notOwner() public {
        vm.prank(outsider);
        vm.expectRevert(PointsRegistry.Unauthorized.selector);
        registry.setContracts(videoReg, predMarket, convReg);
    }

    function testRevert_setContracts_invalidAddress() public {
        vm.expectRevert(PointsRegistry.InvalidAddress.selector);
        registry.setContracts(address(0), predMarket, convReg);
    }

    // ── awardPoints ──

    function test_awardPoints_fromVideoRegistry() public {
        vm.prank(videoReg);
        registry.awardPoints(alice, 10);

        assertEq(registry.getPoints(alice), 10);
    }

    function test_awardPoints_fromPredictionMarket() public {
        vm.prank(predMarket);
        registry.awardPoints(alice, 5);

        assertEq(registry.getPoints(alice), 5);
    }

    function test_awardPoints_fromConvictionRegistry() public {
        vm.prank(convReg);
        registry.awardPoints(alice, 7);

        assertEq(registry.getPoints(alice), 7);
    }

    function test_awardPoints_accumulates() public {
        vm.prank(videoReg);
        registry.awardPoints(alice, 10);

        vm.prank(predMarket);
        registry.awardPoints(alice, 5);

        assertEq(registry.getPoints(alice), 15);
    }

    function testRevert_awardPoints_unauthorized() public {
        vm.prank(outsider);
        vm.expectRevert(PointsRegistry.Unauthorized.selector);
        registry.awardPoints(alice, 10);
    }

    function testRevert_awardPoints_owner_notAuthorized() public {
        // Even the owner (deployer) cannot call awardPoints directly
        vm.expectRevert(PointsRegistry.Unauthorized.selector);
        registry.awardPoints(alice, 10);
    }

    // ── distributeRewards ──

    function test_distributeRewards() public {
        address bob = makeAddr("bob");

        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100;
        amounts[1] = 200;

        registry.distributeRewards(agents, amounts);

        assertEq(registry.getPoints(alice), 100);
        assertEq(registry.getPoints(bob), 200);
    }

    function testRevert_distributeRewards_notOwner() public {
        address[] memory agents = new address[](1);
        agents[0] = alice;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100;

        vm.prank(outsider);
        vm.expectRevert(PointsRegistry.Unauthorized.selector);
        registry.distributeRewards(agents, amounts);
    }

    function testRevert_distributeRewards_lengthMismatch() public {
        address[] memory agents = new address[](2);
        agents[0] = alice;
        agents[1] = makeAddr("bob");

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100;

        vm.expectRevert(PointsRegistry.LengthMismatch.selector);
        registry.distributeRewards(agents, amounts);
    }

    // ── burnPoints ──

    function test_burnPoints() public {
        registry.burnPoints(500);
        assertEq(registry.getTotalBurned(), 500);

        registry.burnPoints(300);
        assertEq(registry.getTotalBurned(), 800);
    }

    function testRevert_burnPoints_notOwner() public {
        vm.prank(outsider);
        vm.expectRevert(PointsRegistry.Unauthorized.selector);
        registry.burnPoints(100);
    }

    // ── getPoints default ──

    function test_getPoints_defaultZero() public {
        address unknown = makeAddr("unknown");
        assertEq(registry.getPoints(unknown), 0);
    }
}
