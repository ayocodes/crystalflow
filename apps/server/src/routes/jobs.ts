import { Router } from 'express';
import { createJob, getJob, getAllJobs, submitResult, clearAll } from '../jobs/index.js';
import { onJobCreated, broadcast } from '../ws/index.js';
import { compareIndexes, parseIndexData } from '../jobs/consensus.js';
import { distributeRewards } from '../jobs/rewards.js';
import { addIndex, type StoredIndex } from '../intel/index-store.js';
import type { IndexResult } from '../types.js';

const router = Router();

// POST /api/jobs — create a new job
router.post('/', (req, res) => {
  const { videoUrl } = req.body;
  if (!videoUrl || typeof videoUrl !== 'string') {
    res.status(400).json({ error: 'videoUrl is required' });
    return;
  }

  const submittedBy = (req.body.submittedBy as string) || 'api';
  const job = createJob(videoUrl, submittedBy);

  // Trigger assignment to available sentinels
  onJobCreated();

  res.status(201).json(job);
});

// GET /api/jobs — list all jobs
router.get('/', (_req, res) => {
  res.json(getAllJobs());
});

// GET /api/jobs/:jobId — get specific job with results
router.get('/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

// POST /api/jobs/:jobId/result — submit index result (CLI fallback to WS)
router.post('/:jobId/result', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const result: IndexResult = {
    agentId: req.body.agentId,
    submittedAt: Date.now(),
    indexData: req.body.indexData,
    storageCid: req.body.storageCid,
  };

  if (!result.agentId) {
    res.status(400).json({ error: 'agentId is required' });
    return;
  }

  const updated = submitResult(req.params.jobId, result);
  if (!updated) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Run consensus when all results are in
  if (updated.status === 'completed') {
    const consensusResult = compareIndexes(updated.results);
    const rewards = distributeRewards(consensusResult);

    updated.consensusStatus = consensusResult.consensusReached ? 'reached' : 'failed';
    updated.consensus = {
      clusteredAgents: consensusResult.clusteredAgents,
      outlierAgents: consensusResult.outlierAgents,
      fastestAgent: consensusResult.fastestAgent,
      similarityScores: consensusResult.similarityScores,
      rewards,
    };

    broadcast({ type: 'job:consensus', jobId: updated.id, consensus: updated.consensus });
    broadcast({ type: 'job:completed', jobId: updated.id });

    // Store winning index in intel layer
    if (consensusResult.consensusReached && consensusResult.fastestAgent) {
      const winningResult = updated.results.find(
        (r) => r.agentId === consensusResult.fastestAgent,
      );
      if (winningResult) {
        const parsed = parseIndexData(winningResult.indexData);
        if (parsed) {
          const raw = winningResult.indexData as Record<string, any>;
          const stored: StoredIndex = {
            videoId: parsed.videoId,
            videoUrl: updated.videoUrl,
            scenes: (raw.scenes ?? parsed.scenes).map((s: any) => ({
              timestamp: s.timestamp,
              deltaE: s.deltaE ?? 0,
              description: s.description,
              colors: s.colors,
            })),
            videoInfo: {
              duration: parsed.videoInfo.duration,
              codec: raw.videoInfo?.codec,
              width: raw.videoInfo?.width,
              height: raw.videoInfo?.height,
              fps: raw.videoInfo?.fps,
            },
            storageCid: winningResult.storageCid,
            indexedAt: winningResult.submittedAt,
            indexedBy: winningResult.agentId,
            jobId: updated.id,
          };
          addIndex(stored);
        }
      }
    }
  }

  res.json(updated);
});

// DELETE /api/jobs — clear all jobs (dev/test only)
router.delete('/', (_req, res) => {
  clearAll();
  res.json({ cleared: true });
});

export default router;
