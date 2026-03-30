import { getPublicClient, getWalletClient } from "./client.js";
import { PREDICTION_MARKET_ADDRESS } from "./config.js";

const PREDICTION_MARKET_ABI = [
  {
    type: "function",
    name: "createMarket",
    inputs: [
      { name: "videoId", type: "string" },
      { name: "question", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "voteYes",
    inputs: [{ name: "marketId", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "voteNo",
    inputs: [{ name: "marketId", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "resolveMarket",
    inputs: [
      { name: "marketId", type: "string" },
      { name: "winningSide", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "closeMarket",
    inputs: [{ name: "marketId", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getMarket",
    inputs: [{ name: "marketId", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "string" },
          { name: "videoId", type: "string" },
          { name: "question", type: "string" },
          { name: "creator", type: "address" },
          { name: "createdAt", type: "uint256" },
          { name: "expiresAt", type: "uint256" },
          { name: "yesVotes", type: "uint256" },
          { name: "noVotes", type: "uint256" },
          { name: "resolved", type: "bool" },
          { name: "winningSide", type: "bool" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMarketOdds",
    inputs: [{ name: "marketId", type: "string" }],
    outputs: [
      { name: "yesPercentage", type: "uint256" },
      { name: "noPercentage", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllMarketIds",
    inputs: [],
    outputs: [{ name: "", type: "string[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getMarketCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isMarketExpired",
    inputs: [{ name: "marketId", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPosition",
    inputs: [
      { name: "marketId", type: "string" },
      { name: "user", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "yesVotes", type: "uint256" },
          { name: "noVotes", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRecentActivities",
    inputs: [{ name: "count", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "activityType", type: "uint8" },
          { name: "user", type: "address" },
          { name: "marketId", type: "string" },
          { name: "isYes", type: "bool" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId", type: "string", indexed: true },
      { name: "videoId", type: "string", indexed: true },
      { name: "question", type: "string", indexed: false },
      { name: "creator", type: "address", indexed: true },
      { name: "expiresAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "marketId", type: "string", indexed: true },
      { name: "voter", type: "address", indexed: true },
      { name: "isYes", type: "bool", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MarketResolved",
    inputs: [
      { name: "marketId", type: "string", indexed: true },
      { name: "winningSide", type: "bool", indexed: false },
      { name: "yesVotes", type: "uint256", indexed: false },
      { name: "noVotes", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "EmptyVideoId", inputs: [] },
  { type: "error", name: "EmptyQuestion", inputs: [] },
  { type: "error", name: "MarketNotFound", inputs: [] },
  { type: "error", name: "MarketExpired", inputs: [] },
  { type: "error", name: "MarketNotExpired", inputs: [] },
  { type: "error", name: "MarketAlreadyResolved", inputs: [] },
  { type: "error", name: "InvalidVoteAmount", inputs: [] },
  { type: "error", name: "NotActiveAgent", inputs: [] },
] as const;

export async function createMarket(videoId: string, question: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "createMarket",
    args: [videoId, question],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    videoId,
    question,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
  };
}

export async function voteYes(marketId: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "voteYes",
    args: [marketId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return { marketId, side: "yes" as const, txHash: hash, blockNumber: Number(receipt.blockNumber) };
}

export async function voteNo(marketId: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "voteNo",
    args: [marketId],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return { marketId, side: "no" as const, txHash: hash, blockNumber: Number(receipt.blockNumber) };
}

export async function getMarket(marketId: string) {
  const publicClient = getPublicClient();

  const market = await publicClient.readContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarket",
    args: [marketId],
  });

  const statusMap = ["Active", "Closed", "Resolved"] as const;

  return {
    id: market.id,
    videoId: market.videoId,
    question: market.question,
    creator: market.creator,
    createdAt: Number(market.createdAt),
    expiresAt: Number(market.expiresAt),
    yesVotes: Number(market.yesVotes),
    noVotes: Number(market.noVotes),
    resolved: market.resolved,
    winningSide: market.winningSide,
    status: statusMap[market.status],
  };
}

export async function getMarketOdds(marketId: string) {
  const publicClient = getPublicClient();

  const [yesPercentage, noPercentage] = await publicClient.readContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getMarketOdds",
    args: [marketId],
  });

  return {
    yesPercentage: Number(yesPercentage),
    noPercentage: Number(noPercentage),
  };
}

export async function getAllMarketIds() {
  const publicClient = getPublicClient();

  return publicClient.readContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "getAllMarketIds",
  });
}

export async function isMarketExpired(marketId: string) {
  const publicClient = getPublicClient();

  return publicClient.readContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "isMarketExpired",
    args: [marketId],
  });
}

export async function resolveMarket(marketId: string, winningSide: boolean) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: PREDICTION_MARKET_ABI,
    functionName: "resolveMarket",
    args: [marketId, winningSide],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return { marketId, winningSide, txHash: hash, blockNumber: Number(receipt.blockNumber) };
}
