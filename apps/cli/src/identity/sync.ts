/**
 * ERC-8004 on-chain sync — optional layer that syncs local identity to real registries
 *
 * Supports:
 * - IdentityRegistry: register agent, get agentId, update URI
 * - ReputationRegistry: submit feedback after work completion
 *
 * Chain-agnostic: works with any chain where ERC-8004 is deployed.
 * Default: Base Sepolia (contracts already live there)
 */

import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { OnChainRegistration, ReputationFeedback, SyncConfig } from "./types.js";

// ERC-8004 canonical addresses (same across all deployed chains via CREATE2)
const ERC8004_IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
const ERC8004_REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;

// Minimal ABIs — only the functions we need
const IDENTITY_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "register",
    inputs: [],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setAgentURI",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "agentURI",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

const REPUTATION_REGISTRY_ABI = [
  {
    type: "function",
    name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int256" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "bytes32" },
      { name: "tag2", type: "bytes32" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSummary",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "totalFeedback", type: "uint256" },
      { name: "averageValue", type: "int256" },
      { name: "averageDecimals", type: "uint8" },
    ],
    stateMutability: "view",
  },
] as const;

// Default sync config: Base Sepolia
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  chain: "base-sepolia",
  rpcUrl: "https://sepolia.base.org",
  identityRegistryAddress: ERC8004_IDENTITY_REGISTRY,
  reputationRegistryAddress: ERC8004_REPUTATION_REGISTRY,
};

function getChainDefinition(config: SyncConfig): Chain {
  if (config.chain === "base-sepolia") return baseSepolia;
  // Fallback: custom chain definition
  return {
    id: 84532,
    name: config.chain,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  } as Chain;
}

function getPrivateKey(): `0x${string}` {
  const key = process.env.ERC8004_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!key) throw new Error("PRIVATE_KEY or ERC8004_PRIVATE_KEY env var required for on-chain sync");
  return key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`);
}

export function getSyncConfig(): SyncConfig {
  const enabled = process.env.ERC8004_SYNC === "true" || process.env.ERC8004_SYNC === "1";
  if (!enabled) return { ...DEFAULT_SYNC_CONFIG, enabled: false };

  return {
    enabled: true,
    chain: process.env.ERC8004_CHAIN ?? DEFAULT_SYNC_CONFIG.chain,
    rpcUrl: process.env.ERC8004_RPC_URL ?? DEFAULT_SYNC_CONFIG.rpcUrl,
    identityRegistryAddress: process.env.ERC8004_IDENTITY_ADDRESS ?? DEFAULT_SYNC_CONFIG.identityRegistryAddress,
    reputationRegistryAddress: process.env.ERC8004_REPUTATION_ADDRESS ?? DEFAULT_SYNC_CONFIG.reputationRegistryAddress,
  };
}

/**
 * Register agent on-chain via ERC-8004 IdentityRegistry
 */
export async function syncRegister(agentURI: string, config?: SyncConfig): Promise<OnChainRegistration> {
  const cfg = config ?? getSyncConfig();
  const chain = getChainDefinition(cfg);
  const account = privateKeyToAccount(getPrivateKey());

  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });

  const hash = await walletClient.writeContract({
    address: cfg.identityRegistryAddress as `0x${string}`,
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "register",
    args: [agentURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Parse agentId from Registered event
  let agentId = 0;
  for (const log of receipt.logs) {
    if (log.topics[0] && log.topics[1]) {
      // Registered event: topics[1] = agentId
      agentId = Number(BigInt(log.topics[1]));
      break;
    }
  }

  return {
    agentId,
    txHash: hash,
    chain: cfg.chain,
    registryAddress: cfg.identityRegistryAddress,
  };
}

/**
 * Submit reputation feedback for an agent via ERC-8004 ReputationRegistry
 */
export async function syncReputation(feedback: ReputationFeedback, config?: SyncConfig): Promise<string> {
  const cfg = config ?? getSyncConfig();
  const chain = getChainDefinition(cfg);
  const account = privateKeyToAccount(getPrivateKey());

  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });

  // Convert tags to bytes32
  const tag1 = stringToBytes32(feedback.tag1);
  const tag2 = stringToBytes32(feedback.tag2);

  const hash = await walletClient.writeContract({
    address: cfg.reputationRegistryAddress as `0x${string}`,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "giveFeedback",
    args: [
      BigInt(feedback.agentId),
      BigInt(feedback.value),
      feedback.decimals,
      tag1,
      tag2,
      feedback.endpoint,
      "", // feedbackURI — could point to stored proof
      "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, // feedbackHash
    ],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Get reputation summary for an agent
 */
export async function getReputation(agentId: number, config?: SyncConfig): Promise<{ totalFeedback: number; averageValue: number }> {
  const cfg = config ?? getSyncConfig();
  const chain = getChainDefinition(cfg);
  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });

  const [totalFeedback, averageValue] = await publicClient.readContract({
    address: cfg.reputationRegistryAddress as `0x${string}`,
    abi: REPUTATION_REGISTRY_ABI,
    functionName: "getSummary",
    args: [BigInt(agentId)],
  });

  return {
    totalFeedback: Number(totalFeedback),
    averageValue: Number(averageValue),
  };
}

function stringToBytes32(str: string): `0x${string}` {
  const hex = Buffer.from(str.slice(0, 31)).toString("hex").padEnd(64, "0");
  return `0x${hex}`;
}
