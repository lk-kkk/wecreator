// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { createTestApp, getEnterpriseToken, getWorkerToken } from './helpers';
import { INestApplication } from '@nestjs/common';

describe('E2E-09/10 资金流专项 + 并发安全', () => {
  let app: INestApplication;
  let companyToken: string;
  let workerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    companyToken = await getEnterpriseToken(app);
    workerToken  = await getWorkerToken(app, `pay_${Date.now()}`);
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────
  // E2E-09: 结算→零工钱包→提现
  // ──────────────────────────────────────────────
  describe('E2E-09: 钱包+提现', () => {
    it('查询零工钱包初始状态', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/worker/wallet')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.availableBalance).toBeGreaterThanOrEqual(0);
    });

    it('提现超出余额应报400', async () => {
      const walletRes = await request(app.getHttpServer())
        .get('/api/v1/worker/wallet')
        .set('Authorization', `Bearer ${workerToken}`);
      const balance = walletRes.body.data.availableBalance;

      const res = await request(app.getHttpServer())
        .post('/api/v1/worker/wallet/withdraw')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ amount: balance + 9999 });
      expect(res.status).toBe(400);
    });

    it('流水列表结构正确', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/worker/wallet/transactions')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('total');
    });
  });

  // ──────────────────────────────────────────────
  // 资金守恒测试：充值总额 = 余额 + 锁定
  // ──────────────────────────────────────────────
  describe('资金守恒', () => {
    it('充值后余额+锁定=充值额', async () => {
      // 先获取初始余额
      const b0Res = await request(app.getHttpServer())
        .get('/api/v1/finance/balance')
        .set('Authorization', `Bearer ${companyToken}`);
      const { balance: b0, lockedBalance: l0 } = b0Res.body.data;

      // 充值500
      const rechargeRes = await request(app.getHttpServer())
        .post('/api/v1/finance/recharge')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: 500 });
      const txNo = rechargeRes.body.data.transactionNo;

      // 模拟回调
      await request(app.getHttpServer())
        .post('/api/v1/finance/recharge/callback')
        .send({ transactionNo: txNo });

      // 余额增加500
      const b1Res = await request(app.getHttpServer())
        .get('/api/v1/finance/balance')
        .set('Authorization', `Bearer ${companyToken}`);
      const { balance: b1, lockedBalance: l1 } = b1Res.body.data;

      expect(b1 - b0).toBeCloseTo(500, 1);
      expect(l1).toBe(l0); // 锁定金额不变
    });
  });

  // ──────────────────────────────────────────────
  // 幂等性测试：相同idempotency_key不重复计费
  // ──────────────────────────────────────────────
  describe('幂等性', () => {
    it('重复回调同一transactionNo只处理一次', async () => {
      const rechargeRes = await request(app.getHttpServer())
        .post('/api/v1/finance/recharge')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: 100 });
      const txNo = rechargeRes.body.data.transactionNo;

      const b0Res = await request(app.getHttpServer())
        .get('/api/v1/finance/balance')
        .set('Authorization', `Bearer ${companyToken}`);

      // 第一次回调
      await request(app.getHttpServer())
        .post('/api/v1/finance/recharge/callback')
        .send({ transactionNo: txNo });

      // 第二次回调（幂等，不重复加余额）
      await request(app.getHttpServer())
        .post('/api/v1/finance/recharge/callback')
        .send({ transactionNo: txNo });

      const b1Res = await request(app.getHttpServer())
        .get('/api/v1/finance/balance')
        .set('Authorization', `Bearer ${companyToken}`);

      // 余额只增加了100一次，而不是200
      expect(b1Res.body.data.balance - b0Res.body.data.balance).toBeCloseTo(100, 0);
    });
  });

  // ──────────────────────────────────────────────
  // E2E-10: 全链路金额守恒
  // ──────────────────────────────────────────────
  describe('E2E-10: 全链路验证', () => {
    it('流水API结构正确（列表+分页）', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${companyToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('list');
      expect(res.body.data).toHaveProperty('total');
      expect(Array.isArray(res.body.data.list)).toBe(true);
    });

    it('充值金额大于0才允许', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/recharge')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: -100 });
      expect(res.status).toBe(400);
    });

    it('提现金额≥1才允许', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/worker/wallet/withdraw')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ amount: 0.5 });
      expect(res.status).toBe(400);
    });
  });
});
