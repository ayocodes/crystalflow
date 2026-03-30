import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { AgentInfo, WSMessageIn, WSMessageOut } from '../types.js';
import {
  registerAgent,
  removeAgent,
  updateHeartbeat,
  getAvailableSentinels,
  setAgentStatus,
  cleanup as cleanupAgents,
} from '../agents/index.js';
import {
  assignJob,
  submitResult,
  getPendingJobs,
} from '../jobs/index.js';
import { compareIndexes, parseIndexData } from '../jobs/consensus.js';
import { distributeRewards } from '../jobs/rewards.js';
import { addIndex, type StoredIndex } from '../intel/index-store.js';

const connections = new Map<string, WebSocket>();

export function sendToAgent(agentId: string, message: WSMessageOut): void {
  const ws = connections.get(agentId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function broadcast(message: WSMessageOut): void {
  const data = JSON.stringify(message);
  for (const ws of connections.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

/** Try to assign pending jobs to available sentinels */
function drainPendingJobs(): void {
  const pending = getPendingJobs();
  if (pending.length === 0) return;

  const sentinels = getAvailableSentinels();
  if (sentinels.length === 0) return;

  for (const job of pending) {
    const available = getAvailableSentinels(); // re-check after each assignment
    if (available.length === 0) break;

    // Pick min(3, available) sentinels randomly (Crystalrohr L1 — unbiased)
    const count = Math.min(3, available.length);
    const picked = shuffleAndTake(available, count);
    const agentIds = picked.map((a) => a.agentId);

    const assigned = assignJob(job.id, agentIds);
    if (!assigned) continue;

    for (const agent of picked) {
      setAgentStatus(agent.agentId, 'working', job.id);
      sendToAgent(agent.agentId, { type: 'job:assigned', job: assigned });
    }

    // Broadcast to all (dashboard listens)
    broadcast({ type: 'job:new', job: assigned });
  }
}

function shuffleAndTake<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

function handleMessage(agentId: string | null, ws: WebSocket, raw: string): void {
  let msg: WSMessageIn;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    return;
  }

  switch (msg.type) {
    case 'agent:connect': {
      const now = Date.now();
      const info: AgentInfo = {
        agentId: msg.agentId,
        address: msg.address,
        role: msg.role,
        name: msg.name,
        connectedAt: now,
        lastHeartbeat: now,
        status: 'idle',
      };
      registerAgent(info);
      connections.set(msg.agentId, ws);

      // Tag the ws so we know who it is on disconnect
      (ws as any).__agentId = msg.agentId;

      sendToAgent(msg.agentId, { type: 'agent:connected', agentId: msg.agentId });

      // New sentinel? Check for pending jobs
      if (msg.role === 'sentinel') {
        drainPendingJobs();
      }
      break;
    }

    case 'agent:heartbeat': {
      updateHeartbeat(msg.agentId);
      break;
    }

    case 'job:result': {
      const job = submitResult(msg.jobId, msg.result);
      if (!job) {
        ws.send(JSON.stringify({ type: 'error', message: `Unknown job ${msg.jobId}` }));
        return;
      }

      // Free up the agent
      setAgentStatus(msg.result.agentId, 'idle');

      if (job.status === 'completed') {
        // Run consensus scoring
        const consensusResult = compareIndexes(job.results);

        // Calculate reward distribution
        const rewards = distributeRewards(consensusResult);

        // Attach consensus data to job
        job.consensusStatus = consensusResult.consensusReached ? 'reached' : 'failed';
        job.consensus = {
          clusteredAgents: consensusResult.clusteredAgents,
          outlierAgents: consensusResult.outlierAgents,
          fastestAgent: consensusResult.fastestAgent,
          similarityScores: consensusResult.similarityScores,
          rewards,
        };

        broadcast({ type: 'job:consensus', jobId: job.id, consensus: job.consensus });
        broadcast({ type: 'job:completed', jobId: job.id });

        // Store the winning index in the intel layer
        if (consensusResult.consensusReached && consensusResult.fastestAgent) {
          const winningResult = job.results.find(
            (r) => r.agentId === consensusResult.fastestAgent,
          );
          if (winningResult) {
            const parsed = parseIndexData(winningResult.indexData);
            if (parsed) {
              const raw = winningResult.indexData as Record<string, any>;
              const stored: StoredIndex = {
                videoId: parsed.videoId,
                videoUrl: job.videoUrl,
                scenes: (raw.scenes ?? parsed.scenes).map((s: any) => ({
                  timestamp: s.timestamp,
                  deltaE: s.deltaE ?? 0,
                  description: s.description,
                  colors: s.colors,
                })),
                videoInfo: {
                  duration: parsed.videoInfo.duration,
                  codec: raw.videoInfo?.codec,
                  width: raw.videoInfo?.width,
                  height: raw.videoInfo?.height,
                  fps: raw.videoInfo?.fps,
                },
                storageCid: winningResult.storageCid,
                indexedAt: winningResult.submittedAt,
                indexedBy: winningResult.agentId,
                jobId: job.id,
              };
              addIndex(stored);
            }
          }
        }

        // Re-check pending jobs since agents are now free
        drainPendingJobs();
      }
      break;
    }

    default: {
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type` }));
    }
  }
}

export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[ws] new connection');

    ws.on('message', (data) => {
      const agentId = (ws as any).__agentId as string | undefined;
      handleMessage(agentId ?? null, ws, data.toString());
    });

    ws.on('close', () => {
      const agentId = (ws as any).__agentId as string | undefined;
      if (agentId) {
        connections.delete(agentId);
        removeAgent(agentId);
        console.log(`[ws] disconnected: ${agentId}`);
      }
    });

    ws.on('error', (err) => {
      console.error('[ws] error:', err.message);
    });
  });

  // Periodic cleanup of stale agents (unref so it doesn't block process exit)
  const wsCleanup = setInterval(() => {
    const stale = cleanupAgents();
    for (const id of stale) {
      const ws = connections.get(id);
      if (ws) {
        ws.close(4003, 'Heartbeat timeout');
        connections.delete(id);
      }
    }
  }, 30_000);
  wsCleanup.unref();

  console.log('[ws] WebSocket server attached');
  return wss;
}

/** Called when a new job is created via REST — triggers assignment */
export function onJobCreated(): void {
  drainPendingJobs();
}
