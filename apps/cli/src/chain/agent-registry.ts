import { getPublicClient, getWalletClient, getAccount } from "./client.js";
import { AGENT_REGISTRY_ADDRESS } from "./config.js";
import { agentRegistryAbi } from "../contracts/generated.js";

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
    abi: agentRegistryAbi,
    functionName: "register",
    args: [roleToIndex(role), name, agentURI],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const agentIdLog = receipt.logs[0];
  const agentId = agentIdLog?.topics[1] ? Number(BigInt(agentIdLog.topics[1])) : 0;

  return {
    agentId,
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
    abi: agentRegistryAbi,
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
    abi: agentRegistryAbi,
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
