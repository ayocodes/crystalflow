#!/usr/bin/env bash
# E2E test for: F8-MK Prediction Markets
# Starts anvil, deploys contracts, tests market lifecycle + server REST API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CONTRACTS_DIR="$ROOT/apps/contracts"
SERVER_DIR="$ROOT/apps/server"
PORT=4446
PASS=0
FAIL=0
ANVIL_PID=""
SERVER_PID=""

# Anvil default accounts
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
NON_AGENT_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
RPC_URL="http://127.0.0.1:8545"

cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null && wait "$SERVER_PID" 2>/dev/null || true
  [[ -n "$ANVIL_PID" ]] && kill "$ANVIL_PID" 2>/dev/null && wait "$ANVIL_PID" 2>/dev/null || true
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

echo "=== E2E: F8-MK Prediction Markets ==="
echo ""

# ── Build contracts ──
echo "[build] contracts..."
if (cd "$CONTRACTS_DIR" && forge build) >/dev/null 2>&1; then
  ok "forge build succeeds"
else
  fail "forge build failed"
  exit 1
fi
echo ""

# ── Start Anvil ──
echo "[anvil] starting..."
anvil --silent &
ANVIL_PID=$!

for i in $(seq 1 20); do
  cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1 && break
  sleep 0.25
done

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "[anvil] FAILED to start"; exit 1
fi
echo "[anvil] ready (pid $ANVIL_PID)"
echo ""

# ── Deploy contracts ──
echo "[deploy] AgentRegistry..."
AGENT_REG_OUTPUT=$(forge create "$CONTRACTS_DIR/src/AgentRegistry.sol:AgentRegistry" \
  --root "$CONTRACTS_DIR" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast 2>&1)
