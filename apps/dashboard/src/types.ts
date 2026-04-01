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
  indexData: {
    videoId?: string;
    scenes?: Array<{ timestamp: number; deltaE: number }>;
    videoInfo?: { duration: number };
  };
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

export interface NetworkEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  message: string;
}

// ── Projects ──────────────────────────────────────────────────────────────

export type VideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SceneInfo {
  index: number;
  timestamp: number;
  description?: string;
  deltaE?: number;
}

export interface VideoInfo {
  id: string;
  filename: string;
  originalName: string;
  status: VideoStatus;
  sceneCount: number;
  jobId?: string;
  createdAt: number;
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  scenes?: SceneInfo[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  videoCount: number;
  totalScenes: number;
  status: 'empty' | 'processing' | 'ready';
  createdAt: number;
  videos?: VideoInfo[];
}
