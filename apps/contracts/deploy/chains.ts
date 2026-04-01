export const defaultChains = [
  { name: "localhost", rpc: "http://127.0.0.1:8545" },
  {
    name: "filecoin-calibration",
    rpc: "https://api.calibration.node.glif.io/rpc/v1",
    chainId: 314159,
    currency: "tFIL",
    explorer: "https://calibration.filfox.info",
  },
  {
    name: "base-sepolia",
    rpc: "https://sepolia.base.org",
    chainId: 84532,
    currency: "ETH",
    explorer: "https://sepolia.basescan.org",
  },
] as const satisfies readonly { name: string; rpc: string; chainId?: number; currency?: string; explorer?: string }[];