AGENT_REGISTRY=$(echo "$AGENT_REG_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
echo "[deploy] AgentRegistry at $AGENT_REGISTRY"

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

echo "[deploy] PredictionMarket..."
MARKET_OUTPUT=$(forge create "$CONTRACTS_DIR/src/PredictionMarket.sol:PredictionMarket" \
  --root "$CONTRACTS_DIR" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$POINTS_REGISTRY" "$AGENT_REGISTRY" 2>&1)
PREDICTION_MARKET=$(echo "$MARKET_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
echo "[deploy] PredictionMarket at $PREDICTION_MARKET"

# Link contracts in PointsRegistry
cast send "$POINTS_REGISTRY" \
  "setContracts(address,address,address)" \
  "$VIDEO_REGISTRY" "$PREDICTION_MARKET" "0x0000000000000000000000000000000000000000" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1
echo "[deploy] contracts linked"
echo ""

# ── Register agent (account 0 as Curator) ──
echo "[setup] registering agent..."
cast send "$AGENT_REGISTRY" \
  "register(uint8,string,string)" \
  2 "test-curator" "https://example.com/agent.json" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1
echo "[setup] agent registered as Curator"

# ── Submit video index + conviction ──
echo "[setup] submitting video index..."
cast send "$VIDEO_REGISTRY" \
  "submitIndex(string,string)" \
  "test-video-001" "QmTestStorageCid123" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1

echo "[setup] submitting conviction..."
cast send "$VIDEO_REGISTRY" \
  "submitConviction(string,string)" \
  "test-video-001" "QmConvictionProof456" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1
echo "[setup] done"
echo ""

# ═══════════════════════════════════════════════════════════
# Test 1: Create market on-chain
# ═══════════════════════════════════════════════════════════
echo "Test 1: Create market on-chain"

cast send "$PREDICTION_MARKET" \
  "createMarket(string,string)" \
  "test-video-001" "Are the convictions valid?" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1

COUNT=$(cast call "$PREDICTION_MARKET" \
  "getMarketCount()(uint256)" \
  --rpc-url "$RPC_URL" 2>&1 | tr -d '[:space:]')
if [[ "$COUNT" == "1" ]]; then
  ok "getMarketCount = 1"
else
  fail "getMarketCount = $COUNT (expected 1)"
fi

MARKET_IDS=$(cast call "$PREDICTION_MARKET" \
  "getAllMarketIds()(string[])" \
  --rpc-url "$RPC_URL" 2>&1)
if echo "$MARKET_IDS" | grep -q "market_1"; then
  ok "getAllMarketIds contains market_1"
else
  fail "getAllMarketIds missing market_1: $MARKET_IDS"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 2: Vote yes and no
# ═══════════════════════════════════════════════════════════
echo "Test 2: Vote yes/no on market"

cast send "$PREDICTION_MARKET" \
  "voteYes(string)" "market_1" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1
ok "voteYes tx succeeded"

# Vote no from a different account
cast send "$PREDICTION_MARKET" \
  "voteNo(string)" "market_1" \
  --rpc-url "$RPC_URL" \
  --private-key "$NON_AGENT_KEY" >/dev/null 2>&1
ok "voteNo tx succeeded (account 1)"
echo ""

# ═══════════════════════════════════════════════════════════
# Test 3: Market odds
# ═══════════════════════════════════════════════════════════
echo "Test 3: Market odds"

ODDS=$(cast call "$PREDICTION_MARKET" \
  "getMarketOdds(string)(uint256,uint256)" "market_1" \
  --rpc-url "$RPC_URL" 2>&1)
YES_PCT=$(echo "$ODDS" | head -1 | tr -d '[:space:]')
NO_PCT=$(echo "$ODDS" | tail -1 | tr -d '[:space:]')

if [[ "$YES_PCT" == "50" ]]; then
  ok "yesPercentage = 50"
else
  fail "yesPercentage = $YES_PCT (expected 50)"
fi
if [[ "$NO_PCT" == "50" ]]; then
  ok "noPercentage = 50"
else
  fail "noPercentage = $NO_PCT (expected 50)"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 4: Market not expired yet
# ═══════════════════════════════════════════════════════════
echo "Test 4: Market not expired before duration"

EXPIRED=$(cast call "$PREDICTION_MARKET" \
  "isMarketExpired(string)(bool)" "market_1" \
  --rpc-url "$RPC_URL" 2>&1 | tr -d '[:space:]')
if [[ "$EXPIRED" == "false" ]]; then
  ok "market not expired"
else
  fail "market expired early"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 5: Access control — non-agent can't create market
# ═══════════════════════════════════════════════════════════
echo "Test 5: Non-agent cannot create market"

if ! cast send "$PREDICTION_MARKET" \
  "createMarket(string,string)" \
  "test-video-001" "Should fail" \
  --rpc-url "$RPC_URL" \
  --private-key "$NON_AGENT_KEY" >/dev/null 2>&1; then
  ok "non-agent create reverted"
else
  fail "non-agent create did not revert"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 6: Can't resolve before expiry
# ═══════════════════════════════════════════════════════════
echo "Test 6: Cannot resolve before expiry"

if ! cast send "$PREDICTION_MARKET" \
  "resolveMarket(string,bool)" "market_1" true \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1; then
  ok "early resolve reverted"
else
  fail "early resolve did not revert"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 7: Fast-forward → resolve market → points
# ═══════════════════════════════════════════════════════════
echo "Test 7: Resolve market after expiry"

# Fast-forward past MARKET_DURATION (2700s)
cast rpc evm_increaseTime 2701 --rpc-url "$RPC_URL" >/dev/null 2>&1
cast rpc evm_mine --rpc-url "$RPC_URL" >/dev/null 2>&1

EXPIRED=$(cast call "$PREDICTION_MARKET" \
  "isMarketExpired(string)(bool)" "market_1" \
  --rpc-url "$RPC_URL" 2>&1 | tr -d '[:space:]')
if [[ "$EXPIRED" == "true" ]]; then
  ok "market expired after time warp"
else
  fail "market not expired after time warp"
fi

# Resolve — YES wins (yes=1, no=1, tie goes to YES since yesVotes >= noVotes)
cast send "$PREDICTION_MARKET" \
  "resolveMarket(string,bool)" "market_1" true \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1
ok "resolveMarket tx succeeded"

# Check points awarded to YES voter (account 0)
POINTS=$(cast call "$POINTS_REGISTRY" \
  "getPoints(address)(uint256)" \
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" \
  --rpc-url "$RPC_URL" 2>&1 | tr -d '[:space:]')
# Account 0 gets points from: submitIndex (10) + market win (5) = 15
if [[ "$POINTS" == "15" ]]; then
  ok "winner points = 15 (10 index + 5 market)"
else
  fail "winner points = $POINTS (expected 15)"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 8: Can't resolve twice
# ═══════════════════════════════════════════════════════════
echo "Test 8: Cannot resolve already resolved market"

if ! cast send "$PREDICTION_MARKET" \
  "resolveMarket(string,bool)" "market_1" false \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1; then
  ok "double resolve reverted"
else
  fail "double resolve did not revert"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 9: Create a second market for server API tests
# ═══════════════════════════════════════════════════════════
echo "Test 9: Create second market for API tests"

cast send "$PREDICTION_MARKET" \
  "createMarket(string,string)" \
  "test-video-001" "Is the scene detection accurate?" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" >/dev/null 2>&1

COUNT=$(cast call "$PREDICTION_MARKET" \
  "getMarketCount()(uint256)" \
  --rpc-url "$RPC_URL" 2>&1 | tr -d '[:space:]')
if [[ "$COUNT" == "2" ]]; then
  ok "getMarketCount = 2"
else
  fail "getMarketCount = $COUNT (expected 2)"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Server REST API tests
# ═══════════════════════════════════════════════════════════
echo "[server] starting on port $PORT..."
(cd "$SERVER_DIR" && \
  PORT=$PORT \
  PRIVATE_KEY="$PRIVATE_KEY" \
  RPC_URL="$RPC_URL" \
  VIDEO_REGISTRY_ADDRESS="$VIDEO_REGISTRY" \
  PREDICTION_MARKET_ADDRESS="$PREDICTION_MARKET" \
  npx tsx src/index.ts) >/dev/null 2>&1 &
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

# ═══════════════════════════════════════════════════════════
# Test 10: GET /api/markets — list all markets
# ═══════════════════════════════════════════════════════════
echo "Test 10: GET /api/markets"

OUT=$(curl -s "$API/markets")
MARKET_COUNT=$(jval "$OUT" ".markets.length")
# 2 manual + 1 from market automation loop (video past conviction period w/ convictions)
if [[ "$MARKET_COUNT" == "3" ]]; then
  ok "3 markets returned (2 manual + 1 automation)"
else
  fail "market count = $MARKET_COUNT (expected 3)"
fi

# First market should be resolved
FIRST_STATUS=$(jval "$OUT" ".markets[0].status")
if [[ "$FIRST_STATUS" == "Resolved" ]]; then
  ok "market_1 status = Resolved"
else
  fail "market_1 status = $FIRST_STATUS (expected Resolved)"
fi

# Second market should be Active
SECOND_STATUS=$(jval "$OUT" ".markets[1].status")
if [[ "$SECOND_STATUS" == "Active" ]]; then
  ok "market_2 status = Active"
else
  fail "market_2 status = $SECOND_STATUS (expected Active)"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 11: GET /api/markets/:marketId — single market
# ═══════════════════════════════════════════════════════════
echo "Test 11: GET /api/markets/market_2"

OUT=$(curl -s "$API/markets/market_2")
check "id=market_2" "$OUT" ".id" "market_2"
check "videoId" "$OUT" ".videoId" "test-video-001"
check "question" "$OUT" ".question" "Is the scene detection accurate?"
check "status=Active" "$OUT" ".status" "Active"

YES_ODDS=$(jval "$OUT" ".odds.yesPercentage")
NO_ODDS=$(jval "$OUT" ".odds.noPercentage")
if [[ "$YES_ODDS" == "50" && "$NO_ODDS" == "50" ]]; then
  ok "odds = 50/50 (no votes yet)"
else
  fail "odds = $YES_ODDS/$NO_ODDS (expected 50/50)"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 12: POST /api/markets/:marketId/vote
# ═══════════════════════════════════════════════════════════
echo "Test 12: POST /api/markets/market_2/vote"

OUT=$(curl -s -X POST "$API/markets/market_2/vote" \
  -H 'Content-Type: application/json' \
  -d '{"side":"yes"}')
check "vote success" "$OUT" ".success" "true"
check "vote side" "$OUT" ".side" "yes"
check "vote marketId" "$OUT" ".marketId" "market_2"

TX_HASH=$(jval "$OUT" ".txHash")
if [[ -n "$TX_HASH" && "$TX_HASH" == 0x* ]]; then
  ok "txHash present"
else
  fail "txHash missing or invalid"
fi

# Verify odds changed
OUT=$(curl -s "$API/markets/market_2")
YES_ODDS=$(jval "$OUT" ".odds.yesPercentage")
if [[ "$YES_ODDS" == "100" ]]; then
  ok "odds updated to 100/0 after yes vote"
else
  fail "odds = $YES_ODDS (expected 100)"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 13: Invalid vote side rejected
# ═══════════════════════════════════════════════════════════
echo "Test 13: Invalid vote side"

OUT=$(curl -s -X POST "$API/markets/market_2/vote" \
  -H 'Content-Type: application/json' \
  -d '{"side":"maybe"}')
HAS_ERROR=$(jval "$OUT" ".error")
if [[ "$HAS_ERROR" != "undefined" && "$HAS_ERROR" != "PARSE_ERROR" ]]; then
  ok "invalid side returns error"
else
  fail "no error for invalid side"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Test 14: Activity count
# ═══════════════════════════════════════════════════════════
echo "Test 14: Activity tracking on-chain"

ACTIVITY_COUNT=$(cast call "$PREDICTION_MARKET" \
  "getActivityCount()(uint256)" \
  --rpc-url "$RPC_URL" 2>&1 | tr -d '[:space:]')
# Activities: create m1, vote yes, vote no, resolve m1, create m2, create m3 (automation), vote yes (API) = 7
if [[ "$ACTIVITY_COUNT" == "7" ]]; then
  ok "activityCount = 7"
else
  fail "activityCount = $ACTIVITY_COUNT (expected 7)"
fi
echo ""

# ── Summary ──
echo "==========================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "==========================="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
