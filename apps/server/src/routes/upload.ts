import { Router } from 'express';
import multer from 'multer';
import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createJob } from '../jobs/index.js';
import { onJobCreated } from '../ws/index.js';

const UPLOAD_DIR = resolve(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

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

const router = Router();

// POST /api/upload — upload a video file and create a job
router.post('/', upload.single('video'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No video file provided' });
    return;
  }

  const filePath = resolve(UPLOAD_DIR, req.file.filename);
  const submittedBy = (req.body?.submittedBy as string) || 'dashboard';

  // Create job with the file path — agents on the same machine read directly,
  // remote agents fetch via /api/upload/file/:filename
  const job = createJob(filePath, submittedBy);
  onJobCreated();

  console.log(`[upload] ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)}MB) -> ${filePath}`);

  res.status(201).json({
    jobId: job.id,
    videoUrl: `/api/upload/file/${req.file.filename}`,
    originalName: req.file.originalname,
    size: req.file.size,
    status: job.status,
  });
});

// Serve uploaded files (so dashboard can preview)
router.get('/file/:filename', (req, res) => {
  const filePath = resolve(UPLOAD_DIR, req.params.filename);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(filePath);
});

export default router;
