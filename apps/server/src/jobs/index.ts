import { randomUUID } from 'node:crypto';
import type { IndexResult, Job } from '../types.js';

const jobs = new Map<string, Job>();

export function createJob(videoUrl: string, submittedBy: string): Job {
  const job: Job = {
    id: randomUUID(),
    videoUrl,
    submittedBy,
    submittedAt: Date.now(),
    status: 'pending',
    assignedTo: [],
    results: [],
  };
  jobs.set(job.id, job);
  console.log(`[jobs] created ${job.id} for ${videoUrl}`);
  return job;
}

export function assignJob(jobId: string, agentIds: string[]): Job | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  job.assignedTo = agentIds;
  job.status = 'assigned';
  job.consensusStatus = 'pending';
  console.log(`[jobs] assigned ${jobId} → [${agentIds.join(', ')}]`);
  return job;
}

export function submitResult(jobId: string, result: IndexResult): Job | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;

  // Prevent duplicate submissions from same agent
  if (job.results.some((r) => r.agentId === result.agentId)) {
    console.log(`[jobs] duplicate result from ${result.agentId} for ${jobId}, ignoring`);
    return job;
  }

  job.results.push(result);
  console.log(`[jobs] result for ${jobId} from ${result.agentId} (${job.results.length}/${job.assignedTo.length})`);

  // All assigned agents submitted — mark completed
  if (job.results.length >= job.assignedTo.length) {
    job.status = 'completed';
    console.log(`[jobs] ${jobId} completed — all results in`);
  }

  return job;
}

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

export function getPendingJobs(): Job[] {
  return Array.from(jobs.values()).filter((j) => j.status === 'pending');
}

export function getJobsForAgent(agentId: string): Job[] {
  return Array.from(jobs.values()).filter((j) => j.assignedTo.includes(agentId));
}

export function getAllJobs(): Job[] {
  return Array.from(jobs.values());
}

export function clearAll(): void {
  jobs.clear();
}
