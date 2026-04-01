import { Command } from "commander";

function getServerUrl(opts: { server?: string }): string {
  return opts.server ?? process.env.CRYSTALFLOW_SERVER ?? "http://localhost:3001";
}

export const jobsCommand = new Command("jobs")
  .description("List jobs from the network")
  .option("--server <url>", "Signal server URL")
  .option("--status <status>", "Filter by status (pending, assigned, completed, all)", "pending")
  .option("--json", "Output raw JSON")
  .action(async (opts) => {
    const serverUrl = getServerUrl(opts);
    const status = opts.status?.toLowerCase();

    // Fetch jobs — use /pending shortcut or get all
    const endpoint = status === "pending"
      ? `${serverUrl}/api/jobs/pending`
      : `${serverUrl}/api/jobs`;

    const resp = await fetch(endpoint);
    if (!resp.ok) {
      console.error(`Failed to fetch jobs: ${resp.statusText}`);
      process.exit(1);
    }

    let jobs = (await resp.json()) as any[];

    // Client-side filter if not "all" and not using the /pending endpoint
    if (status !== "all" && status !== "pending") {
      jobs = jobs.filter((j: any) => j.status === status);
    }

    if (opts.json) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }

    if (jobs.length === 0) {
      console.log(`No ${status === "all" ? "" : status + " "}jobs found.`);
      return;
    }

    // Table output
    console.log(`${"ID".padEnd(12)} ${"STATUS".padEnd(12)} ${"VIDEO".padEnd(30)} ${"ASSIGNED".padEnd(8)} SUBMITTED`);
    console.log("-".repeat(80));
    for (const job of jobs) {
      const id = job.id.slice(0, 10) + "..";
      const video = (job.videoUrl?.split("/").pop() || job.videoUrl || "").slice(0, 28);
      const assigned = String(job.assignedTo?.length ?? 0);
      const submitted = new Date(job.submittedAt).toLocaleString();
      console.log(`${id.padEnd(12)} ${job.status.padEnd(12)} ${video.padEnd(30)} ${assigned.padEnd(8)} ${submitted}`);
    }
  });
