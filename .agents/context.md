# WeCreator 协同上下文（V2 · 14 Agent 方案B）

> 本文件供协同智能体快速理解角色间的**依赖关系**和**接口契约**。
> **V2 变更（2026-04-18）:** 基于全量 PRD V3.6.1 + V3.7 负载分析，R2 拆分为 R2/R2-a/R2-b，Agent 总数 12→14。详见 `docs/Agent_Role_Analysis.md`。

---

## 1. 角色依赖图

```
R10 Schema-Ops（数据库基座 · 35+ 表）
  ↓ 提供 Prisma Schema + Migration
R1 Auth-Dev ←──────────────────────── 被所有后端角色依赖（JWT中间件）
  ↓ JwtModule + AuthGuard + @CurrentUser
  │
  ├─→ R2 Task-Dev ──→ R3 Pay-Dev       事件：TASK_REVIEW_APPROVED → 触发结算
  │     │    ↓            ↓
  │     │  R2-a Project  R4 Msg-Dev ←── C19-C22 事件订阅
  │     │    ↓
  │     └→ R2-b AI-Dev
  │
  └─→ R5 File-Dev                      OSS直传 + 合同PDF + 附件（被R2/R2-a/R4引用）

R6 PC-Dev ──→ 消费 R1~R5 + R2-a + R2-b 的 REST API（企业后台 + 运营后台）
R7 MP-Dev ──→ 消费 R1~R5 的 REST API + WebSocket

R8 QA-Lead ──→ 测试所有 API（~105 个）
R9 Security-Ops ──→ 审计所有代码
R11 DevOps ──→ 部署所有服务 + cron 调度
```

---

## 2. 24 条接口契约

### Schema 依赖（C01-C02）
| 编号 | 提供方 | 消费方 | 内容 |
|------|--------|--------|------|
| C01 | R10 | R1~R5, R2-a, R2-b | Prisma Schema **35+ 表** + PrismaService 全局注入 |
| C02 | R10 | R1~R5, R2-a, R2-b | **23+ 条**核心索引 + 迁移脚本 |

### 认证中间件（C03-C04）
| 编号 | 提供方 | 消费方 | 内容 |
|------|--------|--------|------|
| C03 | R1 | R2~R5, R2-a, R2-b | JwtAuthGuard：请求头 `Authorization: Bearer <token>` |
| C04 | R1 | R2~R5, R2-a, R2-b | @CurrentUser 装饰器：注入 `{userId, companyId?, role, userType}` |

### REST API 契约（C05-C09b）
| 编号 | 提供方 | 消费方 | 路由 | 方法数 |
|------|--------|--------|------|--------|
| C05 | R1 | R6/R7 | `/api/v1/company/*`, `/api/v1/worker/*`(auth) | 18 |
| C06 | R2 | R6/R7 | `/api/v1/tasks/*`, `/api/v1/assignments/*`, `/api/v1/tasks/:id/checkpoints/*`, `/api/v1/tasks/:id/comments/*`, `/api/v1/tasks/:id/issues/*` | **32** |
| C06a | R2-a | R6 | `/api/v1/projects/*`, `/api/v1/projects/:id/milestones/*` | **12** |
| C06b | R2-b | R6 | `/api/v1/company/llm-config/*`, `/api/v1/company/agents/*`, `/api/v1/ai/*` | **11** |
| C07 | R3 | R6/R7 | `/api/v1/finance/*`, `/api/v1/wallet/*` | 15 |
| C08 | R4 | R6/R7 | `/api/v1/messages/*`, `/api/v1/notifications/*` | **12** |
| C09 | R5 | R6/R7 | `/api/v1/files/*`, `/api/v1/contracts/*`, `/api/v1/tasks/:id/attachments/*` | **8** |

