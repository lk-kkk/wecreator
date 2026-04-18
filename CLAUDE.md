# WeCreator — 零工创作者管理平台

> **一句话描述**：连接企业与创意零工（摄影师/设计师/文案等）的撮合·协作·结算一体化 SaaS 平台。

---

## 1. 业务模型

```
企业注册 → 充值 → 发布任务(包含角色+预算) → 锁定108%资金
  → 平台撮合/定向邀约 → 零工接单(签协议) → 执行+交付物
  → 企业验收 → 合规结算(完税) → 零工提现
```

**两种任务模式**：
- **任务包模式**：按交付物结算，验收通过后一次性付款
- **人天模式**：按工作日计费，每日打卡+GPS围栏+截图，按周结算

---

## 2. 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 后端框架 | NestJS | 11.x |
| ORM | Prisma | 6.x |
| 主数据库 | MySQL | 8.0 |
| 缓存/分布式锁 | Redis | 7.x |
| 消息存储 | MongoDB | 6.0 |
| 企业PC端 | Vue 3 + Vite + Ant Design Vue 4 | |
| 零工小程序 | Taro 4 + React 19 | |
| 共享类型 | @wecreator/shared (TypeScript) | |
| 容器化 | Docker Compose | |

---

## 3. Monorepo 结构

```
wecreator/
├── apps/
│   ├── backend/            # NestJS 后端 API（端口3000）
│   │   ├── src/
│   │   │   ├── modules/    # 12个业务模块
│   │   │   │   ├── auth/         # 企业登录+零工微信登录
│   │   │   │   ├── user/         # 用户管理+子账号
│   │   │   │   ├── task/         # 任务CRUD+状态机
│   │   │   │   ├── assignment/   # 分配+邀约+接单
│   │   │   │   ├── finance/      # 充值+锁定+对账
│   │   │   │   ├── wallet/       # 零工钱包+提现
│   │   │   │   ├── message/      # WebSocket IM
│   │   │   │   ├── notification/ # 系统通知+微信订阅消息
│   │   │   │   ├── file/         # OSS直传+文件管理
│   │   │   │   ├── contract/     # 合同PDF生成
│   │   │   │   ├── review/       # 双向评价
│   │   │   │   └── dispute/      # 争议仲裁
│   │   │   ├── prisma/     # PrismaModule（全局）
│   │   │   ├── redis/      # RedisModule（全局）
│   │   │   └── common/     # 拦截器/过滤器/守卫/管道
│   │   └── prisma/
│   │       └── schema.prisma  # 23张业务表 + 11个枚举
│   ├── pc-admin/           # Vue3 企业PC后台（端口5173）
│   └── worker-mp/          # Taro 零工小程序
├── packages/
│   └── shared/             # @wecreator/shared 共享类型
├── docker/
│   └── docker-compose.yml  # MySQL+Redis+MongoDB+Adminer
├── docs/
│   ├── task-checklist.md   # 开发任务清单（120项）
│   └── WeCreator_PRD_V3.1.md  # 产品需求文档
└── .agents/
    └── skills/             # 12个Agent角色配置
```

---

## 4. 开发环境

### 4.1 启动服务

```bash
# Docker三件套
pnpm docker:up

# 后端（端口3000）
pnpm dev:be

# PC端（端口5173，代理 /api → 3000）
pnpm dev:pc

# 小程序（输出 dist/weapp，导入微信开发者工具）
pnpm dev:mp

# 同时启动后端+PC
pnpm dev
```

### 4.2 数据库连接

| 服务 | 地址 | 用户 | 密码 |
|------|------|------|------|
| MySQL | localhost:3306 | wcadmin | wecreator@2026 |
| Redis | localhost:6379 | - | wecreator@2026 |
| MongoDB | localhost:27017 | wcadmin | wecreator@2026 |
| Adminer | localhost:8080 | | |

### 4.3 Prisma CLI

```bash
# 生成客户端（修改schema后）
cd apps/backend && pnpm dlx prisma generate

# 创建迁移（新增表/字段后）
cd apps/backend && pnpm dlx prisma migrate dev --name <描述>

# 查看数据库状态
cd apps/backend && pnpm dlx prisma studio
```

---

## 5. 14个 Agent 角色（V2 · 方案B）

> **V2 变更说明（2026-04-18）：** 基于全量 PRD V3.6.1 + V3.7（105 API · 41 表）负载分析，原 R2 过载（55 API），拆分为 R2 + R2-a + R2-b 三个角色。详见 `docs/Agent_Role_Analysis.md`。

