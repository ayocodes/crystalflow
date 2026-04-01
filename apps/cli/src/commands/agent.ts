import { Command } from "commander";
import WebSocket from "ws";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { getAgent, logAction } from "../identity/index.js";
import { VideoProcessor } from "../pipeline/index.js";
import type { SceneData } from "../pipeline/index.js";

interface Job {
  id: string;
  videoUrl: string;
  submittedBy: string;
  submittedAt: number;
  status: string;
  assignedTo: string[];
  results: unknown[];
}

interface WSMessage {
  type: string;
  agentId?: string;
  job?: Job;
  jobId?: string;
  message?: string;
  [key: string]: unknown;
}

function getServerUrl(opts: { server?: string }): string {
  return opts.server ?? process.env.CRYSTALFLOW_SERVER ?? "http://localhost:3001";
}

export const agentCommand = new Command("agent")
  .description("Run as a persistent agent — connect to network, receive and process jobs")
  .requiredOption("--role <role>", "Agent role (scout, sentinel, curator)")
  .requiredOption("--name <name>", "Agent name")
  .option("--server <url>", "Signal server URL")
  .option("--address <addr>", "Agent wallet address", "0x0000000000000000000000000000000000000000")
  .action(async (opts) => {
    const role = opts.role.toLowerCase();
    const serverUrl = getServerUrl(opts);
    const wsUrl = serverUrl.replace(/^http/, "ws");
    const agentId = `${role}-${opts.name}-${Date.now().toString(36)}`;

    console.log(`[${opts.name}] Starting as ${role} agent`);
    console.log(`[${opts.name}] Connecting to ${wsUrl}`);

    await logAction("agent:start", { role, name: opts.name, server: serverUrl });

    let ws: WebSocket;
    let heartbeatInterval: ReturnType<typeof setInterval>;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let processing = false;

    function connect() {
      ws = new WebSocket(wsUrl);

      ws.on("open", () => {
        console.log(`[${opts.name}] Connected to network`);

        // Announce ourselves
        ws.send(JSON.stringify({
          type: "agent:connect",
          agentId,
          role,
          address: opts.address,
          name: opts.name,
        }));

        // Heartbeat every 20s
        heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "agent:heartbeat", agentId }));
          }
        }, 20_000);
      });

      ws.on("message", async (data) => {
        const msg: WSMessage = JSON.parse(data.toString());

        switch (msg.type) {
          case "agent:connected":
            console.log(`[${opts.name}] Registered as ${agentId}`);
            break;

          case "job:assigned":
            if (msg.job && !processing) {
              console.log(`[${opts.name}] Job assigned: ${msg.job.id.slice(0, 8)}... (${msg.job.videoUrl.split("/").pop()})`);
              await handleJob(msg.job, opts.name, agentId, ws);
            }
            break;

          case "job:new":
            if (role === "scout") {
              console.log(`[${opts.name}] New job on network: ${(msg.job as Job).id.slice(0, 8)}...`);
            }
            break;

          case "job:completed":
            console.log(`[${opts.name}] Job ${(msg.jobId as string).slice(0, 8)}... completed`);
            break;

          case "job:consensus":
            console.log(`[${opts.name}] Consensus reached for job ${(msg.jobId as string).slice(0, 8)}...`);
            break;

          case "error":
            console.error(`[${opts.name}] Server error: ${msg.message}`);
            break;
        }
      });

      ws.on("close", (code, reason) => {
        clearInterval(heartbeatInterval);
        console.log(`[${opts.name}] Disconnected (${code}). Reconnecting in 5s...`);
        reconnectTimeout = setTimeout(connect, 5000);
      });

      ws.on("error", (err) => {
        console.error(`[${opts.name}] WS error: ${err.message}`);
      });
    }

    // Graceful shutdown
    process.on("SIGINT", () => {
      console.log(`\n[${opts.name}] Shutting down...`);
      clearInterval(heartbeatInterval);
      clearTimeout(reconnectTimeout);
      ws?.close();
      process.exit(0);
    });

    connect();

    async function handleJob(job: Job, name: string, myAgentId: string, socket: WebSocket) {
      if (role !== "sentinel") {
        console.log(`[${name}] Not a sentinel — skipping index job`);
        return;
      }

      processing = true;
      const videoSource = job.videoUrl;

      try {
        console.log(`[${name}] Loading: ${videoSource}`);

        // Fetch video — could be local path or server URL
        let videoBuffer: Buffer;
        let filename: string;

        if (videoSource.startsWith("http://") || videoSource.startsWith("https://")) {
          // Remote URL — download it
          const resp = await fetch(videoSource);
          if (!resp.ok) throw new Error(`Failed to download: ${resp.status}`);
          videoBuffer = Buffer.from(await resp.arrayBuffer());
          filename = videoSource.split("/").pop() || "video";
        } else if (videoSource.includes("/uploads/")) {
          // Server upload path — fetch via server's file endpoint
          const fname = basename(videoSource);
          const serverUrl = opts.server ?? process.env.CRYSTALFLOW_SERVER ?? "http://localhost:3001";
          const resp = await fetch(`${serverUrl}/api/upload/file/${fname}`);
          if (!resp.ok) throw new Error(`Failed to fetch from server: ${resp.status}`);
          videoBuffer = Buffer.from(await resp.arrayBuffer());
          filename = fname;
        } else {
          // Local file path
          videoBuffer = await readFile(videoSource);
          filename = basename(videoSource);
        }

        console.log(`[${name}] Processing: ${filename} (${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB)`);

        const videoId = createHash("sha256").update(videoBuffer).digest("hex").slice(0, 16);

        let sceneCount = 0;
        const processor = new VideoProcessor({
          onProgress: (p) => {
            if (p.percentage % 20 === 0) {
              process.stdout.write(`\r[${name}] [${p.percentage}%] ${p.stage}`);
            }
          },
          onSceneDetected: () => { sceneCount++; },
        });

        const scenes = await processor.processVideo(videoBuffer, filename);
        const videoInfo = processor.getVideoInfo();

        console.log(`\n[${name}] Done: ${scenes.length} scenes detected`);

        // Save scenes to temp dir
        const outDir = join("/tmp", `crystalflow-${myAgentId}`);
        await mkdir(outDir, { recursive: true });
        for (let i = 0; i < scenes.length; i++) {
          await writeFile(join(outDir, `scene-${i}.jpg`), scenes[i].jpegBuffer);
        }

        // Build index data
        const indexData = {
          videoId,
          scenes: scenes.map((s: SceneData) => ({
            timestamp: s.timestamp,
            deltaE: s.deltaE,
            colors: s.colors,
          })),
          videoInfo,
          processedAt: new Date().toISOString(),
        };

        // Submit result back to server
        socket.send(JSON.stringify({
          type: "job:result",
          jobId: job.id,
          result: {
            agentId: myAgentId,
            submittedAt: Date.now(),
            indexData,
          },
        }));

        console.log(`[${name}] Result submitted for job ${job.id.slice(0, 8)}...`);

        await logAction("agent:indexed", {
          jobId: job.id,
          videoId,
          scenes: scenes.length,
          codec: videoInfo?.codec,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${name}] Failed to process: ${message}`);
        await logAction("agent:error", { jobId: job.id, error: message });
      } finally {
        processing = false;
      }
    }
  });
