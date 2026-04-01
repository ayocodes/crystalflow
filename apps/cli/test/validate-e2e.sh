#!/usr/bin/env bash
# E2E test for: crystalflow validate
# Starts anvil, deploys contracts, tests conviction submission and listing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLI_DIR="$ROOT/apps/cli"
CONTRACTS_DIR="$ROOT/apps/contracts"
PASS=0
FAIL=0
ANVIL_PID=""
STORAGE_DIR=""

# Anvil default account 0
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
RPC_URL="http://127.0.0.1:8545"

cleanup() {
  [[ -n "$ANVIL_PID" ]] && kill "$ANVIL_PID" 2>/dev/null && wait "$ANVIL_PID" 2>/dev/null || true
  [[ -n "$STORAGE_DIR" ]] && rm -rf "$STORAGE_DIR"
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

echo "=== E2E: crystalflow validate ==="
echo ""

# ── Start Anvil ──
echo "[anvil] starting..."
anvil --silent &
ANVIL_PID=$!

for i in $(seq 1 20); do
  if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "[anvil] FAILED to start"
  exit 1
fi
echo "[anvil] ready (pid $ANVIL_PID)"
echo ""

# ── Deploy contracts ──
echo "[deploy] PointsRegistry..."
POINTS_OUTPUT=$(forge create "$CONTRACTS_DIR/src/PointsRegistry.sol:PointsRegistry" \
  --root "$CONTRACTS_DIR" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast 2>&1)
POINTS_REGISTRY=$(echo "$POINTS_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
echo "[deploy] PointsRegistry at $POINTS_REGISTRY"

echo "[deploy] VideoRegistry..."
VIDEO_OUTPUT=$(forge create "$CONTRACTS_DIR/src/VideoRegistry.sol:VideoRegistry" \
  --root "$CONTRACTS_DIR" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$POINTS_REGISTRY" 2>&1)
VIDEO_REGISTRY=$(echo "$VIDEO_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
echo "[deploy] VideoRegistry at $VIDEO_REGISTRY"

# Link contracts
cast send "$POINTS_REGISTRY" \
  "setContracts(address,address,address)" \
  "$VIDEO_REGISTRY" \
  "0x0000000000000000000000000000000000000000" \
  "0x0000000000000000000000000000000000000000" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1
echo "[deploy] contracts linked"
echo ""

# ── Build CLI ──
echo "[build] CLI..."
(cd "$CLI_DIR" && npx tsc) >/dev/null 2>&1
CLI="node $CLI_DIR/dist/index.js"
echo "[build] done"
echo ""

# Override storage dir for clean test
STORAGE_DIR=$(mktemp -d)
export PRIVATE_KEY
export RPC_URL
export VIDEO_REGISTRY_ADDRESS="$VIDEO_REGISTRY"

# ── Setup: submit a video index so we have something to challenge ──
echo "[setup] submitting test video index..."
cast send "$VIDEO_REGISTRY" \
  "submitIndex(string,string)" \
  "test-video-001" \
  "QmTestStorageCid123" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1
echo "[setup] video 'test-video-001' indexed on-chain"
echo ""

# ── Test 1: Submit conviction (JSON output) ──
echo "Test 1: validate --video-id --fact --proof --json"
OUT=$($CLI validate \
  --video-id "test-video-001" \
  --fact "Tags are wrong" \
  --proof "Video mentions blockchain at 15:30 but no blockchain tag" \
  --json 2>&1)
check_json "videoId" "$OUT" ".videoId" "test-video-001"
check_json "fact" "$OUT" ".fact" "Tags are wrong"
check_json "convictionIndex=0" "$OUT" ".convictionIndex" "0"

TX_HASH=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).txHash))")
if [[ -n "$TX_HASH" && "$TX_HASH" != "undefined" && "$TX_HASH" == 0x* ]]; then
  ok "txHash present ($TX_HASH)"
else
  fail "txHash missing or invalid"
fi

PROOF_CID=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).proofCid))")
if [[ -n "$PROOF_CID" && "$PROOF_CID" != "undefined" && ${#PROOF_CID} -eq 64 ]]; then
  ok "proofCid is 64-char hex ($PROOF_CID)"
else
  fail "proofCid invalid (got '$PROOF_CID')"
fi
echo ""

# ── Test 2: Verify conviction on-chain ──
echo "Test 2: conviction exists on-chain"
COUNT=$(cast call "$VIDEO_REGISTRY" \
  "getConvictionCount(string)(uint256)" \
  "test-video-001" \
  --rpc-url "$RPC_URL" 2>&1)
# cast returns the number, strip whitespace
COUNT=$(echo "$COUNT" | tr -d '[:space:]')
if [[ "$COUNT" == "1" ]]; then
  ok "getConvictionCount = 1"
else
  fail "getConvictionCount = $COUNT (expected 1)"
fi

# Check video status changed to Challenged (2)
STATUS=$(cast call "$VIDEO_REGISTRY" \
  "getVideo(string)" \
  "test-video-001" \
  --rpc-url "$RPC_URL" 2>&1)
# Status is the 7th field (uint8) in the tuple — check via validate --list
echo ""

# ── Test 3: Submit a second conviction ──
echo "Test 3: submit second conviction"
OUT=$($CLI validate \
  --video-id "test-video-001" \
  --fact "Missing scene at 2:45" \
  --proof "There is a scene change at 2:45 that was not detected" \
  --json 2>&1)
check_json "convictionIndex=1" "$OUT" ".convictionIndex" "1"
echo ""

# ── Test 4: List convictions (JSON output) ──
echo "Test 4: validate --list --video-id --json"
OUT=$($CLI validate --list --video-id "test-video-001" --json 2>&1)
check_json "videoId" "$OUT" ".videoId" "test-video-001"
check_json "convictionCount=2" "$OUT" ".convictionCount" "2"
check_json "videoStatus=Challenged" "$OUT" ".videoStatus" "Challenged"

# Verify first conviction details
CHALLENGER=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).convictions[0].challenger))")
if [[ -n "$CHALLENGER" && "$CHALLENGER" == 0x* ]]; then
  ok "conviction[0].challenger is valid address"
