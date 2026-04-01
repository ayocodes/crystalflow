import { Users, Briefcase } from 'lucide-react';
import { useNetwork } from '../providers/NetworkContext';
import StatsBar from '../components/StatsBar';
import ActivityFeed from '../components/ActivityFeed';
import type { AgentRole, JobStatus } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const roleBadge: Record<AgentRole, { bg: string; text: string }> = {
  scout: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  sentinel: { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  curator: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
};

const statusBadge: Record<JobStatus, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  assigned: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
};

// ── Page ─────────────────────────────────────────────────────────────

export default function Overview() {
  const { agents, jobs } = useNetwork();
  const recentJobs = jobs.slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page header */}
      <div>
        <h2 className="font-mono text-xl font-bold tracking-tight text-white">
          Network Overview
        </h2>
        <p className="mt-1 font-mono text-sm text-slate-400">
          Real-time CrystalFlow network status
        </p>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Agent network */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center gap-2.5 border-b border-slate-700/30 px-4 py-3">
            <Users className="h-4 w-4 text-cyan-400" />
            <h3 className="font-mono text-sm font-semibold tracking-wide text-slate-200">
              Agent Network
            </h3>
            <span className="ml-auto font-mono text-xs text-slate-500">
              {agents.length} online
            </span>
          </div>

          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                <Users className="h-5 w-5 text-slate-600" />
              </div>
              <p className="mt-3 font-mono text-xs text-slate-500">
                No agents connected
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {agents.map((agent) => {
                const badge = roleBadge[agent.role];
                const isWorking = agent.status === 'working';
                return (
                  <div
                    key={agent.agentId}
                    className="group rounded-lg border border-slate-700/50 bg-slate-800/50 p-3 transition-all hover:border-slate-600/50 hover:bg-slate-800/70"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${badge.bg} ${badge.text}`}
                      >
                        {agent.role}
                      </span>
                      <span className="relative flex h-2.5 w-2.5" title={agent.status}>
                        {isWorking && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        )}
                        <span
                          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                            isWorking ? 'bg-emerald-500' : 'bg-slate-500'
                          }`}
                        />
                      </span>
                    </div>
                    <p
                      className="truncate font-mono text-sm font-medium text-slate-200"
                      title={agent.name}
                    >
                      {agent.name}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                      {agent.agentId.slice(0, 12)}...
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Activity feed */}
        <ActivityFeed />
      </div>

      {/* Recent jobs */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30">
        <div className="flex items-center gap-2.5 border-b border-slate-700/30 px-4 py-3">
          <Briefcase className="h-4 w-4 text-amber-400" />
          <h3 className="font-mono text-sm font-semibold tracking-wide text-slate-200">
            Recent Jobs
          </h3>
          <span className="ml-auto font-mono text-xs text-slate-500">
            {jobs.length} total
          </span>
        </div>

        {recentJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
              <Briefcase className="h-5 w-5 text-slate-600" />
            </div>
            <p className="mt-3 font-mono text-xs text-slate-500">
              No jobs submitted yet
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-3 border-b border-slate-700/20 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              <span className="col-span-2">Job ID</span>
              <span className="col-span-4">Video URL</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-2 text-center">Agents</span>
              <span className="col-span-2 text-right">Time</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-700/20">
              {recentJobs.map((job) => {
                const badge = statusBadge[job.status];
                return (
                  <div
                    key={job.id}
                    className="grid grid-cols-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-700/10"
                  >
                    <span
                      className="col-span-2 truncate font-mono text-sm text-slate-300"
                      title={job.id}
                    >
                      {job.id.slice(0, 8)}
                    </span>
                    <span
                      className="col-span-4 truncate text-sm text-slate-400"
                      title={job.videoUrl}
                    >
                      {job.videoUrl}
                    </span>
                    <span className="col-span-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${badge.bg} ${badge.text}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        {job.status}
                      </span>
                    </span>
                    <span className="col-span-2 text-center font-mono text-sm text-slate-400">
                      {job.assignedTo.length}
                    </span>
                    <span className="col-span-2 text-right font-mono text-xs text-slate-500">
                      {timeAgo(job.submittedAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
