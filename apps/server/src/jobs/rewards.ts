import type { ConsensusResult } from './consensus.js';
import type { RewardBreakdown } from '../types.js';

const BASE_REWARD = 100; // base points per indexed video

/**
 * Calculates reward distribution from a consensus result.
 *
 * Split: 40% fastest, 30% confirming (split equally), 30% reserved (10% burn, 20% protocol)
 */
export function distributeRewards(
  consensusResult: ConsensusResult,
  totalReward: number = BASE_REWARD,
): RewardBreakdown[] {
  const rewards: RewardBreakdown[] = [];

  if (!consensusResult.consensusReached || consensusResult.clusteredAgents.length === 0) {
    console.log('[rewards] no consensus — no rewards distributed');
    return rewards;
  }

  const { fastestAgent, clusteredAgents } = consensusResult;
  const confirmingAgents = clusteredAgents.filter((a) => a !== fastestAgent);

  // 40% → fastest agent in consensus
  const fastestAmount = Math.floor(totalReward * 0.4);
  rewards.push({ agentId: fastestAgent, amount: fastestAmount, role: 'fastest' });

  // 30% → split equally among confirming agents
  const confirmingPool = Math.floor(totalReward * 0.3);
  if (confirmingAgents.length > 0) {
    const perConfirming = Math.floor(confirmingPool / confirmingAgents.length);
    for (const agentId of confirmingAgents) {
      rewards.push({ agentId, amount: perConfirming, role: 'confirming' });
    }
  }

  // 30% reserved: 10% burn, 20% protocol
  const burnAmount = Math.floor(totalReward * 0.1);
  const protocolAmount = Math.floor(totalReward * 0.2);

  rewards.push({ agentId: 'protocol', amount: protocolAmount, role: 'protocol' });
  rewards.push({ agentId: 'burn', amount: burnAmount, role: 'burned' });

  console.log(
    `[rewards] distributed ${totalReward} points: fastest=${fastestAgent} (${fastestAmount}), ` +
      `confirming=${confirmingAgents.length} agents (${confirmingPool}), ` +
      `protocol=${protocolAmount}, burn=${burnAmount}`,
  );

  return rewards;
}
