#!/usr/bin/env bash
# E2E test for: F5-CN Consensus
# Starts the signal server, submits index results, validates consensus + rewards.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER_DIR="$ROOT/apps/server"
PORT=4445
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

jval() {
  local json="$1" field="$2"
  echo "$json" | node -e "
    process.stdin.resume();let d='';
    process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{try{const o=JSON.parse(d);const v=o${field};console.log(typeof v==='object'?JSON.stringify(v):v)}catch{console.log('PARSE_ERROR')}})
  "
}

check() {
  local label="$1" json="$2" field="$3" expected="$4"
  actual=$(jval "$json" "$field")
  if [[ "$actual" == "$expected" ]]; then ok "$label"; else fail "$label (expected '$expected', got '$actual')"; fi
}

# Run a TS snippet via temp file in server dir — extract last line (JSON) only
run_ts() {
  local code="$1"
  local tmpfile="$SERVER_DIR/_e2e_tmp_$$.ts"
  echo "$code" > "$tmpfile"
  (cd "$SERVER_DIR" && npx tsx "$tmpfile" 2>/dev/null) | tail -1
  rm -f "$tmpfile"
}

TMPDIR_E2E=$(mktemp -d)

echo "=== E2E: F5-CN Consensus ==="
echo ""

# ── Start server ──
echo "[server] starting on port $PORT..."
(cd "$SERVER_DIR" && PORT=$PORT npx tsx src/index.ts) >/dev/null 2>&1 &
SERVER_PID=$!

for i in $(seq 1 20); do
  curl -s "http://localhost:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.25
done

if ! curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
  echo "[server] FAILED to start"; exit 1
fi
echo "[server] ready (pid $SERVER_PID)"
echo ""

API="http://localhost:$PORT/api"

make_index() {
  local vid="$1"; shift
  local scenes="$*"
  local scene_arr=""
  for ts in $scenes; do
    [[ -n "$scene_arr" ]] && scene_arr="$scene_arr,"
    scene_arr="$scene_arr{\"timestamp\":$ts,\"deltaE\":15.2,\"jpeg\":\"base64\",\"colors\":[]}"
  done
  echo "{\"videoId\":\"$vid\",\"scenes\":[$scene_arr],\"videoInfo\":{\"codec\":\"h264\",\"width\":1920,\"height\":1080,\"duration\":60,\"fps\":30},\"processedAt\":\"2026-03-30T00:00:00Z\"}"
}

# ═══════════════════════════════════════════════════════════
# Test 1: Single agent auto-consensus via REST
# ═══════════════════════════════════════════════════════════
echo "Test 1: Single agent → auto-consensus via REST"

curl -s -X DELETE "$API/jobs" >/dev/null
JOB=$(curl -s -X POST "$API/jobs" -H 'Content-Type: application/json' -d '{"videoUrl":"https://example.com/t1.mp4","submittedBy":"e2e"}')
JOB_ID=$(jval "$JOB" ".id")

IDX_A=$(make_index "abc123" 5.0 15.0 30.0 45.0)
R1=$(curl -s -X POST "$API/jobs/$JOB_ID/result" -H 'Content-Type: application/json' \
  -d "{\"agentId\":\"agent-alpha\",\"indexData\":$IDX_A}")

check "job completed" "$R1" ".status" "completed"
check "consensusStatus=reached" "$R1" ".consensusStatus" "reached"
check "fastestAgent=agent-alpha" "$R1" ".consensus.fastestAgent" "agent-alpha"
check "clusteredAgents=[agent-alpha]" "$(jval "$R1" ".consensus.clusteredAgents")" "[0]" "agent-alpha"
echo ""

# ═══════════════════════════════════════════════════════════
# Test 2: 3 similar indexes → all in cluster
# ═══════════════════════════════════════════════════════════
echo "Test 2: Consensus algorithm — 3 similar indexes"

