import { randomUUID } from 'node:crypto';
import type { Job } from '../types.js';
import { getJob } from '../jobs/index.js';

export type ProjectVisibility = 'public' | 'private';

export interface Project {
  id: string;
  name: string;
  description: string;
  visibility: ProjectVisibility;
  createdAt: number;
  videoIds: string[]; // job IDs that belong to this project
}

const projects = new Map<string, Project>();

export function createProject(name: string, description = '', visibility: ProjectVisibility = 'private'): Project {
  const project: Project = {
    id: randomUUID(),
    name,
    description,
    visibility,
    createdAt: Date.now(),
    videoIds: [],
  };
  projects.set(project.id, project);
  console.log(`[projects] created ${project.id} "${name}" (${visibility})`);
  return project;
}

export function getPublicProjects(): Project[] {
  return Array.from(projects.values()).filter((p) => p.visibility === 'public');
}

export function updateVisibility(id: string, visibility: ProjectVisibility): void {
  const project = projects.get(id);
  if (project) {
    project.visibility = visibility;
    console.log(`[projects] ${id} visibility → ${visibility}`);
  }
}

export function getProject(id: string): Project | null {
  return projects.get(id) ?? null;
}

export function getAllProjects(): Project[] {
  return Array.from(projects.values());
}

export function addVideoToProject(projectId: string, jobId: string): void {
  const project = projects.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.videoIds.includes(jobId)) {
    project.videoIds.push(jobId);
    console.log(`[projects] added job ${jobId} to project ${projectId}`);
  }
}

export function getProjectVideos(projectId: string): Job[] {
  const project = projects.get(projectId);
  if (!project) return [];
  return project.videoIds
    .map((id) => getJob(id))
    .filter((j): j is Job => j !== undefined);
}

export function deleteProject(id: string): void {
  if (projects.delete(id)) {
    console.log(`[projects] deleted ${id}`);
  }
}