else
  fail "conviction[0].challenger invalid"
fi

STATUS_0=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).convictions[0].status))")
if [[ "$STATUS_0" == "Active" ]]; then
  ok "conviction[0].status = Active"
else
  fail "conviction[0].status = $STATUS_0 (expected Active)"
fi
echo ""

# ── Test 5: List convictions (human-readable output) ──
echo "Test 5: human-readable output (no --json)"
OUT=$($CLI validate --list --video-id "test-video-001" 2>&1)
if echo "$OUT" | grep -q "Convictions: 2"; then
  ok "human output shows conviction count"
else
  fail "human output missing conviction count"
fi
if echo "$OUT" | grep -q "Status: Challenged"; then
  ok "human output shows Challenged status"
else
  fail "human output missing Challenged status"
fi
if echo "$OUT" | grep -q "#0"; then
  ok "human output shows conviction #0"
else
  fail "human output missing conviction #0"
fi
echo ""

# ── Test 6: Error — missing --fact or --proof ──
echo "Test 6: error when --fact or --proof missing"
OUT=$($CLI validate --video-id "test-video-001" --fact "Something wrong" --json 2>&1) || true
check_json "returns error" "$OUT" ".error" "--fact and --proof are required when submitting a conviction"
echo ""

# ── Test 7: Error — conviction period ended ──
echo "Test 7: error after conviction period ends"
# Fast-forward anvil time by 901 seconds (past 900s conviction period)
cast rpc evm_increaseTime 901 --rpc-url "$RPC_URL" >/dev/null 2>&1
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null 2>&1

OUT=$($CLI validate \
  --video-id "test-video-001" \
  --fact "Late challenge" \
  --proof "This should fail" \
  --json 2>&1) || true
HAS_ERROR=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).error?'yes':'no')}catch{console.log('no')}})")
if [[ "$HAS_ERROR" == "yes" ]]; then
  ok "returns error after conviction period"
else
  fail "no error after conviction period"
fi
echo ""

# ── Test 8: Error — nonexistent video ──
echo "Test 8: error for nonexistent video"
OUT=$($CLI validate \
  --video-id "nonexistent-video" \
  --fact "Test" \
  --proof "Test" \
  --json 2>&1) || true
HAS_ERROR=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).error?'yes':'no')}catch{console.log('no')}})")
if [[ "$HAS_ERROR" == "yes" ]]; then
  ok "returns error for nonexistent video"
else
  fail "no error for nonexistent video"
fi
echo ""

# ── Summary ──
echo "==========================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "==========================="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
