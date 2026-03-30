import { Command } from "commander";
import { getStatus } from "../chain/index.js";

export const statusCommand = new Command("status")
  .description("Check the current agent's on-chain identity and status")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    try {
      const agent = await getStatus();

      if (opts.json) {
        console.log(JSON.stringify(agent, null, 2));
      } else {
        console.log(`Agent Status`);
        console.log(`  Agent ID:      ${agent.agentId}`);
        console.log(`  Role:          ${agent.role}`);
        console.log(`  Name:          ${agent.name}`);
        console.log(`  Address:       ${agent.address}`);
        console.log(`  URI:           ${agent.agentURI || "(none)"}`);
        console.log(`  Active:        ${agent.active}`);
        console.log(`  Registered At: ${new Date(agent.registeredAt * 1000).toISOString()}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("AgentNotFound")) {
        const msg = "No agent registered for this wallet.";
        if (opts.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }
      if (opts.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }
  });
