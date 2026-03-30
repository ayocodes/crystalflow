import type { StorageProvider } from "./types.js";
import { LocalStorage } from "./local.js";

export type { StorageProvider, StorageResult } from "./types.js";
export { LocalStorage } from "./local.js";
export { FilecoinStorage } from "./filecoin.js";

export async function createStorage(provider?: "local" | "filecoin"): Promise<StorageProvider> {
  const selected = provider ?? (process.env.STORAGE_PROVIDER as "local" | "filecoin") ?? "local";
  if (selected === "filecoin") {
    const { FilecoinStorage } = await import("./filecoin.js");
    return new FilecoinStorage();
  }
  return new LocalStorage();
}
