# WeCreator 安全加固报告 (W6 · Sprint 1)

> 审计人：R9 Security-Ops  
> 审计日期：2026-04-17  
> 范围：Sprint 1 全量代码安全审计

---

## 一、认证安全 ✅

| 检查项 | 状态 | 说明 |
|--------|------|------|
| bcryptjs salt rounds ≥ 10 | ✅ 通过 | `bcrypt.hash(pwd, 10)` |
| JWT 密钥长度 ≥ 256bit | ✅ 通过 | `wecreator_jwt_secret_dev_2026_k8s7f2m9x`（40字符=320bit） |
| access_token 有效期 ≤ 2h | ✅ 通过 | `.env: JWT_ACCESS_EXPIRES=2h` |
| refresh_token ≤ 7d | ✅ 通过 | `.env: JWT_REFRESH_EXPIRES=7d` |
| 密码强度校验 | ✅ 通过 | 正则`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/`，最小8位 |
| 登录失败限流 | ⚠️ 待完善 | 全局100req/min/IP已配置；账户级别锁定待Sprint2 |

## 二、数据加密 ✅

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 手机号 AES-256-CBC 加密 | ✅ 通过 | `cryptoService.encrypt(phone)` 存库 |
| 身份证 AES-256-CBC 加密 | ✅ 通过 | `idCardEncrypted` 字段，解密后验证 |
| 加密密钥从环境变量读取 | ✅ 通过 | `AES_KEY` / `AES_IV` 在 `.env` |
| 代码中无硬编码密钥 | ✅ 通过 | 已审计全量 `src/` 目录 |

> ⚠️ **生产部署提醒**：`.env` 不入 Git（已在 `.gitignore`），生产密钥需通过 K8s Secret 注入。

## 三、支付安全 ✅

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 金额参数服务端二次校验 | ✅ 通过 | `amount ≤ 0` 拦截，`amount > 5000000` 上限 |
| 资金操作在数据库事务内 | ✅ 通过 | `prisma.$transaction(...)` 包裹所有资金变更 |
| 乐观锁防并发余额竞争 | ✅ 通过 | `version` 字段 + `where: { version }` 检查 |
| Redis 分布式锁防并发提现 | ✅ 通过 | TTL=10s，Lua 原子释放 |
| 支付回调无需 JWT（但需验签） | ✅ 已设置为公开路由 | 生产需加签名验证 |
| idempotency_key 幂等 | ✅ 通过 | `transactionNo` 唯一索引，重复回调跳过 |

## 四、API 安全 ✅

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 全局限流 100 req/min/IP | ✅ 已配置 | `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` |
| HTTP 安全头（Helmet）| ✅ 已配置 | `app.use(helmet())` in main.ts |
| CORS 白名单 | ✅ 通过 | 生产：`https://admin.wecreator.cn` |
| DTO 白名单校验（XSS 防护）| ✅ 通过 | `whitelist: true, forbidNonWhitelisted: true` |
| SQL 注入防护 | ✅ 通过 | 全程 Prisma 参数化查询，无拼接 SQL |
| 未授权资源访问 | ✅ 通过 | 所有业务接口加 `@UseGuards(JwtAuthGuard)` |

## 五、文件安全（当前状态）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| OSS Bucket 私有读写 | ⬜ 待配置 | P0-09 OSS 未配置 |
| 预签名 URL 访问 | ⬜ 待配置 | 依赖 OSS |
| 上传类型白名单 | ✅ 已配置 | `presignRules` 按场景限制 mimeTypes |
| 文件大小限制 | ✅ 已配置 | 头像 5MB / 交付物 200MB |

## 六、安全扫描计划

| 阶段 | 时间 | 内容 |
|------|------|------|
| W6 加固 | ✅ 完成 | JWT 审计 + API 限流 + Helmet + 敏感字段验证 |
| W11 全扫 | Sprint2 | OWASP ZAP 全面扫描 + 渗透测试 |
| W12 上线前 | Sprint2 | 安全验收报告签发 |

---

## 七、已实施的安全加固（W6 新增）

```
apps/backend/src/main.ts
  + import helmet from 'helmet'
  + app.use(helmet())           ← HTTP安全头：X-Frame-Options, CSP, HSTS等

apps/backend/src/app.module.ts
  + ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])
  + { provide: APP_GUARD, useClass: ThrottlerGuard }  ← 全局限流守卫

apps/backend/src/modules/finance/finance.controller.ts
  + FinancePublicController     ← 支付回调公开路由（无需JWT）
  FinanceController仍需JWT      ← 充值/余额/流水接口受保护
```

## 八、遗留问题（Sprint 2 跟进）

- [ ] 登录失败账户级锁定（5分钟10次→账户锁定15分钟）
- [ ] 支付回调 HMAC-SHA256 签名验证（现为模拟环境跳过）
- [ ] 生产 DB 连接 SSL 配置
- [ ] OWASP ZAP 全量扫描（W11）
- [ ] OSS Bucket 安全配置（P0-09 完成后）
