import type { PublicClient, WalletClient, Address } from "viem";
import { deployFromArtifact, loadAbi, type ScopeResult } from "../utils.js";

export async function deployCore(
  client: PublicClient,
  walletClient: WalletClient,
  _previousScopes: Record<string, ScopeResult>,
  _config: { chain: string; rpc: string; deployer: Address },
): Promise<ScopeResult> {
  console.log("Deploying core contracts...");

  // 1. PointsRegistry (constructor: address _owner)
  const pointsRegistry = await deployFromArtifact(
    walletClient, client,
    "out/PointsRegistry.sol/PointsRegistry.json",
    [_config.deployer],
    "crystalflow-points-registry",
  );

  // 2. AgentRegistry (no constructor args)
  const agentRegistry = await deployFromArtifact(
    walletClient, client,
    "out/AgentRegistry.sol/AgentRegistry.json",
    [],
    "crystalflow-agent-registry",
  );

  // 3. VideoRegistry (constructor: address _pointsRegistry)
  const videoRegistry = await deployFromArtifact(
    walletClient, client,
    "out/VideoRegistry.sol/VideoRegistry.json",
    [pointsRegistry],
    "crystalflow-video-registry",
  );

  // 4. PredictionMarket (constructor: address _pointsRegistry, address _agentRegistry)
  const predictionMarket = await deployFromArtifact(
    walletClient, client,
    "out/PredictionMarket.sol/PredictionMarket.json",
    [pointsRegistry, agentRegistry],
    "crystalflow-prediction-market",
  );

  return {
    status: "completed",
    deployedAt: new Date().toISOString(),
    contracts: {
      pointsRegistry,
      agentRegistry,
      videoRegistry,
      predictionMarket,
    },
  };
}
