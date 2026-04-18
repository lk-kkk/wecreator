# WeCreator 全量功能开发 — Agent 执行顺序

> **基于:** PRD V3.6.1 + V3.7（项目及任务管理深化）· 全量 19 章 · ~105 个 API · ~41 张表
> **覆盖:** 5 个 Sprint · 18 周 · **14 个 Agent 角色（方案 B）**
> **编制日期:** 2026-04-18 · **V2 更新:** 采用 14 Agent 方案 B，R2 拆分为 R2/R2-a/R2-b
> **目的:** 为每个 Agent 角色明确执行顺序、输入输出、依赖关系和验收标准

---

## 0. 当前代码基线（已完成）

在制定执行计划之前，以下内容已在代码库中就位：

### 0.1 基础设施（✅ 已完成）
- [x] Monorepo 骨架：pnpm workspace + 4 个 apps + 1 个 shared package
- [x] Docker Compose：MySQL 8.0 + Redis 7 + MongoDB 6.0 + Adminer
- [x] NestJS 11 应用框架：app.module + 全局中间件（限流/JWT/异常过滤器）
- [x] Prisma 6 ORM：schema.prisma（27 model）+ 4 次 migration
- [x] Vue 3 + Ant Design Vue 4 PC 管理端：13 页面 + 6 组件 + Design System V1.1 全覆盖
- [x] Taro 4 + React 19 零工小程序：8 主页面 + 14 子包页面
- [x] Vue 3 运营后台：12 页面（完整 CRUD）
- [x] 本地 Gitea 仓库：7 次提交（最新 `82e88c7`）

### 0.2 已实现的后端模块（✅ 14 个 Module）

| 模块 | 文件数 | 覆盖 PRD 章节 | 状态 |
|------|--------|--------------|------|
| auth | 8 | §4.1 企业注册/登录/子账号 + §5.1 零工登录 | ✅ 框架完成 |
| task | 11 | §4.2 任务发布/列表/详情/状态机/推荐 + Dashboard | ✅ 框架完成 |
| assignment | 3 | §6.1 撮合分配 | ✅ 框架完成 |
| finance | 6 | §4.6 充值/结算/发票 | ✅ 框架完成 |
| wallet | 3 | §5.5 零工钱包/提现 | ✅ 框架完成 |
| review | 3 | §6.3 评价体系 | ✅ 框架完成 |
| message | 4 | §6.5 IM 消息(WebSocket) | ✅ 框架完成 |
| notification | 3 | §6.6 通知推送 | ✅ 框架完成 |
| file | 4 | §5 OSS 直传 | ✅ 框架完成 |
| contract | 3 | §6.2 电子合同 | ✅ 框架完成 |
| checkin | 5 | §5.3.2 人天模式打卡 | ✅ 框架完成 |
| dispute | 3 | §6.4 争议仲裁 | ✅ 框架完成 |
| admin | 2 | §4.1.3 子账号管理 | ✅ 框架完成 |
| platform | 4 | §18 运营后台(34 API) | ✅ 框架完成 |

### 0.3 尚未实现的模块/功能

| 功能域 | PRD 章节 | 需新建模块 | 涉及表 |
|--------|---------|-----------|--------|
| 项目管理 | §4.9 + V3.7 §2 | project module | projects, milestones, milestone_attachments |
| AI 智能体 | §4.8 + §19 | ai module | llm_configs, ai_agents, ai_chat_sessions |
| 任务检查点 | V3.7 §3.2 | checkpoint (或扩展 task) | task_checkpoints |
| 任务评论 | V3.7 §4.1 | comment (或扩展 task) | task_comments |
| 问题上报 | V3.7 §4.2 | issue (或扩展 task) | task_issues |
| 企业端通知中心 | V3.7 §4.3 | 扩展 notification | notifications |
| 任务附件 | V3.6 §4.2.1 | 扩展 file | task_attachments |
| 数据分析增强 | V3.7 §5 | 扩展 task/dashboard | — |

---

## 1. Agent 角色速查（14 Agent · 方案 B）

> **V2 变更:** R2 拆分为 R2 + R2-a + R2-b，总数 12→14。详见 `docs/Agent_Role_Analysis.md`。

