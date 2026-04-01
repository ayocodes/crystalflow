/**
 * Identity module types — local-first agent identity with optional on-chain sync
 */

// ERC-8004 registration file format
export interface AgentManifest {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
  name: string;
  description: string;
  image?: string;
  services: AgentService[];
  active: boolean;
  registrations: AgentRegistration[];
  supportedTrust: string[];
  // CrystalFlow-specific
  role: "scout" | "sentinel" | "curator";
  version: string;
}

export interface AgentService {
  name: string;
  endpoint: string;
  version?: string;
}

export interface AgentRegistration {
  agentId: number;
  agentRegistry: string; // e.g. "eip155:84532:0x8004..."
  chain: string;         // e.g. "base-sepolia"
  txHash?: string;
}

// Append-only log entry
export interface LogEntry {
  id: string;           // unique entry id (timestamp-based)
  action: string;       // e.g. "register", "index-video", "store", "validate"
  timestamp: string;    // ISO 8601
  data: Record<string, unknown>; // action-specific payload
  chain?: string;       // which chain (if on-chain action)
  txHash?: string;      // transaction hash (if on-chain action)
}

// Sync configuration
export interface SyncConfig {
  enabled: boolean;
  chain: string;                    // e.g. "base-sepolia"
  rpcUrl: string;
  identityRegistryAddress: string;  // ERC-8004 IdentityRegistry
  reputationRegistryAddress: string; // ERC-8004 ReputationRegistry
}

// ERC-8004 IdentityRegistry register() return
export interface OnChainRegistration {
  agentId: number;
  txHash: string;
  chain: string;
  registryAddress: string;
}

// Reputation feedback
export interface ReputationFeedback {
  agentId: number;
  value: number;      // score
  decimals: number;
  tag1: string;       // e.g. "videoIndexing"
  tag2: string;       // e.g. "quality"
  endpoint: string;   // which service endpoint
  txHash?: string;
}
