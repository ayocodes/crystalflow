import { useState } from 'react';
import {
  Users,
  Search,
  Radar,
  Shield,
  Layers,
  Circle,
  Fingerprint,
} from 'lucide-react';
import { useNetwork } from '../providers/NetworkContext';
import type { AgentRole } from '../types';

const ROLE_COLORS: Record<AgentRole, { text: string; bg: string; border: string }> = {
  scout: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20' },
  sentinel: { text: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
  curator: { text: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
};

const ROLE_ICONS: Record<AgentRole, typeof Radar> = {
  scout: Radar,
  sentinel: Shield,
  curator: Layers,
};

type FilterRole = 'all' | AgentRole;

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

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '\u2026';
}

function truncateAddress(addr: string): string {
  if (addr.length <= 13) return addr;
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

export default function Agents() {
  const { agents } = useNetwork();
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');
  const [search, setSearch] = useState('');

  const filters: { value: FilterRole; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'scout', label: 'Scout' },
    { value: 'sentinel', label: 'Sentinel' },
    { value: 'curator', label: 'Curator' },
  ];

  const filteredAgents = agents.filter((agent) => {
    if (roleFilter !== 'all' && agent.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        agent.name.toLowerCase().includes(q) ||
        agent.agentId.toLowerCase().includes(q) ||
        agent.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const roleCounts = agents.reduce(
    (acc, a) => {
      acc[a.role] = (acc[a.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10">
              <Users className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                Agent Registry
              </h1>
              <p className="font-mono text-xs tracking-wider text-slate-500">
                ERC-8004 identity network
              </p>
            </div>
          </div>
        </div>

        {/* Live count badges */}
        <div className="flex items-center gap-3">
          {(['scout', 'sentinel', 'curator'] as AgentRole[]).map((role) => {
            const RIcon = ROLE_ICONS[role];
            const colors = ROLE_COLORS[role];
            return (
              <div
                key={role}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs ${colors.bg} ${colors.border} ${colors.text}`}
              >
                <RIcon className="h-3 w-3" />
                <span className="capitalize">{role}</span>
                <span className="ml-1 font-bold">{roleCounts[role] || 0}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        {/* Role pills */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-800/50 p-1">
          {filters.map(({ value, label }) => {
            const isActive = roleFilter === value;
            let activeClasses = 'text-slate-400 hover:text-slate-200';
            if (isActive) {
              if (value === 'all') {
                activeClasses = 'bg-slate-700 text-slate-100 shadow-sm';
              } else {
                const c = ROLE_COLORS[value as AgentRole];
                activeClasses = `${c.bg} ${c.text} shadow-sm`;
              }
            }
            return (
              <button
                key={value}
                onClick={() => setRoleFilter(value)}
                className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition-all ${activeClasses}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full rounded-xl border border-slate-700/50 bg-slate-800/30 py-2 pl-9 pr-3 font-mono text-xs text-slate-300 placeholder-slate-600 outline-none transition-colors focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20"
          />
        </div>

        {/* Agent count */}
        <span className="ml-auto font-mono text-xs text-slate-500">
          {filteredAgents.length} of {agents.length} agents
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Agent
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Current Job
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Connected
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Address
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAgents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                      <Fingerprint className="h-6 w-6 text-slate-600" />
                    </div>
                    <p className="font-mono text-sm text-slate-500">No agents registered</p>
                    <p className="font-mono text-[10px] text-slate-600">
                      Agents will appear here once they connect to the network
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAgents.map((agent) => {
                const colors = ROLE_COLORS[agent.role];
                const RoleIcon = ROLE_ICONS[agent.role];

                return (
                  <tr
                    key={agent.agentId}
                    className="group border-t border-slate-700/30 transition-colors hover:bg-slate-700/10"
                  >
                    {/* Agent name + id */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors.bg}`}
                        >
                          <RoleIcon className={`h-4 w-4 ${colors.text}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200 group-hover:text-slate-100">
                            {agent.name}
                          </p>
                          <p className="font-mono text-[10px] text-slate-500">
                            {truncate(agent.agentId, 20)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium capitalize ${colors.text} ${colors.bg} ${colors.border}`}
                      >
                        {agent.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {agent.status === 'working' ? (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                          </span>
                        ) : (
                          <Circle className="h-2 w-2 fill-slate-500 text-slate-500" />
                        )}
                        <span
                          className={`font-mono text-xs ${
                            agent.status === 'working' ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {agent.status === 'working' ? 'Working' : 'Idle'}
                        </span>
                      </div>
                    </td>

                    {/* Current Job */}
                    <td className="px-4 py-3">
                      {agent.currentJobId ? (
                        <span className="rounded-md bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-400">
                          {agent.currentJobId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-slate-600">&mdash;</span>
                      )}
                    </td>

                    {/* Connected */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400">
                        {timeAgo(agent.connectedAt)}
                      </span>
                    </td>

                    {/* Address */}
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-700/40 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                        {truncateAddress(agent.address)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom glow accent */}
      <div className="pointer-events-none -mt-px h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
    </div>
  );
}
