import { useState, useMemo } from 'react';
import {
  ListTodo,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  FileCheck,
  Trophy,
  CheckCircle2,
  XCircle,
  Loader2,
  Database,
  Film,
  Coins,
  BarChart3,
} from 'lucide-react';
import { useNetwork } from '../providers/NetworkContext';
import type { Job, JobStatus, AgentInfo } from '../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + '\u2026';
}

function truncateCid(cid: string): string {
  if (cid.length <= 16) return cid;
  return `${cid.slice(0, 8)}\u2026${cid.slice(-6)}`;
}

function agentName(agentId: string, agentMap: Map<string, AgentInfo>): string {
  const a = agentMap.get(agentId);
  return a ? a.name : agentId.slice(0, 12);
}

/* ------------------------------------------------------------------ */
/*  Status styling                                                     */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<
  JobStatus,
  { text: string; bg: string; border: string; dot: string }
> = {
  pending: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/20',
    dot: 'bg-yellow-400',
  },
  assigned: {
    text: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
    dot: 'bg-blue-400',
  },
  completed: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    dot: 'bg-emerald-400',
  },
  failed: {
    text: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/20',
    dot: 'bg-red-400',
  },
};

const CONSENSUS_STYLES: Record<string, { text: string; bg: string; label: string }> = {
  pending: { text: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Pending' },
  reached: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Reached' },
  failed: { text: 'text-red-400', bg: 'bg-red-400/10', label: 'Failed' },
};

const REWARD_LABELS: Record<string, { label: string; color: string }> = {
  fastest: { label: 'Fastest', color: 'text-amber-400' },
  confirming: { label: 'Confirming', color: 'text-cyan-400' },
  protocol: { label: 'Protocol', color: 'text-purple-400' },
  burned: { label: 'Burned', color: 'text-red-400' },
};

type FilterStatus = 'all' | JobStatus;

/* ------------------------------------------------------------------ */
/*  Similarity bar                                                     */
/* ------------------------------------------------------------------ */

function ScoreBar({ agentId, score, agentMap }: { agentId: string; score: number; agentMap: Map<string, AgentInfo> }) {
  const pct = Math.round(score * 100);
  let barColor = 'bg-red-400';
  let textColor = 'text-red-400';
  if (pct >= 85) {
    barColor = 'bg-emerald-400';
    textColor = 'text-emerald-400';
  } else if (pct >= 70) {
    barColor = 'bg-yellow-400';
    textColor = 'text-yellow-400';
  }

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 truncate font-mono text-[11px] text-slate-400">
        {agentName(agentId, agentMap)}
      </span>
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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Jobs() {
  const { jobs, agents } = useNetwork();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const agentMap = useMemo(
    () => new Map(agents.map((a) => [a.agentId, a])),
    [agents],
  );

  const filters: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  const sortedJobs = useMemo(
    () =>
      [...jobs]
        .filter((j) => statusFilter === 'all' || j.status === statusFilter)
        .sort((a, b) => b.submittedAt - a.submittedAt),
    [jobs, statusFilter],
  );

  const statusCounts = jobs.reduce(
    (acc, j) => {
      acc[j.status] = (acc[j.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10">
            <ListTodo className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">Job Queue</h1>
            <p className="font-mono text-xs tracking-wider text-slate-500">
              Video indexing pipeline
            </p>
          </div>
        </div>

        {/* Live counters */}
        <div className="flex items-center gap-2">
          {(['pending', 'assigned', 'completed', 'failed'] as JobStatus[]).map((s) => {
            const st = STATUS_STYLES[s];
            return (
              <div
                key={s}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px] ${st.bg} ${st.border} ${st.text}`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${st.dot}`} />
                <span className="capitalize">{s}</span>
                <span className="font-bold">{statusCounts[s] || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-800/50 p-1">
          {filters.map(({ value, label }) => {
            const isActive = statusFilter === value;
            let activeClasses = 'text-slate-400 hover:text-slate-200';
            if (isActive) {
              if (value === 'all') {
                activeClasses = 'bg-slate-700 text-slate-100 shadow-sm';
              } else {
                const st = STATUS_STYLES[value as JobStatus];
                activeClasses = `${st.bg} ${st.text} shadow-sm`;
              }
            }
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all ${activeClasses}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <span className="ml-auto font-mono text-xs text-slate-500">
          {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Job list */}
      <div className="space-y-3">
        {sortedJobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/30 py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
              <Film className="h-6 w-6 text-slate-600" />
            </div>
            <p className="font-mono text-sm text-slate-500">No jobs in queue</p>
            <p className="font-mono text-[10px] text-slate-600">
              Submit a video URL to start indexing
            </p>
          </div>
        ) : (
          sortedJobs.map((job) => {
            const isExpanded = selectedJobId === job.id;
            const st = STATUS_STYLES[job.status];

            return (
              <div key={job.id} className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 transition-colors hover:border-slate-600/50">
                {/* Collapsed row */}
                <button
                  onClick={() => setSelectedJobId(isExpanded ? null : job.id)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors"
                >
                  {/* Expand chevron */}
                  <div className="text-slate-500">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium capitalize ${st.text} ${st.bg} ${st.border}`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {job.status}
                  </span>

                  {/* Video URL */}
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-300">
                    {truncateUrl(job.videoUrl)}
                  </span>

                  {/* Metadata pills */}
                  <div className="flex items-center gap-3">
                    {/* Assigned agents */}
                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                      <Users className="h-3 w-3" />
                      <span>{job.assignedTo.length}</span>
                    </div>

                    {/* Results */}
                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                      <FileCheck className="h-3 w-3" />
                      <span>
                        {job.results.length}/{job.assignedTo.length || '\u2013'}
                      </span>
                    </div>

                    {/* Consensus badge */}
                    {job.consensusStatus && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium ${CONSENSUS_STYLES[job.consensusStatus].bg} ${CONSENSUS_STYLES[job.consensusStatus].text}`}
                      >
                        {CONSENSUS_STYLES[job.consensusStatus].label}
                      </span>
                    )}

                    {/* Time */}
                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{timeAgo(job.submittedAt)}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <JobDetail job={job} agentMap={agentMap} />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom glow accent */}
      <div className="pointer-events-none -mt-px h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Job detail panel                                                   */
/* ------------------------------------------------------------------ */

function JobDetail({
  job,
  agentMap,
}: {
  job: Job;
  agentMap: Map<string, AgentInfo>;
}) {
  return (
    <div className="border-t border-slate-700/30 bg-slate-900/40 px-6 py-5">
      {/* Top metadata row */}
      <div className="mb-5 grid grid-cols-4 gap-4">
        <MetaItem label="Job ID" value={job.id} mono />
        <MetaItem label="Submitted By" value={`${job.submittedBy.slice(0, 6)}\u2026${job.submittedBy.slice(-4)}`} mono />
        <MetaItem label="Submitted At" value={formatTime(job.submittedAt)} />
        <MetaItem label="Video URL" value={job.videoUrl} mono truncate />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left column: Agents + Results */}
        <div className="space-y-5">
          {/* Assigned Agents */}
          <section>
            <SectionHeading icon={Users} label="Assigned Agents" count={job.assignedTo.length} />
            {job.assignedTo.length === 0 ? (
              <p className="font-mono text-xs text-slate-600">No agents assigned yet</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {job.assignedTo.map((id) => {
                  const agent = agentMap.get(id);
                  const isFastest = job.consensus?.fastestAgent === id;
                  const isClustered = job.consensus?.clusteredAgents.includes(id);
                  const isOutlier = job.consensus?.outlierAgents.includes(id);

                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] ${
                        isOutlier
                          ? 'border-red-400/20 bg-red-400/5 text-red-400'
                          : isFastest
                            ? 'border-amber-400/20 bg-amber-400/10 text-amber-400'
                            : isClustered
                              ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-400'
                              : 'border-slate-700/50 bg-slate-800/50 text-slate-400'
                      }`}
                    >
                      {isFastest && <Trophy className="h-3 w-3" />}
                      {isClustered && !isFastest && <CheckCircle2 className="h-3 w-3" />}
                      {isOutlier && <XCircle className="h-3 w-3" />}
                      <span>{agent?.name || id.slice(0, 12)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Results */}
          <section>
            <SectionHeading icon={FileCheck} label="Index Results" count={job.results.length} />
            {job.results.length === 0 ? (
              <p className="mt-2 font-mono text-xs text-slate-600">No results submitted yet</p>
            ) : (
              <div className="mt-2 space-y-2">
                {job.results.map((result, i) => (
                  <div
                    key={`${result.agentId}-${i}`}
                    className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-medium text-slate-300">
                        {agentName(result.agentId, agentMap)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {formatTime(result.submittedAt)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      {result.indexData.scenes && (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          <BarChart3 className="h-3 w-3 text-cyan-400" />
                          <span>{result.indexData.scenes.length} scenes</span>
                        </div>
                      )}
                      {result.indexData.videoInfo?.duration && (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          <Film className="h-3 w-3 text-purple-400" />
                          <span>{result.indexData.videoInfo.duration.toFixed(1)}s</span>
                        </div>
                      )}
                      {result.storageCid && (
                        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                          <Database className="h-3 w-3 text-amber-400" />
                          <span title={result.storageCid}>{truncateCid(result.storageCid)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right column: Consensus */}
        <div className="space-y-5">
          {job.consensus ? (
            <>
              {/* Similarity scores */}
              <section>
                <SectionHeading icon={BarChart3} label="Similarity Scores" />
                <div className="mt-3 space-y-2.5">
                  {Object.entries(job.consensus.similarityScores).map(([agentId, score]) => (
                    <ScoreBar key={agentId} agentId={agentId} score={score} agentMap={agentMap} />
                  ))}
                </div>
              </section>

              {/* Cluster / Outlier summary */}
              <section>
                <SectionHeading icon={Users} label="Consensus Cluster" />
                <div className="mt-3 space-y-2">
                  {job.consensus.clusteredAgents.map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="font-mono text-xs text-slate-300">
                        {agentName(id, agentMap)}
                      </span>
                      {id === job.consensus!.fastestAgent && (
                        <span className="flex items-center gap-1 rounded-md bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
                          <Trophy className="h-2.5 w-2.5" />
                          Fastest
                        </span>
                      )}
                    </div>
                  ))}
                  {job.consensus.outlierAgents.map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-400" />
                      <span className="font-mono text-xs text-red-300">
                        {agentName(id, agentMap)}
                      </span>
                      <span className="rounded-md bg-red-400/10 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                        Outlier
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Reward distribution */}
              <section>
                <SectionHeading icon={Coins} label="Reward Distribution" />
                <div className="mt-3 space-y-2">
                  {job.consensus.rewards.map((reward, i) => {
                    const rl = REWARD_LABELS[reward.role] || {
                      label: reward.role,
                      color: 'text-slate-400',
                    };
                    return (
                      <div
                        key={`${reward.agentId}-${i}`}
                        className="flex items-center justify-between rounded-lg border border-slate-700/30 bg-slate-800/20 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Coins className={`h-3.5 w-3.5 ${rl.color}`} />
                          <span className="font-mono text-xs text-slate-300">
                            {agentName(reward.agentId, agentMap)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md bg-slate-700/40 px-1.5 py-0.5 font-mono text-[10px] ${rl.color}`}
                          >
                            {rl.label}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-200">
                            {reward.amount.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            /* Awaiting consensus */
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700/50 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              <p className="font-mono text-sm text-slate-400">Awaiting consensus...</p>
              <p className="font-mono text-[10px] text-slate-600">
                Results will be scored once all agents submit
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small reusable bits                                                */
/* ------------------------------------------------------------------ */

function SectionHeading({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Users;
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-cyan-400" />
      <h3 className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400">
        {label}
      </h3>
      {count !== undefined && (
        <span className="rounded-full bg-slate-700/50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          {count}
        </span>
      )}
    </div>
  );
}

function MetaItem({
  label,
  value,
  mono,
  truncate: shouldTruncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-0.5 text-sm text-slate-300 ${mono ? 'font-mono text-xs' : ''} ${shouldTruncate ? 'truncate' : ''}`}
        title={shouldTruncate ? value : undefined}
      >
        {value}
      </p>
    </div>
  );
}
