import { Command } from "commander";
import { registerAgent, type RoleName } from "../chain/index.js";

const VALID_ROLES = ["scout", "sentinel", "curator"] as const;

export const registerCommand = new Command("register")
  .description("Register a new agent on-chain with a role and identity")
  .requiredOption("--role <role>", "Agent role (scout, sentinel, curator)")
  .requiredOption("--name <name>", "Agent name")
  .option("--uri <agentURI>", "Agent identity URI (ERC-8004 format)", "")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const roleLower = opts.role.toLowerCase();
    if (!VALID_ROLES.includes(roleLower as (typeof VALID_ROLES)[number])) {
      console.error(`Error: Invalid role "${opts.role}". Must be one of: ${VALID_ROLES.join(", ")}`);
      process.exit(1);
    }

    const role = (roleLower.charAt(0).toUpperCase() + roleLower.slice(1)) as RoleName;

    try {
      const result = await registerAgent(role, opts.name, opts.uri);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Agent registered successfully!`);
        console.log(`  Agent ID: ${result.agentId}`);
        console.log(`  Role:     ${result.role}`);
        console.log(`  Name:     ${result.name}`);
        console.log(`  Address:  ${result.address}`);
        console.log(`  URI:      ${result.agentURI || "(none)"}`);
        console.log(`  Tx:       ${result.txHash}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("AlreadyRegistered")) {
        const msg = "Error: This wallet already has a registered agent. One agent per address.";
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
