import { Router } from 'express';
import { getAllAgents, getAgent, registerAgent, updateHeartbeat, setAgentStatus } from '../agents/index.js';
import type { AgentRole, AgentStatus } from '../types.js';

const router = Router();

// GET /api/agents — list all connected agents
router.get('/', (_req, res) => {
  res.json(getAllAgents());
});

// POST /api/agents/register — REST-based agent registration
router.post('/register', (req, res) => {
  const { agentId, name, role, address } = req.body;

  if (!agentId || !name || !role) {
    res.status(400).json({ error: 'agentId, name, and role are required' });
    return;
  }

  const validRoles: AgentRole[] = ['scout', 'sentinel', 'curator'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const agentInfo = {
    agentId,
    name,
    role: role as AgentRole,
    address: address || '0x0000000000000000000000000000000000000000',
    connectedAt: Date.now(),
    lastHeartbeat: Date.now(),
    status: 'idle' as const,
  };

  registerAgent(agentInfo);
  res.status(201).json(agentInfo);
});

// POST /api/agents/:agentId/heartbeat — keep agent alive, optionally update status
router.post('/:agentId/heartbeat', (req, res) => {
  const agent = getAgent(req.params.agentId);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  updateHeartbeat(req.params.agentId);

  // Allow agents to self-report status via heartbeat
  const validStatuses: AgentStatus[] = ['idle', 'working'];
  if (req.body.status && validStatuses.includes(req.body.status)) {
    setAgentStatus(req.params.agentId, req.body.status, req.body.jobId);
  }

  res.json({ ok: true, agentId: req.params.agentId, status: agent.status, lastHeartbeat: Date.now() });
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
