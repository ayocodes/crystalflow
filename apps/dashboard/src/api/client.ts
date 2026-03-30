import type { AgentInfo, Job } from '../types';

const BASE = '/api';

export const api = {
  getAgents: (): Promise<AgentInfo[]> =>
    fetch(`${BASE}/agents`).then((r) => r.json()),

  getAgent: (id: string): Promise<AgentInfo> =>
    fetch(`${BASE}/agents/${id}`).then((r) => r.json()),

  getJobs: (): Promise<Job[]> =>
    fetch(`${BASE}/jobs`).then((r) => r.json()),

  getJob: (id: string): Promise<Job> =>
    fetch(`${BASE}/jobs/${id}`).then((r) => r.json()),

  queryIntel: (query: string): Promise<Record<string, unknown>> =>
    fetch(`${BASE}/intel/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => r.json()),

  getStats: (): Promise<Record<string, unknown>> =>
    fetch(`${BASE}/intel/stats`).then((r) => r.json()),
};
