/**
 * Agent manifest management — creates and manages agent.json (DevSpot format)
 * Stored at ~/.crystalflow/agent.json
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { AgentManifest, AgentRegistration } from "./types.js";

const CRYSTALFLOW_DIR = join(homedir(), ".crystalflow");
const AGENT_FILE = join(CRYSTALFLOW_DIR, "agent.json");

export async function ensureDir(): Promise<void> {
  if (!existsSync(CRYSTALFLOW_DIR)) {
    await mkdir(CRYSTALFLOW_DIR, { recursive: true });
  }
}

export async function createAgent(
  name: string,
  role: "scout" | "sentinel" | "curator",
  description?: string,
): Promise<AgentManifest> {
  await ensureDir();

  const manifest: AgentManifest = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name,
    description: description ?? `CrystalFlow ${role} agent — decentralized video intelligence`,
    services: [
      { name: "crystalflow", endpoint: "cli://crystalflow", version: "0.0.1" },
    ],
    active: true,
    registrations: [],
    supportedTrust: ["reputation", "validation"],
    role,
    version: "0.0.1",
  };

  await writeFile(AGENT_FILE, JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function getAgent(): Promise<AgentManifest | null> {
  if (!existsSync(AGENT_FILE)) return null;
  const data = await readFile(AGENT_FILE, "utf-8");
  return JSON.parse(data) as AgentManifest;
}

export async function addRegistration(reg: AgentRegistration): Promise<AgentManifest> {
  const agent = await getAgent();
  if (!agent) throw new Error("No agent.json found. Run `crystalflow register` first.");

  // Avoid duplicate registrations for same chain
  agent.registrations = agent.registrations.filter((r) => r.chain !== reg.chain);
  agent.registrations.push(reg);

  await writeFile(AGENT_FILE, JSON.stringify(agent, null, 2));
  return agent;
}

export async function deactivateAgent(): Promise<void> {
  const agent = await getAgent();
  if (!agent) return;
  agent.active = false;
  await writeFile(AGENT_FILE, JSON.stringify(agent, null, 2));
}

export function getAgentPath(): string {
  return AGENT_FILE;
}

export function getCrystalflowDir(): string {
  return CRYSTALFLOW_DIR;
}
