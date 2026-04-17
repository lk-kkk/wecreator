# WeCreator 协同上下文

> 本文件供协同智能体快速理解角色间的**依赖关系**和**接口契约**。

---

## 1. 角色依赖图

```
R10 Schema-Ops（数据库基座）
  ↓ 提供 Prisma Schema + Migration
R1 Auth-Dev ←──────────────────────── 被所有后端角色依赖（JWT中间件）
  ↓ JwtModule + AuthGuard + @CurrentUser
R2 Task-Dev ──→ R3 Pay-Dev           事件：TASK_REVIEW_APPROVED → 触发结算
  ↓               ↓
R4 Msg-Dev ←── R3 Pay-Dev            事件：SETTLEMENT_COMPLETED → 通知零工
  ↓
R5 File-Dev                           OSS直传 + 合同PDF（被R2/R4引用）

R6 PC-Dev ──→ 消费 R1~R5 的 REST API
R7 MP-Dev ──→ 消费 R1~R5 的 REST API + WebSocket

R8 QA-Lead ──→ 测试所有 API
R9 Security-Ops ──→ 审计所有代码
R11 DevOps ──→ 部署所有服务
```

---

## 2. 18 条接口契约

### Schema 依赖（C01-C02）
| 编号 | 提供方 | 消费方 | 内容 |
|------|--------|--------|------|
| C01 | R10 | R1~R5 | Prisma Schema 23表 + PrismaService 全局注入 |
| C02 | R10 | R1~R5 | 15条核心索引 + 迁移脚本 |

### 认证中间件（C03-C04）
| 编号 | 提供方 | 消费方 | 内容 |
|------|--------|--------|------|
| C03 | R1 | R2~R5 | JwtAuthGuard：请求头 `Authorization: Bearer <token>` |
| C04 | R1 | R2~R5 | @CurrentUser 装饰器：注入 `{userId, companyId?, role}` |

### REST API 契约（C05-C09）
| 编号 | 提供方 | 消费方 | 路由 | 方法数 |
|------|--------|--------|------|--------|
| C05 | R1 | R6/R7 | `/api/v1/enterprise/*`, `/api/v1/worker/*` | 15 |
| C06 | R2 | R6/R7 | `/api/v1/tasks/*`, `/api/v1/assignments/*` | 25 |
| C07 | R3 | R6/R7 | `/api/v1/finance/*`, `/api/v1/wallet/*` | 15 |
| C08 | R4 | R6/R7 | `/api/v1/messages/*`, `/api/v1/notifications/*` | 10 |
| C09 | R5 | R6/R7 | `/api/v1/files/*`, `/api/v1/contracts/*` | 5 |

### 事件驱动（C10-C12）
| 编号 | 发布方 | 订阅方 | 事件名 | 触发条件 |
|------|--------|--------|--------|---------|
| C10 | R2 | R3 | `TASK_REVIEW_APPROVED` | 企业验收通过交付物 |
| C11 | R2 | R4 | `TASK_STATUS_CHANGED` | 任务状态转换 |
| C12 | R3 | R4 | `SETTLEMENT_COMPLETED` | 合规结算完成 |

### WebSocket（C13）
| 编号 | 提供方 | 消费方 | 协议 |
|------|--------|--------|------|
| C13 | R4 | R6/R7 | `ws://localhost:3000` + Redis Pub/Sub 广播 |

### 内部服务调用（C14-C15）
| 编号 | 提供方 | 消费方 | 方法 |
|------|--------|--------|------|
| C14 | R3 | R2 | `FinanceService.lockFund(companyId, amount)` |
| C15 | R5 | R2 | `FileService.generateContract(assignmentId)` |

### 测试/安全/CI（C16-C18）
| 编号 | 提供方 | 消费方 | 标准 |
|------|--------|--------|------|
| C16 | R8 | R1~R5 | 每个模块必须 ≥80% 单测覆盖率 |
| C17 | R9 | R1~R5 | OWASP Top10 + 敏感字段加密审计 |
| C18 | R11 | 全部 | CI流水线：lint → test → build → deploy |

---

## 3. 开发波次与角色激活

| 周次 | 主力角色 | 支援角色 | 里程碑 |
|------|---------|---------|--------|
| W1 | R1, R10, R6, R7 | R11 | 企业注册/登录 + 零工微信登录 |
| W2 | R2, R6, R7 | R1 | 任务发布向导 + 角色配置 |
| W3 | R2, R3, R6, R7 | R8 | 撮合分配 + 充值锁定 |
| W4 | R2, R4, R5, R6, R7 | | 执行验收 + IM + 合同 |
| W5 | R3, R4, R6, R7 | R2 | 结算 + 提现 + 通知 |
| W6 | R8, R9 | 全部 | 联调 + E2E + 安全加固 |
| W7-W9 | R2, R3, R6, R7 | R1 | Sprint2 功能扩展 |
| W10-W11 | R8, R9 | | 压测 + OWASP + 回归 |
| W12 | R11 | R8 | 灰度上线 |

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
