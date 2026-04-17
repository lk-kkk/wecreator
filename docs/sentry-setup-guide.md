# Sentry 监控接入指南

## 1. 后端 NestJS 接入

### 安装
```bash
cd apps/backend
pnpm add @sentry/nestjs @sentry/node @sentry/profiling-node
```

### 配置 `.env`
```env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ENV=production
SENTRY_TRACES_SAMPLE_RATE=0.3
```

### `src/common/sentry.ts`
```typescript
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.3'),
    profilesSampleRate: 0.1,
    integrations: [nodeProfilingIntegration()],
    beforeSend(event) {
      // 过滤掉已知的非 bug 异常
      if (event.exception?.values?.[0]?.type === 'UnauthorizedException') return null;
      if (event.exception?.values?.[0]?.type === 'BadRequestException') return null;
      return event;
    },
  });
}
```

### `main.ts` 中初始化
```typescript
import { initSentry } from './common/sentry';
initSentry(); // 必须在 app 创建之前
```

---

## 2. PC Admin Vue3 接入

### 安装
```bash
cd apps/pc-admin
pnpm add @sentry/vue
```

### `main.ts`
```typescript
import * as Sentry from '@sentry/vue';

const app = createApp(App);

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.3,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### `.env.production`
```env
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## 3. Worker MP 小程序接入

### 安装
```bash
cd apps/worker-mp
pnpm add sentry-miniapp
```

### `app.ts`
```typescript
import * as Sentry from 'sentry-miniapp';

Sentry.init({
  dsn: 'https://xxx@xxx.ingest.sentry.io/xxx',
  tracesSampleRate: 0.3,
});
```

---

## 4. 告警规则

| 规则 | 阈值 | 通知 |
|------|------|------|
| 5xx 错误率 > 1% | 5分钟窗口 | 飞书 + 邮件 |
| P95 延迟 > 500ms | 5分钟窗口 | 飞书 |
| 新错误类型首次出现 | 实时 | 飞书 |
| 错误数量 > 100/h | 1小时窗口 | 邮件 + 电话 |

---

## 5. Source Map 上传

### 后端
```bash
sentry-cli sourcemaps inject ./dist
sentry-cli sourcemaps upload ./dist --org=wecreator --project=backend
```

### PC Admin
```bash
sentry-cli sourcemaps upload ./dist --org=wecreator --project=pc-admin --url-prefix='~/'
```

> **注意**: 生产环境 source map 不要部署到公网，只上传到 Sentry。
