export { anvil, AGENT_REGISTRY_ADDRESS, VIDEO_REGISTRY_ADDRESS } from "./config.js";
export { getAccount, getPublicClient, getWalletClient } from "./client.js";
export { registerAgent, getAgent, getStatus } from "./agent-registry.js";
export type { RoleName } from "./agent-registry.js";
export { submitIndex, getVideo, getAllVideoIds } from "./video-registry.js";
