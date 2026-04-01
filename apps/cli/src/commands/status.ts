import { Command } from "commander";
import { getAgent, getRecentLog, getSyncConfig, getReputation, getAgentPath, getLogPath } from "../identity/index.js";

export const statusCommand = new Command("status")
  .description("Check agent identity, local logs, and on-chain status")
  .option("--json", "Output as JSON")
  .option("--log [count]", "Show recent log entries (default: 10)")
  .action(async (opts) => {
    try {
      const agent = await getAgent();

      if (!agent) {
        const msg = "No agent registered. Run `crystalflow register` first.";
        if (opts.json) {
          console.log(JSON.stringify({ error: msg }));
        } else {
          console.error(msg);
        }
        process.exit(1);
      }

      const result: Record<string, unknown> = {
        name: agent.name,
        role: agent.role,
        active: agent.active,
        version: agent.version,
        agentJson: getAgentPath(),
        agentLog: getLogPath(),
        registrations: agent.registrations,
        services: agent.services,
      };

      // Check ERC-8004 reputation if synced
      const syncConfig = getSyncConfig();
      if (syncConfig.enabled && agent.registrations.length > 0) {
        const reg = agent.registrations.find((r) => r.chain === syncConfig.chain);
        if (reg) {
          try {
            const rep = await getReputation(reg.agentId, syncConfig);
            result.reputation = rep;
          } catch {
            result.reputation = { error: "Could not fetch reputation" };
          }
        }
      }

      // Recent log entries
      if (opts.log !== undefined) {
        const count = typeof opts.log === "string" ? parseInt(opts.log, 10) : 10;
        const entries = await getRecentLog(count);
        result.recentLog = entries;
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Agent Status`);
        console.log(`  Name:       ${agent.name}`);
        console.log(`  Role:       ${agent.role}`);
        console.log(`  Active:     ${agent.active}`);
        console.log(`  Version:    ${agent.version}`);
        console.log(`  agent.json: ${getAgentPath()}`);
        console.log(`  agent_log:  ${getLogPath()}`);

        if (agent.registrations.length > 0) {
          console.log(`\n  Registrations:`);
          for (const reg of agent.registrations) {
            console.log(`    ${reg.chain}: Agent #${reg.agentId} (${reg.agentRegistry})`);
            if (reg.txHash) console.log(`      tx: ${reg.txHash}`);
          }
        } else {
          console.log(`\n  Registrations: none (set ERC8004_SYNC=true to register on-chain)`);
        }

        if (result.reputation && typeof result.reputation === "object" && !("error" in result.reputation)) {
          const rep = result.reputation as { totalFeedback: number; averageValue: number };
          console.log(`\n  Reputation (${syncConfig.chain}):`);
          console.log(`    Feedback count: ${rep.totalFeedback}`);
          console.log(`    Average score:  ${rep.averageValue}`);
        }

        if (opts.log !== undefined) {
          const entries = result.recentLog as Array<{ action: string; timestamp: string; txHash?: string }>;
          console.log(`\n  Recent Activity (${entries.length} entries):`);
          for (const e of entries) {
            const tx = e.txHash ? ` (${e.txHash.slice(0, 10)}...)` : "";
            console.log(`    ${e.timestamp} | ${e.action}${tx}`);
          }
        }
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
