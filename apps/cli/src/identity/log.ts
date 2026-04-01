/**
 * Append-only agent log — manages agent_log.json locally
 * Every action the agent takes is recorded here (DevSpot requirement)
 * Stored at ~/.crystalflow/agent_log.json
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureDir, getCrystalflowDir } from "./agent.js";
import type { LogEntry } from "./types.js";

const LOG_FILE = join(getCrystalflowDir(), "agent_log.json");

export async function logAction(
  action: string,
  data: Record<string, unknown>,
  chain?: string,
  txHash?: string,
): Promise<LogEntry> {
  await ensureDir();

  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    timestamp: new Date().toISOString(),
    data,
    ...(chain ? { chain } : {}),
    ...(txHash ? { txHash } : {}),
  };

  const entries = await getLog();
  entries.push(entry);
  await writeFile(LOG_FILE, JSON.stringify(entries, null, 2));

  return entry;
}

export async function getLog(): Promise<LogEntry[]> {
  if (!existsSync(LOG_FILE)) return [];
  const raw = await readFile(LOG_FILE, "utf-8");
  try {
    return JSON.parse(raw) as LogEntry[];
  } catch {
    return [];
  }
}

export async function getLogByAction(action: string): Promise<LogEntry[]> {
  const entries = await getLog();
  return entries.filter((e) => e.action === action);
}

export async function getRecentLog(count: number = 20): Promise<LogEntry[]> {
  const entries = await getLog();
  return entries.slice(-count);
}

export function getLogPath(): string {
  return LOG_FILE;
}
