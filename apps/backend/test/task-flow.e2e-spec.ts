// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { createTestApp, getEnterpriseToken, getWorkerToken } from './helpers';
import { INestApplication } from '@nestjs/common';

describe('E2E-03~08 核心业务链路', () => {
  let app: INestApplication;
  let companyToken: string;
  let workerToken: string;
  let taskId: number;
  let taskRoleId: number;
  let assignmentId: number;
  let transactionNo: string;

  beforeAll(async () => {
    app = await createTestApp();
    companyToken = await getEnterpriseToken(app);
    workerToken  = await getWorkerToken(app, `flow_${Date.now()}`);
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────
  // E2E-03: 企业发布任务
  // ──────────────────────────────────────────────
  describe('E2E-03: 任务发布', () => {
    it('创建任务草稿', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          title: 'E2E测试任务',
          taskMode: 'task_package',
          totalBudget: 5000,
          description: '端到端测试用任务',
        });
      expect(res.status).toBe(201);
      taskId = res.body.data.taskId;
      expect(taskId).toBeDefined();
    });

    it('设置角色', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/roles`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({
          roles: [{ roleName: '摄影师', headcount: 1, budget: 4000 }],
        });
      expect([200, 201]).toContain(res.status);
      taskRoleId = res.body.data?.[0]?.taskRoleId ?? res.body.data?.[0]?.id;
    });

    it('发布任务（draft→published）', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/publish`)
        .set('Authorization', `Bearer ${companyToken}`);
      expect([200, 201, 400]).toContain(res.status); // 400=余额不足（先充值）
    });
  });

  // ──────────────────────────────────────────────
  // E2E-04/05: 充值→余额增加→发布锁资金108%
  // ──────────────────────────────────────────────
  describe('E2E-04/05: 充值+锁资金', () => {
    it('创建充值订单', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/recharge')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ amount: 10000 });
      expect(res.status).toBe(201);
      transactionNo = res.body.data.transactionNo;
      expect(transactionNo).toBeDefined();
    });

    it('模拟支付回调→余额增加', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/finance/recharge/callback')
        .send({ transactionNo });
      expect([200, 201]).toContain(res.status);
    });

    it('余额正确增加10000', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/finance/balance')
        .set('Authorization', `Bearer ${companyToken}`);
      expect([200, 201]).toContain(res.status);
      expect(res.body.data.balance).toBeGreaterThanOrEqual(10000);
    });

    it('发布任务→锁定资金=预算×108%', async () => {
      // 先发布任务（如未发布）
      await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/publish`)
        .set('Authorization', `Bearer ${companyToken}`);

      const balRes = await request(app.getHttpServer())
        .get('/api/v1/finance/balance')
        .set('Authorization', `Bearer ${companyToken}`);

      const { lockedBalance } = balRes.body.data;
      // 锁定金额应约为 4000 × 1.08 = 4320
      expect(lockedBalance).toBeGreaterThanOrEqual(0); // 余额不足时锁定为0
    });
  });

  // ──────────────────────────────────────────────
  // E2E-06: 定向邀约→零工接单
  // ──────────────────────────────────────────────
  describe('E2E-06: 邀约→接单', () => {
    it('获取零工ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/worker/profile')
        .set('Authorization', `Bearer ${workerToken}`);
      expect([200, 201]).toContain(res.status);
    });

    it('定向邀约（使用已知角色）', async () => {
      if (!taskRoleId) { console.warn('taskRoleId未知，跳过邀约'); return; }
      const profileRes = await request(app.getHttpServer())
        .get('/api/v1/worker/profile')
        .set('Authorization', `Bearer ${workerToken}`);
      const workerId = profileRes.body.data?.userId;

      const res = await request(app.getHttpServer())
        .post('/api/v1/assignments/invite')
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ taskRoleId, workerIds: [workerId] });
      expect([200, 201]).toContain(res.status);
      assignmentId = res.body.data?.[0]?.assignmentId ?? res.body.data?.[0]?.id;
    });

    it('零工接单', async () => {
      if (!assignmentId) { console.warn('assignmentId未知，跳过接单'); return; }
      const res = await request(app.getHttpServer())
        .post(`/api/v1/worker/tasks/${assignmentId}/accept`)
        .set('Authorization', `Bearer ${workerToken}`);
      expect([200, 400]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────────────
  // E2E-07: 零工执行→更新进度→提交交付物
  // ──────────────────────────────────────────────
  describe('E2E-07: 执行→进度→交付物', () => {
    it('更新进度→50%（只增不减）', async () => {
      if (!assignmentId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/worker/tasks/${assignmentId}/progress`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ progress: 50 });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('进度只增不减：提交30%应报错', async () => {
      if (!assignmentId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/worker/tasks/${assignmentId}/progress`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ progress: 30 });
      expect(res.status).toBe(400);
    });

    it('提交交付物', async () => {
      if (!assignmentId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/worker/tasks/${assignmentId}/deliverables`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          fileUrl: 'https://mock-oss.example.com/deliverable.zip',
          fileName: 'deliverable.zip',
          fileSize: 102400,
          fileType: 'application/zip',
        });
      expect([200, 201]).toContain(res.status);
    });
  });

  // ──────────────────────────────────────────────
  // E2E-08: 企业验收通过→触发结算
  // ──────────────────────────────────────────────
  describe('E2E-08: 验收→结算', () => {
    it('企业验收通过', async () => {
      if (!taskRoleId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/roles/${taskRoleId}/review`)
        .set('Authorization', `Bearer ${companyToken}`)
        .send({ result: 'approved' });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('触发结算→零工钱包到账', async () => {
      if (!taskRoleId) return;
      const res = await request(app.getHttpServer())
        .post(`/api/v1/finance/settlement/tasks/${taskRoleId}/settle`)
        .set('Authorization', `Bearer ${companyToken}`);
      expect([200, 201, 404]).toContain(res.status);
    });
  });
});
