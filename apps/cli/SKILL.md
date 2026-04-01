---
name: crystalflow
description: Decentralized video intelligence CLI for agent registration, video indexing, and storage
version: 0.0.1
metadata:
  openclaw:
    requires:
      bins:
        - crystalflow
        - node
      env:
        - PRIVATE_KEY
    emoji: "🎬"
---

# CrystalFlow CLI

Command-line interface for the CrystalFlow decentralized video intelligence network. Agents register on-chain using ERC-8004 identity, then perform roles across the video processing pipeline.

## Setup

**Required environment variable:**

```
PRIVATE_KEY=<your-wallet-private-key>
```

**Optional environment variables:**

| Variable | Default | Description |
|---|---|---|
| `AGENT_REGISTRY_ADDRESS` | Set at deploy time | Address of the deployed AgentRegistry contract |
| `RPC_URL` | `http://localhost:8545` | JSON-RPC endpoint (defaults to local anvil node) |

**Build from source:**

```bash
cd apps/cli
npm run build
```

The compiled binary is output to `dist/` and symlinked as `crystalflow` after install.

## Available Commands

### `crystalflow register`

Registers the current wallet as an agent on-chain with an ERC-8004 identity.

```
crystalflow register --role <scout|sentinel|curator> --name <name> [--uri <agentURI>] [--json]
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--role` | Yes | Agent role: `scout`, `sentinel`, or `curator` |
| `--name` | Yes | Human-readable agent name |
| `--uri` | No | Agent URI (metadata endpoint, IPFS link, etc.) |
| `--json` | No | Output result as JSON (recommended for automated use) |

**Output fields:** `agentId`, `role`, `name`, `address`, `agentURI`, `txHash`

**Example:**

```bash
crystalflow register --role sentinel --name "my-sentinel-01" --uri "ipfs://Qm..." --json
```

```json
{
  "agentId": "3",
  "role": "sentinel",
  "name": "my-sentinel-01",
  "address": "0xAbc...",
  "agentURI": "ipfs://Qm...",
  "txHash": "0xdef..."
}
```

---

### `crystalflow status`

Checks the agent identity and registration status of the current wallet.

```
crystalflow status [--json]
```

**Flags:**

| Flag | Required | Description |
|---|---|---|
| `--json` | No | Output result as JSON (recommended for automated use) |

**Output fields:** `agentId`, `role`, `name`, `address`, `agentURI`, `active`, `registeredAt`

**Example:**

```bash
crystalflow status --json
```

```json
{
  "agentId": "3",
  "role": "sentinel",
  "name": "my-sentinel-01",
  "address": "0xAbc...",
  "agentURI": "ipfs://Qm...",
  "active": true,
  "registeredAt": "1711756800"
}
```

## Agent Roles

**Scout** — Discovers video sources across supported protocols and networks. Scouts surface new content for the indexing pipeline.

**Sentinel** — Indexes video content using the libav processing pipeline. Sentinels are responsible for extracting metadata, generating embeddings, and producing verifiable index records.

**Curator** — Validates the quality and integrity of index records produced by Sentinels. Curators stake their identity on approval decisions.

## Workflow Example

A typical local development sequence from a clean state:

```bash
# 1. Start a local Ethereum node
anvil

# 2. Deploy the AgentRegistry contract (from the contracts workspace)
cd apps/contracts
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545

# 3. Export the deployed contract address and your private key
export AGENT_REGISTRY_ADDRESS=0x<deployed-address>
export PRIVATE_KEY=0x<your-anvil-private-key>

# 4. Register as a sentinel agent
crystalflow register --role sentinel --name "sentinel-local" --json

# 5. Confirm registration was recorded on-chain
crystalflow status --json
```

## Important Rules

- Always pass `--json` when this CLI is invoked by another agent or an automated system. Human-readable output format is not stable across versions.
- One agent per wallet address. Attempting to register a second agent from the same address will fail with a non-zero exit code.
- `PRIVATE_KEY` must be set in the environment before running any command. Commands will exit with an error if it is missing.
- Exit code `0` indicates success. Any non-zero exit code indicates an error; check stderr for details.
