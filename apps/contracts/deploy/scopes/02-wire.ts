import type { PublicClient, WalletClient, Address } from "viem";
import { loadAbi, type ScopeResult } from "../utils.js";

export async function deployWire(
  client: PublicClient,
  walletClient: WalletClient,
  previousScopes: Record<string, ScopeResult>,
  _config: { chain: string; rpc: string; deployer: Address },
): Promise<ScopeResult> {
  console.log("Wiring contracts together...");

  const core = previousScopes.core;
  if (core?.status !== "completed" || !core.contracts) {
    return { status: "failed", error: "Core scope not completed" };
  }

  const { pointsRegistry, videoRegistry, predictionMarket } = core.contracts as Record<string, Address>;

  const abi = loadAbi("out/PointsRegistry.sol/PointsRegistry.json");

  // Wire PointsRegistry: set authorized callers
  // convictionRegistry placeholder = predictionMarket (non-zero required)
  console.log("  Setting PointsRegistry authorized contracts...");
  const hash = await walletClient.writeContract({
    address: pointsRegistry,
    abi,
    functionName: "setContracts",
    args: [videoRegistry, predictionMarket, predictionMarket],
  });
  await client.waitForTransactionReceipt({ hash });
  console.log("  PointsRegistry wired");

  return {
    status: "completed",
    deployedAt: new Date().toISOString(),
    contracts: {},
  };
}
