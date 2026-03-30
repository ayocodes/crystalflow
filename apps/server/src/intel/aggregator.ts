/**
 * Intelligence aggregation engine.
 * Queries stored indexes and synthesizes answers from scene data.
 */

import {
  searchScenes,
  getAllIndexes,
  getStats,
  type SceneMatch,
} from './index-store.js';

export interface IntelSource {
  videoId: string;
  videoUrl: string;
  scene: number;
  timestamp: number;
  description?: string;
  relevance: number;
}

export interface IntelligenceResult {
  query: string;
  answer: string;
  sources: IntelSource[];
  confidence: number;
  indexCount: number;
  sceneCount: number;
}

export function queryIntelligence(query: string): IntelligenceResult {
  const stats = getStats();
  const matches = searchScenes(query);

  if (matches.length === 0) {
    return {
      query,
      answer:
        stats.totalIndexes === 0
          ? 'No indexed videos available yet.'
          : `No relevant scenes found across ${stats.totalVideos} indexed videos (${stats.totalScenes} scenes).`,
      sources: [],
      confidence: 0,
      indexCount: stats.totalIndexes,
      sceneCount: 0,
    };
  }

  // Group matches by video
  const byVideo = new Map<string, SceneMatch[]>();
  for (const m of matches) {
    const existing = byVideo.get(m.videoId) ?? [];
    existing.push(m);
    byVideo.set(m.videoId, existing);
  }

  const videoCount = byVideo.size;
  const allIndexes = getAllIndexes();
  const totalVideos = new Set(allIndexes.map((i) => i.videoId)).size;

  // Confidence: more videos corroborating = higher confidence
  // Also factor in average relevance of matches
  const avgRelevance =
    matches.reduce((sum, m) => sum + m.relevance, 0) / matches.length;
  const coverage = totalVideos > 0 ? videoCount / totalVideos : 0;
  const confidence = Math.min(
    0.95,
    avgRelevance * 0.6 + coverage * 0.4,
  );

  // Synthesize answer
  const answer = synthesize(query, matches, byVideo, videoCount);

  // Build sources
  const sources: IntelSource[] = matches.slice(0, 20).map((m) => ({
    videoId: m.videoId,
    videoUrl: m.videoUrl,
    scene: m.scene.timestamp,
    timestamp: m.scene.timestamp,
    description: m.scene.description,
    relevance: m.relevance,
  }));

  return {
    query,
    answer,
    sources,
    confidence: Math.round(confidence * 100) / 100,
    indexCount: stats.totalIndexes,
    sceneCount: matches.length,
  };
}

function synthesize(
  query: string,
  matches: SceneMatch[],
  byVideo: Map<string, SceneMatch[]>,
  videoCount: number,
): string {
  const sceneCount = matches.length;
  const parts: string[] = [];

  parts.push(
    `${sceneCount} relevant scene${sceneCount === 1 ? '' : 's'} found across ${videoCount} video feed${videoCount === 1 ? '' : 's'}.`,
  );

  // Add per-video breakdown if multiple videos
  if (videoCount > 1) {
    const breakdown = Array.from(byVideo.entries())
      .map(([vid, scenes]) => `${vid}: ${scenes.length} scene${scenes.length === 1 ? '' : 's'}`)
      .slice(0, 5);
    parts.push(`Breakdown: ${breakdown.join(', ')}.`);
  }

  // Add sample descriptions if available
  const described = matches
    .filter((m) => m.scene.description)
    .slice(0, 3);
  if (described.length > 0) {
    const descs = described.map(
      (m) => `"${m.scene.description}" (${m.videoId} @ ${m.scene.timestamp.toFixed(1)}s)`,
    );
    parts.push(`Key observations: ${descs.join('; ')}.`);
  }

  return parts.join(' ');
}