| Agent | 代号 | 职责范围 | 核心输出 |
|-------|------|---------|----------|
| R0 | wc-orchestrator | 编排协调 · 任务分发 · 阻塞仲裁 · Sprint 3-5 优先级仲裁 | 周计划 · 进度跟踪 |
| R1 | wc-auth-dev | 认证（注册/登录/JWT/RBAC/子账号）+ 运营后台维护 | ~18 个 API |
| **R2** | **wc-task-dev** | **任务核心（发布/撮合/执行/验收/状态机/检查点/评论/问题/分析）** | **~32 个 API** |
| **R2-a** | **wc-project-dev** | **项目管理（CRUD/看板/里程碑/阶段流转/三色预警）** | **~12 个 API** |
| **R2-b** | **wc-ai-dev** | **AI 系统（LLM 配置/智能体/对话/6 Adapter/月度 cron）** | **~11 个 API** |
| R3 | wc-pay-dev | 支付结算（充值/锁定/结算/提现/发票/周结算） | ~15 个 API |
| R4 | wc-msg-dev | 消息系统（IM/通知中心/WebSocket/订阅消息/@提及） | ~12 个 API |
| R5 | wc-file-dev | 文件服务（OSS 直传/合同 PDF/任务附件/里程碑附件） | ~8 个 API |
| R6 | wc-pc-dev | 全部 PC 端（企业 26+ 页 + 运营 12 页） | ~38 页面 |
| R7 | wc-mp-dev | 零工小程序（Taro 4 + React 19） | ~26 页面 |
| R8 | wc-qa-lead | 测试（E2E/接口自动化/压测 · 105 API 全覆盖） | 测试用例 + 报告 |
| R9 | wc-security-ops | 安全（OWASP/加密审计/SSRF 防护/XSS 检查） | 安全报告 |
| R10 | wc-schema-ops | 数据架构（Prisma Schema 35+ 表/迁移/种子/23+ 索引） | Schema + Migration |
| R11 | wc-devops | 运维部署（Docker/CI/监控/灰度/cron 调度） | Dockerfile + CI |

## 2. 全局依赖关系图

```
                    ┌──────────────┐
                    │   R0 编排     │
                    │ Orchestrator │
                    └──────┬───────┘
                           │ 分发任务 · 协调阻塞
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌─────────┐  ┌──────────┐  ┌─────────┐
       │ R10     │  │ R11      │  │ R9      │
       │ Schema  │  │ DevOps   │  │Security │
       │ 35+表   │  │ cron部署 │  │SSRF+XSS │
       └────┬────┘  └────┬─────┘  └────┬────┘
            │             │             │
            │ Prisma      │ Docker      │ 审计
            │ Schema      │ + CI        │
            ▼             ▼             ▼
       ┌─────────────────────────────────────────────┐
       │              后端 Service 层（7 Agent）       │
       │                                              │
       │  R1(Auth) ─→ R2(Task,32) ──→ R3(Pay)       │
       │     ↕            ↕    ↕          ↕           │
       │  R4(Msg) ←C19~22 │   R5(File)              │
       │                   │                          │
       │          ┌────────┴────────┐                 │
       │          ▼                 ▼                 │
       │    R2-a(Project,12)  R2-b(AI,11)            │
       │    看板·里程碑·预警   Adapter·对话·cron       │
       └──────────────────┬──────────────────────────┘
                          │ REST API + WebSocket
              ┌───────────┼───────────┐
              ▼           ▼           ▼
          ┌──────┐    ┌──────┐   ┌──────────┐
          │ R6   │    │ R7   │   │ R6(Admin)│
          │ 26+页│    │ 26页 │   │ 运营12页  │
          └──────┘    └──────┘   └──────────┘
                          │
                          ▼
                    ┌──────────┐
                    │ R8 QA    │
                    │ 105 API  │
                    └──────────┘
```

**硬性依赖链（阻塞型）:**
1. **R10 → R1~R5, R2-a, R2-b**: 没有 Schema 迁移,后端无法编译
2. **R1 → R2~R5, R2-a, R2-b**: 没有 JWT Guard,后端无法鉴权
3. **全部后端 → R6/R7**: 没有 API,前端只能 Mock
4. **R2 → R3**: 任务验收通过才能触发结算（C10 事件）
5. **R2/R2-a → R4**: 任务状态变更/评论@/问题上报/里程碑到期 → 触发通知（C11,C19~C22 事件）
6. **R2-b → R2**: AI 生成任务建议 → R2 处理一键填充（C23 内部调用）
7. **R2-a → R2**: 项目关联查询（C24 内部调用）

**柔性依赖（可并行，Mock 先行）:**
- R6/R7 可在 API 完成前用 Mock 数据开发 UI
- R4 通知可后接入,不阻塞核心流程
- R2-a/R2-b 可与 R2 并行开发（共享 Schema 但代码独立）
- R8 可在 API 稳定后补写测试

---

## 3. Sprint 1（W1-W6）· 核心闭环

> **目标:** 企业注册→发布任务→定向分配→零工接单→执行→验收→结算→到账 全流程跑通

### W1 · 地基搭建 + 认证闭环

| 执行序号 | Agent | 任务 | 输入 | 输出 | 阻塞依赖 |
|---------|-------|------|------|------|---------|
| **1.1** | R10 | Prisma Schema V1 — 建表（前 12 张核心表：companies/company_users/workers/tasks/task_roles/role_assignments/deliverables/deliverable_files/wallets/transactions/conversations/platform_roles） | PRD §10.2 | schema.prisma + `npx prisma migrate dev` | 无（起点） |
| **1.2** | R11 | Docker Compose 环境确认 + `.env` 模板 + CI Lint 管道 | architecture.md | docker-compose.yml + .env.example + CI config | 无（并行） |
| **1.3** | R1 | 企业注册/登录 API（POST register/login/refresh-token） | C01(Schema) | auth.controller + auth.service + JWT策略 | R10(1.1) |
| **1.4** | R1 | 子账号 CRUD API + 角色鉴权 Guard | C01 | admin.controller + roles.guard | R10(1.1) |
| **1.5** | R1 | 零工微信登录 API（code2session + JWT） | C01 | worker auth endpoints | R10(1.1) |
| **1.6** | R6 | 登录/注册页 UI（LoginPage + RegisterPage） | Design System V1.1 | 2 Vue 页面 | 无（Mock API） |
| **1.7** | R7 | 小程序框架 + 登录流程（wx.login → JWT） | Design System V1.1 | index + auth subpkg | 无（Mock API） |
| **1.8** | R9 | 密码哈希方案审计 + JWT Secret 策略审计 | R1 代码 | 安全审计报告 #1 | R1(1.3) |

