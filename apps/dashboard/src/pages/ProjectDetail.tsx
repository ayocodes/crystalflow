import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderOpen,
  Film,
  Upload,
  Search,
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../api/client';
import type { Project, VideoInfo } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────

function cleanFilename(raw?: string): string {
  if (!raw) return 'Untitled video';
  const basename = raw.split('/').pop() || raw;
  return basename.replace(/^\d+-[a-z0-9]+-/, '');
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const VIDEO_STATUS_STYLES: Record<
  string,
  { text: string; bg: string; dot: string; label: string }
> = {
  pending: {
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    dot: 'bg-yellow-400',
    label: 'Pending',
  },
  assigned: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    dot: 'bg-cyan-400',
    label: 'Processing',
  },
  processing: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    dot: 'bg-cyan-400',
    label: 'Processing',
  },
  completed: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-400',
    label: 'Indexed',
  },
  failed: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    dot: 'bg-red-400',
    label: 'Failed',
  },
};

// ── Video card ────────────────────────────────────────────────────────────

function VideoCard({ video, projectId, onClick }: { video: VideoInfo; projectId: string; onClick: () => void }) {
  const st = VIDEO_STATUS_STYLES[video.status] ?? VIDEO_STATUS_STYLES.pending;
  const name = cleanFilename(video.originalName || video.filename);

  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-left transition-all hover:border-cyan-500/30 hover:bg-slate-800/60"
    >
      {/* Thumbnail placeholder area */}
      <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-900/60">
        <Film className="h-8 w-8 text-slate-700" />
      </div>

      {/* Name */}
      <p
        className="truncate font-mono text-xs font-medium text-slate-200 group-hover:text-white"
        title={name}
      >
        {name}
      </p>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${st.bg} ${st.text}`}
        >
          {video.status === 'processing' ? (
            <Loader2 className="h-2 w-2 animate-spin" />
          ) : (
            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
          )}
          {st.label}
        </span>

        {video.sceneCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-slate-500">
            <Sparkles className="h-2.5 w-2.5 text-purple-400/60" />
            {video.sceneCount}
          </span>
        )}
      </div>

      {/* Timestamp */}
      <p className="mt-1.5 font-mono text-[10px] text-slate-600">{timeAgo(video.createdAt)}</p>

      <ChevronRight className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700 transition-colors group-hover:text-cyan-400" />
    </button>
  );
}

// ── Upload zone ───────────────────────────────────────────────────────────

function UploadZone({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('video/')) {
      setError('Only video files are supported');
      return;
    }
    setFile(f);
    setError('');
    setSuccess(false);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const doUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError('');
    try {
      await api.uploadVideo(projectId, file);
      setSuccess(true);
      setFile(null);
      onUploaded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Upload className="h-4 w-4 text-cyan-400" />
        <h3 className="font-mono text-sm font-semibold text-slate-200">Upload Video</h3>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-all ${
          dragOver
            ? 'border-cyan-400 bg-cyan-400/5'
            : file
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : success
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-600/50 bg-slate-900/30 hover:border-slate-500/50 hover:bg-slate-800/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {success ? (
          <div className="space-y-1">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
            <p className="font-mono text-sm text-emerald-300">Uploaded — processing queued</p>
          </div>
        ) : file ? (
          <div className="space-y-1">
            <Film className="mx-auto h-7 w-7 text-emerald-400" />
            <p className="font-mono text-sm font-medium text-emerald-300">{file.name}</p>
            <p className="font-mono text-xs text-slate-500">
              {(file.size / (1024 * 1024)).toFixed(2)} MB &middot; {file.type}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-7 w-7 text-slate-500" />
            <p className="font-mono text-sm text-slate-400">Drop a video or click to browse</p>
            <p className="font-mono text-xs text-slate-600">MP4, WebM, MKV — any format</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2">
          <XCircle className="h-3.5 w-3.5 text-red-400" />
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {file && !success && (
        <button
          onClick={doUpload}
          disabled={uploading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 font-mono text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="h-4 w-4" /> Submit to Network</>
          )}
        </button>
      )}
    </div>
  );
}

// ── Query box ─────────────────────────────────────────────────────────────

function QueryBox({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.queryProject(projectId, q);
      setResult(data);
    } catch {
      setError('Query failed — the intelligence endpoint may not be available yet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Search className="h-4 w-4 text-amber-400" />
        <h3 className="font-mono text-sm font-semibold text-slate-200">Query Project</h3>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about the videos in this project…"
          className="flex-1 rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-2.5 font-mono text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 font-mono text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Query
        </button>
      </form>

      {loading && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          <p className="font-mono text-sm text-cyan-300">Querying video knowledge…</p>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-700/30 bg-slate-800/40 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 text-slate-500" />
          <p className="font-mono text-xs text-slate-400">{error}</p>
        </div>
      )}

      {result != null && !error && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-400">
            Result
          </p>
          {typeof result === 'object' && 'answer' in result ? (
            <div className="space-y-2">
              <p className="font-mono text-sm text-amber-200">
                {result.answer as string}
              </p>
              {'confidence' in result && (
                <p className="font-mono text-xs text-slate-500">
                  Confidence: {Math.round((result.confidence as number) * 100)}%
                </p>
              )}
            </div>
          ) : (
            <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-slate-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProject = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getProject(id);
      setProject(data as unknown as Project);
    } catch {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    const interval = setInterval(fetchProject, 5000);
    return () => clearInterval(interval);
  }, [fetchProject]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
        <p className="font-mono text-sm text-slate-500">Loading project…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="font-mono text-sm text-red-400">{error || 'Project not found'}</p>
        <Link
          to="/"
          className="font-mono text-xs text-slate-400 underline hover:text-slate-200"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  const videos: VideoInfo[] = project.videos ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
        <Link to="/" className="hover:text-slate-300">Projects</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-300">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/30 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
            <FolderOpen className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight text-white">
              {project.name}
            </h1>
            {project.description && (
              <p className="font-mono text-sm text-slate-400">{project.description}</p>
            )}
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-1.5 font-mono text-xs text-slate-400">
            <Film className="h-3.5 w-3.5 text-cyan-400/70" />
            {project.videoCount} video{project.videoCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-1.5 font-mono text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-purple-400/70" />
            {project.totalScenes} scene{project.totalScenes !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Query box */}
      <QueryBox projectId={project.id} />

      {/* Upload zone */}
      <UploadZone projectId={project.id} onUploaded={fetchProject} />

      {/* Videos grid */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Film className="h-4 w-4 text-cyan-400" />
          <h2 className="font-mono text-sm font-semibold text-slate-200">Videos</h2>
          <span className="rounded-full bg-slate-700/50 px-2 py-0.5 font-mono text-[11px] text-slate-500">
            {videos.length}
          </span>
        </div>

        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700/50 bg-slate-800/20 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
              <Film className="h-6 w-6 text-slate-600" />
            </div>
            <p className="font-mono text-sm text-slate-500">No videos yet</p>
            <p className="font-mono text-xs text-slate-600">
              Upload a video above to start analysis
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                projectId={project.id}
                onClick={() => navigate(`/projects/${project.id}/videos/${video.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom accent */}
      <div className="pointer-events-none h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
    </div>
  );
}
