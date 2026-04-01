import { Command } from "commander";
import { readFile } from "node:fs/promises";

function getServerUrl(opts: { server?: string }): string {
  return opts.server ?? process.env.CRYSTALFLOW_SERVER ?? "http://localhost:3001";
}

export const submitCommand = new Command("submit")
  .description("Submit enriched results (with descriptions) for a processed job")
  .requiredOption("--job <id>", "Job ID")
  .requiredOption("--data <file>", "Path to results JSON file (manifest + descriptions)")
  .option("--agent-id <id>", "Agent ID", "cli-agent")
  .option("--server <url>", "Signal server URL")
  .action(async (opts) => {
    const serverUrl = getServerUrl(opts);

    // Read the results file
    const raw = await readFile(opts.data, "utf-8");
    const results = JSON.parse(raw);

    // Build indexData from the results file
    const indexData = {
      videoId: results.videoId,
      scenes: results.scenes.map((s: any) => ({
        timestamp: s.timestamp,
        deltaE: s.deltaE,
        colors: s.colors,
        description: s.description,
      })),
      videoInfo: results.videoInfo,
      processedAt: results.processedAt,
    };

    const agentId = opts.agentId || results.agentId || "cli-agent";

    console.error(`[submit] Submitting result for job ${opts.job.slice(0, 8)}... (${indexData.scenes.length} scenes)`);

    const resp = await fetch(`${serverUrl}/api/jobs/${opts.job}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, indexData }),
    });

    if (!resp.ok) {
      const err = (await resp.json()) as { error?: string };
      console.error(`Failed to submit: ${err.error ?? resp.statusText}`);
      process.exit(1);
    }

    const updated = (await resp.json()) as { status: string };
    console.error(`[submit] Accepted. Job status: ${updated.status}`);
    console.log(JSON.stringify({ ok: true, jobId: opts.job, status: updated.status }));
  });
