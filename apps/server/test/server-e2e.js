/**
 * E2E test for VidGrid signal server.
 * Run: node test/server-e2e.js (server must be running on port 3001)
 */
import WebSocket from "ws";

const SERVER = "http://localhost:3001";
const WS_URL = "ws://localhost:3001";
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`  [FAIL] ${msg}`);
    failed++;
  } else {
    console.log(`  [ok] ${msg}`);
    passed++;
  }
}

function connectWS() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws, type, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (!type || msg.type === type) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msg);
      }
    };
    ws.on("message", handler);
  });
}

function sendAgent(ws, agentId, role, name) {
  ws.send(JSON.stringify({
    type: "agent:connect",
    agentId,
    role,
    address: `0x${agentId}`,
    name,
  }));
}

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SERVER}${path}`, opts);
  return { status: res.status, data: await res.json() };
}

// --- Tests ---

async function testHealthCheck() {
  console.log("\n--- Test 1: Health check ---");
  const { status, data } = await api("GET", "/health");
  assert(status === 200, "GET /health returns 200");
  assert(data.status === "ok", 'status is "ok"');
  assert(typeof data.uptime === "number", "uptime is a number");
}

async function testAgentConnect() {
  console.log("\n--- Test 2: Agent connect via WebSocket ---");
  const ws = await connectWS();
  const ackP = waitForMessage(ws, "agent:connected");
  sendAgent(ws, "test-sentinel-1", "sentinel", "Sentinel Alpha");
  const ack = await ackP;
  assert(ack.type === "agent:connected", "receives agent:connected ack");
  assert(ack.agentId === "test-sentinel-1", "ack contains correct agentId");

  // Verify via REST
  const { data: agents } = await api("GET", "/api/agents");
  const found = agents.find((a) => a.agentId === "test-sentinel-1");
  assert(found !== undefined, "agent visible in GET /api/agents");
  assert(found.role === "sentinel", "agent role is sentinel");
  assert(found.status === "idle", "agent status is idle");
  assert(found.name === "Sentinel Alpha", "agent name correct");

  // Verify single agent lookup
  const { status, data: agent } = await api("GET", "/api/agents/test-sentinel-1");
  assert(status === 200, "GET /api/agents/:id returns 200");
  assert(agent.agentId === "test-sentinel-1", "single agent lookup works");

  ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

async function testAgentDisconnect() {
  console.log("\n--- Test 3: Agent disconnect cleanup ---");
  const ws = await connectWS();
  const ackP = waitForMessage(ws, "agent:connected");
  sendAgent(ws, "test-disconnect-1", "scout", "Scout Temp");
  await ackP;

  // Verify connected
  let { data: agents } = await api("GET", "/api/agents");
  assert(agents.some((a) => a.agentId === "test-disconnect-1"), "agent connected");

  // Disconnect
  ws.close();
  await new Promise((r) => setTimeout(r, 200));

  // Verify removed
  ({ data: agents } = await api("GET", "/api/agents"));
  assert(!agents.some((a) => a.agentId === "test-disconnect-1"), "agent removed after disconnect");
}

async function testJobCreation() {
  console.log("\n--- Test 4: Job creation via REST ---");
  const { status, data: job } = await api("POST", "/api/jobs", { videoUrl: "e2e-test.mp4" });
  assert(status === 201, "POST /api/jobs returns 201");
  assert(job.videoUrl === "e2e-test.mp4", "job has correct videoUrl");
  assert(job.status === "pending", "job starts as pending (no sentinels connected)");
  assert(Array.isArray(job.assignedTo) && job.assignedTo.length === 0, "no assignment yet");

  // Verify via list
  const { data: jobs } = await api("GET", "/api/jobs");
  assert(jobs.some((j) => j.id === job.id), "job visible in GET /api/jobs");

  // Verify single lookup
  const { data: single } = await api("GET", `/api/jobs/${job.id}`);
  assert(single.id === job.id, "single job lookup works");

  return job.id;
}

async function testJobValidation() {
  console.log("\n--- Test 5: Job creation validation ---");
  const { status } = await api("POST", "/api/jobs", {});
  assert(status === 400, "missing videoUrl returns 400");

  const { status: s2 } = await api("GET", "/api/jobs/nonexistent");
  assert(s2 === 404, "unknown jobId returns 404");

  const { status: s3 } = await api("GET", "/api/agents/nonexistent");
  assert(s3 === 404, "unknown agentId returns 404");
}

async function testAutoAssignment() {
  console.log("\n--- Test 6: Auto-assign job to sentinel on connect ---");

  // Clear stale jobs from previous tests
  await api("DELETE", "/api/jobs");

  // Create a job first (no sentinels connected → stays pending)
  const { data: job } = await api("POST", "/api/jobs", { videoUrl: "auto-assign-test.mp4" });
  assert(job.status === "pending", "job pending before sentinel connects");

  // Connect a sentinel
  const ws = await connectWS();
  const ackP = waitForMessage(ws, "agent:connected");
  sendAgent(ws, "auto-sentinel-1", "sentinel", "Sentinel Auto");
  await ackP;

  // Sentinel should receive job:assigned
  const assigned = await waitForMessage(ws, "job:assigned");
  assert(assigned.type === "job:assigned", "sentinel receives job:assigned");
  assert(assigned.job.videoUrl === "auto-assign-test.mp4", "assigned job has correct videoUrl");
  assert(assigned.job.assignedTo.includes("auto-sentinel-1"), "sentinel is in assignedTo");
  assert(assigned.job.status === "assigned", "job status is assigned");

  // Verify agent status changed to working
  const { data: agent } = await api("GET", "/api/agents/auto-sentinel-1");
  assert(agent.status === "working", "agent status changed to working");

  ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

async function testJobAssignOnCreation() {
  console.log("\n--- Test 7: Job assigns on creation when sentinels available ---");

  // Clear stale jobs
  await api("DELETE", "/api/jobs");

  // Connect sentinel first
  const ws = await connectWS();
  const ackP = waitForMessage(ws, "agent:connected");
  sendAgent(ws, "ready-sentinel-1", "sentinel", "Sentinel Ready");
  await ackP;

  // Wait for any stale drain to finish
  await new Promise((r) => setTimeout(r, 100));

  // Create a job — should auto-assign immediately
  const assignedP = waitForMessage(ws, "job:assigned");
  const { data: job } = await api("POST", "/api/jobs", { videoUrl: "on-create-test.mp4" });

  const assigned = await assignedP;
  assert(assigned.job.videoUrl === "on-create-test.mp4", "job assigned immediately on creation");
  assert(assigned.job.assignedTo.includes("ready-sentinel-1"), "assigned to the connected sentinel");

  ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

async function testResultSubmission() {
  console.log("\n--- Test 8: Result submission completes job ---");
  await api("DELETE", "/api/jobs");

  // Connect sentinel
  const ws = await connectWS();
  const ackP = waitForMessage(ws, "agent:connected");
  sendAgent(ws, "result-sentinel-1", "sentinel", "Sentinel Results");
  await ackP;

  // Drain pending
  await new Promise((r) => setTimeout(r, 200));

  // Create job
  const assignedP = waitForMessage(ws, "job:assigned");
  await api("POST", "/api/jobs", { videoUrl: "result-test.mp4" });
  const assigned = await assignedP;
  const jobId = assigned.job.id;

  // Submit result via WS
  const completedP = waitForMessage(ws, "job:completed");
  ws.send(JSON.stringify({
    type: "job:result",
    jobId,
    result: {
      agentId: "result-sentinel-1",
      submittedAt: Date.now(),
      indexData: { scenes: [{ ts: 0, label: "test" }] },
      storageCid: "bafytest123",
    },
  }));

  const completed = await completedP;
  assert(completed.type === "job:completed", "receives job:completed broadcast");
  assert(completed.jobId === jobId, "completed jobId matches");

  // Verify job status via REST
  const { data: job } = await api("GET", `/api/jobs/${jobId}`);
  assert(job.status === "completed", "job status is completed");
  assert(job.results.length === 1, "job has 1 result");
  assert(job.results[0].storageCid === "bafytest123", "result has storageCid");

  // Agent should be back to idle
  const { data: agent } = await api("GET", "/api/agents/result-sentinel-1");
  assert(agent.status === "idle", "agent back to idle after result");

  ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

async function testResultViaREST() {
  console.log("\n--- Test 9: Result submission via REST fallback ---");
  await api("DELETE", "/api/jobs");

  const ws = await connectWS();
  const ackP = waitForMessage(ws, "agent:connected");
  sendAgent(ws, "rest-sentinel-1", "sentinel", "Sentinel REST");
  await ackP;

  await new Promise((r) => setTimeout(r, 200));

  const assignedP = waitForMessage(ws, "job:assigned");
  await api("POST", "/api/jobs", { videoUrl: "rest-result-test.mp4" });
  const assigned = await assignedP;
  const jobId = assigned.job.id;

  // Submit via REST instead of WS
  const { status, data: updated } = await api("POST", `/api/jobs/${jobId}/result`, {
    agentId: "rest-sentinel-1",
    indexData: { scenes: [] },
  });
  assert(status === 200, "REST result returns 200");
  assert(updated.results.length === 1, "result recorded");
  assert(updated.status === "completed", "job completed via REST result");

  ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

async function testMultipleSentinels() {
  console.log("\n--- Test 10: Multiple sentinels get same job ---");
  await api("DELETE", "/api/jobs");

  // Connect 3 sentinels
  const sockets = [];
  for (let i = 1; i <= 3; i++) {
    const ws = await connectWS();
    const ackP = waitForMessage(ws, "agent:connected");
    sendAgent(ws, `multi-sentinel-${i}`, "sentinel", `Sentinel Multi ${i}`);
    await ackP;
    sockets.push(ws);
  }

  await new Promise((r) => setTimeout(r, 200));

  // Create a job — should assign to all 3 (min(3, available))
  const assignPromises = sockets.map((ws) => waitForMessage(ws, "job:assigned"));
  await api("POST", "/api/jobs", { videoUrl: "multi-sentinel-test.mp4" });

  const results = await Promise.all(assignPromises);
  assert(results.length === 3, "all 3 sentinels received job:assigned");
  assert(results[0].job.assignedTo.length === 3, "job assigned to 3 sentinels");

  const ids = new Set(results[0].job.assignedTo);
  assert(ids.size === 3, "3 unique agents assigned");

  for (const ws of sockets) ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

async function testHeartbeat() {
  console.log("\n--- Test 11: Heartbeat updates ---");
  const ws = await connectWS();
  const ackP = waitForMessage(ws, "agent:connected");
  sendAgent(ws, "hb-sentinel-1", "sentinel", "Sentinel HB");
  await ackP;

  const { data: before } = await api("GET", "/api/agents/hb-sentinel-1");
  const hbBefore = before.lastHeartbeat;

  await new Promise((r) => setTimeout(r, 50));
  ws.send(JSON.stringify({ type: "agent:heartbeat", agentId: "hb-sentinel-1" }));
  await new Promise((r) => setTimeout(r, 50));

  const { data: after } = await api("GET", "/api/agents/hb-sentinel-1");
  assert(after.lastHeartbeat > hbBefore, "heartbeat timestamp updated");

  ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

async function testInvalidJSON() {
  console.log("\n--- Test 12: Invalid JSON handling ---");
  const ws = await connectWS();

  const errP = waitForMessage(ws, "error");
  ws.send("not valid json {{{");
  const err = await errP;
  assert(err.type === "error", "server returns error for invalid JSON");
  assert(err.message === "Invalid JSON", "error message is correct");

  ws.close();
  await new Promise((r) => setTimeout(r, 100));
}

// --- Run all ---
try {
  await testHealthCheck();
  await testAgentConnect();
  await testAgentDisconnect();
  await testJobCreation();
  await testJobValidation();
  await testAutoAssignment();
  await testJobAssignOnCreation();
  await testResultSubmission();
  await testResultViaREST();
  await testMultipleSentinels();
  await testHeartbeat();
  await testInvalidJSON();

  console.log(`\n=== ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.error("SOME TESTS FAILED");
    process.exit(1);
  }
  console.log("ALL E2E TESTS PASSED\n");
  process.exit(0);
} catch (e) {
  console.error("\nTEST ERROR:", e);
  process.exit(1);
}
