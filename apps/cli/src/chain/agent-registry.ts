import { getPublicClient, getWalletClient, getAccount } from "./client.js";
import { AGENT_REGISTRY_ADDRESS } from "./config.js";

const AGENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "role", type: "uint8" },
      { name: "name", type: "string" },
      { name: "agentURI", type: "string" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAgent",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "role", type: "uint8" },
          { name: "name", type: "string" },
          { name: "agentURI", type: "string" },
          { name: "registeredAt", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentByOwner",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "role", type: "uint8" },
          { name: "name", type: "string" },
          { name: "agentURI", type: "string" },
          { name: "registeredAt", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAgentCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllAgentIds",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isActiveAgent",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "deactivate",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateURI",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "role", type: "uint8", indexed: false },
      { name: "name", type: "string", indexed: false },
    ],
  },
  { type: "error", name: "AlreadyRegistered", inputs: [] },
  { type: "error", name: "AgentNotFound", inputs: [] },
  { type: "error", name: "NotAgentOwner", inputs: [] },
  { type: "error", name: "EmptyName", inputs: [] },
] as const;

const ROLES = ["Scout", "Sentinel", "Curator"] as const;

export type RoleName = (typeof ROLES)[number];

function roleToIndex(role: RoleName): number {
  const idx = ROLES.indexOf(role);
  if (idx === -1) throw new Error(`Invalid role: ${role}`);
  return idx;
}

function indexToRole(idx: number): RoleName {
  if (idx < 0 || idx >= ROLES.length) throw new Error(`Invalid role index: ${idx}`);
  return ROLES[idx];
}

export async function registerAgent(role: RoleName, name: string, agentURI: string) {
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "register",
    args: [roleToIndex(role), name, agentURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Parse agentId from logs
  const agentIdLog = receipt.logs[0];
  const agentId = agentIdLog?.topics[1] ? BigInt(agentIdLog.topics[1]) : 0n;

  return {
    agentId: Number(agentId),
    role,
    name,
    address: walletClient.account.address,
    agentURI,
    txHash: hash,
  };
}

export async function getAgent(agentId: number) {
  const publicClient = getPublicClient();

  const agent = await publicClient.readContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgent",
    args: [BigInt(agentId)],
  });

  return {
    agentId: Number(agent.id),
    role: indexToRole(agent.role),
    name: agent.name,
    address: agent.owner,
    agentURI: agent.agentURI,
    active: agent.active,
    registeredAt: Number(agent.registeredAt),
  };
}

export async function getStatus() {
  const publicClient = getPublicClient();
  const account = getAccount();

  const agent = await publicClient.readContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgentByOwner",
    args: [account.address],
  });

  return {
    agentId: Number(agent.id),
    role: indexToRole(agent.role),
    name: agent.name,
    address: agent.owner,
    agentURI: agent.agentURI,
    active: agent.active,
    registeredAt: Number(agent.registeredAt),
  };
}
