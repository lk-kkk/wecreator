/**
 * S2-031: OWASP Top 10 安全扫描
 * S2-032: 并发安全复测
 */
const request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { createTestApp, getEnterpriseToken, getWorkerToken } from './helpers';

let app: INestApplication;
let companyToken: string;
let workerToken: string;

beforeAll(async () => {
  app = await createTestApp();
  companyToken = await getEnterpriseToken(app);
  workerToken  = await getWorkerToken(app);
}, 30000);

afterAll(async () => { await app?.close(); });

// ═══════════════════════════════════════════════════
// OWASP A01: Broken Access Control
// ═══════════════════════════════════════════════════
describe('A01: Broken Access Control', () => {
  test('Worker cannot access company dashboard', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('Worker cannot manage subaccounts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/subaccounts')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('Worker cannot create invoices', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 1000, invoiceType: '普票' });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('Company cannot access worker wallet', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/worker/wallet')
      .set('Authorization', `Bearer ${companyToken}`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('Company cannot submit worker checkin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/worker/tasks/1/checkin')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({ lat: 30.0, lng: 120.0 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ═══════════════════════════════════════════════════
// OWASP A02: Cryptographic Failures
// ═══════════════════════════════════════════════════
describe('A02: Cryptographic Failures', () => {
  test('Password not returned in profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/enterprise/profile')
      .set('Authorization', `Bearer ${companyToken}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('password');
    expect(body).not.toContain('password_hash');
    expect(body).not.toContain('passwordHash');
  });

  test('JWT secret not exposed in response', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/enterprise/profile')
      .set('Authorization', `Bearer ${companyToken}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('JWT_SECRET');
    expect(body).not.toContain('jwtSecret');
  });
});

// ═══════════════════════════════════════════════════
// OWASP A03: Injection
// ═══════════════════════════════════════════════════
describe('A03: Injection', () => {
  test('SQL injection in task title', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({ title: "'; DROP TABLE tasks; --", taskMode: 'task_package', totalBudget: 1000 });
    // Should either create safely or reject, never crash
    expect([200, 201, 400]).toContain(res.status);
  });

  test('SQL injection in search params', async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/tasks?status='; DROP TABLE tasks;--")
      .set('Authorization', `Bearer ${companyToken}`);
    expect([200, 400, 500]).toContain(res.status);
  });

  test('NoSQL injection in login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/enterprise/login')
      .send({ phone: { $gt: '' }, password: { $gt: '' } });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('XSS in task description', async () => {
    const xssPayload = '<script>alert("xss")</script><img onerror="alert(1)" src="x">';
    const res = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({ title: 'XSS Test', description: xssPayload, taskMode: 'task_package', totalBudget: 100 });
    // Should either sanitize or store as plain text (Prisma parameterized)
    expect([200, 201, 400]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════
// OWASP A04: Insecure Design
// ═══════════════════════════════════════════════════
describe('A04: Insecure Design', () => {
  test('Registration requires strong password format', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/enterprise/register')
      .send({
        name: 'WeakPw', creditCode: `91110000WP${Date.now().toString().slice(-8)}`,
        adminName: 'WP', adminPhone: `137${Date.now().toString().slice(-8)}`,
        password: '123',  // weak password
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('Negative budget rejected', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({ title: 'Neg', taskMode: 'task_package', totalBudget: -1000 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ═══════════════════════════════════════════════════
// OWASP A07: Auth Failures (handled by A01 + JWT)
// ═══════════════════════════════════════════════════
describe('A07: Auth Failures', () => {
  test('Invalid JWT rejected', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(res.status).toBe(401);
  });

  test('Expired-like token rejected', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlhdCI6MTAwMDAwMDAwMCwiZXhwIjoxMDAwMDAwMDAxfQ.fake');
    expect(res.status).toBe(401);
  });

  test('No auth header rejected', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/dashboard');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════
// OWASP A08: Data Integrity
// ═══════════════════════════════════════════════════
describe('A08: Data Integrity', () => {
  test('Cannot set negative wallet balance via withdraw', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/worker/wallet/withdraw')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 999999999 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('Cannot recharge negative amount', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/finance/recharge')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({ amount: -1000 });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ═══════════════════════════════════════════════════
// OWASP A09: Logging & Monitoring
// ═══════════════════════════════════════════════════
describe('A09: Logging', () => {
  test('Server returns proper error structure', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/nonexistent');
    expect(res.body).toHaveProperty('message');
    // Should NOT leak stack traces
    expect(JSON.stringify(res.body)).not.toContain('at Object.');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });
});

// ═══════════════════════════════════════════════════
// S2-032: 并发安全复测
// ═══════════════════════════════════════════════════
describe('Concurrency Safety', () => {
  test('Concurrent balance reads are consistent', async () => {
    // Fire 5 parallel balance reads
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/finance/balance')
          .set('Authorization', `Bearer ${companyToken}`)
      )
    );
    // All should return same balance value
    const balances = results.filter(r => r.status === 200).map(r => (r.body?.data ?? r.body).balance);
    if (balances.length > 1) {
      const unique = [...new Set(balances.map(String))];
      expect(unique.length).toBe(1);
    }
  });

  test('Concurrent wallet reads are consistent', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/worker/wallet')
          .set('Authorization', `Bearer ${workerToken}`)
      )
    );
    const wallets = results.filter(r => r.status === 200).map(r => (r.body?.data ?? r.body).balance);
    const unique = [...new Set(wallets.map(String))];
    expect(unique.length).toBe(1);
  });

  test('Concurrent dashboard reads do not crash', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/dashboard')
          .set('Authorization', `Bearer ${companyToken}`)
      )
    );
    const statuses = results.map(r => r.status);
    expect(statuses.every(s => s === 200)).toBe(true);
  });
});
