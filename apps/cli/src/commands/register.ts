import { Command } from "commander";
import { createAgent, addRegistration, logAction, getSyncConfig, syncRegister, getAgentPath } from "../identity/index.js";
import { registerAgent, type RoleName } from "../chain/index.js";

const VALID_ROLES = ["scout", "sentinel", "curator"] as const;

export const registerCommand = new Command("register")
  .description("Register a new agent with identity (local + optional on-chain)")
  .requiredOption("--role <role>", "Agent role (scout, sentinel, curator)")
  .requiredOption("--name <name>", "Agent name")
  .option("--description <desc>", "Agent description")
  .option("--local-only", "Skip all on-chain registration (local agent.json only)")
  .option("--json", "Output as JSON")
  .action(async (opts) => {
    const roleLower = opts.role.toLowerCase();
    if (!VALID_ROLES.includes(roleLower as (typeof VALID_ROLES)[number])) {
      console.error(`Error: Invalid role "${opts.role}". Must be one of: ${VALID_ROLES.join(", ")}`);
      process.exit(1);
    }

    const role = roleLower as "scout" | "sentinel" | "curator";
    const roleCap = (role.charAt(0).toUpperCase() + role.slice(1)) as RoleName;

    try {
      // Step 1: Always create local agent.json
      const manifest = await createAgent(opts.name, role, opts.description);
      const agentJsonPath = getAgentPath();

      // Log locally
      await logAction("register", { name: opts.name, role, agentJsonPath });

      const result: Record<string, unknown> = {
        name: opts.name,
        role,
        agentJson: agentJsonPath,
        local: true,
      };

      if (opts.localOnly) {
        // Done — local only
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Agent registered locally!`);
          console.log(`  Name:       ${opts.name}`);
          console.log(`  Role:       ${role}`);
          console.log(`  agent.json: ${agentJsonPath}`);
        }
        return;
      }

      // Step 2: Register on CrystalFlow contracts (anvil / app chain)
      try {
        const chainResult = await registerAgent(roleCap, opts.name, "");
        result.crystalflow = {
          agentId: chainResult.agentId,
          txHash: chainResult.txHash,
          address: chainResult.address,
        };

        await logAction("register:crystalflow", {
          agentId: chainResult.agentId,
          address: chainResult.address,
        }, "anvil", chainResult.txHash);

        if (!opts.json) {
          console.log(`  CrystalFlow:    Agent #${chainResult.agentId} (${chainResult.txHash})`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Non-fatal — CrystalFlow chain might not be running
        result.crystalflowError = msg;
        if (!opts.json) {
          console.log(`  CrystalFlow:    skipped (${msg.includes("AlreadyRegistered") ? "already registered" : "chain unavailable"})`);
        }
      }

      // Step 3: Sync to ERC-8004 on Base Sepolia (if enabled)
      const syncConfig = getSyncConfig();
      if (syncConfig.enabled) {
        try {
          const agentURI = JSON.stringify(manifest);
          const onChainReg = await syncRegister(agentURI, syncConfig);

          await addRegistration({
            agentId: onChainReg.agentId,
            agentRegistry: `eip155:84532:${syncConfig.identityRegistryAddress}`,
            chain: syncConfig.chain,
            txHash: onChainReg.txHash,
          });

          await logAction("register:erc8004", {
            agentId: onChainReg.agentId,
            chain: syncConfig.chain,
            registryAddress: syncConfig.identityRegistryAddress,
          }, syncConfig.chain, onChainReg.txHash);

          result.erc8004 = {
            agentId: onChainReg.agentId,
            chain: syncConfig.chain,
            txHash: onChainReg.txHash,
            registryAddress: syncConfig.identityRegistryAddress,
          };

          if (!opts.json) {
            console.log(`  ERC-8004:   Agent #${onChainReg.agentId} on ${syncConfig.chain} (${onChainReg.txHash})`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          result.erc8004Error = msg;
          if (!opts.json) {
            console.log(`  ERC-8004:   sync failed (${msg})`);
          }
        }
      } else {
        if (!opts.json) {
          console.log(`  ERC-8004:   disabled (set ERC8004_SYNC=true to enable)`);
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\nAgent registered!`);
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