**W1 里程碑:** ✅ 企业可注册/登录获取 JWT；零工可微信登录获取 JWT

---

### W2 · 任务发布 + 角色配置

| 执行序号 | Agent | 任务 | 输入 | 输出 | 阻塞依赖 |
|---------|-------|------|------|------|---------|
| **2.1** | R10 | Schema V2 — 补充表（skill_tags/company_custom_roles/portfolios/worker_roles） | PRD §10.2 | migration #2 | 1.1 |
| **2.2** | R2 | 任务发布 API（POST /tasks — 5步向导数据模型,含草稿自动保存） | C01+C03 | task.controller + task.service | R1(1.3), R10(2.1) |
| **2.3** | R2 | 任务列表 API（GET /tasks — 分页+多维筛选+排序） | C01 | task.controller(list) | R10(2.1) |
| **2.4** | R2 | 任务详情 API（GET /tasks/:id — 含角色/交付物/进度） | C01 | task.controller(detail) | R10(2.1) |
| **2.5** | R2 | 任务状态机（task-status.machine.ts — 7态流转规则） | PRD §4.2 | 状态机模块 | 无 |
| **2.6** | R2 | 平台角色库 + 技能标签 API（GET /common/platform-roles + skill-tags） | C01 | common endpoints | R10(2.1) |
| **2.7** | R6 | TaskCreatePage 5步向导 UI（Step1~5 完整表单） | PRD §4.2.1 | TaskCreatePage.vue | 无（Mock） |
| **2.8** | R7 | 零工信息完善 + 实名认证页 | PRD §5.1 | profile-edit + verify | 无（Mock） |
| **2.9** | R5 | OSS 直传预签名 API（POST /common/upload/presign） | PRD §11.3 | file.controller | R1(1.3) |

**W2 里程碑:** ✅ 企业可发布任务（含5步向导全部字段）；草稿可自动保存

---

### W3 · 撮合分配 + 零工接单 + 充值

| 执行序号 | Agent | 任务 | 输入 | 输出 | 阻塞依赖 |
|---------|-------|------|------|------|---------|
| **3.1** | R10 | Schema V3 — 补充表（company_worker_pool/task_applications/progress_updates/daily_checkins） | PRD §10.2-10.3 | migration #3 | 2.1 |
| **3.2** | R2 | 定向分配 API（POST /tasks/:id/roles/:roleId/assign — 含多人岗位 slot 分配） | C01+C14 | assignment.service | R10(3.1), R1 |
| **3.3** | R2 | 零工接单/婉拒 API（POST /worker/tasks/:id/accept + reject） | C01 | worker task endpoints | R10(3.1) |
| **3.4** | R2 | 服务广场 API（GET /marketplace/tasks — 零工库过滤 V3.4） | PRD §5.6 | marketplace.controller | R10(3.1) |
| **3.5** | R2 | 零工申请 + 企业审批 API（V3.4 申请管理 3 API） | PRD §5.6.5 | application endpoints | R10(3.1) |
| **3.6** | R3 | 企业充值 API（POST /finance/recharge — 微信扫码） | C01 | finance.controller | R10(3.1), R1 |
| **3.7** | R3 | 资金锁定 API（lockFund — 总预算×108%） | PRD §7.7 | finance.service(lock) | R10(3.1) |
| **3.8** | R6 | WorkerPoolPage（零工库 + 批量导入 + 定向分配） | PRD §4.4 | WorkerPoolPage.vue | 无（Mock） |
| **3.9** | R6 | RechargePage（微信扫码充值页） | PRD §4.6.2 | RechargePage.vue | 无（Mock） |
| **3.10** | R7 | 任务列表 + 接单流程（Tab1 首页 + 任务详情 + 接受/婉拒） | PRD §5.2 | home + task detail | 无（Mock） |
| **3.11** | R7 | 服务广场（Tab2 — 卡片列表 + 筛选 + 申请投递） | PRD §5.6 | marketplace pages | 无（Mock） |

**W3 里程碑:** ✅ 企业可充值并锁定资金；零工可通过定向邀约或服务广场申请接单

---

### W4 · 执行验收 + IM + 合同

