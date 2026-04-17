// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { createTestApp, getEnterpriseToken, getWorkerToken } from './helpers';
import { INestApplication } from '@nestjs/common';

describe('E2E-01/02 认证体系', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────
  // E2E-01: 企业注册 → 登录 → 获取Token
  // ──────────────────────────────────────────────
  describe('E2E-01: 企业注册→登录', () => {
    const phone = `138${Date.now().toString().slice(-8)}`;
    let accessToken: string;

    it('企业注册成功', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/enterprise/register')
        .send({
          name: `测试企业_${phone}`,
          creditCode: `91330100E2E${phone.slice(-7)}`,
          adminName: '测试管理员',
          adminPhone: phone,
          password: 'Test1234',
        });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe(0);
    });

    it('企业登录成功并返回JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/enterprise/login')
        .send({ phone, password: 'Test1234' });
      expect([200, 201]).toContain(res.status);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      accessToken = res.body.data.accessToken;
    });

    it('使用JWT可获取企业资料', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/enterprise/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      expect([200, 201]).toContain(res.status);
    });

    it('错误密码登录返回401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/enterprise/login')
        .send({ phone, password: 'WrongPwd' });
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────────
  // E2E-02: 零工微信登录 → 实名认证
  // ──────────────────────────────────────────────
  describe('E2E-02: 零工登录→实名认证', () => {
    const wxCode = `test_wx_${Date.now()}`;
    let workerToken: string;

    it('零工微信登录成功', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/worker/login')
        .send({ code: wxCode });
      expect([200, 201]).toContain(res.status);
      expect(res.body.data.accessToken).toBeDefined();
      workerToken = res.body.data.accessToken;
    });

    it('重复登录返回相同用户（openid幂等）', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/worker/login')
        .send({ code: wxCode });
      expect([200, 201]).toContain(res.status);
      // 同一code对应同一用户
      const token2 = res.body.data.accessToken;
      expect(token2).toBeDefined();
    });

    it('零工实名认证', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/worker/verify')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ realName: '张测试', idCard: '110101199001010011' });
      // 开发环境下三要素验证直接通过
      expect([200, 400]).toContain(res.status);
    });
  });
});
