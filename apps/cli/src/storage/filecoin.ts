import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getChain, Synapse } from "@filoz/synapse-sdk";
import type { StorageProvider, StorageResult } from "./types.js";

const CALIBRATION_CHAIN_ID = 314159;

function getAccount() {
  const key = process.env.FILECOIN_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!key) throw new Error("FILECOIN_PRIVATE_KEY or PRIVATE_KEY env var is required");
  return privateKeyToAccount(key.startsWith("0x") ? (key as `0x${string}`) : (`0x${key}` as `0x${string}`));
}

export class FilecoinStorage implements StorageProvider {
  private synapse: Synapse | null = null;

  private getSynapse(): Synapse {
    if (this.synapse) return this.synapse;

    const account = getAccount();
    const chain = getChain(CALIBRATION_CHAIN_ID);
    const client = createWalletClient({
      account,
      chain,
      transport: http(),
    });

    this.synapse = new Synapse({ client, source: "crystalflow" });
    return this.synapse;
  }

  async upload(data: Buffer, metadata?: Record<string, string>): Promise<StorageResult> {
    const synapse = this.getSynapse();

    // High-level upload: handles context creation, store, pull, and commit
    const result = await synapse.storage.upload(new Uint8Array(data), {
      copies: 1,
      metadata: { app: "crystalflow", ...metadata },
    });

    // Synapse SDK returns pieceCid as a CID object (with .toV1()) or a plain string.
    // Normalize to a V1 CID string for consistent storage across providers.
    const cid =
      result.pieceCid && typeof result.pieceCid === "object" && "toV1" in result.pieceCid
        ? String((result.pieceCid as { toV1: () => unknown }).toV1())
        : String(result.pieceCid);

    return { cid, size: result.size, provider: "filecoin" };
  }

  async download(cid: string): Promise<Buffer> {
    const synapse = this.getSynapse();
    const data = await synapse.storage.download({ pieceCid: cid });
    return Buffer.from(data);
  }

  getUrl(cid: string): string {
    return `https://calibration.filbeam.io/piece/${cid}`;
  }
}
