import { Command } from "commander";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { VideoProcessor } from "../pipeline/index.js";
import type { SceneData } from "../pipeline/index.js";
import { logAction } from "../identity/index.js";

export const indexCommand = new Command("index")
  .description("Index a video file — detect scenes and extract structured data")
  .requiredOption("--input <path>", "Path to video file")
  .option("--output <dir>", "Directory to save scene JPEGs")
  .option("--json", "Output structured JSON index")
  .option("--submit", "Submit index on-chain after processing")
  .action(async (opts) => {
    try {
      const videoBuffer = await readFile(opts.input);
      const videoId = createHash("sha256").update(videoBuffer).digest("hex").slice(0, 16);
      const filename = basename(opts.input);

      if (!opts.json) {
        console.log(`Processing: ${filename}`);
        console.log(`Video ID:   ${videoId}`);
      }

      let sceneCount = 0;
      const processor = new VideoProcessor({
        onProgress: (p) => {
          if (!opts.json) {
            process.stdout.write(`\r  [${p.percentage}%] ${p.stage}`);
          }
        },
        onSceneDetected: (_scene: SceneData) => {
          sceneCount++;
          if (!opts.json) {
            process.stdout.write(`\r  Scene ${sceneCount} detected at ${_scene.timestamp.toFixed(1)}s (deltaE=${_scene.deltaE.toFixed(1)})   \n`);
          }
        },
        onLog: (msg) => {
          if (!opts.json && process.env.DEBUG) {
            console.log(`  [log] ${msg}`);
          }
        },
      });

      const scenes = await processor.processVideo(videoBuffer, filename);
      const videoInfo = processor.getVideoInfo();

      if (!opts.json) {
        console.log(`\nDone! ${scenes.length} scenes detected.`);
      }

      // Save scene JPEGs if output dir specified
      if (opts.output) {
        await mkdir(opts.output, { recursive: true });
        for (let i = 0; i < scenes.length; i++) {
          const scenePath = join(opts.output, `scene-${String(i + 1).padStart(3, "0")}.jpg`);
          await writeFile(scenePath, scenes[i].jpegBuffer);
          if (!opts.json) {
            console.log(`  Saved: ${scenePath}`);
          }
        }
      }

      // Submit on-chain if requested
      if (opts.submit) {
        try {
          const { submitIndex } = await import("../chain/video-registry.js");
          const result = await submitIndex(videoId, `pending-storage-${videoId}`);
          if (!opts.json) {
            console.log(`\nSubmitted on-chain:`);
            console.log(`  Video ID: ${videoId}`);
            console.log(`  Tx:       ${result.txHash}`);
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (opts.json) {
            console.log(JSON.stringify({ error: `Chain submission failed: ${message}` }));
          } else {
            console.error(`Chain submission failed: ${message}`);
          }
          process.exit(1);
        }
      }

      // Log to agent_log.json
      await logAction("index-video", {
        videoId,
        filename,
        scenes: scenes.length,
        codec: videoInfo?.codec,
        width: videoInfo?.width,
        height: videoInfo?.height,
        duration: videoInfo?.duration,
      });

      // JSON output
      if (opts.json) {
        const output = {
          videoId,
          scenes: scenes.map((s) => ({
            timestamp: s.timestamp,
            jpeg: s.jpegBuffer.toString("base64"),
            colors: s.colors,
            deltaE: s.deltaE,
          })),
          videoInfo,
          processedAt: new Date().toISOString(),
        };
        console.log(JSON.stringify(output, null, 2));
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
