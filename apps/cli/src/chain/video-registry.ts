import { getPublicClient, getWalletClient } from "./client.js";
import { VIDEO_REGISTRY_ADDRESS } from "./config.js";

const VIDEO_REGISTRY_ABI = [
  {
    type: "function",
    name: "submitIndex",
    inputs: [
      { name: "videoId", type: "string" },
      { name: "storageCid", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getVideo",
    inputs: [{ name: "videoId", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "string" },
          { name: "storageCid", type: "string" },
          { name: "uploader", type: "address" },
          { name: "indexer", type: "address" },
          { name: "uploadTime", type: "uint256" },
          { name: "convictionPeriodEnd", type: "uint256" },
          { name: "status", type: "uint8" },
          {
            name: "convictions",
            type: "tuple[]",
            components: [
              { name: "challenger", type: "address" },
              { name: "proofCid", type: "string" },
              { name: "timestamp", type: "uint256" },
              { name: "status", type: "uint8" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllVideoIds",
    inputs: [],
    outputs: [{ name: "", type: "string[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVideoCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "finalizeVideo",
    inputs: [{ name: "videoId", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "VideoIndexed",
    inputs: [
      { name: "videoId", type: "string", indexed: true },
      { name: "uploader", type: "address", indexed: true },
      { name: "indexer", type: "address", indexed: true },
      { name: "storageCid", type: "string", indexed: false },
      { name: "uploadTime", type: "uint256", indexed: false },
      { name: "convictionPeriodEnd", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "VideoAlreadyExists", inputs: [] },
  { type: "error", name: "VideoNotFound", inputs: [] },
  { type: "error", name: "EmptyVideoId", inputs: [] },
  { type: "error", name: "EmptyCid", inputs: [] },
] as const;

export async function submitIndex(videoId: string, storageCid: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: VIDEO_REGISTRY_ABI,
    functionName: "submitIndex",
    args: [videoId, storageCid],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    videoId,
    storageCid,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
  };
}

export async function getVideo(videoId: string) {
  const publicClient = getPublicClient();

  const video = await publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: VIDEO_REGISTRY_ABI,
    functionName: "getVideo",
    args: [videoId],
  });

  return {
    id: video.id,
    storageCid: video.storageCid,
    uploader: video.uploader,
    indexer: video.indexer,
    uploadTime: Number(video.uploadTime),
    convictionPeriodEnd: Number(video.convictionPeriodEnd),
    status: video.status,
    convictions: video.convictions.map((c) => ({
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
    abi: VIDEO_REGISTRY_ABI,
    functionName: "getAllVideoIds",
  });
}
