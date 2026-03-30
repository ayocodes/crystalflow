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
  { type: "error", name: "ConvictionPeriodEnded", inputs: [] },
  { type: "error", name: "ConvictionNotFound", inputs: [] },
  {
    type: "function",
    name: "submitConviction",
    inputs: [
      { name: "videoId", type: "string" },
      { name: "proofCid", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getConviction",
    inputs: [
      { name: "videoId", type: "string" },
      { name: "convictionIndex", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "challenger", type: "address" },
          { name: "proofCid", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getConvictionCount",
    inputs: [{ name: "videoId", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isInConvictionPeriod",
    inputs: [{ name: "videoId", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ConvictionSubmitted",
    inputs: [
      { name: "videoId", type: "string", indexed: true },
      { name: "convictionIndex", type: "uint256", indexed: false },
      { name: "challenger", type: "address", indexed: true },
      { name: "proofCid", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
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

export async function submitConviction(videoId: string, proofCid: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: VIDEO_REGISTRY_ABI,
    functionName: "submitConviction",
    args: [videoId, proofCid],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  return {
    videoId,
    proofCid,
    txHash: hash,
    blockNumber: Number(receipt.blockNumber),
  };
}

export async function getConviction(videoId: string, index: number) {
  const publicClient = getPublicClient();

  const conviction = await publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: VIDEO_REGISTRY_ABI,
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
    abi: VIDEO_REGISTRY_ABI,
    functionName: "getConvictionCount",
    args: [videoId],
  });

  return Number(count);
}

export async function isInConvictionPeriod(videoId: string) {
  const publicClient = getPublicClient();

  return publicClient.readContract({
    address: VIDEO_REGISTRY_ADDRESS,
    abi: VIDEO_REGISTRY_ABI,
    functionName: "isInConvictionPeriod",
    args: [videoId],
  });
}
