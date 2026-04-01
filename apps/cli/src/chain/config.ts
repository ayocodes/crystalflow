import { defineChain } from "viem";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Chain definition — defaults to anvil, overridable via env
export const appChain = defineChain({
  id: Number(process.env.CHAIN_ID ?? 31337),
  name: process.env.CHAIN_NAME ?? "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL ?? "http://127.0.0.1:8545"] },
  },
});

// Load addresses from deterministic deploy state file
function loadDeployState(): Record<string, string> {
  const chainName = process.env.DEPLOY_STATE ?? "localhost";
  // Try deploy output relative to contracts dir
  const candidates = [
    resolve(import.meta.dirname, "../../../contracts/deploy/output", `${chainName}.json`),
    resolve(process.cwd(), `../contracts/deploy/output/${chainName}.json`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) {
      const state = JSON.parse(readFileSync(path, "utf-8"));
      const coreContracts = state.scopes?.core?.contracts;
      if (coreContracts) return coreContracts;
    }
  }

  // Fallback to env vars
  return {};
}

const deployed = loadDeployState();

export const AGENT_REGISTRY_ADDRESS = (process.env.AGENT_REGISTRY_ADDRESS ??
  deployed.agentRegistry ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const VIDEO_REGISTRY_ADDRESS = (process.env.VIDEO_REGISTRY_ADDRESS ??
  deployed.videoRegistry ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const PREDICTION_MARKET_ADDRESS = (process.env.PREDICTION_MARKET_ADDRESS ??
  deployed.predictionMarket ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const POINTS_REGISTRY_ADDRESS = (process.env.POINTS_REGISTRY_ADDRESS ??
  deployed.pointsRegistry ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
