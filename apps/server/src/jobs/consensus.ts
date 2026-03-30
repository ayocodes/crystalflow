import type { IndexResult } from '../types.js';

export interface ConsensusResult {
  clusteredAgents: string[];
  outlierAgents: string[];
  fastestAgent: string;
  similarityScores: Record<string, number>;
  consensusReached: boolean;
  threshold: number;
}

interface IndexData {
  videoId: string;
  scenes: Array<{ timestamp: number; deltaE: number }>;
  videoInfo: { duration: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function parseIndexData(raw: unknown): IndexData | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.videoId !== 'string') return null;

  if (!Array.isArray(obj.scenes)) return null;
  for (const s of obj.scenes) {
    if (s === null || typeof s !== 'object') return null;
    const scene = s as Record<string, unknown>;
    if (typeof scene.timestamp !== 'number') return null;
    if (typeof scene.deltaE !== 'number') return null;
  }

  if (obj.videoInfo === null || typeof obj.videoInfo !== 'object') return null;
  const vi = obj.videoInfo as Record<string, unknown>;
  if (typeof vi.duration !== 'number') return null;

  return {
    videoId: obj.videoId as string,
    scenes: (obj.scenes as Array<Record<string, unknown>>).map((s) => ({
      timestamp: s.timestamp as number,
      deltaE: s.deltaE as number,
    })),
    videoInfo: { duration: vi.duration as number },
  };
}

/**
 * Compute pairwise similarity between two index results.
 *
 * Combined = 0.4 * sceneCountSimilarity + 0.6 * timestampAlignmentSimilarity
 */
function pairwiseSimilarity(a: IndexData, b: IndexData): number {
  const countA = a.scenes.length;
  const countB = b.scenes.length;

  // Scene count similarity
  const sceneCountSim = 1 - Math.abs(countA - countB) / Math.max(countA, countB, 1);

  // Timestamp alignment similarity
  let timestampSim: number;
  if (countA === 0 && countB === 0) {
    // Both have zero scenes — perfectly aligned
    timestampSim = 1;
  } else if (countA === 0 || countB === 0) {
    // One has scenes, the other does not — no alignment possible
    timestampSim = 0;
  } else {
    // For each scene in A, find the nearest scene in B by timestamp
    let totalDiff = 0;
    for (const sceneA of a.scenes) {
      let minDiff = Infinity;
      for (const sceneB of b.scenes) {
        const diff = Math.abs(sceneA.timestamp - sceneB.timestamp);
        if (diff < minDiff) minDiff = diff;
      }
      totalDiff += minDiff;
    }
    const avgDiff = totalDiff / countA;
    timestampSim = Math.max(0, 1 - avgDiff / 2.0);
  }

  return 0.4 * sceneCountSim + 0.6 * timestampSim;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function compareIndexes(results: IndexResult[]): ConsensusResult {
  const PRIMARY_THRESHOLD = 0.85;
  const FALLBACK_THRESHOLD = 0.70;

  // Single result — give benefit of the doubt
  if (results.length < 2) {
    const agentId = results.length === 1 ? results[0].agentId : '';
    console.log(`[consensus] single result from ${agentId || '(none)'} — auto-consensus`);
    return {
      clusteredAgents: agentId ? [agentId] : [],
      outlierAgents: [],
      fastestAgent: agentId,
      similarityScores: agentId ? { [agentId]: 1 } : {},
      consensusReached: results.length === 1,
      threshold: PRIMARY_THRESHOLD,
    };
  }

  // Parse all index data
  const parsed = new Map<string, IndexData>();
  for (const r of results) {
    const data = parseIndexData(r.indexData);
    if (data) {
      parsed.set(r.agentId, data);
    } else {
      console.log(`[consensus] failed to parse indexData from ${r.agentId}, skipping`);
    }
  }

  const agentIds = Array.from(parsed.keys());

  // Need at least 2 parseable results
  if (agentIds.length < 2) {
    console.log('[consensus] fewer than 2 parseable results — consensus failed');
    return {
      clusteredAgents: agentIds,
      outlierAgents: results.filter((r) => !parsed.has(r.agentId)).map((r) => r.agentId),
      fastestAgent: agentIds[0] ?? '',
      similarityScores: Object.fromEntries(agentIds.map((id) => [id, 1])),
      consensusReached: false,
      threshold: PRIMARY_THRESHOLD,
    };
  }

  // Build pairwise similarity matrix
  const simMatrix = new Map<string, Map<string, number>>();
  for (const idA of agentIds) {
    simMatrix.set(idA, new Map());
  }

  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      const idA = agentIds[i];
      const idB = agentIds[j];
      const sim = pairwiseSimilarity(parsed.get(idA)!, parsed.get(idB)!);
      simMatrix.get(idA)!.set(idB, sim);
      simMatrix.get(idB)!.set(idA, sim);
      console.log(`[consensus] pairwise similarity ${idA}\u2194${idB}: ${sim.toFixed(4)}`);
    }
  }

  // Find largest clique: group where ALL pairs have similarity > threshold
  // For small N (≤3 agents), brute-force all subsets
  function findLargestClique(ids: string[], thresh: number): string[] {
    let best: string[] = [];
    const n = ids.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      const subset: string[] = [];
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) subset.push(ids[i]);
      }
      if (subset.length < 2 || subset.length <= best.length) continue;
      // Check all pairs in subset are above threshold
      let valid = true;
      for (let i = 0; i < subset.length && valid; i++) {
        for (let j = i + 1; j < subset.length && valid; j++) {
          const sim = simMatrix.get(subset[i])!.get(subset[j])!;
          if (sim < thresh) valid = false;
        }
      }
      if (valid) best = subset;
    }
    return best;
  }

  // Try primary threshold, then fallback
  let threshold = PRIMARY_THRESHOLD;
  let cluster = findLargestClique(agentIds, threshold);

  if (cluster.length === 0) {
    console.log(`[consensus] no clique above ${PRIMARY_THRESHOLD}, trying fallback ${FALLBACK_THRESHOLD}`);
    threshold = FALLBACK_THRESHOLD;
    cluster = findLargestClique(agentIds, threshold);
  }

  const consensusReached = cluster.length > 0;
  const outliers = agentIds.filter((id) => !cluster.includes(id));

  // Also include agents whose data could not be parsed as outliers
  const unparseable = results.filter((r) => !parsed.has(r.agentId)).map((r) => r.agentId);
  outliers.push(...unparseable);

  console.log(`[consensus] cluster: [${cluster.join(', ')}], outliers: [${outliers.join(', ')}]`);

  // Fastest agent in cluster (smallest submittedAt)
  let fastestAgent = '';
  if (cluster.length > 0) {
    const clusteredResults = results.filter((r) => cluster.includes(r.agentId));
    clusteredResults.sort((a, b) => a.submittedAt - b.submittedAt);
    fastestAgent = clusteredResults[0].agentId;
    console.log(`[consensus] fastest agent: ${fastestAgent}`);
  }

  // Build per-agent avg similarity scores for reporting
  const similarityScores: Record<string, number> = {};
  for (const id of agentIds) {
    const pairSims = Array.from(simMatrix.get(id)!.values());
    similarityScores[id] = pairSims.reduce((sum, v) => sum + v, 0) / pairSims.length;
  }
  for (const id of unparseable) {
    similarityScores[id] = 0;
  }

  return {
    clusteredAgents: cluster,
    outlierAgents: outliers,
    fastestAgent,
    similarityScores,
    consensusReached,
    threshold,
  };
}