RESULT=$(run_ts "
import { compareIndexes } from './src/jobs/consensus.js';

const results = [
  { agentId: 'A', submittedAt: 1000, indexData: { videoId: 'v1', scenes: [{timestamp:5,deltaE:15},{timestamp:15,deltaE:12},{timestamp:30,deltaE:18},{timestamp:45,deltaE:10}], videoInfo:{duration:60} } },
  { agentId: 'B', submittedAt: 1001, indexData: { videoId: 'v1', scenes: [{timestamp:5.1,deltaE:14},{timestamp:14.9,deltaE:13},{timestamp:30.2,deltaE:17},{timestamp:44.8,deltaE:11}], videoInfo:{duration:60} } },
  { agentId: 'C', submittedAt: 1002, indexData: { videoId: 'v1', scenes: [{timestamp:5.2,deltaE:16},{timestamp:15.1,deltaE:11},{timestamp:29.8,deltaE:19},{timestamp:45.1,deltaE:9}], videoInfo:{duration:60} } },
];

const r = compareIndexes(results);
console.log(JSON.stringify(r));
")

check "consensusReached=true" "$RESULT" ".consensusReached" "true"
CLUSTER=$(jval "$RESULT" ".clusteredAgents.length")
if [[ "$CLUSTER" == "3" ]]; then ok "all 3 agents in cluster"; else fail "cluster size $CLUSTER (expected 3)"; fi
check "fastestAgent=A" "$RESULT" ".fastestAgent" "A"
OUTLIERS=$(jval "$RESULT" ".outlierAgents.length")
if [[ "$OUTLIERS" == "0" ]]; then ok "0 outliers"; else fail "$OUTLIERS outliers (expected 0)"; fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 3: 2 similar + 1 outlier
# ═══════════════════════════════════════════════════════════
echo "Test 3: Consensus — 1 outlier detected"

RESULT=$(run_ts "
import { compareIndexes } from './src/jobs/consensus.js';

const results = [
  { agentId: 'A', submittedAt: 1000, indexData: { videoId: 'v2', scenes: [{timestamp:5,deltaE:15},{timestamp:15,deltaE:12},{timestamp:30,deltaE:18},{timestamp:45,deltaE:10}], videoInfo:{duration:60} } },
  { agentId: 'B', submittedAt: 1001, indexData: { videoId: 'v2', scenes: [{timestamp:5.1,deltaE:14},{timestamp:14.9,deltaE:13},{timestamp:30.2,deltaE:17},{timestamp:44.8,deltaE:11}], videoInfo:{duration:60} } },
  { agentId: 'OUTLIER', submittedAt: 999, indexData: { videoId: 'v2', scenes: [{timestamp:2,deltaE:5},{timestamp:55,deltaE:8}], videoInfo:{duration:60} } },
];

const r = compareIndexes(results);
console.log(JSON.stringify(r));
")

check "consensusReached=true" "$RESULT" ".consensusReached" "true"
CLUSTER=$(jval "$RESULT" ".clusteredAgents")
if echo "$CLUSTER" | grep -q '"A"' && echo "$CLUSTER" | grep -q '"B"'; then
  ok "A and B in cluster"
else
  fail "expected A,B in cluster, got $CLUSTER"
fi

OUTLIERS=$(jval "$RESULT" ".outlierAgents")
if echo "$OUTLIERS" | grep -q '"OUTLIER"'; then
  ok "OUTLIER correctly identified"
else
  fail "OUTLIER not in outliers: $OUTLIERS"
fi
check "fastestAgent=A (not OUTLIER)" "$RESULT" ".fastestAgent" "A"
echo ""

# ═══════════════════════════════════════════════════════════
# Test 4: Reward distribution math
# ═══════════════════════════════════════════════════════════
echo "Test 4: Reward distribution"

RESULT=$(run_ts "
import { compareIndexes } from './src/jobs/consensus.js';
import { distributeRewards } from './src/jobs/rewards.js';

const results = [
  { agentId: 'A', submittedAt: 1000, indexData: { videoId: 'v3', scenes: [{timestamp:10,deltaE:15},{timestamp:20,deltaE:12}], videoInfo:{duration:60} } },
  { agentId: 'B', submittedAt: 1001, indexData: { videoId: 'v3', scenes: [{timestamp:10.1,deltaE:14},{timestamp:19.9,deltaE:13}], videoInfo:{duration:60} } },
  { agentId: 'C', submittedAt: 1002, indexData: { videoId: 'v3', scenes: [{timestamp:10.2,deltaE:16},{timestamp:20.1,deltaE:11}], videoInfo:{duration:60} } },
];

const consensus = compareIndexes(results);
const rewards = distributeRewards(consensus, 100);
console.log(JSON.stringify({ consensus, rewards }));
")

FASTEST_REWARD=$(echo "$RESULT" | node -e "
  process.stdin.resume();let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{const o=JSON.parse(d);const r=o.rewards.find(r=>r.role==='fastest');console.log(r?r.amount:'MISSING')})
")
if [[ "$FASTEST_REWARD" == "40" ]]; then ok "fastest gets 40 (40%)"; else fail "fastest got $FASTEST_REWARD (expected 40)"; fi

CONFIRMING_COUNT=$(echo "$RESULT" | node -e "
  process.stdin.resume();let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.rewards.filter(r=>r.role==='confirming').length)})
")
if [[ "$CONFIRMING_COUNT" == "2" ]]; then ok "2 confirming agents"; else fail "$CONFIRMING_COUNT confirming (expected 2)"; fi

CONFIRMING_EACH=$(echo "$RESULT" | node -e "
  process.stdin.resume();let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{const o=JSON.parse(d);const r=o.rewards.find(r=>r.role==='confirming');console.log(r?r.amount:'MISSING')})
")
if [[ "$CONFIRMING_EACH" == "15" ]]; then ok "each confirming gets 15 (30%/2)"; else fail "confirming got $CONFIRMING_EACH (expected 15)"; fi

BURN=$(echo "$RESULT" | node -e "
  process.stdin.resume();let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{const o=JSON.parse(d);const r=o.rewards.find(r=>r.role==='burned');console.log(r?r.amount:'MISSING')})
")
if [[ "$BURN" == "10" ]]; then ok "burn = 10 (10%)"; else fail "burn = $BURN (expected 10)"; fi

PROTO=$(echo "$RESULT" | node -e "
  process.stdin.resume();let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{const o=JSON.parse(d);const r=o.rewards.find(r=>r.role==='protocol');console.log(r?r.amount:'MISSING')})
")
if [[ "$PROTO" == "20" ]]; then ok "protocol = 20 (20%)"; else fail "protocol = $PROTO (expected 20)"; fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 5: All different → consensus failed
# ═══════════════════════════════════════════════════════════
echo "Test 5: All different → consensus failed"

RESULT=$(run_ts "
import { compareIndexes } from './src/jobs/consensus.js';

const results = [
  { agentId: 'X', submittedAt: 1000, indexData: { videoId: 'v4', scenes: [{timestamp:1,deltaE:15}], videoInfo:{duration:60} } },
  { agentId: 'Y', submittedAt: 1001, indexData: { videoId: 'v4', scenes: [{timestamp:10,deltaE:12},{timestamp:20,deltaE:13},{timestamp:30,deltaE:14},{timestamp:40,deltaE:15},{timestamp:50,deltaE:16}], videoInfo:{duration:60} } },
  { agentId: 'Z', submittedAt: 1002, indexData: { videoId: 'v4', scenes: [{timestamp:58,deltaE:5},{timestamp:59,deltaE:6}], videoInfo:{duration:60} } },
];

const r = compareIndexes(results);
console.log(JSON.stringify(r));
")

REACHED=$(jval "$RESULT" ".consensusReached")
if [[ "$REACHED" == "false" ]]; then ok "consensus failed"; else fail "consensusReached=$REACHED (expected false)"; fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 6: No rewards when consensus fails
# ═══════════════════════════════════════════════════════════
echo "Test 6: No rewards when consensus fails"

RESULT=$(run_ts "
import { compareIndexes } from './src/jobs/consensus.js';
import { distributeRewards } from './src/jobs/rewards.js';

const results = [
  { agentId: 'X', submittedAt: 1000, indexData: { videoId: 'v5', scenes: [{timestamp:1,deltaE:15}], videoInfo:{duration:60} } },
  { agentId: 'Y', submittedAt: 1001, indexData: { videoId: 'v5', scenes: [{timestamp:10,deltaE:12},{timestamp:20,deltaE:13},{timestamp:30,deltaE:14},{timestamp:40,deltaE:15},{timestamp:50,deltaE:16}], videoInfo:{duration:60} } },
  { agentId: 'Z', submittedAt: 1002, indexData: { videoId: 'v5', scenes: [{timestamp:58,deltaE:5},{timestamp:59,deltaE:6}], videoInfo:{duration:60} } },
];

const consensus = compareIndexes(results);
const rewards = distributeRewards(consensus, 100);
console.log(JSON.stringify(rewards));
")

REWARD_COUNT=$(echo "$RESULT" | node -e "
  process.stdin.resume();let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>console.log(JSON.parse(d).length))
")
if [[ "$REWARD_COUNT" == "0" ]]; then ok "0 rewards distributed"; else fail "$REWARD_COUNT rewards (expected 0)"; fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 7: GET /api/jobs/:id returns consensus data
# ═══════════════════════════════════════════════════════════
echo "Test 7: GET /api/jobs/:id includes consensus"

curl -s -X DELETE "$API/jobs" >/dev/null
JOB=$(curl -s -X POST "$API/jobs" -H 'Content-Type: application/json' -d '{"videoUrl":"https://example.com/final.mp4","submittedBy":"e2e"}')
JOB_ID=$(jval "$JOB" ".id")

IDX=$(make_index "final123" 10.0 20.0 30.0)
curl -s -X POST "$API/jobs/$JOB_ID/result" -H 'Content-Type: application/json' \
  -d "{\"agentId\":\"sentinel-1\",\"indexData\":$IDX}" >/dev/null

FETCHED=$(curl -s "$API/jobs/$JOB_ID")
check "consensusStatus=reached" "$FETCHED" ".consensusStatus" "reached"
check "fastestAgent=sentinel-1" "$FETCHED" ".consensus.fastestAgent" "sentinel-1"

REWARD_COUNT=$(echo "$FETCHED" | node -e "
  process.stdin.resume();let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>console.log(JSON.parse(d).consensus.rewards.length))
")
if [[ "$REWARD_COUNT" -ge 1 ]]; then ok "rewards array ($REWARD_COUNT entries)"; else fail "no rewards in response"; fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 8: Contract compiles
# ═══════════════════════════════════════════════════════════
echo "Test 8: PointsRegistry.sol compiles"
if (cd "$ROOT/apps/contracts" && forge build) >/dev/null 2>&1; then
  ok "forge build succeeds"
else
  fail "forge build failed"
fi
echo ""

# ── Summary ──
echo "==========================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "==========================="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
