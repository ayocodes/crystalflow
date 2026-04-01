import { Command } from 'commander';

export const queryCommand = new Command('query')
  .description('Query the CrystalFlow intelligence engine')
  .argument('<question>', 'intelligence query (e.g. "road damage near Main St")')
  .option('--server <url>', 'signal server URL', process.env.CRYSTALFLOW_SERVER ?? 'http://localhost:3001')
  .option('--json', 'output raw JSON')
  .action(async (question: string, opts: { server: string; json?: boolean }) => {
    try {
      const url = `${opts.server.replace(/\/$/, '')}/api/intel/query`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        console.error(`Error: ${(err as any).error ?? resp.statusText}`);
        process.exit(1);
      }

      const result = (await resp.json()) as {
        query: string;
        answer: string;
        confidence: number;
        sceneCount: number;
        indexCount: number;
        sources: Array<{
          videoId: string;
          timestamp: number;
          description?: string;
        }>;
      };

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Human-readable output
      console.log(`\n  Query:      ${result.query}`);
      console.log(`  Answer:     ${result.answer}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`  Sources:    ${result.sceneCount} scenes from ${result.indexCount} indexes`);

      if (result.sources && result.sources.length > 0) {
        console.log(`\n  Top sources:`);
        for (const src of result.sources.slice(0, 5)) {
          const desc = src.description ? ` — ${src.description}` : '';
          console.log(`    ${src.videoId} @ ${src.timestamp.toFixed(1)}s${desc}`);
        }
      }

      console.log();
    } catch (err: any) {
      if (err.cause?.code === 'ECONNREFUSED') {
        console.error(`Error: Cannot connect to server at ${opts.server}`);
        console.error('Is the CrystalFlow signal server running?');
      } else {
        console.error(`Error: ${err.message}`);
      }
      process.exit(1);
    }
  });