| 执行序号 | Agent | 任务 | 输入 | 输出 | 阻塞依赖 |
|---------|-------|------|------|------|---------|
| **4.1** | R2 | 进度更新 API（POST /worker/tasks/:id/progress） | C01 | progress endpoints | R10, R1 |
| **4.2** | R2 | 交付物上传 API（POST /worker/tasks/:id/deliverables） | C01+C09 | deliverable endpoints | R5(2.9) |
| **4.3** | R2 | 验收 API（POST /tasks/:id/roles/:roleId/review — 通过/退回,最多2次） | C01+C10 | review endpoint + 事件发布 | R10 |
| **4.4** | R5 | 电子合同生成（generateContract — PDF 模板渲染） | C15 | contract.service | R10 |
| **4.5** | R4 | IM 消息 — WebSocket Gateway + 文字消息收发 | C13+MongoDB | message.gateway + message.service | R10, R1 |
| **4.6** | R4 | 任务状态变更通知（订阅 C11 事件 → 推送通知） | C11 | notification.service(task) | R2(4.3) |
| **4.7** | R6 | TaskDetailPage 三栏布局（基本信息 + 角色进度 + IM 沟通） | PRD §4.2.3 | TaskDetailPage.vue | 无（Mock） |
| **4.8** | R6 | DeliverableReview 组件（验收通过/退回） | PRD §4.2.4 | DeliverableReview.vue | 无（Mock） |
| **4.9** | R6 | ImChatPanel 组件（WebSocket 实时消息） | PRD §6.5 | ImChatPanel.vue | R4(4.5) |
| **4.10** | R7 | 任务执行页（进度更新 + 交付物上传 + 提交验收） | PRD §5.3.1 | task/execute + review | 无（Mock） |
| **4.11** | R7 | 消息 Tab3（会话列表 + 聊天界面 — wx.connectSocket） | PRD §6.5 | message pages | R4(4.5) |

**W4 里程碑:** ✅ 零工可更新进度/上传交付物/提交验收；企业可验收通过/退回；双方可IM通信

---

### W5 · 结算 + 提现 + 评价

| 执行序号 | Agent | 任务 | 输入 | 输出 | 阻塞依赖 |
|---------|-------|------|------|------|---------|
| **5.1** | R10 | Schema V4 — 补充表（reviews/contracts/invoices/audit_logs/login_logs/weekly_settlements） | PRD §10.2-10.3 | migration #4 | 3.1 |
| **5.2** | R3 | 结算 API（验收通过→合规通道→T+1到账） | C10(订阅验收事件) | settlement.service | R2(4.3), R10(5.1) |
| **5.3** | R3 | 零工提现 API（POST /worker/wallet/withdraw — 微信零钱） | C01 | wallet.service(withdraw) | R10(5.1) |
| **5.4** | R3 | 发票申请 API（企业端） | C01 | invoice.service | R10(5.1) |
| **5.5** | R2 | 评价 API（POST /reviews — 企业对零工,简版单维度） | C01 | review.controller | R10(5.1) |
| **5.6** | R4 | 结算完成通知（订阅 C12 事件 → 推送零工） | C12 | notification.service(pay) | R3(5.2) |
| **5.7** | R4 | 微信订阅消息推送（7个模板 — §6.6） | PRD §6.6 | wechat-sub-msg.service | R10 |
| **5.8** | R6 | FinancePage（账户余额 + 结算流水 + 导出 Excel） | PRD §4.6 | FinancePage.vue | 无（Mock） |
| **5.9** | R6 | InvoicePage（发票申请列表） | PRD §4.6.3 | InvoicePage.vue | 无（Mock） |
| **5.10** | R7 | 钱包页（收益总览 + 提现 + 流水明细 + 合同查看） | PRD §5.5 | wallet subpkg | 无（Mock） |

**W5 里程碑:** ✅ 验收通过→合规结算→零工微信零钱到账 全流程跑通

---

### W6 · Sprint 1 联调 + 集成测试 + 安全加固

| 执行序号 | Agent | 任务 | 输入 | 输出 | 阻塞依赖 |
|---------|-------|------|------|------|---------|
| **6.1** | R0 | Sprint 1 联调计划：10 个端到端场景 | 所有 API | 联调测试计划 | W1~W5 全部 |
| **6.2** | R6+R7 | 前后端联调（替换所有 Mock → 真实 API） | R1~R5 API | 联调通过 | W1~W5 |
| **6.3** | R8 | E2E 测试用例编写 + 执行（10 条核心链路） | 联调环境 | 测试报告 #1 | 6.2 |
| **6.4** | R8 | 接口自动化测试（覆盖企业端12 + 零工端24 + 通用4 = 40 API） | API 文档 | 自动化脚本 + 报告 | 6.2 |
| **6.5** | R9 | 安全扫描（OWASP Top10 + 敏感字段加密审计 + SQL注入检查） | 全部代码 | 安全报告 #2 | 6.2 |
| **6.6** | R9 | 资金并发安全验证（乐观锁 + Redis 分布式锁） | PRD §7.7 | 并发测试报告 | R3 |
| **6.7** | R11 | CI 管道完善（lint → test → build → staging deploy） | 所有代码 | CI Pipeline | 6.2 |
| **6.8** | R2+R3 | Bug Fix（来自 6.3~6.6 的问题修复） | 测试报告 | Fix commits | 6.3~6.6 |

**Sprint 1 交付标准:**
- ✅ 企业注册→充值→发布任务→定向分配 全流程跑通
- ✅ 零工注册→实名→接单→执行→提交验收 全流程跑通
- ✅ 企业验收→结算→零工到账（合规通道）全流程跑通
- ✅ 10 个 E2E 测试用例全部通过
- ✅ 安全扫描无高危漏洞

