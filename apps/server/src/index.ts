import { createServer } from 'node:http';
import express from 'express';
import { attachWebSocket } from './ws/index.js';
import { startCleanupTimer } from './agents/index.js';
import agentRoutes from './routes/agents.js';
import jobRoutes from './routes/jobs.js';

const PORT = Number(process.env.PORT) || 3001;

const app = express();

// CORS — allow dashboard and any local dev origin
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Routes
app.use('/api/agents', agentRoutes);
app.use('/api/jobs', jobRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message });
});

// Boot
const server = createServer(app);
attachWebSocket(server);
startCleanupTimer();

server.listen(PORT, () => {
  console.log(`\n  VidGrid Signal Server`);
  console.log(`  Port:      ${PORT}`);
  console.log(`  Health:    http://localhost:${PORT}/health`);
  console.log(`  WebSocket: ws://localhost:${PORT}`);
  console.log(`  Ready.\n`);
});

// Graceful shutdown
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`\n[${sig}] shutting down...`);
    server.close(() => process.exit(0));
  });
}
