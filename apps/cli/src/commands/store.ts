import { Command } from "commander";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { createStorage, type StorageResult } from "../storage/index.js";
import { logAction } from "../identity/index.js";

export const storeCommand = new Command("store")
  .description("Store video index data to Filecoin or local storage")
  .option("--input <path>", "Path to a file to store")
  .option("--input-dir <dir>", "Directory of files to store (uploads all files)")
  .option("--provider <provider>", "Storage provider: local or filecoin", "local")
  .option("--json", "Output structured JSON")
  .action(async (opts) => {
    try {
      if (!opts.input && !opts.inputDir) {
        throw new Error("Either --input or --input-dir is required");
      }

      const storage = await createStorage(opts.provider);
      const results: StorageResult[] = [];

      if (opts.input) {
        const data = await readFile(opts.input);
        if (!opts.json) console.log(`Storing: ${opts.input} (${data.length} bytes)`);
        const result = await storage.upload(data);
        results.push(result);
        if (!opts.json) {
          console.log(`  CID:      ${result.cid}`);
          console.log(`  Size:     ${result.size}`);
          console.log(`  Provider: ${result.provider}`);
        }
      }

      if (opts.inputDir) {
        const entries = await readdir(opts.inputDir);
        for (const entry of entries) {
          const fullPath = join(opts.inputDir, entry);
          const info = await stat(fullPath);
          if (!info.isFile()) continue;

          const data = await readFile(fullPath);
          if (!opts.json) console.log(`Storing: ${entry} (${data.length} bytes)`);
          const result = await storage.upload(data);
          results.push(result);
          if (!opts.json) {
            console.log(`  CID:      ${result.cid}`);
            console.log(`  Size:     ${result.size}`);
            console.log(`  Provider: ${result.provider}`);
          }
        }
      }

      // Log each stored file
      for (const r of results) {
        await logAction("store", { cid: r.cid, size: r.size, provider: r.provider },
          r.provider === "filecoin" ? "filecoin-calibration" : undefined);
      }

      if (opts.json) {
        const output = results.length === 1 ? results[0] : results;
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log(`\nStored ${results.length} file(s) via ${opts.provider}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (opts.json) {
        console.log(JSON.stringify({ error: message }));
      } else {
        console.error(`Error: ${message}`);
      }
      process.exit(1);
    }
  });
