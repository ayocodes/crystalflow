import { Users, Clock, CheckCircle2, Target } from 'lucide-react';
import { useNetwork } from '../providers/NetworkContext';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  accent: string;
  iconBg: string;
}

function StatCard({ icon, value, label, accent, iconBg }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all hover:border-slate-600/50 hover:bg-slate-800/70">
      {/* Subtle gradient glow */}
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

export default function StatsBar() {
  const { agents, jobs } = useNetwork();

  const activeAgents = agents.length;
  const pendingJobs = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'assigned',
  ).length;
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const completedCount = completedJobs.length;
  const consensusReached = completedJobs.filter(
    (j) => j.consensusStatus === 'reached',
  ).length;
  const consensusRate =
    completedCount > 0 ? Math.round((consensusReached / completedCount) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        icon={<Users className="h-5 w-5 text-cyan-400" />}
        value={activeAgents}
        label="Active Agents"
        accent="bg-cyan-400"
        iconBg="bg-cyan-500/10"
      />
      <StatCard
        icon={<Clock className="h-5 w-5 text-amber-400" />}
        value={pendingJobs}
        label="Pending Jobs"
        accent="bg-amber-400"
        iconBg="bg-amber-500/10"
      />
      <StatCard
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
        value={completedCount}
        label="Completed Indexes"
        accent="bg-emerald-400"
        iconBg="bg-emerald-500/10"
      />
      <StatCard
        icon={<Target className="h-5 w-5 text-purple-400" />}
        value={`${consensusRate}%`}
        label="Consensus Rate"
        accent="bg-purple-400"
        iconBg="bg-purple-500/10"
      />
    </div>
  );
}
