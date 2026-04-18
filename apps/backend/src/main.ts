import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common';
import { AllExceptionsFilter } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // ── R9 安全：HTTP安全头 ──────────────────────
  app.use(helmet());

  // ── 全局前缀 ─────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── CORS ──────────────────────────────────────
  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? ['https://admin.wecreator.cn']
      : true,
    credentials: true,
  });

  // ── 全局管道：自动校验 DTO ────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // 自动剥离未声明字段
      forbidNonWhitelisted: true, // 有未声明字段则报错
      transform: true,          // 自动类型转换
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── 统一响应格式拦截器 ────────────────────────
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ── 全局异常过滤器 ────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Swagger 文档 ──────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('WeCreator API')
      .setDescription('零工创作者管理平台 API 文档')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', '认证模块')
      .addTag('task', '任务模块')
      .addTag('finance', '财务模块')
      .addTag('message', '消息模块')
      .addTag('file', '文件模块')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs at http://localhost:3000/api/docs');
    logger.warn('⚠️  Swagger UI 已启用！生产环境必须设置 NODE_ENV=production 以禁用');
  }

  // ── 启动 ──────────────────────────────────────
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`🚀 WeCreator API running on http://localhost:${port}`);
  logger.log(`📖 API Prefix: /api/v1`);
}
bootstrap();
