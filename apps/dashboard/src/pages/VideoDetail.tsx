import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Film,
  Sparkles,
  Clock,
  ChevronRight,
  ChevronLeft,
  Loader2,
  XCircle,
  Trophy,
  CheckCircle2,
  Users,
  BarChart3,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import type { VideoInfo, SceneInfo } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────

function cleanFilename(raw?: string): string {
  if (!raw) return 'Untitled video';
  const basename = raw.split('/').pop() || raw;
  return basename.replace(/^\d+-[a-z0-9]+-/, '');
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

// Extended video shape returned by the API — includes consensus/agent info
interface VideoDetailData extends VideoInfo {
  jobId?: string;
  consensusStatus?: string;
  consensus?: {
    clusteredAgents: string[];
    outlierAgents: string[];
    fastestAgent: string;
    similarityScores: Record<string, number>;
  };
  agents?: Array<{ agentId: string; name: string; role: string }>;
}

// ── Score bar ─────────────────────────────────────────────────────────────

function ScoreBar({
  agentId,
  agentName,
  score,
}: {
  agentId: string;
  agentName: string;
  score: number;
}) {
  const pct = Math.round(score * 100);
  const barColor = pct >= 85 ? 'bg-emerald-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400';
  const textColor =
    pct >= 85 ? 'text-emerald-400' : pct >= 70 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 truncate font-mono text-[11px] text-slate-400">{agentName}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-700/50">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-10 text-right font-mono text-[11px] font-bold ${textColor}`}>
        {pct}%
      </span>
    </div>
  );
}

// ── Scene card ────────────────────────────────────────────────────────────

function SceneCard({ scene, jobId }: { scene: SceneInfo; jobId?: string }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = jobId
    ? `/api/scenes/${jobId}/${scene.index}`
    : null;

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 transition-all hover:border-cyan-500/20 hover:bg-slate-800/60">
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-slate-900/80">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={`Scene ${scene.index + 1} at ${formatTimestamp(scene.timestamp)}`}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Film className="h-6 w-6 text-slate-700" />
            <span className="font-mono text-xs text-slate-600">
              {formatTimestamp(scene.timestamp)}
            </span>
          </div>
        )}

        {/* Timestamp overlay */}
        {imgSrc && !imgError && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950/80 to-transparent px-2 py-1">
            <span className="font-mono text-[10px] text-slate-300">
              {formatTimestamp(scene.timestamp)}
            </span>
          </div>
        )}

        {/* Scene index badge */}
        <div className="absolute left-2 top-2 rounded-md bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          #{scene.index + 1}
        </div>
      </div>

      {/* Info row */}
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
            <Clock className="h-3 w-3 text-slate-600" />
            {formatTimestamp(scene.timestamp)}
          </span>
          {scene.deltaE !== undefined && scene.deltaE > 0 && (
            <span className="font-mono text-[10px] text-slate-600">
              ΔE {scene.deltaE.toFixed(1)}
            </span>
          )}
        </div>

        {scene.description && (
          <p className="mt-1 line-clamp-2 font-mono text-[11px] leading-relaxed text-slate-400">
            {scene.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function VideoDetail() {
  const { id: projectId, videoId } = useParams<{ id: string; videoId: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<VideoDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchVideo = useCallback(async () => {
    if (!projectId || !videoId) return;
    try {
      const data = await api.getVideo(projectId, videoId);
      setVideo(data as unknown as VideoDetailData);
    } catch {
      setError('Failed to load video');
    } finally {
      setLoading(false);
    }
  }, [projectId, videoId]);

  useEffect(() => {
    fetchVideo();
    // Poll while processing
    const interval = setInterval(async () => {
      if (video?.status === 'processing' || video?.status === 'pending') {
        await fetchVideo();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchVideo, video?.status]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
        <p className="font-mono text-sm text-slate-500">Loading video…</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="font-mono text-sm text-red-400">{error || 'Video not found'}</p>
        <Link
          to={`/projects/${projectId}`}
          className="font-mono text-xs text-slate-400 underline hover:text-slate-200"
        >
          Back to Project
        </Link>
      </div>
    );
  }

  const name = cleanFilename(video.originalName || video.filename);
  const scenes: SceneInfo[] = video.scenes ?? [];
  const consensus = video.consensus;
  const agentMap = new Map(
    (video.agents ?? []).map((a) => [a.agentId, a]),
  );

  const isProcessing = video.status === 'processing' || video.status === 'pending';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
        <Link to="/" className="hover:text-slate-300">Projects</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to={`/projects/${projectId}`} className="hover:text-slate-300">
          Project
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-slate-300">{name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
          <Film className="h-5 w-5 text-cyan-400" />
        </div>

        <div className="min-w-0 flex-1">
          <h1
            className="truncate font-mono text-xl font-bold tracking-tight text-white"
            title={name}
          >
            {name}
          </h1>

          {/* Video metadata pills */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {video.codec && (
              <span className="rounded-md bg-slate-700/40 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {video.codec}
              </span>
            )}
            {video.width && video.height && (
              <span className="rounded-md bg-slate-700/40 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {video.width}×{video.height}
              </span>
            )}
            {video.fps && (
              <span className="rounded-md bg-slate-700/40 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {video.fps.toFixed(0)} fps
              </span>
            )}
            {video.duration && (
              <span className="rounded-md bg-slate-700/40 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {formatDuration(video.duration)}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[11px] font-medium ${
                video.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : video.status === 'failed'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              {isProcessing && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
              {video.status}
            </span>
          </div>
        </div>
      </div>

      {/* Processing banner */}
      {isProcessing && (
        <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
          <div>
            <p className="font-mono text-sm font-semibold text-cyan-300">Processing in progress</p>
            <p className="font-mono text-xs text-slate-400">
              Agents are analysing this video — scene data will appear shortly
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout: scenes + consensus */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Scenes grid — 2/3 width */}
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <h2 className="font-mono text-sm font-semibold text-slate-200">Scenes</h2>
            <span className="rounded-full bg-slate-700/50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
              {scenes.length}
            </span>
          </div>

          {scenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700/50 bg-slate-800/20 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                <Sparkles className="h-6 w-6 text-slate-600" />
              </div>
              <p className="font-mono text-sm text-slate-500">
                {isProcessing ? 'Scenes will appear when processing completes' : 'No scenes detected'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {scenes.map((scene, i) => (
                <SceneCard key={i} scene={scene} jobId={video.jobId} />
              ))}
            </div>
          )}
        </div>

        {/* Consensus panel — 1/3 width */}
        <div className="space-y-4">
          {/* Consensus summary */}
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-4">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-cyan-400" />
              <h2 className="font-mono text-sm font-semibold text-slate-200">Consensus</h2>
              {video.consensusStatus && (
                <span
                  className={`ml-auto rounded-md px-2 py-0.5 font-mono text-[10px] font-medium ${
                    video.consensusStatus === 'reached'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : video.consensusStatus === 'failed'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                  }`}
                >
                  {video.consensusStatus}
                </span>
              )}
            </div>

            {consensus ? (
              <div className="space-y-5">
                {/* Similarity scores */}
                {Object.keys(consensus.similarityScores).length > 0 && (
                  <section>
                    <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                      Similarity Scores
                    </p>
                    <div className="space-y-2.5">
                      {Object.entries(consensus.similarityScores).map(([agentId, score]) => {
                        const agent = agentMap.get(agentId);
                        return (
                          <ScoreBar
                            key={agentId}
                            agentId={agentId}
                            agentName={agent?.name ?? agentId.slice(0, 12)}
                            score={score}
                          />
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Cluster */}
                {consensus.clusteredAgents.length > 0 && (
                  <section>
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                      Consensus Cluster
                    </p>
                    <div className="space-y-2">
                      {consensus.clusteredAgents.map((agentId) => {
                        const agent = agentMap.get(agentId);
                        const isFastest = consensus.fastestAgent === agentId;
                        return (
                          <div key={agentId} className="flex items-center gap-2">
                            {isFastest ? (
                              <Trophy className="h-3.5 w-3.5 text-amber-400" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            )}
                            <span className="font-mono text-xs text-slate-300">
                              {agent?.name ?? agentId.slice(0, 14)}
                            </span>
                            {isFastest && (
                              <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
                                Fastest
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {consensus.outlierAgents.map((agentId) => {
                        const agent = agentMap.get(agentId);
                        return (
                          <div key={agentId} className="flex items-center gap-2">
                            <XCircle className="h-3.5 w-3.5 text-red-400" />
                            <span className="font-mono text-xs text-red-300">
                              {agent?.name ?? agentId.slice(0, 14)}
                            </span>
                            <span className="rounded-md bg-red-400/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                              Outlier
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            ) : isProcessing ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                <p className="font-mono text-xs text-slate-400">Awaiting consensus…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <Info className="h-6 w-6 text-slate-600" />
                <p className="font-mono text-xs text-slate-500">No consensus data</p>
              </div>
            )}
          </div>

          {/* Agents panel */}
          {(video.agents ?? []).length > 0 && (
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" />
                <h2 className="font-mono text-sm font-semibold text-slate-200">Agents</h2>
                <span className="ml-auto rounded-full bg-slate-700/50 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                  {(video.agents ?? []).length}
                </span>
              </div>

              <div className="space-y-2">
                {(video.agents ?? []).map((agent) => (
                  <div
                    key={agent.agentId}
                    className="flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-800/30 px-3 py-2"
                  >
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${
                        agent.role === 'scout'
                          ? 'bg-amber-500/15 text-amber-400'
                          : agent.role === 'sentinel'
                            ? 'bg-cyan-500/15 text-cyan-400'
                            : 'bg-purple-500/15 text-purple-400'
                      }`}
                    >
                      {agent.role}
                    </span>
                    <span className="truncate font-mono text-xs text-slate-300">
                      {agent.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom accent */}
      <div className="pointer-events-none h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
    </div>
  );
}
