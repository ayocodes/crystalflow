import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Send, Loader2, CheckCircle2, Film, Search, Clock, Users, Eye } from 'lucide-react';

const API = '/api';

type JobResult = {
  id?: string;
  jobId?: string;
  videoUrl?: string;
  status: string;
};

type IntelResult = {
  query: string;
  answer: string;
  confidence: number;
  sceneCount: number;
  indexCount: number;
  sources: Array<{ videoId: string; timestamp: number; description?: string }>;
};

export default function Submit() {
  // ── Upload state ──
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobResult, setJobResult] = useState<JobResult | null>(null);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Job tracking state ──
  const [trackedJob, setTrackedJob] = useState<Record<string, any> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for job completion when we have a jobId
  useEffect(() => {
    if (!jobResult) return;
    const jobId = jobResult.jobId || jobResult.id;
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API}/jobs/${jobId}`);
        if (res.ok) {
          const job = await res.json();
          setTrackedJob(job);
          if (job.status === 'completed' || job.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        }
      } catch { /* ignore poll errors */ }
    };

    poll(); // immediate first check
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobResult]);

  // ── Query state ──
  const [query, setQuery] = useState('');
  const [querying, setQuerying] = useState(false);
  const [intelResult, setIntelResult] = useState<IntelResult | null>(null);
  const [queryError, setQueryError] = useState('');

  // ── Drag & drop ──
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type.startsWith('video/')) {
      setFile(dropped);
      setJobResult(null);
      setUploadError('');
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setJobResult(null);
      setUploadError('');
    }
  };

  // ── Submit job — upload file or send URL ──
  const submitJob = async () => {
    if (!file && !videoUrl.trim()) {
      setUploadError('Drop a video file or enter a URL');
      return;
    }

    setSubmitting(true);
    setUploadError('');
    setJobResult(null);

    try {
      let job;

      if (file) {
        // Upload the actual file to the server
        const formData = new FormData();
        formData.append('video', file);
        formData.append('submittedBy', 'dashboard');

        const res = await fetch(`${API}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        job = await res.json();
      } else {
        // URL mode — send URL directly as a job
        const res = await fetch(`${API}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: videoUrl.trim(), submittedBy: 'dashboard' }),
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        job = await res.json();
      }

      setJobResult(job);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Query intelligence ──
  const submitQuery = async () => {
    if (!query.trim()) return;

    setQuerying(true);
    setQueryError('');
    setIntelResult(null);

    try {
      const res = await fetch(`${API}/intel/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const result = await res.json();
      setIntelResult(result);
    } catch (err: any) {
      setQueryError(err.message || 'Query failed');
    } finally {
      setQuerying(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-mono text-xl font-bold tracking-tight text-white">
          Submit & Query
        </h2>
        <p className="mt-1 font-mono text-sm text-slate-400">
          Submit videos for agent processing or query the intelligence network
        </p>
      </div>

      {/* ── Upload Section ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <Film className="h-4 w-4 text-cyan-400" />
          <h3 className="font-mono text-sm font-semibold text-slate-200">
            Submit Video for Indexing
          </h3>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all
            ${dragOver
              ? 'border-cyan-400 bg-cyan-400/5'
              : file
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-slate-600/50 bg-slate-900/30 hover:border-slate-500/50 hover:bg-slate-800/30'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={onFileChange}
            className="hidden"
          />

          {file ? (
            <div className="space-y-1">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
              <p className="font-mono text-sm font-medium text-emerald-300">{file.name}</p>
              <p className="font-mono text-xs text-slate-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB &middot; {file.type}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="mx-auto h-8 w-8 text-slate-500" />
              <p className="font-mono text-sm text-slate-400">
                Drop a video here or click to browse
              </p>
              <p className="font-mono text-xs text-slate-600">
                MP4, WebM, MKV, AVI — any format
              </p>
            </div>
          )}
        </div>

        {/* Or enter URL */}
        <div className="mt-4 flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500">or enter URL:</span>
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => { setVideoUrl(e.target.value); setFile(null); }}
            placeholder="https://example.com/video.mp4"
            className="flex-1 rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>

        {/* Submit button */}
        <button
          onClick={submitJob}
          disabled={submitting || (!file && !videoUrl.trim())}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 font-mono text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
          ) : (
            <><Send className="h-4 w-4" /> Submit to Network</>
          )}
        </button>

        {/* Result — live tracking */}
        {jobResult && (
          <div className="mt-4 space-y-3">
            {/* Job status header */}
            <div className={`rounded-lg border p-4 ${
              trackedJob?.status === 'completed'
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : trackedJob?.status === 'failed'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-cyan-500/30 bg-cyan-500/5'
            }`}>
              <div className="flex items-center justify-between">
                <p className="font-mono text-sm text-slate-200">
                  Job: <span className="text-cyan-400">{(jobResult.jobId || jobResult.id || '').slice(0, 12)}...</span>
                </p>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${
                  trackedJob?.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                  trackedJob?.status === 'assigned' ? 'bg-cyan-500/15 text-cyan-400' :
                  trackedJob?.status === 'failed' ? 'bg-red-500/15 text-red-400' :
                  'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {trackedJob?.status === 'assigned' && <Loader2 className="h-3 w-3 animate-spin" />}
                  {trackedJob?.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                  {trackedJob?.status || jobResult.status}
                </span>
              </div>

              {/* Assigned agents */}
              {trackedJob?.assignedTo?.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-mono text-xs text-slate-400">
                    {trackedJob.assignedTo.length} agent{trackedJob.assignedTo.length > 1 ? 's' : ''} processing
                  </span>
                </div>
              )}

              {/* Results count */}
              {trackedJob?.results?.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  <span className="font-mono text-xs text-slate-400">
                    {trackedJob.results.length} result{trackedJob.results.length > 1 ? 's' : ''} submitted
                  </span>
                </div>
              )}
            </div>

            {/* Consensus results */}
            {trackedJob?.consensus && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="font-mono text-xs font-medium uppercase tracking-wider text-amber-400 mb-2">
                  Consensus Result
                </p>
                <div className="space-y-1 font-mono text-xs text-slate-400">
                  <p>Status: <span className="text-amber-300">{trackedJob.consensusStatus}</span></p>
                  <p>Fastest agent: <span className="text-amber-300">{trackedJob.consensus.fastestAgent?.slice(0, 20)}...</span></p>
                  <p>Agents in consensus: <span className="text-amber-300">{trackedJob.consensus.clusteredAgents?.length}</span></p>
                  {trackedJob.consensus.outlierAgents?.length > 0 && (
                    <p>Outliers: <span className="text-red-400">{trackedJob.consensus.outlierAgents.length}</span></p>
                  )}
                </div>
              </div>
            )}

            {/* Index results from agents */}
            {trackedJob?.results?.length > 0 && (
              <div className="rounded-lg border border-slate-700/30 bg-slate-900/50 p-4">
                <p className="font-mono text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                  Agent Results
                </p>
                <div className="space-y-3">
                  {trackedJob.results.map((r: any, i: number) => (
                    <div key={i} className="rounded-lg border border-slate-700/20 bg-slate-800/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-cyan-400">{r.agentId?.slice(0, 25)}...</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {new Date(r.submittedAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {r.indexData && (
                        <div className="space-y-1 font-mono text-xs text-slate-400">
                          <p>Video ID: <span className="text-slate-300">{r.indexData.videoId}</span></p>
                          <p>Scenes detected: <span className="text-emerald-400">{r.indexData.scenes?.length ?? 0}</span></p>
                          {r.indexData.videoInfo && (
                            <p>
                              {r.indexData.videoInfo.codec} &middot; {r.indexData.videoInfo.width}x{r.indexData.videoInfo.height} &middot; {r.indexData.videoInfo.fps?.toFixed(0)}fps
                            </p>
                          )}
                          {r.indexData.scenes?.map((s: any, si: number) => (
                            <div key={si} className="mt-1 rounded bg-slate-900/50 p-2">
                              <span className="text-slate-500">Scene {si + 1}</span> @ {s.timestamp?.toFixed(1)}s
                              {s.deltaE > 0 && <span className="text-slate-600"> (deltaE: {s.deltaE?.toFixed(1)})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {uploadError && (
          <p className="mt-3 font-mono text-sm text-red-400">{uploadError}</p>
        )}

        {/* Integration snippet */}
        <div className="mt-6 rounded-lg border border-slate-700/30 bg-slate-900/50 p-4">
          <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-500">
            API Integration
          </p>
          <pre className="overflow-x-auto font-mono text-xs text-slate-400">
{`curl -X POST ${window.location.origin}/api/jobs \\
  -H "Content-Type: application/json" \\
  -d '{"videoUrl": "https://example.com/video.mp4"}'`}
          </pre>
        </div>
      </div>

      {/* ── Query Section ── */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <Search className="h-4 w-4 text-amber-400" />
          <h3 className="font-mono text-sm font-semibold text-slate-200">
            Query Intelligence
          </h3>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitQuery()}
            placeholder="Ask the network anything... e.g. 'road damage near Main St'"
            className="flex-1 rounded-lg border border-slate-700/50 bg-slate-900/50 px-4 py-2.5 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500/50 focus:outline-none"
          />
          <button
            onClick={submitQuery}
            disabled={querying || !query.trim()}
            className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 font-mono text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {querying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Query
          </button>
        </div>

        {intelResult && (
          <div className="mt-4 space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="font-mono text-sm text-amber-200">{intelResult.answer}</p>
            <div className="flex gap-4 font-mono text-xs text-slate-400">
              <span>Confidence: {(intelResult.confidence * 100).toFixed(0)}%</span>
              <span>{intelResult.sceneCount} scenes</span>
              <span>{intelResult.indexCount} indexes</span>
            </div>
            {intelResult.sources.length > 0 && (
              <div className="space-y-1">
                <p className="font-mono text-xs font-medium text-slate-500">Sources:</p>
                {intelResult.sources.slice(0, 5).map((s, i) => (
                  <p key={i} className="font-mono text-xs text-slate-400">
                    {s.videoId} @ {s.timestamp.toFixed(1)}s
                    {s.description && ` — ${s.description}`}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {queryError && (
          <p className="mt-3 font-mono text-sm text-red-400">{queryError}</p>
        )}

        {/* Integration snippet */}
        <div className="mt-6 rounded-lg border border-slate-700/30 bg-slate-900/50 p-4">
          <p className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-slate-500">
            API Integration
          </p>
          <pre className="overflow-x-auto font-mono text-xs text-slate-400">
{`curl -X POST ${window.location.origin}/api/intel/query \\
  -H "Content-Type: application/json" \\
  -d '{"query": "road damage near Main St"}'`}
          </pre>
        </div>
      </div>
    </div>
  );
}
