import { Router } from 'express';
import { createJob, getJob, getAllJobs, submitResult, clearAll } from '../jobs/index.js';
import { onJobCreated } from '../ws/index.js';
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
  res.json(updated);
});

// DELETE /api/jobs — clear all jobs (dev/test only)
router.delete('/', (_req, res) => {
  clearAll();
  res.json({ cleared: true });
});

export default router;
