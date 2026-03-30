export { anvil, AGENT_REGISTRY_ADDRESS, VIDEO_REGISTRY_ADDRESS, PREDICTION_MARKET_ADDRESS } from "./config.js";
export { getAccount, getPublicClient, getWalletClient } from "./client.js";
export { registerAgent, getAgent, getStatus } from "./agent-registry.js";
export type { RoleName } from "./agent-registry.js";
export {
  submitIndex,
  getVideo,
  getAllVideoIds,
  submitConviction,
  getConviction,
  getConvictionCount,
  isInConvictionPeriod,
} from "./video-registry.js";
export {
  createMarket,
  voteYes,
  voteNo,
  getMarket,
  getMarketOdds,
  getAllMarketIds,
  isMarketExpired,
  resolveMarket,
} from "./prediction-market.js";
