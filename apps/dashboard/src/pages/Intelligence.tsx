import { useState, useMemo, useCallback, type FormEvent } from 'react';
import {
  BrainCircuit,
  Film,
  Sparkles,
  Zap,
  Search,
  Loader2,
  Database,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useNetwork } from '../providers/NetworkContext';
import { api } from '../api/client';
import type { Job, IndexResult } from '../types';

/* ------------------------------------------------------------------ */
/*  Stat card – mirrors StatsBar style                                */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  accent: string;
  iconBg: string;
}

function StatCard({ icon, value, label, accent, iconBg }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all hover:border-slate-600/50 hover:bg-slate-800/70">
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.12] ${accent}`}
      />
      <div className="relative flex items-center gap-3.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </div>
        <div>
          <p className="font-mono text-2xl font-bold leading-tight text-white">
            {value}
          </p>
          <p className="mt-0.5 text-xs tracking-wide text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene timeline bar                                                */
/* ------------------------------------------------------------------ */

function SceneTimeline({
  scenes,
  duration,
}: {
  scenes: Array<{ timestamp: number; deltaE: number }>;
  duration: number;
}) {
  if (!scenes.length || !duration) return null;

  const maxDelta = Math.max(...scenes.map((s) => s.deltaE), 1);

  return (
    <div className="mt-3">
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        Scene Timeline
      </p>
      <div className="relative h-6 w-full overflow-hidden rounded-lg bg-slate-900/80 border border-slate-700/30">
        {/* Duration track */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800/40 to-slate-800/20" />

        {/* Tick marks at 25%, 50%, 75% */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <div
            key={pct}
            className="absolute top-0 h-full w-px bg-slate-700/30"
            style={{ left: `${pct * 100}%` }}
          />
        ))}

        {/* Scene markers */}
        {scenes.map((scene, i) => {
          const pct = (scene.timestamp / duration) * 100;
          const intensity = scene.deltaE / maxDelta;
          // Opacity and size scale with deltaE intensity
          const opacity = 0.4 + intensity * 0.6;
          const size = 6 + intensity * 6;

          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${Math.min(Math.max(pct, 1), 99)}%`,
                width: `${size}px`,
                height: `${size}px`,
                background: `rgba(34, 211, 238, ${opacity})`,
                boxShadow:
                  intensity > 0.6
                    ? `0 0 ${4 + intensity * 8}px rgba(34, 211, 238, ${intensity * 0.5})`
                    : 'none',
              }}
              title={`${scene.timestamp.toFixed(1)}s  |  deltaE: ${scene.deltaE.toFixed(1)}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
        <span>0s</span>
        <span>{duration.toFixed(0)}s</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Video knowledge card                                              */
/* ------------------------------------------------------------------ */

function VideoCard({ job }: { job: Job }) {
  const firstResult: IndexResult | undefined = job.results[0];
  const scenes = firstResult?.indexData?.scenes ?? [];
  const duration = firstResult?.indexData?.videoInfo?.duration ?? 0;
  const totalScenes = scenes.length;
  const storageCid = job.results.find((r) => r.storageCid)?.storageCid;
  const consensusReached = job.consensusStatus === 'reached';
  const consensusFailed = job.consensusStatus === 'failed';

  // Truncate URL for display
  const displayUrl =
    job.videoUrl.length > 48
      ? job.videoUrl.slice(0, 24) + '...' + job.videoUrl.slice(-20)
      : job.videoUrl;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 transition-all hover:border-cyan-500/20 hover:bg-slate-800/50">
      {/* Top glow accent */}
      <div className="absolute -top-10 left-1/2 h-20 w-40 -translate-x-1/2 rounded-full bg-cyan-500 opacity-[0.03] blur-2xl transition-opacity group-hover:opacity-[0.06]" />

      <div className="relative">
        {/* Header: URL + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-mono text-sm text-slate-200"
              title={job.videoUrl}
            >
              {displayUrl}
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">
              Job {job.id.slice(0, 8)}
            </p>
          </div>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-colors group-hover:text-cyan-400" />
        </div>

        {/* Metrics row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-400">
            <Sparkles className="h-3 w-3" />
            {totalScenes} scene{totalScenes !== 1 ? 's' : ''}
          </span>

          {duration > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-700/50 px-2 py-0.5 font-mono text-[11px] text-slate-300">
              <Film className="h-3 w-3" />
              {duration.toFixed(1)}s
            </span>
          )}

          {storageCid && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400"
              title={storageCid}
            >
              <Database className="h-3 w-3" />
              {storageCid.slice(0, 8)}...
            </span>
          )}

          {consensusReached && (
            <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 font-mono text-[11px] text-purple-400">
              <ShieldCheck className="h-3 w-3" />
              Consensus
            </span>
          )}

          {consensusFailed && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Disputed
            </span>
          )}
        </div>

        {/* Agents contributing */}
        <div className="mt-2.5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            {job.results.length} agent{job.results.length !== 1 ? 's' : ''}{' '}
            contributed
          </p>
          <div className="mt-1 flex -space-x-1.5">
            {job.results.slice(0, 5).map((r, i) => (
              <div
                key={r.agentId}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 font-mono text-[8px] font-bold text-cyan-400"
                title={r.agentId}
                style={{ zIndex: 5 - i }}
              >
                {r.agentId.slice(0, 2).toUpperCase()}
              </div>
            ))}
            {job.results.length > 5 && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-800 font-mono text-[8px] text-slate-400">
                +{job.results.length - 5}
              </div>
            )}
          </div>
        </div>

        {/* Scene timeline */}
        <SceneTimeline scenes={scenes} duration={duration} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function Intelligence() {
  const { jobs } = useNetwork();

  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<unknown>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ---- Derived data ---- */

  const completedJobs = useMemo(
    () => jobs.filter((j) => j.status === 'completed'),
    [jobs],
  );

  const totalScenes = useMemo(
    () =>
      completedJobs.reduce((sum, j) => {
        return (
          sum +
          j.results.reduce(
            (rSum, r) => rSum + (r.indexData?.scenes?.length ?? 0),
            0,
          )
        );
      }, 0),
    [completedJobs],
  );

  const throughput = useMemo(() => {
    if (completedJobs.length < 2) return null;

    const timestamps = completedJobs
      .flatMap((j) => j.results.map((r) => r.submittedAt))
      .filter(Boolean)
      .sort((a, b) => a - b);

    if (timestamps.length < 2) return null;

    const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
    const spanHrs = spanMs / (1000 * 60 * 60);
    if (spanHrs < 0.001) return null;

    return (completedJobs.length / spanHrs).toFixed(1);
  }, [completedJobs]);

  /* ---- Query handler ---- */

  const handleQuery = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!query.trim() || loading) return;

      setLoading(true);
      setQueryError(null);
      setQueryResult(null);

      try {
        const result = await api.queryIntel(query.trim());
        setQueryResult(result);
      } catch {
        setQueryError('Intelligence endpoint not available yet');
      } finally {
        setLoading(false);
      }
    },
    [query, loading],
  );

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10">
            <BrainCircuit className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight text-white">
              Intelligence
            </h1>
            <p className="font-mono text-sm text-slate-400">
              Query the decentralized video knowledge graph
            </p>
          </div>
        </div>
      </div>

      {/* ---- Stats row ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Film className="h-5 w-5 text-cyan-400" />}
          value={completedJobs.length}
          label="Videos Indexed"
          accent="bg-cyan-400"
          iconBg="bg-cyan-500/10"
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5 text-purple-400" />}
          value={totalScenes}
          label="Scenes Detected"
          accent="bg-purple-400"
          iconBg="bg-purple-500/10"
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-amber-400" />}
          value={throughput ? `${throughput}/hr` : '\u2014'}
          label="Network Throughput"
          accent="bg-amber-400"
          iconBg="bg-amber-500/10"
        />
      </div>

      {/* ---- Query section ---- */}
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30">
        <div className="border-b border-slate-700/30 px-5 py-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-cyan-400" />
            <h2 className="font-mono text-sm font-semibold text-white">
              Query Knowledge Graph
            </h2>
          </div>
        </div>

        <div className="p-5">
          <form onSubmit={handleQuery} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Ask the network: e.g., "Show all scenes with traffic congestion"'
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-mono text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 font-mono text-sm font-semibold text-slate-950 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </button>
          </form>

          {/* Query results / error */}
          {loading && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              <p className="font-mono text-sm text-cyan-300">
                Querying the decentralized knowledge graph...
              </p>
            </div>
          )}

          {queryError && (
            <div className="mt-4 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-slate-500" />
                <p className="font-mono text-sm text-slate-400">{queryError}</p>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-600">
                The intelligence query API will resolve once agents index enough
                video data.
              </p>
            </div>
          )}

          {queryResult != null && !queryError && (
            <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="mb-2 font-mono text-xs uppercase tracking-widest text-cyan-400">
                Query Result
              </p>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-slate-300">
                {JSON.stringify(queryResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* ---- Network Knowledge / Indexed Videos ---- */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Layers className="h-4 w-4 text-cyan-400" />
          <h2 className="font-mono text-sm font-semibold text-white">
            Indexed Videos
          </h2>
          {completedJobs.length > 0 && (
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-400">
              {completedJobs.length}
            </span>
          )}
        </div>

        {completedJobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedJobs.map((job) => (
              <VideoCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-800/20 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/80">
              <BrainCircuit className="h-7 w-7 text-slate-600" />
            </div>
            <p className="mt-4 font-mono text-sm text-slate-400">
              No indexed videos yet.
            </p>
            <p className="mt-1 max-w-sm font-mono text-xs leading-relaxed text-slate-600">
              Submit videos to the network to begin building the knowledge graph.
              Agents will process, index, and reach consensus on video content
              automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
