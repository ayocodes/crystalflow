import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { StorageProvider, StorageResult } from "./types.js";

const STORAGE_DIR = join(homedir(), ".vidgrid", "storage");

export class LocalStorage implements StorageProvider {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? STORAGE_DIR;
  }

  async upload(data: Buffer): Promise<StorageResult> {
    await mkdir(this.dir, { recursive: true });
    const cid = createHash("sha256").update(data).digest("hex");
    await writeFile(join(this.dir, cid), data);
    return { cid, size: data.length, provider: "local" };
  }

  async download(cid: string): Promise<Buffer> {
    return readFile(join(this.dir, cid));
  }

  getUrl(cid: string): string {
    return join(this.dir, cid);
  }
}
