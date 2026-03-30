import type { AgentInfo, AgentRole, AgentStatus } from '../types.js';

const agents = new Map<string, AgentInfo>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

const HEARTBEAT_TTL = 60_000; // 60s — remove agents with stale heartbeats
const CLEANUP_INTERVAL = 30_000; // 30s

export function registerAgent(info: AgentInfo): void {
  agents.set(info.agentId, info);
  console.log(`[agents] registered ${info.role} "${info.name}" (${info.agentId})`);
}

export function removeAgent(agentId: string): void {
  const agent = agents.get(agentId);
  if (agent) {
    agents.delete(agentId);
    console.log(`[agents] removed ${agent.role} "${agent.name}" (${agentId})`);
  }
}

export function getAgent(agentId: string): AgentInfo | undefined {
  return agents.get(agentId);
}

export function getAllAgents(): AgentInfo[] {
  return Array.from(agents.values());
}

function getByRole(role: AgentRole, status?: AgentStatus): AgentInfo[] {
  return getAllAgents().filter(
    (a) => a.role === role && (status === undefined || a.status === status)
  );
}

export function getAvailableSentinels(): AgentInfo[] {
  return getByRole('sentinel', 'idle');
}

export function getAvailableScouts(): AgentInfo[] {
  return getByRole('scout', 'idle');
}

export function getAvailableCurators(): AgentInfo[] {
  return getByRole('curator', 'idle');
}

export function updateHeartbeat(agentId: string): void {
  const agent = agents.get(agentId);
  if (agent) {
    agent.lastHeartbeat = Date.now();
  }
}

export function setAgentStatus(agentId: string, status: AgentStatus, jobId?: string): void {
  const agent = agents.get(agentId);
  if (agent) {
    agent.status = status;
    agent.currentJobId = jobId;
  }
}

export function cleanup(): string[] {
  const now = Date.now();
  const stale: string[] = [];
  for (const [id, agent] of agents) {
    if (now - agent.lastHeartbeat > HEARTBEAT_TTL) {
      stale.push(id);
      agents.delete(id);
      console.log(`[agents] cleanup: removed stale ${agent.role} "${agent.name}" (${id})`);
    }
  }
  return stale;
}

export function startCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL);
}

export function stopCleanupTimer(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
