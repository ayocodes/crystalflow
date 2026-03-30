import { Router } from 'express';
import { queryIntelligence } from '../intel/aggregator.js';
import { getStats, getRecentIndexes, addIndex, type StoredIndex } from '../intel/index-store.js';

const router = Router();

// POST /api/intel/query — query the intelligence engine
router.post('/query', (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  const result = queryIntelligence(query.trim());
  res.json(result);
});

// GET /api/intel/stats — aggregated stats
router.get('/stats', (_req, res) => {
  res.json(getStats());
});

// GET /api/intel/recent — most recently indexed videos
router.get('/recent', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  res.json(getRecentIndexes(limit));
});

// POST /api/intel/ingest — manually ingest an index (for testing/enrichment)
router.post('/ingest', (req, res) => {
  const { videoId, videoUrl, scenes, videoInfo, storageCid, indexedBy } = req.body;

  if (!videoId || !scenes || !videoInfo) {
    res.status(400).json({ error: 'videoId, scenes, and videoInfo are required' });
    return;
  }

  const index: StoredIndex = {
    videoId,
    videoUrl: videoUrl ?? '',
    scenes: scenes ?? [],
    videoInfo: videoInfo ?? { duration: 0 },
    storageCid,
    indexedAt: Date.now(),
    indexedBy: indexedBy ?? 'manual',
    jobId: 'manual',
  };

  addIndex(index);
  res.status(201).json({ stored: true, videoId, sceneCount: index.scenes.length });
});

export default router;
