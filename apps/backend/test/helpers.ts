import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common';

/**
 * E2E 测试辅助
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  await app.init();
  return app;
}

/** 生成 e2e 专用手机号（18位时间戳后8位） */
function e2ePhone(seed = '') {
  return `138${(Date.now() + seed.length).toString().slice(-8)}`;
}

/** 生成 18 位信用代码 */
function e2eCreditCode(suffix = '') {
  const base = `91330100E2E${(Date.now() + suffix.length).toString().slice(-7)}`;
  return base.padEnd(18, '0').slice(0, 18);
}

/**
 * 获取企业 token（每次创建唯一企业）
 */
export async function getEnterpriseToken(app: INestApplication): Promise<string> {
  const phone = e2ePhone('company');
  const creditCode = e2eCreditCode('cc');

  // 先注册
  const regRes = await request(app.getHttpServer())
    .post('/api/v1/enterprise/register')
    .send({
      name: `测试企业_${phone}`,
      creditCode,
      adminName: 'E2E测试员',
      adminPhone: phone,
      password: 'Test1234',
    });

  if (regRes.status !== 201) {
    throw new Error(`企业注册失败: ${regRes.status} ${JSON.stringify(regRes.body)}`);
  }

  // 登录
  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/enterprise/login')
    .send({ phone, password: 'Test1234' });

  if (!loginRes.body?.data?.accessToken) {
    throw new Error(`企业登录失败: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  return loginRes.body.data.accessToken;
}

/**
 * 获取零工 token（每次以不同 wx code 登录）
 */
export async function getWorkerToken(
  app: INestApplication,
  code = `e2e_wx_${Date.now()}`,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/worker/login')
    .send({ code });

  if (!res.body?.data?.accessToken) {
    throw new Error(`零工登录失败: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return res.body.data.accessToken;
}
