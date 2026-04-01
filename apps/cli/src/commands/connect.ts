import { Command } from "commander";

function getServerUrl(opts: { server?: string }): string {
  return opts.server ?? process.env.CRYSTALFLOW_SERVER ?? "http://localhost:3001";
}

export const connectCommand = new Command("connect")
  .description("Register agent on the network and maintain heartbeat (long-running)")
  .option("--name <name>", "Agent name", "agent")
  .option("--role <role>", "Agent role (scout, sentinel, curator)", "sentinel")
  .option("--server <url>", "Signal server URL")
  .option("--address <addr>", "Agent wallet address", "0x0000000000000000000000000000000000000000")
  .action(async (opts) => {
    const serverUrl = getServerUrl(opts);
    const role = opts.role.toLowerCase();
    const agentId = `${role}-${opts.name}-${Date.now().toString(36)}`;

    // Register via REST
    const resp = await fetch(`${serverUrl}/api/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        name: opts.name,
        role,
        address: opts.address,
      }),
    });

    if (!resp.ok) {
      const err = (await resp.json()) as { error?: string };
      console.error(`Failed to register: ${err.error ?? resp.statusText}`);
      process.exit(1);
    }

    const agent = (await resp.json()) as { agentId: string };
    // Output agentId to stdout so callers can capture it
    console.log(agent.agentId);
    console.error(`[connect] Registered as ${agent.agentId} (${role}) on ${serverUrl}`);
    console.error(`[connect] Sending heartbeat every 20s — Ctrl+C to disconnect`);

    // Heartbeat loop
    const interval = setInterval(async () => {
      try {
        const hb = await fetch(`${serverUrl}/api/agents/${agentId}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!hb.ok) {
          console.error(`[connect] Heartbeat failed: ${hb.status}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[connect] Heartbeat error: ${msg}`);
      }
    }, 20_000);

    // Keep process alive, graceful shutdown
    process.on("SIGINT", () => {
      clearInterval(interval);
      console.error(`\n[connect] Disconnected ${agentId}`);
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      clearInterval(interval);
      process.exit(0);
    });
  });
