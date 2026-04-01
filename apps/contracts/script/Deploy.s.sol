// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PointsRegistry.sol";
import "../src/AgentRegistry.sol";
import "../src/VideoRegistry.sol";
import "../src/PredictionMarket.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        // 1. Deploy PointsRegistry first — all other contracts depend on it
        PointsRegistry pointsRegistry = new PointsRegistry(address(this));
        console.log("PointsRegistry deployed at:", address(pointsRegistry));

        // 2. Deploy AgentRegistry (no dependencies)
        AgentRegistry agentRegistry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(agentRegistry));

        // 3. Deploy VideoRegistry (depends on PointsRegistry)
        VideoRegistry videoRegistry = new VideoRegistry(address(pointsRegistry));
        console.log("VideoRegistry deployed at:", address(videoRegistry));

        // 4. Deploy PredictionMarket (depends on PointsRegistry + AgentRegistry)
        PredictionMarket predictionMarket = new PredictionMarket(
            address(pointsRegistry),
            address(agentRegistry)
        );
        console.log("PredictionMarket deployed at:", address(predictionMarket));

        // 5. Wire PointsRegistry with all dependent contract addresses.
        //    No ConvictionRegistry exists yet — use address(predictionMarket) as
        //    a non-zero placeholder to satisfy the InvalidAddress() guard.
        pointsRegistry.setContracts(
            address(videoRegistry),
            address(predictionMarket),
            address(predictionMarket) // convictionRegistry placeholder
        );
        console.log("PointsRegistry.setContracts configured");

        vm.stopBroadcast();

        console.log("---");
        console.log("Deployment summary:");
        console.log("  PointsRegistry  :", address(pointsRegistry));
        console.log("  AgentRegistry   :", address(agentRegistry));
        console.log("  VideoRegistry   :", address(videoRegistry));
        console.log("  PredictionMarket:", address(predictionMarket));
    }
}
