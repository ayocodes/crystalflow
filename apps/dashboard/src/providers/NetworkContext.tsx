import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../api/client';
import type { AgentInfo, Job, NetworkEvent } from '../types';

interface NetworkState {
  connected: boolean;
  agents: AgentInfo[];
  jobs: Job[];
  events: NetworkEvent[];
}

const NetworkContext = createContext<NetworkState>({
  connected: false,
  agents: [],
  jobs: [],
  events: [],
});

export function useNetwork() {
  return useContext(NetworkContext);
}

let eventCounter = 0;
function makeEvent(
  type: string,
  message: string,
  data: Record<string, unknown> = {},
): NetworkEvent {
  return {
    id: `evt-${++eventCounter}`,
    type,
    timestamp: Date.now(),
    data,
    message,
  };
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [events, setEvents] = useState<NetworkEvent[]>([]);

  const pushEvent = useCallback(
    (type: string, message: string, data?: Record<string, unknown>) => {
      setEvents((prev) => [makeEvent(type, message, data), ...prev].slice(0, 100));
    },
    [],
  );

  // Poll REST API for initial state + periodic refresh
  useEffect(() => {
    const poll = () => {
      api.getAgents().then((data) => setAgents(data as AgentInfo[])).catch(err => console.error('[Network]', err));
      api.getJobs().then((data) => setJobs(data as Job[])).catch(err => console.error('[Network]', err));
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMessage = useCallback(
    (msg: Record<string, unknown>) => {
      const type = msg.type as string;

      switch (type) {
        case 'agent:connected': {
          const agentId = msg.agentId as string;
          pushEvent(type, `Agent ${agentId} connected`);
          api.getAgents().then((data) => setAgents(data as AgentInfo[])).catch(err => console.error('[Network]', err));
          break;
        }
        case 'job:new': {
          const job = msg.job as Job;
          setJobs((prev) => {
            const exists = prev.find((j) => j.id === job.id);
            return exists ? prev.map((j) => (j.id === job.id ? job : j)) : [job, ...prev];
          });
          pushEvent(type, `New job: ${job.videoUrl}`, { jobId: job.id });
          break;
        }
        case 'job:assigned': {
          const job = msg.job as Job;
          setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j)));
          pushEvent(type, `Job ${job.id.slice(0, 8)} assigned to ${job.assignedTo.length} agents`);
          break;
        }
        case 'job:completed': {
          const jobId = msg.jobId as string;
          pushEvent(type, `Job ${(jobId).slice(0, 8)} completed`);
          api.getJobs().then((data) => setJobs(data as Job[])).catch(err => console.error('[Network]', err));
          break;
        }
        case 'job:consensus': {
          const jobId = msg.jobId as string;
          pushEvent(type, `Consensus reached for job ${(jobId).slice(0, 8)}`);
          api.getJobs().then((data) => setJobs(data as Job[])).catch(err => console.error('[Network]', err));
          break;
        }
        default:
          break;
      }
    },
    [pushEvent],
  );

  const { connected } = useWebSocket('ws://localhost:3001', handleMessage);

  return (
    <NetworkContext.Provider value={{ connected, agents, jobs, events }}>
      {children}
    </NetworkContext.Provider>
  );
}
