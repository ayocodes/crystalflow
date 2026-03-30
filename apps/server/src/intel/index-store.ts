/**
 * In-memory store of all completed, consensus-validated indexes.
 * Populated when jobs complete with consensus reached.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface StoredScene {
  timestamp: number;
  deltaE: number;
  description?: string;
  colors?: RGB[];
}

export interface StoredIndex {
  videoId: string;
  videoUrl: string;
  scenes: StoredScene[];
  videoInfo: {
    codec?: string;
    width?: number;
    height?: number;
    duration: number;
    fps?: number;
  };
  storageCid?: string;
  indexedAt: number;
  indexedBy: string;
  jobId: string;
}

export interface SceneMatch {
  videoId: string;
  videoUrl: string;
  scene: StoredScene;
  relevance: number;
}

const indexes: StoredIndex[] = [];

export function addIndex(index: StoredIndex): void {
  indexes.push(index);
  console.log(
    `[intel] stored index for ${index.videoId} (${index.scenes.length} scenes) by ${index.indexedBy}`,
  );
}

export function getAllIndexes(): StoredIndex[] {
  return indexes;
}

export function getIndexesByVideoId(videoId: string): StoredIndex[] {
  return indexes.filter((idx) => idx.videoId === videoId);
}

export function getRecentIndexes(limit = 10): StoredIndex[] {
  return [...indexes].sort((a, b) => b.indexedAt - a.indexedAt).slice(0, limit);
}

/**
 * Simple keyword search across scene descriptions and video metadata.
 * Returns matched scenes ranked by relevance.
 */
export function searchScenes(query: string): SceneMatch[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) return [];

  const matches: SceneMatch[] = [];

  for (const idx of indexes) {
    // Check if videoUrl or videoId matches any term (partial)
    const metaText = `${idx.videoId} ${idx.videoUrl}`.toLowerCase();
    const metaRelevance = terms.reduce(
      (score, term) => score + (metaText.includes(term) ? 0.3 : 0),
      0,
    );

    for (const scene of idx.scenes) {
      let relevance = metaRelevance;

      // Match against scene description if present
      if (scene.description) {
        const desc = scene.description.toLowerCase();
        relevance += terms.reduce(
          (score, term) => score + (desc.includes(term) ? 0.5 : 0),
          0,
        );
      }

      if (relevance > 0) {
        matches.push({
          videoId: idx.videoId,
          videoUrl: idx.videoUrl,
          scene,
          relevance: Math.min(relevance, 1),
        });
      }
    }
  }

  // Sort by relevance descending
  matches.sort((a, b) => b.relevance - a.relevance);
  return matches;
}

export function getStats(): {
  totalVideos: number;
  totalScenes: number;
  totalIndexes: number;
} {
  const uniqueVideos = new Set(indexes.map((idx) => idx.videoId));
  const totalScenes = indexes.reduce((sum, idx) => sum + idx.scenes.length, 0);
  return {
    totalVideos: uniqueVideos.size,
    totalScenes,
    totalIndexes: indexes.length,
  };
}
