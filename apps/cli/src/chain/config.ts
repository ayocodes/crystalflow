import { defineChain } from "viem";

export const anvil = defineChain({
  id: 31337,
  name: "Anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.RPC_URL ?? "http://127.0.0.1:8545"] },
  },
});

export const AGENT_REGISTRY_ADDRESS = (process.env.AGENT_REGISTRY_ADDRESS ??
  "0x5FbDB2315678afecb367f032d93F642f64180aa3") as `0x${string}`;

export const VIDEO_REGISTRY_ADDRESS = (process.env.VIDEO_REGISTRY_ADDRESS ??
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512") as `0x${string}`;

export const PREDICTION_MARKET_ADDRESS = (process.env.PREDICTION_MARKET_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
