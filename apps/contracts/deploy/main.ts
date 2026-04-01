import { parseArgs } from "node:util";
import { type Hex, parseEther } from "viem";
import { defaultChains } from "./chains.js";
import { createClients, ensureNickFactory, readState, writeState, type DeployState, type ScopeFn } from "./utils.js";
import { deployCore } from "./scopes/01-core.js";
import { deployWire } from "./scopes/02-wire.js";

const SCOPES: { key: string; fn: ScopeFn }[] = [
  { key: "core", fn: deployCore },
  { key: "wire", fn: deployWire },
];

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    rpc: { type: "string" },
    scope: { type: "string" },
    force: { type: "boolean", default: false },
    all: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  console.log(`
Usage: npx tsx deploy/main.ts [options]

Options:
  --name <chain>     Chain name (e.g. localhost, filecoin-calibration, base-sepolia)
  --rpc <url>        Custom RPC URL
  --scope <name>     Deploy only this scope (core, wire)
  --force            Force redeploy even if scope is completed
  --all              Deploy to all default chains
  --help             Show this help
  `);
  process.exit(0);
}

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
if (!deployerKey) {
  console.error("Error: DEPLOYER_PRIVATE_KEY env var is required");
  process.exit(1);
}

async function deployToChain(chainName: string, rpc: string) {
  console.log(`\n========== Deploying to ${chainName} ==========`);
  console.log(`RPC: ${rpc}\n`);

  const { publicClient, walletClient, account } = createClients(rpc, deployerKey!);
  const chainId = await publicClient.getChainId();
  const deployer = account.address;

  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployer}\n`);

  // On localhost (Anvil), auto-fund deployer
  if (Number(chainId) === 31337) {
    const ANVIL_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
    const { walletClient: anvilWallet } = createClients(rpc, ANVIL_KEY);
    const balance = await publicClient.getBalance({ address: deployer });
    if (balance < parseEther("10")) {
      console.log("Funding deployer from Anvil account #0...");
      const hash = await anvilWallet.sendTransaction({ to: deployer, value: parseEther("10") });
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("Deployer funded\n");
    }
  }

  let state: DeployState = readState(chainName) ?? {
    chain: chainName,
    chainId,
    rpc,
    deployedAt: new Date().toISOString(),
    deployer,
    scopes: {},
  };

  const config = { chain: chainName, rpc, deployer };

  await ensureNickFactory(publicClient, walletClient);

  const scopesToRun = values.scope
    ? SCOPES.filter(s => s.key === values.scope)
    : SCOPES;

  for (const { key, fn } of scopesToRun) {
    const existing = state.scopes[key];
    if (existing?.status === "completed" && !values.force) {
      console.log(`Scope "${key}" already completed — skipping`);
      continue;
    }

    console.log(`\nRunning scope: ${key}`);
    try {
      const result = await fn(publicClient, walletClient, state.scopes, config);
      state.scopes[key] = result;
    } catch (err: any) {
      state.scopes[key] = { status: "failed", error: err.message };
      console.error(`Scope "${key}" failed: ${err.message}`);
    }

    writeState(chainName, state);

    if (state.scopes[key]?.status === "failed") {
      console.error(`\nStopping — scope "${key}" failed.`);
      break;
    }
  }

  // Summary
  console.log(`\n---------- Summary: ${chainName} ----------`);
  for (const [key, result] of Object.entries(state.scopes)) {
    const icon = result.status === "completed" ? "OK" : "FAIL";
    console.log(`  ${icon} ${key}: ${result.status}`);
    if (result.contracts) {
      for (const [name, addr] of Object.entries(result.contracts)) {
        console.log(`      ${name}: ${addr}`);
      }
    }
  }
}

async function main() {
  if (values.all) {
    for (const chain of defaultChains) {
      await deployToChain(chain.name, chain.rpc);
    }
  } else if (values.name) {
    const defaultChain = defaultChains.find(c => c.name === values.name);
    const rpc = values.rpc ?? defaultChain?.rpc;
    if (!rpc) {
      console.error(`Error: No RPC found for "${values.name}". Provide --rpc or use a default chain.`);
      process.exit(1);
    }
    await deployToChain(values.name, rpc);
  } else {
    console.error("Error: Provide --name <chain> or --all");
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
