#!/usr/bin/env node
/**
 * S2-030: 100QPS 压测脚本
 * 目标: P95 < 500ms, 零 5xx
 *
 * 使用: node test/load-test.js [baseUrl] [duration]
 * 示例: node test/load-test.js http://localhost:3000 30
 */

const http = require('http');

const BASE = process.argv[2] || 'http://localhost:3000';
const DURATION = parseInt(process.argv[3] || '10', 10);
const CONCURRENCY = 20;     // 20 concurrent connections
const RATE = 100;            // target 100 req/s

// ── 测试场景 ──────────────────────────────────────
const SCENARIOS = [
  { name: 'Health',             method: 'GET',  path: '/api/v1',                  auth: false },
  { name: 'Platform Roles',    method: 'GET',  path: '/api/v1/common/platform-roles', auth: true },
  { name: 'Upload Rules',      method: 'GET',  path: '/api/v1/common/upload/rules',   auth: true },
  { name: 'Dashboard',         method: 'GET',  path: '/api/v1/dashboard',          auth: true },
  { name: 'Task List',         method: 'GET',  path: '/api/v1/tasks',              auth: true },
  { name: 'Finance Balance',   method: 'GET',  path: '/api/v1/finance/balance',    auth: true },
  { name: 'Worker Profile',    method: 'GET',  path: '/api/v1/worker/profile',     auth: true, worker: true },
  { name: 'Worker Tasks',      method: 'GET',  path: '/api/v1/worker/tasks',       auth: true, worker: true },
];

// ── 统计 ──────────────────────────────────────
class Stats {
  constructor(name) {
    this.name = name;
    this.latencies = [];
    this.errors = 0;
    this.status5xx = 0;
    this.total = 0;
  }

  record(latency, statusCode) {
    this.total++;
    this.latencies.push(latency);
    if (statusCode >= 500) this.status5xx++;
    if (statusCode === 0) this.errors++;
  }

  report() {
    if (this.latencies.length === 0) return `  ${this.name}: no requests`;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const ok = p95 < 500 && this.status5xx === 0;
    return `  ${ok ? '✅' : '❌'} ${this.name.padEnd(20)} | total=${this.total.toString().padStart(5)} | avg=${avg.toFixed(0).padStart(4)}ms | p50=${p50.toFixed(0).padStart(4)}ms | p95=${p95.toFixed(0).padStart(4)}ms | p99=${p99.toFixed(0).padStart(4)}ms | 5xx=${this.status5xx}`;
  }
}

// ── HTTP 请求 ──────────────────────────────────
function makeRequest(url, method, headers) {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers,
      timeout: 5000,
    };

    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ latency: Date.now() - start, status: res.statusCode }));
    });

    req.on('error', () => resolve({ latency: Date.now() - start, status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ latency: Date.now() - start, status: 0 }); });
    req.end();
  });
}

// ── 获取Token ──────────────────────────────────
async function getTokens() {
  const phone = `138${Date.now().toString().slice(-8)}`;
  const credit = `91110000LT${Date.now().toString().slice(-8)}`;

  // Register
  await new Promise((resolve) => {
    const data = JSON.stringify({ name: 'LoadTest', creditCode: credit, adminName: 'LT', adminPhone: phone, password: 'Test1234' });
    const req = http.request(`${BASE}/api/v1/enterprise/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve(b)); });
    req.write(data); req.end();
  });

  // Login company
  const companyToken = await new Promise((resolve) => {
    const data = JSON.stringify({ phone, password: 'Test1234' });
    const req = http.request(`${BASE}/api/v1/enterprise/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b).data.accessToken); } catch { resolve(''); } });
    });
    req.write(data); req.end();
  });

  // Login worker
  const workerToken = await new Promise((resolve) => {
    const data = JSON.stringify({ code: `lt_wx_${Date.now()}` });
    const req = http.request(`${BASE}/api/v1/worker/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b).data.accessToken); } catch { resolve(''); } });
    });
    req.write(data); req.end();
  });

  return { companyToken, workerToken };
}

// ── Main ──────────────────────────────────────
async function main() {
  console.log(`\n🚀 WeCreator 100QPS Load Test`);
  console.log(`   Target: ${BASE}`);
  console.log(`   Duration: ${DURATION}s`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Rate target: ${RATE} req/s\n`);

  const { companyToken, workerToken } = await getTokens();
  if (!companyToken) { console.error('❌ Failed to get company token'); process.exit(1); }

  const statsMap = {};
  SCENARIOS.forEach(s => statsMap[s.name] = new Stats(s.name));

  const endTime = Date.now() + DURATION * 1000;
  const interval = 1000 / RATE; // ms between requests
  let inflight = 0;

  const runOne = async () => {
    if (Date.now() >= endTime) return;
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    const token = scenario.worker ? workerToken : companyToken;
    const headers = scenario.auth ? { 'Authorization': `Bearer ${token}` } : {};

    inflight++;
    const { latency, status } = await makeRequest(`${BASE}${scenario.path}`, scenario.method, headers);
    statsMap[scenario.name].record(latency, status);
    inflight--;
  };

  // Fire requests at target rate
  const requestPromises = [];
  const startTime = Date.now();

  while (Date.now() < endTime) {
    if (inflight < CONCURRENCY) {
      requestPromises.push(runOne());
    }
    await new Promise(r => setTimeout(r, interval));
  }

  await Promise.all(requestPromises);

  const elapsed = (Date.now() - startTime) / 1000;
  const totalReqs = Object.values(statsMap).reduce((s, st) => s + st.total, 0);
  const total5xx = Object.values(statsMap).reduce((s, st) => s + st.status5xx, 0);
  const allLatencies = Object.values(statsMap).flatMap(st => st.latencies).sort((a, b) => a - b);
  const globalP95 = allLatencies[Math.floor(allLatencies.length * 0.95)] || 0;

  console.log('═══ Per-Scenario Results ═══');
  Object.values(statsMap).forEach(st => console.log(st.report()));

  console.log('\n═══ Summary ═══');
  console.log(`  Total requests: ${totalReqs}`);
  console.log(`  Duration:       ${elapsed.toFixed(1)}s`);
  console.log(`  Throughput:     ${(totalReqs / elapsed).toFixed(1)} req/s`);
  console.log(`  Global P95:     ${globalP95.toFixed(0)}ms ${globalP95 < 500 ? '✅' : '❌'}`);
  console.log(`  5xx errors:     ${total5xx} ${total5xx === 0 ? '✅' : '❌'}`);
  console.log(`\n  ${globalP95 < 500 && total5xx === 0 ? '🎉 PASS: P95 < 500ms, 0 errors' : '⚠️ FAIL: Performance target not met'}`);

  process.exit(globalP95 < 500 && total5xx === 0 ? 0 : 1);
}

main().catch(console.error);