---

## 4. Sprint 2（W7-W12）· 完善体验

### W7 · 人天模式 + 完整评价

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **7.1** | R2 | 人天模式任务发布逻辑（task.type=daily_rate 分支） | Sprint 1 |
| **7.2** | R2 | 人天模式打卡 API（POST /worker/tasks/:id/checkin — GPS+截图+日志） | R10 |
| **7.3** | R2 | 打卡记录查询 + 工时汇总 API | 7.2 |
| **7.4** | R3 | 人天模式结算规则（周结算 — §5.3.3） | 7.2 |
| **7.5** | R2 | 完整评价体系（多维度 + 零工评企业 + 互评规则 — §6.3） | Sprint 1 |
| **7.6** | R6 | DailyTaskDetail 页面（人天模式详情 + 打卡列表） | 无（Mock） |
| **7.7** | R6 | ReviewDialog 组件（多维度评价弹窗） | 无（Mock） |
| **7.8** | R7 | 打卡页 + 工作日志（subpkg/task/checkin） | 无（Mock） |
| **7.9** | R7 | 零工评企业页 + 评价列表 | 无（Mock） |

**W7 里程碑:** ✅ 人天模式全流程（发布→打卡→周结算）+ 双向多维评价

---

### W8 · 推荐算法 + 争议仲裁 + IM 增强

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **8.1** | R2 | 推荐引擎（评分+匹配算法 — §6.1.2） | Sprint 1 |
| **8.2** | R2 | 争议仲裁 API（POST /disputes + 状态流转 — §6.4） | Sprint 1 |
| **8.3** | R4 | IM 图片/文件消息支持 | W4 IM 基础 |
| **8.4** | R6 | WorkerRecommend 组件（推荐列表 + 雷达图） | 无（Mock） |
| **8.5** | R6 | DisputePage（争议管理列表 + 详情） | 无（Mock） |
| **8.6** | R6 | IM 增强（图片预览 + 文件下载） | R4(8.3) |
| **8.7** | R7 | 推荐列表页（服务广场推荐 Tab） | 无（Mock） |
| **8.8** | R7 | 争议入口（任务详情→申请仲裁） | 无（Mock） |

**W8 里程碑:** ✅ 平台推荐可用；争议仲裁全流程；IM 支持图片/文件

---

### W9 · 子账号管理 + Dashboard + 发票 + 模板

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **9.1** | R1 | 子账号完整 CRUD + 权限矩阵实现（4角色×12权限点） | Sprint 1| **9.2** | R2 | 任务模板 API（保存/复用历史任务为模板） | Sprint 1 |
| **9.3** | R2 | Dashboard 数据聚合 API（6指标 + 3图表 — §4.7） | Sprint 1 |
| **9.4** | R3 | 发票完整 API（申请/列表/状态 — §4.6.3） | Sprint 1 |
| **9.5** | R6 | SubaccountPage（子账号管理 + 权限配置） | 无（Mock） |
| **9.6** | R6 | DashboardPage 完善（ECharts 图表 + 指标卡） | 无（Mock） |
| **9.7** | R7 | 服务名片生成 + 分享海报 | 无（Mock） |
| **9.8** | R7 | 优质零工体系（等级晋升展示 + 信用分体系） | 无（Mock） |
| **9.9** | R7 | 我的页(Tab4) — 信用分面板 + 作品集 + 设置 | 无（Mock） |

**W9 里程碑:** ✅ 子账号权限矩阵完整；Dashboard 数据可视化；零工端"我的"完善

---

### W10 · Sprint 2 联调

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **10.1** | R6+R7 | W7-W9 新功能前后端联调 | W7~W9 |
| **10.2** | R6 | 响应式适配（1024/1280/1440/1920 四断点） | 10.1 |
| **10.3** | R7 | 小程序分包优化（主包 ≤ 2MB,各子包 ≤ 800KB） | 10.1 |
| **10.4** | R8 | Sprint 2 新增功能测试（人天模式/评价/争议/推荐/模板） | 10.1 |

---

### W11 · 回归测试 + 安全加固

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **11.1** | R8 | 全量回归测试（Sprint 1+2 合计 ~70 API） | W10 |
| **11.2** | R8 | 压测（100 QPS 目标 — §7.1） | W10 |
| **11.3** | R9 | 安全扫描复查 + 税务合规审计（§7.6） | W10 |
| **11.4** | R9 | 小程序安全审计（敏感信息过滤/手机号脱敏/微信号检测） | W10 |
| **11.5** | R2+R3 | 性能调优 + Bug Fix | 11.1~11.3 |

---

### W12 · 灰度发布 + 监控

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **12.1** | R11 | 生产环境部署（Kubernetes/Docker + Nginx 反代） | W11 |
| **12.2** | R11 | 灰度发布策略执行（§13.2 — 5%→20%→50%→100%） | 12.1 |
| **12.3** | R11 | 监控部署（APM + 错误追踪 + 慢查询告警） | 12.1 |
| **12.4** | R8 | 线上验证（灰度环境端到端验证） | 12.2 |
| **12.5** | R0 | Sprint 1+2 交付验收总结 | 12.4 |

