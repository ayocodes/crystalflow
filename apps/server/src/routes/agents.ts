import { Router } from 'express';
import { getAllAgents, getAgent } from '../agents/index.js';

const router = Router();

// GET /api/agents — list all connected agents
router.get('/', (_req, res) => {
  res.json(getAllAgents());
});

// GET /api/agents/:agentId — get specific agent
router.get('/:agentId', (req, res) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent);
});

export default router;
