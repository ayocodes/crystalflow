import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

/**
 * Market automation — runs server-side on a 30s interval.
 *
 * 1. checkForNewMarkets(): Find videos past conviction period with convictions → create market
 * 2. checkForResolution(): Find expired unresolved markets → resolve by vote majority
 */

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const VIDEO_REGISTRY_ADDRESS = (process.env.VIDEO_REGISTRY_ADDRESS ?? '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as `0x${string}`;
const PREDICTION_MARKET_ADDRESS = (process.env.PREDICTION_MARKET_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

const POLL_INTERVAL = 30_000; // 30 seconds

// Track which videos already have markets to avoid duplicate creation
const processedVideos = new Set<string>();

const videoRegistryAbi = parseAbi([
  'function getAllVideoIds() view returns (string[])',
  'function getVideo(string videoId) view returns ((string id, string storageCid, address uploader, address indexer, uint256 uploadTime, uint256 convictionPeriodEnd, uint8 status, (address challenger, string proofCid, uint256 timestamp, uint8 status)[] convictions))',
  'function isInConvictionPeriod(string videoId) view returns (bool)',
  'function getConvictionCount(string videoId) view returns (uint256)',
]);

const predictionMarketAbi = parseAbi([
  'function createMarket(string videoId, string question) returns (string)',
  'function resolveMarket(string marketId, bool winningSide)',
  'function getAllMarketIds() view returns (string[])',
  'function getMarket(string marketId) view returns ((string id, string videoId, string question, address creator, uint256 createdAt, uint256 expiresAt, uint256 yesVotes, uint256 noVotes, bool resolved, bool winningSide, uint8 status))',
  'function isMarketExpired(string marketId) view returns (bool)',
]);

function getClients() {
  const transport = http(RPC_URL);

  const publicClient = createPublicClient({
    chain: foundry,
    transport,
  });

  if (!PRIVATE_KEY) {
    return { publicClient, walletClient: null };
  }

  const account = privateKeyToAccount(PRIVATE_KEY);
  const walletClient = createWalletClient({
    chain: foundry,
    transport,
    account,
  });

  return { publicClient, walletClient };
}

async function checkForNewMarkets() {
  const { publicClient, walletClient } = getClients();
  if (!walletClient) return 0;
  if (PREDICTION_MARKET_ADDRESS === '0x0000000000000000000000000000000000000000') return 0;

  let created = 0;

  try {
    const videoIds = await publicClient.readContract({
      address: VIDEO_REGISTRY_ADDRESS,
      abi: videoRegistryAbi,
      functionName: 'getAllVideoIds',
    });

    for (const videoId of videoIds) {
      if (processedVideos.has(videoId)) continue;

      try {
        // Check if conviction period has ended
        const inConvictionPeriod = await publicClient.readContract({
          address: VIDEO_REGISTRY_ADDRESS,
          abi: videoRegistryAbi,
          functionName: 'isInConvictionPeriod',
          args: [videoId],
        });

        if (inConvictionPeriod) continue;

        // Check if video has convictions
        const convictionCount = await publicClient.readContract({
          address: VIDEO_REGISTRY_ADDRESS,
          abi: videoRegistryAbi,
          functionName: 'getConvictionCount',
          args: [videoId],
        });

        if (Number(convictionCount) === 0) {
          processedVideos.add(videoId); // No convictions, skip permanently
          continue;
        }

        // Create one market per video
        const question = `Are the convictions for video "${videoId}" valid?`;

        const hash = await walletClient.writeContract({
          address: PREDICTION_MARKET_ADDRESS,
          abi: predictionMarketAbi,
          functionName: 'createMarket',
          args: [videoId, question],
        });

        await publicClient.waitForTransactionReceipt({ hash });

        processedVideos.add(videoId);
        created++;
        console.log(`[markets] Created market for video ${videoId}`);
      } catch (err) {
        console.error(`[markets] Failed to process video ${videoId}:`, err);
      }
    }
  } catch (err) {
    console.error('[markets] Error checking for new markets:', err);
  }

  return created;
}

async function checkForResolution() {
  const { publicClient, walletClient } = getClients();
  if (!walletClient) return 0;
  if (PREDICTION_MARKET_ADDRESS === '0x0000000000000000000000000000000000000000') return 0;

  let resolved = 0;

  try {
    const marketIds = await publicClient.readContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi: predictionMarketAbi,
      functionName: 'getAllMarketIds',
    });

    for (const marketId of marketIds) {
      try {
        const market = await publicClient.readContract({
          address: PREDICTION_MARKET_ADDRESS,
          abi: predictionMarketAbi,
          functionName: 'getMarket',
          args: [marketId],
        });

        // Skip already resolved
        if (market.resolved) continue;

        // Check if expired
        const expired = await publicClient.readContract({
          address: PREDICTION_MARKET_ADDRESS,
          abi: predictionMarketAbi,
          functionName: 'isMarketExpired',
          args: [marketId],
        });

        if (!expired) continue;

        // Resolve by simple vote majority
        const winningSide = market.yesVotes >= market.noVotes;

        const hash = await walletClient.writeContract({
          address: PREDICTION_MARKET_ADDRESS,
          abi: predictionMarketAbi,
          functionName: 'resolveMarket',
          args: [marketId, winningSide],
        });

        await publicClient.waitForTransactionReceipt({ hash });

        resolved++;
        console.log(`[markets] Resolved ${marketId} → ${winningSide ? 'YES' : 'NO'} (${market.yesVotes}/${market.noVotes})`);
      } catch (err) {
        console.error(`[markets] Failed to resolve ${marketId}:`, err);
      }
    }
  } catch (err) {
    console.error('[markets] Error checking for resolution:', err);
  }

  return resolved;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startMarketLoop() {
  if (intervalHandle) return;

  console.log(`[markets] Starting market automation loop (every ${POLL_INTERVAL / 1000}s)`);

  const tick = async () => {
    const created = await checkForNewMarkets();
    const resolved = await checkForResolution();

    if (created > 0 || resolved > 0) {
      console.log(`[markets] Tick: ${created} created, ${resolved} resolved`);
    }
  };

  // Run once immediately, then on interval
  tick();
  intervalHandle = setInterval(tick, POLL_INTERVAL);
}

export function stopMarketLoop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[markets] Market automation stopped');
  }
}
