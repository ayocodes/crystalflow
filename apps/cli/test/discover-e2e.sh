#!/usr/bin/env bash
# E2E test for: crystalflow discover
# Starts the signal server, runs CLI commands, validates responses.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLI_DIR="$ROOT/apps/cli"
SERVER_DIR="$ROOT/apps/server"
PORT=4444
SERVER_PID=""
PASS=0
FAIL=0
TMPDIR_E2E=""

cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null || true
  [[ -n "$TMPDIR_E2E" ]] && rm -rf "$TMPDIR_E2E"
}
trap cleanup EXIT

ok()   { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

check_json() {
  local label="$1" json="$2" field="$3" expected="$4"
  actual=$(echo "$json" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const o=JSON.parse(d);console.log(o${field})}catch{console.log('PARSE_ERROR')}})")
  if [[ "$actual" == "$expected" ]]; then
    ok "$label"
  else
    fail "$label (expected '$expected', got '$actual')"
  fi
}

echo "=== E2E: crystalflow discover ==="
echo ""

# ── Build CLI ──
echo "[build] CLI..."
(cd "$CLI_DIR" && npx tsc) >/dev/null 2>&1
CLI="node $CLI_DIR/dist/index.js"
echo "[build] done"

# ── Start server ──
echo "[server] starting on port $PORT..."
(cd "$SERVER_DIR" && PORT=$PORT npx tsx src/index.ts) >/dev/null 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 20); do
  if curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
  echo "[server] FAILED to start"
  exit 1
fi
echo "[server] ready (pid $SERVER_PID)"
echo ""

# ── Create test fixtures ──
TMPDIR_E2E=$(mktemp -d)
echo "fake-video-content" > "$TMPDIR_E2E/clip1.mp4"
echo "fake-video-content" > "$TMPDIR_E2E/clip2.mp4"
echo "not-a-video" > "$TMPDIR_E2E/readme.txt"

# ── Test 1: Single source (local file) ──
echo "Test 1: discover --source <file> --json"
OUT=$($CLI discover --source "$TMPDIR_E2E/clip1.mp4" --server "http://localhost:$PORT" --json 2>&1)
check_json "status=pending" "$OUT" ".status"   "pending"
JOB_ID=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).jobId))")
if [[ -n "$JOB_ID" && "$JOB_ID" != "undefined" ]]; then
  ok "jobId is present ($JOB_ID)"
else
  fail "jobId is missing"
fi
echo ""

# ── Test 2: Single source (URL) ──
echo "Test 2: discover --source <url> --json"
OUT=$($CLI discover --source "https://example.com/video.mp4" --server "http://localhost:$PORT" --json 2>&1)
check_json "status=pending" "$OUT" ".status" "pending"
check_json "videoUrl matches" "$OUT" ".videoUrl" "https://example.com/video.mp4"
echo ""

# ── Test 3: Batch discovery ──
echo "Test 3: discover --dir <directory> --json"
OUT=$($CLI discover --dir "$TMPDIR_E2E" --pattern "*.mp4" --server "http://localhost:$PORT" --json 2>&1)
DISCOVERED=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).discovered.length))")
if [[ "$DISCOVERED" == "2" ]]; then
  ok "batch discovered 2 files"
else
  fail "batch discovered $DISCOVERED files (expected 2)"
fi
ERRORS=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).errors.length))")
if [[ "$ERRORS" == "0" ]]; then
  ok "batch 0 errors"
else
  fail "batch had $ERRORS errors (expected 0)"
fi
echo ""

# ── Test 4: Verify jobs on server ──
echo "Test 4: GET /api/jobs shows all submitted jobs"
JOBS=$(curl -s "http://localhost:$PORT/api/jobs")
JOB_COUNT=$(echo "$JOBS" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).length))")
if [[ "$JOB_COUNT" -ge 4 ]]; then
  ok "server has $JOB_COUNT jobs (≥4 expected)"
else
  fail "server has $JOB_COUNT jobs (expected ≥4)"
fi
echo ""

# ── Test 5: Missing source file ──
echo "Test 5: error on missing source"
OUT=$($CLI discover --source "/nonexistent/video.mp4" --server "http://localhost:$PORT" --json 2>&1) || true
check_json "returns error" "$OUT" ".error" "Source not found: /nonexistent/video.mp4"
echo ""

# ── Test 6: Server not running ──
echo "Test 6: error when server is down"
OUT=$($CLI discover --source "$TMPDIR_E2E/clip1.mp4" --server "http://localhost:59999" --json 2>&1) || true
HAS_ERROR=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).error?'yes':'no')}catch{console.log('no')}})")
if [[ "$HAS_ERROR" == "yes" ]]; then
  ok "returns error when server unreachable"
else
  fail "no error returned when server unreachable"
fi
echo ""

# ── Test 7: No args ──
echo "Test 7: error with no --source or --dir"
OUT=$($CLI discover --server "http://localhost:$PORT" --json 2>&1) || true
check_json "returns error" "$OUT" ".error" "Provide --source <url_or_path> or --dir <directory>"
echo ""

# ── Summary ──
echo "==========================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "==========================="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
