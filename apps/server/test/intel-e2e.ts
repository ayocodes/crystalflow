/**
 * E2E test for the F9 Intel flow.
 *
 * Spins up the real Express server, simulates the full pipeline:
 *   1. Create a job + submit result → consensus auto-stores to intel
 *   2. Manually ingest a second video index
 *   3. Query the intelligence API — keyword matching, multi-video aggregation
 *   4. Verify stats, recent, edge cases
 *   5. Test CLI query command against live server
 *
 * Run: npx tsx test/intel-e2e.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:';
let port: number;
let server: Server;
let baseUrl: string;
let stopCleanup: () => void;

async function json(method: string, path: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data: data as Record<string, any> };
}

// ── Boot server ────────────────────────────────────────────────────────────

before(async () => {
  const express = (await import('express')).default;
  const { attachWebSocket } = await import('../src/ws/index.js');
  const { startCleanupTimer, stopCleanupTimer: _stopCleanup } = await import('../src/agents/index.js');
  stopCleanup = _stopCleanup;
  const agentRoutes = (await import('../src/routes/agents.js')).default;
  const jobRoutes = (await import('../src/routes/jobs.js')).default;
  const intelRoutes = (await import('../src/routes/intel.js')).default;

  const app = express();
  app.use(express.json());
  app.use('/api/agents', agentRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/intel', intelRoutes);

  server = createServer(app);
  attachWebSocket(server);
  startCleanupTimer();

  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      baseUrl = `${BASE}${port}`;
      console.log(`  [test] server on port ${port}`);
      resolve();
    });
  });
});

after(() => {
  stopCleanup?.();
  server?.close();
});

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeIndexData(videoId: string, scenes: Array<{ ts: number; desc: string; deltaE: number }>) {
  return {
    videoId,
    scenes: scenes.map((s) => ({
      timestamp: s.ts,
      deltaE: s.deltaE,
      description: s.desc,
      colors: [{ r: 128, g: 128, b: 128 }],
    })),
    videoInfo: { codec: 'vp9', width: 1920, height: 1080, duration: 120, fps: 30 },
    processedAt: new Date().toISOString(),
  };
}

const SCENES_CAM01 = [
  { ts: 12.0, desc: 'Large pothole visible on road surface', deltaE: 18.5 },
  { ts: 45.2, desc: 'Road obstruction near intersection', deltaE: 22.1 },
  { ts: 78.0, desc: 'Traffic flowing normally', deltaE: 14.3 },
];

// ── Tests ──────────────────────────────────────────────────────────────────

describe('F9 Intel E2E', () => {
  // ------------------------------------------------------------------
  // Phase 0: empty state
  // ------------------------------------------------------------------
  it('stats are zero before any indexing', async () => {
    const { status, data } = await json('GET', '/api/intel/stats');
    assert.equal(status, 200);
    assert.equal(data.totalVideos, 0);
    assert.equal(data.totalScenes, 0);
    assert.equal(data.totalIndexes, 0);
  });

  it('query on empty store returns helpful message', async () => {
    const { status, data } = await json('POST', '/api/intel/query', { query: 'potholes' });
    assert.equal(status, 200);
    assert.equal(data.confidence, 0);
    assert.equal(data.sceneCount, 0);
    assert.match(data.answer, /no indexed videos/i);
  });

  it('rejects empty query', async () => {
    const { status } = await json('POST', '/api/intel/query', { query: '' });
    assert.equal(status, 400);
  });

  it('rejects missing query', async () => {
    const { status } = await json('POST', '/api/intel/query', {});
    assert.equal(status, 400);
  });

  // ------------------------------------------------------------------
  // Phase 1: job pipeline → auto-ingest into intel store
  //
  // REST-only flow: assignedTo=[] so the first result immediately
  // triggers completion + consensus (single-agent auto-consensus).
  // ------------------------------------------------------------------
  it('job result triggers consensus and auto-stores index', async () => {
    // Create job
    const { status: createStatus, data: job } = await json('POST', '/api/jobs', {
      videoUrl: 'https://cam-feeds.city.gov/main-st-01.mp4',
      submittedBy: 'scout-01',
    });
    assert.equal(createStatus, 201);

    // Submit result — single agent, auto-consensus
    const { status: resultStatus, data: updated } = await json('POST', `/api/jobs/${job.id}/result`, {
      agentId: 'sentinel-alpha',
      indexData: makeIndexData('cam-01', SCENES_CAM01),
    });
    assert.equal(resultStatus, 200);
    assert.equal(updated.status, 'completed');
    assert.equal(updated.consensusStatus, 'reached');

    // Intel store should now have this index
    const { data: stats } = await json('GET', '/api/intel/stats');
    assert.equal(stats.totalIndexes, 1);
    assert.equal(stats.totalVideos, 1);
    assert.equal(stats.totalScenes, 3);
  });

  // ------------------------------------------------------------------
  // Phase 2: manual ingest for a second video
  // ------------------------------------------------------------------
  it('manual ingest stores a second index', async () => {
    const { status, data } = await json('POST', '/api/intel/ingest', {
      videoId: 'cam-03',
      videoUrl: 'https://cam-feeds.city.gov/elm-5th.mp4',
      scenes: [
        { timestamp: 5.0, deltaE: 20, description: 'Road damage and pothole near curb' },
        { timestamp: 30.0, deltaE: 15, description: 'Pedestrian crossing safely' },
      ],
      videoInfo: { duration: 60, codec: 'h264', width: 1280, height: 720 },
      indexedBy: 'sentinel-gamma',
    });
    assert.equal(status, 201);
    assert.equal(data.stored, true);
    assert.equal(data.sceneCount, 2);
  });

  it('rejects ingest with missing fields', async () => {
    const { status } = await json('POST', '/api/intel/ingest', { videoUrl: 'x' });
    assert.equal(status, 400);
  });

  it('stats reflect both indexes', async () => {
    const { data } = await json('GET', '/api/intel/stats');
    assert.equal(data.totalIndexes, 2);
    assert.equal(data.totalVideos, 2);
    assert.equal(data.totalScenes, 5); // 3 + 2
  });

  // ------------------------------------------------------------------
  // Phase 3: intelligence queries
  // ------------------------------------------------------------------
  it('query "pothole" returns relevant scenes with sources', async () => {
    const { status, data } = await json('POST', '/api/intel/query', { query: 'pothole' });
    assert.equal(status, 200);
    assert.ok(data.sceneCount > 0, `expected scenes, got ${data.sceneCount}`);
    assert.ok(data.confidence > 0);
    assert.ok(data.answer.length > 0);
    assert.ok(Array.isArray(data.sources));
    assert.ok(data.sources.length > 0);

    // At least one source should reference pothole
    const withPothole = data.sources.filter(
      (s: any) => s.description?.toLowerCase().includes('pothole'),
    );
    assert.ok(withPothole.length > 0, 'expected source with pothole description');
  });

  it('query "road" matches scenes across multiple videos', async () => {
    const { data } = await json('POST', '/api/intel/query', { query: 'road' });
    assert.ok(data.sceneCount >= 2, `expected ≥2 scenes, got ${data.sceneCount}`);

    // Sources from both cam-01 and cam-03
    const videoIds = new Set((data.sources as any[]).map((s) => s.videoId));
    assert.ok(videoIds.has('cam-01'), 'expected cam-01 in results');
    assert.ok(videoIds.has('cam-03'), 'expected cam-03 in results');
  });

  it('query for nonexistent term returns zero scenes', async () => {
    const { data } = await json('POST', '/api/intel/query', { query: 'earthquake tsunami' });
    assert.equal(data.sceneCount, 0);
    assert.equal(data.confidence, 0);
    assert.match(data.answer, /no relevant scenes/i);
  });

  it('query matches on videoUrl when no description matches', async () => {
    // "elm" appears in cam-03's videoUrl (elm-5th.mp4)
    const { data } = await json('POST', '/api/intel/query', { query: 'elm' });
    assert.ok(data.sceneCount > 0, 'expected scenes matched via videoUrl');
    const videoIds = new Set((data.sources as any[]).map((s) => s.videoId));
    assert.ok(videoIds.has('cam-03'), 'expected cam-03 matched by URL');
  });

  // ------------------------------------------------------------------
  // Phase 4: recent indexes
  // ------------------------------------------------------------------
  it('recent returns indexes in descending time order', async () => {
    const { data } = await json('GET', '/api/intel/recent');
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 2);
    assert.ok(data[0].indexedAt >= data[1].indexedAt, 'expected descending order');
  });

  it('recent respects limit param', async () => {
    const { data } = await json('GET', '/api/intel/recent?limit=1');
    assert.equal(data.length, 1);
  });

  // ------------------------------------------------------------------
  // Phase 5: CLI query command
  // ------------------------------------------------------------------
  it('vidgrid query --json returns structured intelligence', async () => {
    try {
      const { stdout } = await execFileAsync(
        'npx',
        ['tsx', '../cli/src/index.ts', 'query', 'pothole', '--json', '--server', baseUrl],
        { cwd: `${process.cwd()}`, timeout: 15_000 },
      );
      const result = JSON.parse(stdout);
      assert.equal(result.query, 'pothole');
      assert.ok(result.sceneCount > 0);
      assert.ok(Array.isArray(result.sources));
      console.log(`  [test] CLI returned ${result.sceneCount} scenes`);
    } catch (err: any) {
      if (err.code === 'ENOENT' || err.stderr?.includes('Cannot find')) {
        console.log('  [test] CLI not available, skipping');
        return;
      }
      throw err;
    }
  });
});
