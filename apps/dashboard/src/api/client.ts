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

  // ── Projects ──────────────────────────────────────────────────────

  createProject: (name: string, description?: string, visibility: 'public' | 'private' = 'private'): Promise<Record<string, unknown>> =>
    fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, visibility }),
    }).then((r) => r.json()),

  getProjects: (visibility?: 'public'): Promise<Record<string, unknown>[]> =>
    fetch(`${BASE}/projects${visibility ? `?visibility=${visibility}` : ''}`).then((r) => r.json()),

  toggleVisibility: (id: string, visibility: 'public' | 'private'): Promise<Record<string, unknown>> =>
    fetch(`${BASE}/projects/${id}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    }).then((r) => r.json()),

  getProject: (id: string): Promise<Record<string, unknown>> =>
    fetch(`${BASE}/projects/${id}`).then((r) => r.json()),

  uploadVideo: (projectId: string, file: File): Promise<Record<string, unknown>> => {
    const formData = new FormData();
    formData.append('video', file);
    return fetch(`${BASE}/projects/${projectId}/videos`, {
      method: 'POST',
      body: formData,
    }).then((r) => r.json());
  },

  getVideo: (projectId: string, videoId: string): Promise<Record<string, unknown>> =>
    fetch(`${BASE}/projects/${projectId}/videos/${videoId}`).then((r) => r.json()),

  queryProject: (projectId: string, query: string): Promise<Record<string, unknown>> =>
    fetch(`${BASE}/projects/${projectId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    }).then((r) => r.json()),
};
