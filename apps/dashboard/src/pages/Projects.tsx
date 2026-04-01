import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen,
  Plus,
  Film,
  Sparkles,
  Clock,
  ChevronRight,
  Loader2,
  X,
  Check,
  FolderPlus,
  Globe,
  Lock,
} from 'lucide-react';
import { api } from '../api/client';
import type { Project } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_STYLES: Record<
  Project['status'],
  { text: string; bg: string; dot: string; label: string }
> = {
  empty: {
    text: 'text-slate-400',
    bg: 'bg-slate-500/10',
    dot: 'bg-slate-500',
    label: 'Empty',
  },
  processing: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-400',
    label: 'Processing',
  },
  ready: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-400',
    label: 'Ready',
  },
};

// ── Project card ──────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const status = project.status ?? 'empty';
  const st = STATUS_STYLES[status] ?? STATUS_STYLES.empty;

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 text-left transition-all hover:border-cyan-500/30 hover:bg-slate-800/60"
    >
      {/* Hover glow */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-500 opacity-0 blur-2xl transition-opacity group-hover:opacity-[0.05]" />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
              <FolderOpen className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm font-semibold text-slate-100 group-hover:text-white">
                {project.name}
              </p>
              {project.description && (
                <p className="truncate font-mono text-[11px] text-slate-500">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-cyan-400" />
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
            <Film className="h-3.5 w-3.5 text-cyan-400/70" />
            <span>{project.videoCount ?? 0} video{(project.videoCount ?? 0) !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-purple-400/70" />
            <span>{project.totalScenes ?? 0} scene{(project.totalScenes ?? 0) !== 1 ? 's' : ''}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
            <Clock className="h-3 w-3" />
            <span title={formatDate(project.createdAt)}>{timeAgo(project.createdAt)}</span>
          </div>
        </div>

        {/* Status + visibility badges */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${st.bg} ${st.text}`}
          >
            {status === 'processing' ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
            )}
            {st.label}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium ${
            (project as any).visibility === 'public'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-slate-500/10 text-slate-400'
          }`}>
            {(project as any).visibility === 'public' ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
            {(project as any).visibility === 'public' ? 'Public' : 'Private'}
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Inline new-project form ───────────────────────────────────────────────

function NewProjectForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, visibility: 'public' | 'private') => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(trimmed, visibility);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-cyan-500/30 bg-slate-800/50 p-5"
    >
      <div className="mb-3 flex items-center gap-2">
        <FolderPlus className="h-4 w-4 text-cyan-400" />
        <h3 className="font-mono text-sm font-semibold text-slate-200">New Project</h3>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name…"
        autoFocus
        className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 font-mono text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
      />

      {/* Visibility toggle */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setVisibility('private')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs transition-all ${
            visibility === 'private'
              ? 'bg-slate-700 text-white'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Lock className="h-3 w-3" />
          Private
        </button>
        <button
          type="button"
          onClick={() => setVisibility('public')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs transition-all ${
            visibility === 'public'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Globe className="h-3 w-3" />
          Public
        </button>
        <span className="font-mono text-[10px] text-slate-600">
          {visibility === 'public' ? 'Anyone can view results' : 'Only you can view'}
        </span>
      </div>

      {error && <p className="mt-2 font-mono text-xs text-red-400">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 font-mono text-xs font-semibold text-slate-950 transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Create
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-mono text-xs text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.getProjects();
      setProjects(data as unknown as Project[]);
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 8000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleCreate = async (name: string, visibility: 'public' | 'private') => {
    await api.createProject(name, undefined, visibility);
    setShowNewForm(false);
    await fetchProjects();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-white">Projects</h1>
          <p className="mt-1 font-mono text-sm text-slate-400">
            Organise videos into projects for agent analysis
          </p>
        </div>

        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 font-mono text-sm font-semibold text-slate-950 transition-all hover:bg-cyan-400"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        )}
      </div>

      {/* New project form */}
      {showNewForm && (
        <NewProjectForm onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
          <p className="font-mono text-sm text-slate-500">Loading projects…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4">
          <p className="font-mono text-sm text-red-400">{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-2 font-mono text-xs text-red-400 underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-700/50 bg-slate-800/20 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800">
            <FolderOpen className="h-7 w-7 text-slate-600" />
          </div>
          <div>
            <p className="font-mono text-sm text-slate-400">No projects yet</p>
            <p className="mt-1 font-mono text-xs text-slate-600">
              Create a project to start uploading and analysing videos
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-4 py-2 font-mono text-sm text-cyan-400 transition-all hover:bg-cyan-500/20"
          >
            <Plus className="h-4 w-4" />
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {/* Bottom accent */}
      <div className="pointer-events-none h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
    </div>
  );
}
