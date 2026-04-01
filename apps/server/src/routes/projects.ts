import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { createJob, getJob } from '../jobs/index.js';
import { onJobCreated } from '../ws/index.js';
import {
  createProject,
  getProject,
  getAllProjects,
  getPublicProjects,
  addVideoToProject,
  getProjectVideos,
  deleteProject,
  updateVisibility,
  type ProjectVisibility,
} from '../projects/index.js';
import { getIndexesByVideoId, searchScenes } from '../intel/index-store.js';

// ── Upload directories ───────────────────────────────────────────────────────

const UPLOAD_DIR = resolve(process.cwd(), 'uploads');
const SCENES_DIR = resolve(UPLOAD_DIR, 'scenes');

if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
if (!existsSync(SCENES_DIR)) mkdirSync(SCENES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are accepted'));
    }
  },
});

// ── Scene persistence helpers ────────────────────────────────────────────────

/**
 * Persist base64 scene images from a job's results into uploads/scenes/{jobId}/.
 * Called opportunistically — silently skips scenes that have no imageData.
 */
export function persistSceneImages(jobId: string): void {
  const job = getJob(jobId);
  if (!job) return;

  for (const result of job.results) {
    const raw = result.indexData as Record<string, any>;
    const scenes: any[] = raw?.scenes ?? [];

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const b64: string | undefined =
        scene.imageData ?? scene.jpegData ?? scene.image ?? scene.thumbnail;
      if (!b64) continue;

      const jobScenesDir = join(SCENES_DIR, jobId);
      if (!existsSync(jobScenesDir)) mkdirSync(jobScenesDir, { recursive: true });

      const outPath = join(jobScenesDir, `scene-${i}.jpg`);
      if (existsSync(outPath)) continue; // already saved

      try {
        const buf = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        writeFileSync(outPath, buf);
        console.log(`[projects] saved scene image ${jobId}/scene-${i}.jpg`);
      } catch (err) {
        console.warn(`[projects] failed to save scene ${i} for job ${jobId}:`, (err as Error).message);
      }
    }
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

const router = Router();

// POST /api/projects — create a project
router.post('/', (req, res) => {
  const { name, description, visibility } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const vis: ProjectVisibility = visibility === 'public' ? 'public' : 'private';
  const project = createProject(name.trim(), description?.toString() ?? '', vis);
  res.status(201).json(project);
});

// GET /api/projects — list projects (?visibility=public for public only)
router.get('/', (req, res) => {
  if (req.query.visibility === 'public') {
    res.json(getPublicProjects());
  } else {
    res.json(getAllProjects());
  }
});

// PATCH /api/projects/:id/visibility — toggle public/private
router.patch('/:id/visibility', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const vis: ProjectVisibility = req.body.visibility === 'public' ? 'public' : 'private';
  updateVisibility(project.id, vis);
  res.json({ ...project, visibility: vis });
});

// GET /api/projects/:id — get project with videos and their results
router.get('/:id', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const videos = getProjectVideos(project.id);
  res.json({ ...project, videos });
});

// POST /api/projects/:id/videos — upload a video into a project
router.post('/:id/videos', upload.single('video'), (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No video file provided' });
    return;
  }

  const filePath = resolve(UPLOAD_DIR, req.file.filename);
  const submittedBy = (req.body?.submittedBy as string) || 'dashboard';

  const job = createJob(filePath, submittedBy);
  addVideoToProject(project.id, job.id);
  onJobCreated();

  console.log(
    `[projects] ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)}MB) -> project ${project.id} / job ${job.id}`,
  );

  res.status(201).json({
    jobId: job.id,
    projectId: project.id,
    videoUrl: `/api/upload/file/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
    status: job.status,
  });
});

// GET /api/projects/:id/videos/:videoId — job detail + results + scene image URLs
router.get('/:id/videos/:videoId', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  if (!project.videoIds.includes(req.params.videoId)) {
    res.status(404).json({ error: 'Video not found in this project' });
    return;
  }

  const job = getJob(req.params.videoId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Try to persist any scene images that came back with results
  persistSceneImages(job.id);

  // Attach scene thumbnail URLs from the intel store (preferred)
  const indexes = getIndexesByVideoId(job.id);
  const scenesWithUrls = indexes.flatMap((idx) =>
    idx.scenes.map((scene, i) => {
      const imagePath = join(SCENES_DIR, job.id, `scene-${i}.jpg`);
      return {
        ...scene,
        sceneIndex: i,
        thumbnailUrl: existsSync(imagePath)
          ? `/api/scenes/${job.id}/${i}`
          : null,
      };
    }),
  );

  res.json({ ...job, indexes, scenesWithUrls });
});

// POST /api/projects/:id/query — keyword search across all videos in the project
router.post('/:id/query', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const { query } = req.body;
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  const trimmed = query.trim();

  // Search across all scenes globally, then filter to this project's jobs
  const allMatches = searchScenes(trimmed);

  // searchScenes uses videoId (not jobId) — cross-reference via intel indexes
  // We collect indexes for project jobs and filter matches by their videoId
  const projectVideoIds = new Set(
    project.videoIds.flatMap((jobId) =>
      getIndexesByVideoId(jobId).map((idx) => idx.videoId),
    ),
  );

  const filteredMatches = allMatches.filter((m) => projectVideoIds.has(m.videoId));

  // Annotate with thumbnail URLs
  const results = filteredMatches.map((m) => {
    // Find the jobId for this videoId by checking indexes
    const jobId = project.videoIds.find((jid) =>
      getIndexesByVideoId(jid).some((idx) => idx.videoId === m.videoId),
    );

    // Determine scene index within that job's index
    let sceneIndex: number | null = null;
    if (jobId) {
      const idx = getIndexesByVideoId(jobId)[0];
      if (idx) {
        sceneIndex = idx.scenes.findIndex((s) => s.timestamp === m.scene.timestamp);
        if (sceneIndex === -1) sceneIndex = null;
      }
    }

    const thumbnailUrl =
      jobId && sceneIndex !== null && existsSync(join(SCENES_DIR, jobId, `scene-${sceneIndex}.jpg`))
        ? `/api/scenes/${jobId}/${sceneIndex}`
        : null;

    return {
      videoId: m.videoId,
      videoUrl: m.videoUrl,
      jobId: jobId ?? null,
      scene: {
        ...m.scene,
        sceneIndex,
        thumbnailUrl,
      },
      relevance: m.relevance,
    };
  });

  res.json({
    query: trimmed,
    projectId: project.id,
    totalMatches: results.length,
    results,
  });
});

export default router;

// ── Scenes router (mounted at /api/scenes in src/index.ts) ──────────────────

export const scenesRouter = Router();

// GET /api/scenes/:jobId/:sceneIndex — serve a scene JPEG
scenesRouter.get('/:jobId/:sceneIndex', (req, res) => {
  const { jobId, sceneIndex } = req.params;
  const idx = parseInt(sceneIndex, 10);

  if (isNaN(idx) || idx < 0) {
    res.status(400).json({ error: 'Invalid scene index' });
    return;
  }

  const imagePath = join(SCENES_DIR, jobId, `scene-${idx}.jpg`);
  if (!existsSync(imagePath)) {
    res.status(404).json({ error: 'Scene image not found' });
    return;
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(imagePath);
});
