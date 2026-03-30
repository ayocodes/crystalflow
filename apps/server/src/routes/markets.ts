import { Router, Request, Response } from 'express';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const router = Router();

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const PREDICTION_MARKET_ADDRESS = (process.env.PREDICTION_MARKET_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

const abi = parseAbi([
  'function getAllMarketIds() view returns (string[])',
  'function getMarket(string marketId) view returns ((string id, string videoId, string question, address creator, uint256 createdAt, uint256 expiresAt, uint256 yesVotes, uint256 noVotes, bool resolved, bool winningSide, uint8 status))',
  'function getMarketOdds(string marketId) view returns (uint256 yesPercentage, uint256 noPercentage)',
  'function getMarketCount() view returns (uint256)',
  'function getRecentActivities(uint256 count) view returns ((uint8 activityType, address user, string marketId, bool isYes, uint256 timestamp)[])',
  'function voteYes(string marketId)',
  'function voteNo(string marketId)',
]);

function getPublicClient() {
  return createPublicClient({ chain: foundry, transport: http(RPC_URL) });
}

function getWalletClient() {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set');
  return createWalletClient({
    chain: foundry,
    transport: http(RPC_URL),
    account: privateKeyToAccount(PRIVATE_KEY),
  });
}

const STATUS_MAP = ['Active', 'Closed', 'Resolved'] as const;

/**
 * GET /api/markets — list all markets
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const client = getPublicClient();

    const marketIds = await client.readContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi,
      functionName: 'getAllMarketIds',
    });

    const markets = await Promise.all(
      marketIds.map(async (id) => {
        const m = await client.readContract({
          address: PREDICTION_MARKET_ADDRESS,
          abi,
          functionName: 'getMarket',
          args: [id],
        });

        const [yesPercentage, noPercentage] = await client.readContract({
          address: PREDICTION_MARKET_ADDRESS,
          abi,
          functionName: 'getMarketOdds',
          args: [id],
        });

        return {
          id: m.id,
          videoId: m.videoId,
          question: m.question,
          creator: m.creator,
          createdAt: Number(m.createdAt),
          expiresAt: Number(m.expiresAt),
          yesVotes: Number(m.yesVotes),
          noVotes: Number(m.noVotes),
          resolved: m.resolved,
          winningSide: m.winningSide,
          status: STATUS_MAP[m.status],
          odds: { yesPercentage: Number(yesPercentage), noPercentage: Number(noPercentage) },
        };
      })
    );

    res.json({ markets });
  } catch (err) {
    console.error('[markets] GET / error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * GET /api/markets/:marketId — market details with odds
 */
router.get('/:marketId', async (req: Request, res: Response) => {
  try {
    const client = getPublicClient();
    const { marketId } = req.params;

    const m = await client.readContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi,
      functionName: 'getMarket',
      args: [marketId],
    });

    const [yesPercentage, noPercentage] = await client.readContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi,
      functionName: 'getMarketOdds',
      args: [marketId],
    });

    res.json({
      id: m.id,
      videoId: m.videoId,
      question: m.question,
      creator: m.creator,
      createdAt: Number(m.createdAt),
      expiresAt: Number(m.expiresAt),
      yesVotes: Number(m.yesVotes),
      noVotes: Number(m.noVotes),
      resolved: m.resolved,
      winningSide: m.winningSide,
      status: STATUS_MAP[m.status],
      odds: { yesPercentage: Number(yesPercentage), noPercentage: Number(noPercentage) },
    });
  } catch (err) {
    console.error('[markets] GET /:marketId error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

/**
 * POST /api/markets/:marketId/vote — { side: "yes" | "no" }
 */
router.post('/:marketId/vote', async (req: Request, res: Response) => {
  try {
    const wallet = getWalletClient();
    const client = getPublicClient();
    const { marketId } = req.params;
    const { side } = req.body as { side: 'yes' | 'no' };

    if (side !== 'yes' && side !== 'no') {
      res.status(400).json({ error: 'side must be "yes" or "no"' });
      return;
    }

    const hash = await wallet.writeContract({
      address: PREDICTION_MARKET_ADDRESS,
      abi,
      functionName: side === 'yes' ? 'voteYes' : 'voteNo',
      args: [marketId],
    });

    const receipt = await client.waitForTransactionReceipt({ hash });

    res.json({
      success: true,
      marketId,
      side,
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
    });
  } catch (err) {
    console.error('[markets] POST /:marketId/vote error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default router;
