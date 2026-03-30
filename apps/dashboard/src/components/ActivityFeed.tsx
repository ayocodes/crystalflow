import { useNetwork } from '../providers/NetworkContext';

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getEventColor(type: string): { bg: string; text: string } {
  if (type.startsWith('agent:')) return { bg: 'bg-cyan-500/15', text: 'text-cyan-400' };
  if (type === 'job:new') return { bg: 'bg-amber-500/15', text: 'text-amber-400' };
  if (type === 'job:assigned') return { bg: 'bg-blue-500/15', text: 'text-blue-400' };
  if (type === 'job:completed') return { bg: 'bg-emerald-500/15', text: 'text-emerald-400' };
  if (type === 'job:consensus') return { bg: 'bg-purple-500/15', text: 'text-purple-400' };
  return { bg: 'bg-slate-500/15', text: 'text-slate-400' };
}

function getEventLabel(type: string): string {
  const parts = type.split(':');
  return parts.length > 1 ? parts[1] : type;
}

export default function ActivityFeed() {
  const { events } = useNetwork();

  return (
    <div className="flex flex-col rounded-xl border border-slate-700/50 bg-slate-800/30">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-700/30 px-4 py-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <h3 className="font-mono text-sm font-semibold tracking-wide text-slate-200">
          Live Activity
        </h3>
      </div>

      {/* Events list */}
      <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700">
        {events.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-12">
            <p className="font-mono text-xs text-slate-500">
              Waiting for network activity...
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/20">
            {events.map((event) => {
              const color = getEventColor(event.type);
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-700/10"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-[11px] leading-5 text-slate-500">
                    {formatTime(event.timestamp)}
                  </span>
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${color.bg} ${color.text}`}
                  >
                    {getEventLabel(event.type)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm leading-5 text-slate-300">
                    {event.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
