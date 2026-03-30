// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/PointsRegistry.sol";
import "../src/VideoRegistry.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AgentRegistry agentRegistry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(agentRegistry));

        PointsRegistry pointsRegistry = new PointsRegistry();
        console.log("PointsRegistry deployed at:", address(pointsRegistry));

        VideoRegistry videoRegistry = new VideoRegistry(address(pointsRegistry));
        console.log("VideoRegistry deployed at:", address(videoRegistry));

        pointsRegistry.setContracts(address(videoRegistry), address(0), address(0));
        console.log("PointsRegistry configured with VideoRegistry");

        vm.stopBroadcast();
    }
}
