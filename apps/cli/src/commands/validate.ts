import { Command } from "commander";
import { createStorage } from "../storage/index.js";
import {
  submitConviction,
  getConvictionCount,
  getConviction,
  getVideo,
  isInConvictionPeriod,
  getAccount,
} from "../chain/index.js";

const CONVICTION_STATUS = ["Active", "Resolved", "Dismissed"] as const;
const VIDEO_STATUS = ["Pending", "Finalized", "Challenged"] as const;

export const validateCommand = new Command("validate")
  .description("Review indexes and submit convictions (Curator)")
  .requiredOption("--video-id <id>", "Video ID to validate or list convictions for")
  .option("--fact <string>", "Fact being challenged (e.g. 'Tags are wrong')")
  .option("--proof <string>", "Evidence supporting the challenge")
  .option("--list", "List all convictions for a video")
  .option("--provider <provider>", "Storage provider: local or filecoin", "local")
  .option("--json", "Output structured JSON")
  .action(async (opts) => {
    try {
      if (opts.list) {
        await listConvictions(opts.videoId, opts.json);
      } else {
        if (!opts.fact || !opts.proof) {
          throw new Error("--fact and --proof are required when submitting a conviction");
        }
        await submitConvictionFlow(opts.videoId, opts.fact, opts.proof, opts.provider, opts.json);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (opts.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }
  });

async function submitConvictionFlow(
  videoId: string,
  fact: string,
  proof: string,
  provider: string,
  json: boolean,
) {
  // Check conviction period is still active
  const inPeriod = await isInConvictionPeriod(videoId);
  if (!inPeriod) {
    throw new Error(`Conviction period has ended for video "${videoId}"`);
  }

  if (!json) console.log(`Submitting conviction for video: ${videoId}`);

  // Build conviction proof payload
  const account = getAccount();
  const convictionPayload = {
    fact,
    proof,
    challenger: account.address,
    timestamp: Date.now(),
  };

  // Store proof via storage provider
  const storage = await createStorage(provider as "local" | "filecoin");
  const proofData = Buffer.from(JSON.stringify(convictionPayload, null, 2));
  const storageResult = await storage.upload(proofData, { type: "conviction", videoId });

  if (!json) console.log(`  Proof stored: ${storageResult.cid} (${storageResult.provider})`);

  // Submit conviction on-chain
  const result = await submitConviction(videoId, storageResult.cid);

  // Get the conviction index from chain
  // NOTE: Assumes the conviction just submitted is at index (count - 1).
  // A more robust approach would parse ConvictionSubmitted event from the tx receipt.
  const count = await getConvictionCount(videoId);
  const convictionIndex = count - 1;

  if (json) {
    console.log(
      JSON.stringify(
        {
          convictionIndex,
          videoId,
          fact,
          proof,
          proofCid: storageResult.cid,
          challenger: account.address,
          txHash: result.txHash,
          blockNumber: result.blockNumber,
          storageProvider: storageResult.provider,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`  Conviction #${convictionIndex} submitted on-chain`);
    console.log(`  TX: ${result.txHash}`);
    console.log(`  Block: ${result.blockNumber}`);
  }
}

async function listConvictions(videoId: string, json: boolean) {
  const video = await getVideo(videoId);
  const count = video.convictions.length;

  if (json) {
    console.log(
      JSON.stringify(
        {
          videoId,
          videoStatus: VIDEO_STATUS[video.status],
          convictionPeriodEnd: video.convictionPeriodEnd,
          convictionCount: count,
          convictions: video.convictions.map((c, i) => ({
            index: i,
            challenger: c.challenger,
            proofCid: c.proofCid,
            timestamp: c.timestamp,
            status: CONVICTION_STATUS[c.status],
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Video: ${videoId}`);
    console.log(`Status: ${VIDEO_STATUS[video.status]}`);
    console.log(`Conviction period ends: ${new Date(video.convictionPeriodEnd * 1000).toISOString()}`);
    console.log(`Convictions: ${count}`);

    if (count === 0) {
      console.log("  (none)");
      return;
    }

    for (let i = 0; i < count; i++) {
      const c = video.convictions[i];
      console.log(`\n  #${i}`);
      console.log(`    Challenger: ${c.challenger}`);
      console.log(`    Proof CID:  ${c.proofCid}`);
      console.log(`    Time:       ${new Date(c.timestamp * 1000).toISOString()}`);
      console.log(`    Status:     ${CONVICTION_STATUS[c.status]}`);
    }
  }
}
