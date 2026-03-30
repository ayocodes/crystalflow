import { Command } from "commander";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".webm",
  ".avi",
  ".mov",
  ".flv",
  ".wmv",
  ".m4v",
  ".ts",
]);

function getServerUrl(opts: { server?: string }): string {
  return opts.server || process.env.VIDGRID_SERVER || "http://localhost:3001";
}

async function submitJob(
  serverUrl: string,
  videoUrl: string,
  submittedBy: string
): Promise<{ id: string; videoUrl: string; status: string }> {
  const res = await fetch(`${serverUrl}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoUrl, submittedBy }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Server responded ${res.status}: ${text}`);
  }

  return res.json() as Promise<{ id: string; videoUrl: string; status: string }>;
}

export const discoverCommand = new Command("discover")
  .description("Discover video sources and submit to the job queue (Scout)")
  .option("--source <url_or_path>", "Video URL or local file path")
  .option("--dir <directory>", "Directory to scan for video files")
  .option("--pattern <glob>", "File extension filter for --dir", "*.mp4")
  .option("--server <url>", "Signal server URL")
  .option("--agent-id <id>", "Agent ID for job attribution")
  .option("--json", "Output structured JSON")
  .action(async (opts) => {
    try {
      if (!opts.source && !opts.dir) {
        throw new Error("Provide --source <url_or_path> or --dir <directory>");
      }

      const serverUrl = getServerUrl(opts);
      const agentId = opts.agentId || process.env.VIDGRID_AGENT_ID || "scout";

      if (opts.source) {
        await discoverSingle(serverUrl, opts.source, agentId, opts.json);
      } else if (opts.dir) {
        await discoverBatch(serverUrl, opts.dir, opts.pattern, agentId, opts.json);
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

async function discoverSingle(
  serverUrl: string,
  source: string,
  agentId: string,
  json?: boolean
): Promise<void> {
  // Validate source — URL or existing file
  const isUrl = /^https?:\/\//i.test(source);
  if (!isUrl && !existsSync(source)) {
    throw new Error(`Source not found: ${source}`);
  }

  if (!json) {
    console.log(`Submitting: ${source}`);
  }

  const job = await submitJob(serverUrl, source, agentId);

  if (json) {
    console.log(
      JSON.stringify(
        { jobId: job.id, videoUrl: job.videoUrl, status: job.status },
        null,
        2
      )
    );
  } else {
    console.log(`Job created: ${job.id}`);
    console.log(`  Video:  ${job.videoUrl}`);
    console.log(`  Status: ${job.status}`);
  }
}

async function discoverBatch(
  serverUrl: string,
  dir: string,
  pattern: string,
  agentId: string,
  json?: boolean
): Promise<void> {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`Directory not found: ${dir}`);
  }

  // Extract extension from pattern like "*.mp4" or "*.{mp4,mkv}"
  const extensions = parsePatternExtensions(pattern);

  const files = readdirSync(dir)
    .filter((f) => {
      const ext = f.substring(f.lastIndexOf(".")).toLowerCase();
      return extensions.has(ext);
    })
    .map((f) => join(dir, f))
    .sort();

  if (files.length === 0) {
    throw new Error(`No video files matching "${pattern}" in ${dir}`);
  }

  if (!json) {
    console.log(`Found ${files.length} video(s) in ${dir}`);
  }

  const results: Array<{ jobId: string; videoUrl: string; status: string }> = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    try {
      const job = await submitJob(serverUrl, file, agentId);
      results.push({ jobId: job.id, videoUrl: job.videoUrl, status: job.status });
      if (!json) {
        console.log(`  ✓ ${file} → ${job.id}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ file, error: message });
      if (!json) {
        console.log(`  ✗ ${file}: ${message}`);
      }
    }
  }

  if (json) {
    console.log(JSON.stringify({ discovered: results, errors }, null, 2));
  } else {
    console.log(
      `\nDone: ${results.length} submitted, ${errors.length} failed`
    );
  }
}

function parsePatternExtensions(pattern: string): Set<string> {
  // Handle "*.mp4", "*.{mp4,mkv,webm}", or just use defaults
  const braceMatch = pattern.match(/\*\.\{(.+)\}/);
  if (braceMatch) {
    return new Set(braceMatch[1].split(",").map((e) => `.${e.trim().toLowerCase()}`));
  }
  const simpleMatch = pattern.match(/\*\.(\w+)/);
  if (simpleMatch) {
    return new Set([`.${simpleMatch[1].toLowerCase()}`]);
  }
  // Fallback: all known video extensions
  return VIDEO_EXTENSIONS;
}
