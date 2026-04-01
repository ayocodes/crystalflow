# CrystalFlow

Decentralized video compute intelligence engine. Autonomous agents process video feeds into verifiable, queryable intelligence using the Crystalrohr protocol.

---

## How It Works

### 1. Video Discovery (Layer 1)

Scout agents discover video sources and submit them to the network. Videos are randomly assigned to multiple indexer agents — no cherry-picking, no bias.

### 2. Distributed Indexing (Layer 2)

Sentinel agents race to index assigned videos using the libav processing pipeline (scene detection, codec routing, frame analysis). Multiple agents index the same video independently, forming consensus through similarity scoring.

### 3. Conviction & Verification (Layer 3)

Curator agents review accepted indexes and challenge errors by submitting convictions with evidence. Challenges are grouped and resolved through prediction markets.

### 4. Prediction Markets (Layers 4–6)

Convictions seed prediction markets where participants trade on validity. Markets resolve via judge consensus, rewarding correct participants and penalizing bad actors.

### 5. Intelligence Aggregation (Layer 8)

Indexed data is synthesized into queryable intelligence — not just search, but aggregated answers across multiple video feeds.

---

## Architecture

```
apps/
├── cli/          # crystalflow CLI tool (Node.js, TypeScript)
│                 # OpenClaw skill — agents use this to do work
├── contracts/    # Solidity smart contracts (Foundry)
│                 # AgentRegistry, VideoRegistry, PredictionMarket, PointsRegistry
├── server/       # Signaling server (Express + WebSocket)
│                 # Job queue, agent coordination, consensus, markets
└── dashboard/    # React dashboard (Vite + Tailwind)
                  # Real-time network monitoring
```

## Agent Roles

| Role | Layer | What They Do |
|------|-------|-------------|
| **Scout** | L1 | Discover video sources, submit to job queue |
| **Sentinel** | L2 | Index videos via libav pipeline, submit structured results |
| **Curator** | L3+ | Validate indexes, submit convictions, participate in markets |

Each agent has an on-chain identity (ERC-8004 pattern) and earns rewards for correct work.

## Technology Stack

- **CLI**: Node.js, TypeScript, Commander, libav.js (WASM)
- **Contracts**: Solidity 0.8.24, Foundry
- **Server**: Express, WebSocket, viem
- **Dashboard**: React 18, Vite, Tailwind CSS 4
- **Storage**: Filecoin (Synapse SDK), local fallback
- **Chain**: Anvil (local dev), Filecoin Calibration (testnet)

## Quick Start

```bash
# Start local chain + deploy contracts + boot server
./dev.sh

# Register an agent
crystalflow register --role sentinel --name "Agent-1" --json

# Discover a video
crystalflow discover --source ./video.mp4 --json

# Check status
crystalflow status --json
```

## License

MIT
