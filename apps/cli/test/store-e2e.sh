#!/usr/bin/env bash
# E2E test for: crystalflow store
# Tests local storage: single file, directory, determinism, content integrity.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLI_DIR="$ROOT/apps/cli"
PASS=0
FAIL=0
TMPDIR_E2E=""
STORAGE_DIR=""

cleanup() {
  [[ -n "$TMPDIR_E2E" ]] && rm -rf "$TMPDIR_E2E"
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

echo "=== E2E: crystalflow store ==="
echo ""

# ── Build CLI ──
echo "[build] CLI..."
(cd "$CLI_DIR" && npx tsc) >/dev/null 2>&1
CLI="node $CLI_DIR/dist/index.js"
echo "[build] done"
echo ""

# ── Create test fixtures ──
TMPDIR_E2E=$(mktemp -d)
STORAGE_DIR=$(mktemp -d)

# Fake index JSON (mimics output of crystalflow index --json)
cat > "$TMPDIR_E2E/index.json" <<'ENDJSON'
{
  "videoId": "abc123def456",
  "scenes": [
    {"timestamp": 0.0, "jpeg": "dGVzdC1qcGVn", "colors": [{"r":255,"g":0,"b":0}], "deltaE": 42.5},
    {"timestamp": 3.2, "jpeg": "c2NlbmUtdHdv", "colors": [{"r":0,"g":255,"b":0}], "deltaE": 38.1}
  ],
  "videoInfo": {"codec": "h264", "width": 1920, "height": 1080, "fps": 30, "duration": 10.0},
  "processedAt": "2025-01-01T00:00:00.000Z"
}
ENDJSON

echo "test-scene-jpeg-1" > "$TMPDIR_E2E/scene-001.jpg"
echo "test-scene-jpeg-2" > "$TMPDIR_E2E/scene-002.jpg"
echo "test-scene-jpeg-3" > "$TMPDIR_E2E/scene-003.jpg"

# Known SHA-256 of index.json for determinism check
EXPECTED_CID=$(shasum -a 256 "$TMPDIR_E2E/index.json" | awk '{print $1}')

# ── Test 1: Store single file (JSON output) ──
echo "Test 1: store --input <file> --json"
OUT=$($CLI store --input "$TMPDIR_E2E/index.json" --provider local --json 2>&1)
check_json "provider=local" "$OUT" ".provider" "local"
check_json "cid matches sha256" "$OUT" ".cid" "$EXPECTED_CID"

SIZE=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).size))")
ACTUAL_SIZE=$(wc -c < "$TMPDIR_E2E/index.json" | tr -d ' ')
if [[ "$SIZE" == "$ACTUAL_SIZE" ]]; then
  ok "size=$SIZE matches file size"
else
  fail "size mismatch (got $SIZE, expected $ACTUAL_SIZE)"
fi
echo ""

# ── Test 2: CID determinism (same content → same CID) ──
echo "Test 2: deterministic CID"
OUT2=$($CLI store --input "$TMPDIR_E2E/index.json" --provider local --json 2>&1)
CID1=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).cid))")
CID2=$(echo "$OUT2" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).cid))")
if [[ "$CID1" == "$CID2" ]]; then
  ok "same content produces same CID"
else
  fail "CIDs differ ($CID1 vs $CID2)"
fi
echo ""

# ── Test 3: Content integrity (stored data matches original) ──
echo "Test 3: content integrity"
STORED_PATH="$HOME/.crystalflow/storage/$EXPECTED_CID"
if [[ -f "$STORED_PATH" ]]; then
  ok "file exists at ~/.crystalflow/storage/<cid>"
else
  fail "file not found at $STORED_PATH"
fi

if diff -q "$TMPDIR_E2E/index.json" "$STORED_PATH" >/dev/null 2>&1; then
  ok "stored content matches original byte-for-byte"
else
  fail "stored content differs from original"
fi
echo ""

# ── Test 4: Store directory ──
echo "Test 4: store --input-dir <directory> --json"
# Create a subdirectory with only JPEGs
mkdir -p "$TMPDIR_E2E/scenes"
cp "$TMPDIR_E2E/scene-001.jpg" "$TMPDIR_E2E/scenes/"
cp "$TMPDIR_E2E/scene-002.jpg" "$TMPDIR_E2E/scenes/"
cp "$TMPDIR_E2E/scene-003.jpg" "$TMPDIR_E2E/scenes/"

OUT=$($CLI store --input-dir "$TMPDIR_E2E/scenes" --provider local --json 2>&1)
COUNT=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(Array.isArray(o)?o.length:'NOT_ARRAY')})")
if [[ "$COUNT" == "3" ]]; then
  ok "stored 3 files from directory"
else
  fail "stored $COUNT files (expected 3)"
fi

# Verify each has a CID
ALL_HAVE_CID=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const o=JSON.parse(d);console.log(o.every(r=>r.cid&&r.cid.length===64)?'yes':'no')})")
if [[ "$ALL_HAVE_CID" == "yes" ]]; then
  ok "all results have valid 64-char hex CIDs"
else
  fail "some results missing CIDs"
fi
echo ""

# ── Test 5: Different content → different CID ──
echo "Test 5: different content produces different CID"
echo "unique-content-$(date +%s)" > "$TMPDIR_E2E/unique.txt"
OUT_A=$($CLI store --input "$TMPDIR_E2E/scene-001.jpg" --provider local --json 2>&1)
OUT_B=$($CLI store --input "$TMPDIR_E2E/unique.txt" --provider local --json 2>&1)
CID_A=$(echo "$OUT_A" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).cid))")
CID_B=$(echo "$OUT_B" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).cid))")
if [[ "$CID_A" != "$CID_B" ]]; then
  ok "different content → different CIDs"
else
  fail "different content produced same CID"
fi
echo ""

# ── Test 6: Human-readable output ──
echo "Test 6: human-readable output (no --json)"
OUT=$($CLI store --input "$TMPDIR_E2E/index.json" --provider local 2>&1)
if echo "$OUT" | grep -q "CID:"; then
  ok "human output contains CID line"
else
  fail "human output missing CID line"
fi
if echo "$OUT" | grep -q "Provider: local"; then
  ok "human output contains provider"
else
  fail "human output missing provider"
fi
if echo "$OUT" | grep -q "Stored 1 file"; then
  ok "human output contains summary"
else
  fail "human output missing summary"
fi
echo ""

# ── Test 7: Error on missing input ──
echo "Test 7: error on missing file"
OUT=$($CLI store --input "/nonexistent/file.json" --provider local --json 2>&1) || true
HAS_ERROR=$(echo "$OUT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).error?'yes':'no')}catch{console.log('no')}})")
if [[ "$HAS_ERROR" == "yes" ]]; then
  ok "returns error for missing file"
else
  fail "no error for missing file"
fi
echo ""

# ── Test 8: Error with no args ──
echo "Test 8: error with no --input or --input-dir"
OUT=$($CLI store --provider local --json 2>&1) || true
check_json "returns error" "$OUT" ".error" "Either --input or --input-dir is required"
echo ""

# ── Summary ──
echo "==========================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "==========================="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