| 角色 | Skill Slug | 职责 | 代码范围 | API 数 |
|------|-----------|------|---------|--------|
| R0 Orchestrator | `wc-orchestrator` | 任务编排·依赖追踪·里程碑验收·Sprint 3-5优先级仲裁 | docs/ + task-checklist | — |
| R1 Auth-Dev | `wc-auth-dev` | 认证：注册/登录/JWT/RBAC/子账号/运营后台维护 | modules/auth + modules/user + modules/admin + modules/platform | ~18 |
| R2 Task-Dev | `wc-task-dev` | 任务核心：发布/撮合/执行/验收/状态机/检查点/评论/问题上报/数据分析 | modules/task + modules/assignment + modules/review + modules/dispute + modules/checkin(打卡逻辑) | ~32 |
| R2-a Project-Dev | `wc-project-dev` | 项目管理：CRUD/看板/里程碑/阶段流转/三色预警 | modules/project | ~12 |
| R2-b AI-Dev | `wc-ai-dev` | AI系统：LLM配置/智能体管理/AI对话/6种Adapter/月度统计cron | modules/ai | ~11 |
| R3 Pay-Dev | `wc-pay-dev` | 支付：充值/锁定/结算/提现/对账/周结算 | modules/finance + modules/wallet + modules/checkin(周结算) | ~15 |
| R4 Msg-Dev | `wc-msg-dev` | 消息：WebSocket IM + 通知中心 + 微信订阅消息 + @提及通知 | modules/message + modules/notification | ~12 |
| R5 File-Dev | `wc-file-dev` | 文件：OSS直传/交付物/合同PDF/任务附件/里程碑附件 | modules/file + modules/contract | ~8 |
| R6 PC-Dev | `wc-pc-dev` | 全部PC端：企业后台(26+页) + 运营后台(12页) | apps/pc-admin/ + apps/platform-admin/ | ~38页 |
| R7 MP-Dev | `wc-mp-dev` | 零工小程序：Taro 4Tab+7分包 | apps/worker-mp/ | ~26页 |
| R8 QA-Lead | `wc-qa-lead` | 测试：E2E+资金流+压测（105 API全覆盖） | test/ + k6-scripts/ | — |
| R9 Security-Ops | `wc-security-ops` | 安全：OWASP+加密审计+SSRF防护+XSS检查 | 全项目审计 | — |
| R10 Schema-Ops | `wc-schema-ops` | 数据库：Schema(35+表)/Migration/种子/索引(23+条) | prisma/ | — |
| R11 DevOps | `wc-devops` | 运维：Docker/CI-CD/监控/cron调度部署 | docker/ + .github/ | — |

**调用方式**：在会话中输入 `[skill:wc-auth-dev]` 激活对应角色。

---

## 6. API 规范

### 6.1 路由前缀
所有 API 路由前缀：`/api/v1/`

### 6.2 统一响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": 1713254400000
}
```
- `code = 0` 成功，非0为HTTP状态码

### 6.3 分页
```json
// 请求
{ "page": 1, "pageSize": 20 }

// 响应
{ "list": [], "total": 100, "page": 1, "pageSize": 20 }
```

### 6.4 认证
- Bearer Token：`Authorization: Bearer <access_token>`
- access_token 有效期 2h，refresh_token 有效期 7d

---

## 7. 关键业务规则

### 7.1 资金安全
- 企业余额：**乐观锁**（version字段，CAS更新）
- 零工钱包：**Redis分布式锁**（`wallet:lock:{workerId}`，TTL 10s）
- 充值幂等：idempotency_key 唯一索引
- 发布锁定：total_budget × 108%（含8%平台服务费）

### 7.2 任务状态机（7态）
```
draft → pending_review → published → in_progress → reviewing → completed → closed
                                                                    ↗
                                                        cancelled ←
```

### 7.3 结算公式
- **任务包**：role_budget × (1 - platform_rate) = 零工税后到手
- **人天模式**：daily_rate × confirmed_days × (1 - platform_rate)
- 平台费率：8%（PRD §3.2.3）

### 7.4 敏感字段加密
- 手机号(phone)、身份证号(id_card_encrypted)：AES-256-CBC
- 密钥从环境变量 `AES_KEY` + `AES_IV` 读取

---

## 8. 开发排期

> **最后更新**: 2026-04-18 | **详细进度**: `docs/Development_Progress_Report.md`

| 周次 | 主题 | 核心产出 | 状态 | Commit |
|------|------|---------|------|--------|
| W1 | 认证体系 | 企业注册/登录 + 零工微信登录 + JWT | ✅ | `79f4003`→`ba5e719` |
| W2 | 任务发布 | 5步向导 + 角色配置 + 状态机 | ✅ | `98b156a` |
| W3 | 撮合+资金 | 定向分配 + 充值 + 108%锁定 | ✅ | `c361e09` |
| W4 | 执行+IM | 交付物 + WebSocket + 合同 | ✅ | `33d8776` |
| W5 | 结算+通知 | 合规通道 + 提现 + 订阅消息 | ✅ | `2ef5355` |
| W6 | 联调+安全 | 全端联调 + E2E测试 + 安全加固 | ⏭️ 跳过 | — |
| W7-W9 | Sprint2功能 | 人天/评价/仲裁/推荐/Dashboard | ✅ | `1ccc651` |
| W10-W11 | 质量保障 | 压测 + OWASP + 回归 | ⏭️ 跳过 | — |
| W12 | 灰度上线 | 监控 + 分批放量 | ⏭️ 跳过 | — |
| **W13-W14** | **S3 项目+AI** | 项目管理 + LLM Adapter + AI对话 | ⏳ 待执行 | — |
| **W15-W16** | **S4 看板+通知** | 里程碑 + 检查点 + 评论 + 自动化 | ⏳ 待执行 | — |
| **W17-W18** | **S5 全量交付** | 数据分析 + 回归 + 安全 + 上线 | ⏳ 待执行 | — |

## 9. Git 约定

- 分支：`feat/<module>-<desc>`（如 `feat/auth-jwt-login`）
- Commit：`feat(auth): 企业注册API`
- PR 必须通过 CI（lint + test + build）

---

## 10. 注意事项

- **Prisma 6.x**：使用传统 `prisma-client-js` generator，`datasource.url` 在 schema.prisma 中配置（非 Prisma 7 的 adapter 模式）
- **连接字符串密码编码**：密码中的 `@` 符号必须编码为 `%40`（已在 .env 中处理）
- **pnpm dlx**：不使用全局 npm 安装，所有 CLI 工具用 `pnpm dlx`
- **macOS bash 3.x**：不支持 `${var^}`、`declare -A` 等 bash 4+ 语法
- **小程序主包**：≤ 2MB，使用分包策略