### 事件驱动（C10-C12 原有 + C19-C22 新增）
| 编号 | 发布方 | 订阅方 | 事件名 | 触发条件 |
|------|--------|--------|--------|---------|
| C10 | R2 | R3 | `TASK_REVIEW_APPROVED` | 企业验收通过交付物 |
| C11 | R2 | R4 | `TASK_STATUS_CHANGED` | 任务状态转换（7态） |
| C12 | R3 | R4 | `SETTLEMENT_COMPLETED` | 合规结算完成 |
| **C19** | **R2** | **R4** | **`COMMENT_MENTION`** | **评论中@某人 → 推送通知** |
| **C20** | **R2** | **R4** | **`ISSUE_CREATED`** | **问题上报 → 推送企业通知** |
| **C21** | **R2-a** | **R4** | **`MILESTONE_DUE`** | **里程碑到期预警 → 推送通知** |
| **C22** | **R2** | **R4** | **`CHECKPOINT_SUBMITTED`** | **检查点提交 → 推送企业审核通知** |

### WebSocket（C13）
| 编号 | 提供方 | 消费方 | 协议 |
|------|--------|--------|------|
| C13 | R4 | R6/R7 | `ws://localhost:3000` + Redis Pub/Sub 广播 |

### 内部服务调用（C14-C15 原有 + C23-C24 新增）
| 编号 | 提供方 | 消费方 | 方法 |
|------|--------|--------|------|
| C14 | R3 | R2 | `FinanceService.lockFund(companyId, amount)` |
| C15 | R5 | R2 | `FileService.generateContract(assignmentId)` |
| **C23** | **R2-b** | **R2** | **`AiService.generateTaskSuggestion()` → R2 处理一键填充** |
| **C24** | **R2-a** | **R2** | **`ProjectService.getProjectById()` → 任务关联项目查询** |

### 测试/安全/CI（C16-C18）
| 编号 | 提供方 | 消费方 | 标准 |
|------|--------|--------|------|
| C16 | R8 | R1~R5, R2-a, R2-b | 每个模块必须 ≥80% 单测覆盖率 |
| C17 | R9 | R1~R5, R2-a, R2-b | OWASP Top10 + 敏感字段加密 + SSRF防护 + XSS检查 |
| C18 | R11 | 全部 | CI流水线：lint → test → build → deploy |

---

## 3. 开发波次与角色激活（5 Sprint · 18 周）

| 周次 | 主力角色 | 支援角色 | 里程碑 |
|------|---------|---------|--------|
| W1 | R1, R10, R6, R7 | R11 | 企业注册/登录 + 零工微信登录 |
| W2 | R2, R6, R7 | R1, R5 | 任务发布向导 + 角色配置 |
| W3 | R2, R3, R6, R7 | R8 | 撮合分配 + 充值锁定 |
| W4 | R2, R4, R5, R6, R7 | | 执行验收 + IM + 合同 |
| W5 | R3, R4, R6, R7 | R2 | 结算 + 提现 + 通知 |
| W6 | R8, R9 | 全部 | **Sprint 1 交付** · 联调 + E2E + 安全 |
| W7 | R2, R3, R6, R7 | R1 | 人天模式 + 评价 |
| W8 | R2, R4, R6, R7 | | 推荐 + 争议 + IM增强 |
| W9 | R1, R2, R6, R7 | | 子账号 + Dashboard + 发票 |
| W10 | R6, R7, R8 | | 联调 + 响应式 + 分包优化 |
| W11 | R8, R9 | R2, R3 | 压测 + OWASP + 回归 |
| W12 | R11 | R8 | **Sprint 2 交付** · 灰度上线 |
| **W13** | **R2-a, R2-b, R5, R6** | R10 | 项目CRUD + AI配置 + 附件 |
| **W14** | **R2-b, R6** | R2, R8 | LLM Adapter + AI对话 + 联调 |
| **W15** | **R2, R2-a, R4, R6** | R10 | 项目看板 + 里程碑 + 检查点 + 通知中心 |
| **W16** | **R2, R6, R7** | R8, R9 | 评论 + 问题上报 + 日报 + 自动化 |
| **W17** | **R2, R6, R7** | R2-a | 数据分析增强 + 零工端优化 |
| **W18** | **R8, R9, R11** | 全部 | **全量交付** · 回归 + 安全 + 上线 |

---

## 4. 统一响应格式

所有 API 必须返回：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "timestamp": 1713254400000
}
```

错误时 `code` = HTTP状态码，`data` = `null`。

## 5. 分页约定

请求：`?page=1&pageSize=20`

响应：
```json
{
  "list": [],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```