**Sprint 2 交付标准:**
- ✅ 任务包 + 人天两种模式全流程跑通
- ✅ 评价 + 争议仲裁流程跑通
- ✅ 100 QPS 压测通过
- ✅ 安全扫描无高危漏洞
- ✅ 灰度发布启动

---

## 5. Sprint 3（W13-W14）· AI 智能体 + 项目管理基础 + 附件

> **PRD 范围:** V3.6 §4.8 + §4.9 + §19 + 附件增强

### W13 · 项目管理 + 附件 + AI 配置

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **13.1** | R10 | Schema V5 — 新增表（projects/llm_configs/ai_agents/ai_chat_sessions/task_attachments） | PRD §10.4 | Sprint 2 |
| **13.2** | **R2-a** | 项目管理 CRUD API（4个 — §4.9: list/create/update/status） | R10(13.1) |
| **13.3** | R5 | 任务附件 API（POST presign + POST metadata + DELETE — V3.6 §4.2.1） | R10(13.1) |
| **13.4** | R1 | AI 模块鉴权（super_admin only guard for /settings/*） | Sprint 1 |
| **13.5** | **R2-b** | LLM 配置 API（GET/PUT /company/llm-config + POST test — §4.8.1） | R10(13.1) |
| **13.6** | **R2-b** | 智能体管理 API（GET/POST/PUT /company/agents — §4.8.2） | R10(13.1) |
| **13.7** | R6 | 项目列表/详情页（ProjectListPage + ProjectDetailPage） | 无（Mock） |
| **13.8** | R6 | 大模型配置页（LlmConfigPage — Provider/Key/参数表单） | 无（Mock） |
| **13.9** | R6 | 智能体管理页（AgentListPage — CRUD + 预览 + 启停） | 无（Mock） |
| **13.10** | R6 | TaskCreatePage Step2 附件上传增强（拖拽+批量,最多10个/50MB） | R5(13.3) |

> **V2 变更:** W13 中项目管理由 R2-a(wc-project-dev)负责，AI/LLM由 R2-b(wc-ai-dev)负责。R2(wc-task-dev)仅负责附件系统与任务核心联调。

---

### W14 · LLM Adapter + AI 对话 + 联调

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **14.1** | **R2-b** | LLM Adapter 架构（Strategy Pattern — 6 个适配器: OpenAI/Claude/Azure/Qwen/Compatible/CustomHTTP — §19.2） | 13.5 |
| **14.2** | **R2-b** | AI 对话 API（POST /ai/chat + GET /ai/sessions — §19.3 协议） | 14.1, R10(13.1) |
| **14.3** | **R2-b** | AI 对话存储（MySQL ai_chat_sessions + MongoDB ai_chat_messages） | R10(13.1) |
| **14.4** | **R2-b** | 月度统计 cron（每月1日归零 call_count/token_count — V3.6.1 §19.5） | 14.2 |
| **14.5** | R6 | AI 任务顾问 Drawer（560px 右侧抽屉 — 对话界面 + 一键填充 — §V3.6 AI 顾问） | R2(14.2) |
| **14.6** | R6+R7 | Sprint 3 前后端联调 | 13.1~14.5 |
| **14.7** | R8 | Sprint 3 功能测试（项目CRUD + AI对话 + 附件上传） | 14.6 |
| **14.8** | R9 | AI 安全审计（API Key 加密存储 + SSRF 防护 + Rate Limit 验证） | 14.2 |

**Sprint 3 交付标准:**
- ✅ super_admin 可配置 LLM Provider 并测试连接
- ✅ 可创建智能体并在发布任务时使用 AI 顾问
- ✅ AI 对话可生成结构化任务单并一键填充表单
- ✅ 任务发布可上传附件（最多 10 个/50MB）
- ✅ 项目清单 CRUD 可用,任务可关联项目

---

## 6. Sprint 4（W15-W16）· 项目及任务管理深化（V3.7 P0+P1）

> **PRD 范围:** V3.7 全部 P0 + P1 功能

### W15 · 项目看板 + 里程碑 + 任务增强 + 检查点

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **15.1** | R10 | Schema V6 — 新增表（milestones/milestone_attachments/task_checkpoints/task_comments/task_issues/notifications 重构）+ tasks 表新增字段（task_no/priority/acceptance_criteria/risk_level/acceptance_status）+ projects 表新增字段（expected_delivery_date/phase/risk_level）+ projects.status 枚举 5 态 + progress_updates 扩展 | V3.7 §6 | Sprint 3 |
| **15.2** | R2 | 任务编号自动生成（Redis INCR `task:seq:YYYYMMDD`）+ 优先级字段 | 15.1 |
| **15.3** | **R2-a** | 里程碑 CRUD API（4个 — GET/POST/PUT/DELETE /projects/:id/milestones） | 15.1 |
| **15.4** | R2 | 检查点 CRUD API（4个 — GET/POST/PUT/DELETE /tasks/:id/checkpoints） | 15.1 |
| **15.5** | R4 | 通知中心 API（GET /notifications + PUT /notifications/read） + notifications 表增强 | 15.1 |
| **15.6** | R6 | 项目看板页（ProjectBoardPage — 卡片 + 三色预警 + 列表/看板切换，消费 R2-a API） | 无（Mock） |
| **15.7** | R6 | 里程碑管理组件（MilestonePanel — 在项目详情页内,CRUD + 时间线展示） | 无（Mock） |
| **15.8** | R6 | 任务信息增强（TaskCreatePage Step2 新增: 任务编号只读 + 优先级选择 + 验收标准） | 无 |
| **15.9** | R6 | 项目信息增强（ProjectModal 新增: 预期交付日期 + 项目阶段 + 5态状态） | 无 |
| **15.10** | R6 | 通知中心（NotificationPopover + NotificationPage — 顶栏🔔 + 独立页面） | 无（Mock） |

---

### W16 · 评论 + 问题上报 + 日报 + 交付物增强 + 自动化

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **16.1** | R2 | 任务评论 API（3个 — GET/POST/DELETE /tasks/:id/comments + @解析通知） | 15.1 |
| **16.2** | R2 | 问题上报 API（3个 — GET/POST/PUT /tasks/:id/issues + SLA 计时） | 15.1 |
| **16.3** | R2 | 风险等级自动计算 cron（每小时：任务 risk_level + 项目 risk_level） | 15.2 |
| **16.4** | R2 | 异常自动化 cron（检查点逾期 + 日报缺失 + 阻塞问题超时 + 里程碑到期） | 15.4, 16.2 |
| **16.5** | **R2-a** | 项目阶段自动流转逻辑（首个任务 in_progress→制作执行; 全部完成→验收交付） | 15.1 |
| **16.6** | R6 | 检查点面板（CheckpointPanel — 在任务详情中栏,创建/提交/审核） | R2(15.4) |
| **16.7** | R6 | 工作日志面板（WorkLogPanel — 在任务详情中栏,日报列表+企业评论） | R2 |
| **16.8** | R6 | 交付物版本浏览器（DeliverableVersionViewer — 版本列表+退回原因+下载） | 已有基础 |
| **16.9** | R6 | 评论 Tab（CommentTab — 在任务详情页新增Tab,评论/回复/@/标记重要） | R2(16.1) |
| **16.10** | R6 | 问题上报标记（IssueIndicator — 在任务详情中栏角色区域,问题列表+回复） | R2(16.2) |
| **16.11** | R7 | 零工端检查点提交 + 问题上报入口 | R2(15.4, 16.2) |
| **16.12** | R7 | 零工端日报增强（daily_summary + tomorrow_plan 字段） | R2 |
| **16.13** | R6+R7 | Sprint 4 前后端联调 | 全部 |
| **16.14** | R8 | Sprint 4 功能测试（看板/里程碑/检查点/评论/问题/通知 + SLA 验证） | 16.13 |
| **16.15** | R9 | V3.7 安全审计（@提及 XSS 防护 + 通知内容注入检查） | 16.13 |

**Sprint 4 交付标准:**
- ✅ 项目看板可展示所有项目（含进度条 + 三色预警 + 里程碑进度）
- ✅ 里程碑可创建、标记完成、延期自动预警
- ✅ 任务检查点可创建 → 零工提交 → 企业审核（通过/不通过）
- ✅ 任务详情页「讨论」Tab 可发表评论/回复/@通知
- ✅ 零工可上报阻塞问题,企业可响应处理,SLA 24h 跟踪
- ✅ 通知中心可接收并展示所有类型通知（8种）
- ✅ 风险等级自动计算（每小时 cron）
- ✅ 工作日志面板可查看零工日报 + 企业反馈

---

## 7. Sprint 5（W17-W18）· 数据分析 + 全量回归 + 上线准备

### W17 · 数据分析增强 + 零工端日报增强

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **17.1** | R2 | Dashboard 数据聚合 API 增强（V3.7 §5: 平均完成周期/按时交付率/接单响应时间/活跃零工数） | Sprint 4 |
| **17.2** | R2 | 项目维度分析 API（项目状态概览 + 预算 vs 实际 + 健康度分布） | Sprint 4 |
| **17.3** | R2 | 质量分析 API（验收通过率 + 返工率 + 平均返工次数 + 检查点通过率） | Sprint 4 |
| **17.4** | R6 | DashboardPage 升级（新增 4 指标卡 + 4 图表 + 项目分析区 + 质量分析区） | 无（Mock） |
| **17.5** | R7 | 零工端体验优化（作品集管理 + 角色档案 + 名片分享 + 通知订阅） | Sprint 3+4 |
| **17.6** | R7 | 零工端日报增强（结构化模板: 今日/明日/问题 + 截图附件） | Sprint 4 |

---

### W18 · 全量回归 + 安全加固 + 上线

| 序号 | Agent | 任务 | 依赖 |
|------|-------|------|------|
| **18.1** | R8 | 全量回归测试（Sprint 1~5 合计 ~105 API + 30+ 页面） | W17 |
| **18.2** | R8 | 压测复查（100 QPS + 50 并发项目 + 大文件上传 500MB） | W17 |
| **18.3** | R9 | 全量安全扫描（OWASP + 加密 + SSRF + XSS + CSRF） | W17 |
| **18.4** | R6 | UI 走查 + 响应式适配复查（1024/1280/1440/1920） | W17 |
| **18.5** | R7 | 小程序审核准备（类目资质确认 + 体验版测试 + 提审） | W17 |
| **18.6** | R2+R3 | Bug Fix + 性能调优（来自 18.1~18.3） | 18.1~18.3 |
| **18.7** | R11 | 生产环境更新部署 + 灰度发布 Sprint 3~5 功能 | 18.6 |
| **18.8** | R0 | 全量交付验收 + 项目总结报告 | 18.7 |

**Sprint 5 交付标准:**
- ✅ Dashboard 新增全部指标卡 + 图表
- ✅ 项目维度分析 + 质量分析可用
- ✅ 全部 ~105 API 回归通过
- ✅ 安全扫描无高危漏洞
- ✅ 小程序提审通过

---

## 8. 全局质量门禁

每个 Sprint 结束时,R8(QA) + R9(Security) 必须完成以下检查,否则不进入下一个 Sprint:

| 门禁项 | 标准 | 责任 Agent |
|--------|------|-----------|
| API 接口覆盖率 | ≥ 80% 自动化测试覆盖 | R8 |
| E2E 链路测试 | 核心链路 100% 通过 | R8 |
| 性能基线 | API P95 < 500ms; 页面加载 < 3s | R8 |
| 安全扫描 | OWASP Top10 无高危 | R9 |
| 敏感字段加密 | 手机号/身份证/API Key 全部加密 | R9 |
| 资金操作并发安全 | 乐观锁 + 分布式锁验证通过 | R9 |
| 代码规范 | ESLint + Prettier 零 Error | R11(CI) |

---

## 9. Agent 激活时间表（甘特图视角）

```
Agent     W1  W2  W3  W4  W5  W6  W7  W8  W9  W10 W11 W12 W13 W14 W15 W16 W17 W18
──────────────────────────────────────────────────────────────────────────────────────
R0 编排   ██                  ██                          ██              ██      ██
R1 认证   ████████                  ████                  ░░
R2 任务       ██████████████████    ████████████      ░░  ░░  ████████████████
R2-a项目                                                ████████████████░░██
R2-b AI                                                 ████████
R3 支付           ████████████░░    ░░██░░                                    ░░
R4 消息               ████████░░        ████░░              ████
R5 文件       ░░              ░░                    ████
R6 PC端   ██████████████████████    ████████████████  ████████████████████████████
R7 小程序 ██████████████████████    ████████████████  ░░  ░░  ░░  ████████████████
R8 测试                       ████            ████████        ░░  ████        ████
R9 安全   ░░                  ████            ████                ░░  ████    ████
R10 架构  ████████████    ████                          ████████
R11 运维  ██              ░░  ████                ████                        ████
──────────────────────────────────────────────────────────────────────────────────────
          ├── Sprint 1 ──┤    ├── Sprint 2 ────────┤    ├─S3─┤├─ Sprint 4 ─┤├─S5─┤

██ = 主力工作   ░░ = 支援/待命   R2-a/R2-b 从 W13 启动（Sprint 3 起新增角色）
```

---

## 10. 风险与应对

| 风险 | 概率 | 影响 | 应对策略 |
|------|------|------|---------|
| 合规通道对接延迟 | 高 | 阻塞 W5 结算 | W1 启动对接,Mock 先行,W5 前必须联调通过 |
| 微信小程序审核被拒 | 中 | 阻塞 W12 上线 | W6 提交体验版预审;W10 准备二次提审 |
| LLM API Key 费用超预期 | 低 | Sprint 3 成本 | 默认低 Token 限额 + 月度上限 |
| 大文件上传 OSS 超时 | 中 | 交付物功能体验差 | 分片上传 + 断点续传 |
| 并发资金操作死锁 | 低 | 数据不一致 | 乐观锁 + Redis 分布式锁 + W6 并发压测 |
| V3.7 范围蔓延 | 中 | Sprint 4 延期 | 严格按 P0→P1→P2 优先级,P2 可延至 Sprint 5 |

---

## 11. 文档交叉索引

| 文档 | 路径 | 用途 |
|------|------|------|
| PRD V3.6.1 主文档 | `docs/WeCreator_PRD_V3.1.md` | 全量需求（4,479行） |
| PRD V3.7 增量 | `docs/WeCreator_PRD_V3.7_Project_Task_Enhancement.md` | 项目及任务深化需求（970行） |
| V3.6 复盘报告 | `docs/PRD_V3.6_Review_Report.md` | 18个问题清单 |
| 架构文档 | `docs/architecture.md` | 技术架构 + 模块依赖 |
| 设计系统 V1.1 | `docs/design/WeCreator_Design_System_V1.1.md` | UI/UX 规范 |
| 设计 Tokens | `docs/design/tokens/` | CSS/SCSS/TS/JSON 四套 |
| Agent 协同上下文 | `.agents/context.md` | 角色依赖 + 18条接口契约 |
| Prisma Schema | `apps/backend/prisma/schema.prisma` | 当前 27 model |

---

**文档版本:** V1.0 · 全量功能开发 Agent 执行顺序
**统计:** 5 Sprint · 18 周 · **14 Agent（方案 B）** · ~130 个执行步骤 · ~108 API · ~41 表 · ~38 PC页面 + ~26 小程序页面
