import { getPublicClient, getWalletClient } from "./client.js";
import { VIDEO_REGISTRY_ADDRESS } from "./config.js";
import { videoRegistryAbi } from "../contracts/generated.js";

export async function submitIndex(videoId: string, storageCid: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: videoRegistryAbi,
    functionName: "submitIndex",
    args: [videoId, storageCid],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { videoId, storageCid, txHash: hash, blockNumber: Number(receipt.blockNumber) };
}

export async function getVideo(videoId: string) {
  const publicClient = getPublicClient();
  const video = await publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: videoRegistryAbi,
    functionName: "getVideo",
    args: [videoId],
  });

  return {
    id: video.id,
    storageCid: video.storageCid,
    uploader: video.uploader,
    uploadTime: Number(video.uploadTime),
    convictionPeriodEnd: Number(video.convictionPeriodEnd),
    status: video.status,
    convictions: (video.convictions ?? []).map((c: any) => ({
      challenger: c.challenger,
      proofCid: c.proofCid,
      timestamp: Number(c.timestamp),
      status: c.status,
    })),
  };
}

export async function getAllVideoIds() {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: videoRegistryAbi,
    functionName: "getAllVideoIds",
  });
}

export async function submitConviction(videoId: string, proofCid: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: videoRegistryAbi,
    functionName: "submitConviction",
    args: [videoId, proofCid],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { videoId, proofCid, txHash: hash, blockNumber: Number(receipt.blockNumber) };
}

export async function getConviction(videoId: string, index: number) {
  const publicClient = getPublicClient();
  const conviction = await publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: videoRegistryAbi,
    functionName: "getConviction",
    args: [videoId, BigInt(index)],
  });

  return {
    challenger: conviction.challenger,
    proofCid: conviction.proofCid,
    timestamp: Number(conviction.timestamp),
    status: conviction.status,
  };
}

export async function getConvictionCount(videoId: string) {
  const publicClient = getPublicClient();
  const count = await publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: videoRegistryAbi,
    functionName: "getConvictionCount",
    args: [videoId],
  });
  return Number(count);
}

export async function isInConvictionPeriod(videoId: string) {
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: videoRegistryAbi,
    functionName: "isInConvictionPeriod",
    args: [videoId],
  });
}
