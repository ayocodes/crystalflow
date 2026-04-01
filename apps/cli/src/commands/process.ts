import { Command } from "commander";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { VideoProcessor } from "../pipeline/index.js";
import type { SceneData } from "../pipeline/index.js";

function getServerUrl(opts: { server?: string }): string {
  return opts.server ?? process.env.CRYSTALFLOW_SERVER ?? "http://localhost:3001";
}

export const processCommand = new Command("process")
  .description("Claim a job, download video, extract scenes to a directory")
  .requiredOption("--job <id>", "Job ID to process")
  .option("--output <dir>", "Output directory for scene images and manifest", "/tmp/crystalflow-scenes")
  .option("--agent-id <id>", "Agent ID for claiming the job", "cli-agent")
  .option("--server <url>", "Signal server URL")
  .option("--json", "Output manifest JSON to stdout")
  .action(async (opts) => {
    const serverUrl = getServerUrl(opts);
    const jobId = opts.job;
    const agentId = opts.agentId;
    const outDir = opts.output;

    // 1. Claim the job
    console.error(`[process] Claiming job ${jobId.slice(0, 8)}...`);
    const claimResp = await fetch(`${serverUrl}/api/jobs/${jobId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });

    if (!claimResp.ok) {
      const err = (await claimResp.json()) as { error?: string };
      console.error(`Failed to claim job: ${err.error ?? claimResp.statusText}`);
      process.exit(1);
    }

    const job = (await claimResp.json()) as { videoUrl: string; [k: string]: unknown };
    const videoSource = job.videoUrl;
    console.error(`[process] Claimed. Video: ${videoSource}`);

    // Report working status via heartbeat
    await fetch(`${serverUrl}/api/agents/${agentId}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "working", jobId }),
    }).catch(() => {});

    // 2. Download video (reuse logic from agent.ts)
    let videoBuffer: Buffer;
    let filename: string;

    if (videoSource.startsWith("http://") || videoSource.startsWith("https://")) {
      const resp = await fetch(videoSource);
      if (!resp.ok) throw new Error(`Failed to download: ${resp.status}`);
      videoBuffer = Buffer.from(await resp.arrayBuffer());
      filename = videoSource.split("/").pop() || "video";
    } else if (videoSource.includes("/uploads/")) {
      const fname = basename(videoSource);
      const resp = await fetch(`${serverUrl}/api/upload/file/${fname}`);
      if (!resp.ok) throw new Error(`Failed to fetch from server: ${resp.status}`);
      videoBuffer = Buffer.from(await resp.arrayBuffer());
      filename = fname;
    } else {
      videoBuffer = await readFile(videoSource);
      filename = basename(videoSource);
    }

    console.error(`[process] Loaded ${filename} (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`);

    // 3. Process video
    const videoId = createHash("sha256").update(videoBuffer).digest("hex").slice(0, 16);

    const processor = new VideoProcessor({
      onProgress: (p) => {
        if (p.percentage % 20 === 0) {
          process.stderr.write(`\r[process] [${p.percentage}%] ${p.stage}`);
        }
      },
    });

    const scenes = await processor.processVideo(videoBuffer, filename);
    const videoInfo = processor.getVideoInfo();

    console.error(`\n[process] ${scenes.length} scenes detected`);

    // 4. Write scene JPEGs and manifest
    await mkdir(outDir, { recursive: true });

    const manifestScenes = [];
    for (let i = 0; i < scenes.length; i++) {
      const imgName = `scene-${String(i).padStart(3, "0")}.jpg`;
      const imgPath = join(outDir, imgName);
      await writeFile(imgPath, scenes[i].jpegBuffer);
      manifestScenes.push({
        index: i,
        timestamp: scenes[i].timestamp,
        deltaE: scenes[i].deltaE,
        colors: scenes[i].colors,
        imagePath: imgPath,
      });
    }

    const manifest = {
      jobId,
      videoId,
      agentId,
      scenes: manifestScenes,
      videoInfo,
      processedAt: new Date().toISOString(),
    };

    const manifestPath = join(outDir, "manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    console.error(`[process] Wrote ${scenes.length} scenes + manifest to ${outDir}`);

    // Report idle status — processing done, agent can describe scenes now
    await fetch(`${serverUrl}/api/agents/${agentId}/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "idle" }),
    }).catch(() => {});

    if (opts.json) {
      console.log(JSON.stringify(manifest, null, 2));
    } else {
      console.log(manifestPath);
    }
  });
