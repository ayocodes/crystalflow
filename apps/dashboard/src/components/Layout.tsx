import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ListTodo,
  BrainCircuit,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useNetwork } from '../providers/NetworkContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/jobs', icon: ListTodo, label: 'Jobs' },
  { to: '/intel', icon: BrainCircuit, label: 'Intelligence' },
];

export default function Layout() {
  const { connected, agents } = useNetwork();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-slate-800 bg-slate-950">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-slate-800 px-5 py-4">
          <Radio className="h-6 w-6 text-cyan-400" />
          <div>
            <h1 className="font-mono text-sm font-bold tracking-wider text-cyan-400">
              VIDGRID
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              Mission Control
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 font-mono text-sm transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer status */}
        <div className="border-t border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-xs">
            {connected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-red-400" />
                <span className="text-red-400">Disconnected</span>
              </>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} online
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-slate-900 p-6">
        <Outlet />
      </main>
    </div>
  );
}
