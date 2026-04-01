import { getPublicClient, getWalletClient } from "./client.js";
import { PREDICTION_MARKET_ADDRESS } from "./config.js";
import { predictionMarketAbi } from "../contracts/generated.js";

export async function createMarket(videoId: string, question: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const hash = await walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "createMarket",
    args: [videoId, question],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { videoId, question, txHash: hash, blockNumber: Number(receipt.blockNumber) };
}

export async function voteYes(marketId: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const hash = await walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
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
    abi: predictionMarketAbi,
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
    abi: predictionMarketAbi,
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
    abi: predictionMarketAbi,
    functionName: "getMarketOdds",
    args: [marketId],
  });
  return { yesPercentage: Number(yesPercentage), noPercentage: Number(noPercentage) };
}

export async function getAllMarketIds() {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "getAllMarketIds",
  });
}

export async function isMarketExpired(marketId: string) {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "isMarketExpired",
    args: [marketId],
  });
}

export async function resolveMarket(marketId: string, winningSide: boolean) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const hash = await walletClient.writeContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "resolveMarket",
    args: [marketId, winningSide],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { marketId, winningSide, txHash: hash, blockNumber: Number(receipt.blockNumber) };
}
