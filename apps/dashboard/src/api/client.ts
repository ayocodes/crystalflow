const BASE = '/api';

export const api = {
  getAgents: (): Promise<unknown[]> =>
    fetch(`${BASE}/agents`).then((r) => r.json()),

  getAgent: (id: string): Promise<unknown> =>
    fetch(`${BASE}/agents/${id}`).then((r) => r.json()),

  getJobs: (): Promise<unknown[]> =>
    fetch(`${BASE}/jobs`).then((r) => r.json()),

  getJob: (id: string): Promise<unknown> =>
    fetch(`${BASE}/jobs/${id}`).then((r) => r.json()),

  queryIntel: (query: string): Promise<unknown> =>
    fetch(`${BASE}/intel/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => r.json()),

  getStats: (): Promise<unknown> =>
    fetch(`${BASE}/intel/stats`).then((r) => r.json()),
};
