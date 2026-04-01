/**
 * Identity module — public API
 *
 * Local-first: always writes agent.json + agent_log.json to ~/.crystalflow/
 * Optional on-chain sync: when ERC8004_SYNC=true, also registers on real ERC-8004 registries
 *
 * Usage:
 *   import { identity } from './identity/index.js'
 *   await identity.register("sentinel", "Agent-1")
 *   await identity.log("index-video", { videoId: "abc", scenes: 12 })
 *   await identity.log("store", { cid: "bafy..." }, "filecoin-calibration", "0x...")
 */

export { createAgent, getAgent, addRegistration, deactivateAgent, getAgentPath, getCrystalflowDir } from "./agent.js";
export { logAction, getLog, getLogByAction, getRecentLog, getLogPath } from "./log.js";
export { syncRegister, syncReputation, getReputation, getSyncConfig, DEFAULT_SYNC_CONFIG } from "./sync.js";
export type {
  AgentManifest,
  AgentService,
  AgentRegistration,
  LogEntry,
  SyncConfig,
  OnChainRegistration,
  ReputationFeedback,
} from "./types.js";
