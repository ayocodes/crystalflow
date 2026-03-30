export type AgentRole = 'scout' | 'sentinel' | 'curator';
export type AgentStatus = 'idle' | 'working';
export type JobStatus = 'pending' | 'assigned' | 'completed' | 'failed';
export type ConsensusStatus = 'pending' | 'reached' | 'failed';

export interface AgentInfo {
  agentId: string;
  address: string;
  role: AgentRole;
  name: string;
  connectedAt: number;
  lastHeartbeat: number;
  status: AgentStatus;
  currentJobId?: string;
}

export interface IndexResult {
  agentId: string;
  submittedAt: number;
  indexData: unknown;
  storageCid?: string;
}

export interface RewardBreakdown {
  agentId: string;
  amount: number;
  role: 'fastest' | 'confirming' | 'protocol' | 'burned';
}

export interface ConsensusData {
  clusteredAgents: string[];
  outlierAgents: string[];
  fastestAgent: string;
  similarityScores: Record<string, number>;
  rewards: RewardBreakdown[];
}

export interface Job {
  id: string;
  videoUrl: string;
  submittedBy: string;
  submittedAt: number;
  status: JobStatus;
  assignedTo: string[];
  results: IndexResult[];
  consensusStatus?: ConsensusStatus;
  consensus?: ConsensusData;
}

// WebSocket message types — inbound (agent → server)
export type WSMessageIn =
  | { type: 'agent:connect'; agentId: string; role: AgentRole; address: string; name: string }
  | { type: 'agent:heartbeat'; agentId: string }
  | { type: 'job:result'; jobId: string; result: IndexResult };

// WebSocket message types — outbound (server → agent)
export type WSMessageOut =
  | { type: 'agent:connected'; agentId: string }
  | { type: 'job:assigned'; job: Job }
  | { type: 'job:new'; job: Job }
  | { type: 'job:completed'; jobId: string }
  | { type: 'job:consensus'; jobId: string; consensus: ConsensusData }
  | { type: 'error'; message: string };
