# WeCreator 原 12 Agent 角色可用性分析

> **目的:** 对照全量 PRD（V3.6.1 + V3.7），逐一审查原定义的 12 个 Agent 角色，判断是否可继续使用、需要调整或新增。
> **编制日期:** 2026-04-18
> **输入:** CLAUDE.md §5 角色定义 + .agents/context.md 协同上下文 + 全量 PRD 105 API + 41 表

---

## 0. 分析方法

对每个 Agent 从 **5 个维度** 评估：

| 维度 | 说明 |
|------|------|
| ① 职责定义匹配度 | 原始职责范围能否覆盖全量 PRD 需求 |
| ② 代码范围准确性 | 原定义的 `modules/xxx` 映射在当前代码库中是否正确 |
| ③ API 负载均衡度 | 该 Agent 承担的 API 数量是否合理（建议单Agent ≤ 25 API） |
| ④ 接口契约完整性 | .agents/context.md 中的 18 条契约是否仍然覆盖新增依赖 |
| ⑤ Sprint 跨度合理性 | 该 Agent 的活跃周期是否合理 |

**结论分三档:**
- ✅ **可直接使用** — 无需修改
- ⚠️ **需调整** — 职责或代码范围需修改
- ❌ **需拆分/新增** — 负载过重或出现未覆盖域

---

## 1. 逐一评估

### R0 wc-orchestrator（编排协调）

| 维度 | 评估 |
|------|------|
| 原始职责 | 任务编排 · 依赖追踪 · 里程碑验收 |
| 代码范围 | `docs/` + `task-checklist` |
| PRD 覆盖 | 全 Sprint 的任务分发、阻塞仲裁、进度跟踪 |

**分析:** R0 是元角色（Meta），不编写代码，只负责协调其他 11 个 Agent 的工作顺序。PRD 从 12 周（W1-W12）扩展到 18 周（W1-W18），R0 的工作量线性增加但性质不变。

**结论:** ✅ **可直接使用**

唯一建议：在职责描述中追加「Sprint 3-5 新增功能的优先级仲裁」。

---

### R1 wc-auth-dev（认证模块）

| 维度 | 评估 |
|------|------|
| 原始职责 | 认证：注册/登录/JWT/RBAC |
| 代码范围 | `modules/auth` + `modules/user` |
| 原始 API | ~15 个（注册/登录/refresh/子账号 CRUD/零工微信登录） |
| V3.6 新增 | super_admin 专属鉴权（§4.8 系统管理页面访问控制） |
| V3.7 新增 | 权限矩阵扩展（§8: 新增 project_manage/checkpoint_manage/comment_manage 等权限点） |

**分析:**
- API 数量从 ~15 增加到 ~18（新增 super_admin Guard + 权限点查询），仍在合理范围
- `modules/admin`（子账号管理）在原定义中未明确归属，实际应归 R1
- `modules/platform`（运营后台 34 API）在原 12 Agent 中**完全没有归属** — 见后文 §2.1

**结论:** ⚠️ **需小幅调整**

```diff
- 代码范围: modules/auth + modules/user
+ 代码范围: modules/auth + modules/user + modules/admin
+ 新增职责: V3.6 super_admin 鉴权 Guard + V3.7 权限矩阵扩展
```

---

### R2 wc-task-dev（任务核心）⚠️ 重点审查

| 维度 | 评估 |
|------|------|
| 原始职责 | 任务：发布/撮合/执行/验收/状态机 |
| 代码范围 | `modules/task` + `modules/assignment` |
| 原始 API | ~25 个 |

**V3.6 塞入 R2 的新功能:**

| 功能 | API 数 | 复杂度 | 备注 |
|------|--------|--------|------|
| 项目管理 CRUD | 4 | 中 | 新建 `modules/project` |
| LLM 配置 | 3 | 高 | 涉及 AES 加密、Provider 验证 |
| 智能体管理 | 3 | 中 | CRUD + 启停 |
| AI 对话 | 2 | 极高 | 6 种 Adapter + 流式输出 + MongoDB |
| 附件系统 | 2 | 中 | 扩展 `modules/file` |

**V3.7 继续塞入 R2 的新功能:**

| 功能 | API 数 | 复杂度 | 备注 |
|------|--------|--------|------|
| 里程碑管理 | 4 | 中 | 新建子模块 |
| 检查点管理 | 4 | 中 | 新建子模块 |
| 任务评论 | 3 | 中 | @解析 + 通知联动 |
| 问题上报 | 3 | 高 | SLA 计时 + 自动化 |
| 数据分析增强 | 2+ | 高 | 多维聚合查询 |
| 任务编号 | — | 低 | Redis INCR |
| 风险自动化 | — | 高 | 5 条 cron 规则 |

**API 负载统计:**

```
原始:    25 API
V3.6:  + 14 API（含项目+AI全部）
V3.7:  + 16 API
───────────────
合计:    55 API（是原始的 2.2 倍！）
```

**分析:**
R2 是 **全系统负载最重的 Agent**，原始设计已经是 25 API（12 个 Agent 中最多），V3.6/V3.7 又几乎所有新后端功能都默认归入了 R2，导致：

1. **API 数量失控:** 55 API 远超单 Agent 合理上限（25），是 R3/R4/R5 的 3~10 倍
2. **技术栈跨度过大:** 既要写 NestJS 业务逻辑，又要实现 LLM Adapter（HTTP Client/流式解析/JSON Path 提取），还要管理 MongoDB 对话存储和多个 cron 任务
3. **新建后端模块数:** 需新建 project/ai/checkpoint/comment/issue 共 5 个 module，而原始 R2 只管 2 个 module
4. **Sprint 跨度:** W2-W18 贯穿全程 17 周，几乎没有空档

**结论:** ❌ **必须拆分**，否则 R2 将成为整个项目的单点瓶颈。

拆分方案见后文 §3。

---

### R3 wc-pay-dev（支付结算）

| 维度 | 评估 |
|------|------|
| 原始职责 | 支付：充值/锁定/结算/提现/对账 |
| 代码范围 | `modules/finance` + `modules/wallet` |
| 原始 API | ~15 个 |
| V3.6/V3.7 变更 | 无新增 API；V3.7 增加里程碑付款可选项（P2，可延后） |

**分析:**
- R3 是全量 PRD 中**变动最小**的 Agent，V3.6/V3.7 未新增任何支付类 API
- 唯一变化：V3.7 里程碑如果与付款挂钩（P2 需求），需要扩展结算触发条件
- 实际代码中还有 `modules/checkin`（打卡）中的 `weekly-settlement.service.ts`（周结算），逻辑上应归 R3
- `modules/review`（评价）原定义中也未明确归属

**结论:** ✅ **可直接使用**

微调建议：
```diff
- 代码范围: modules/finance + modules/wallet
+ 代码范围: modules/finance + modules/wallet + modules/checkin(周结算部分)
```

---

### R4 wc-msg-dev（消息系统）

| 维度 | 评估 |
|------|------|
| 原始职责 | 消息：WebSocket IM + 订阅消息 |
| 代码范围 | `modules/message` + `modules/notification` |
| 原始 API | ~10 个 |
| V3.7 新增 | 通知中心 API（2 个）+ 8 种通知类型 + @提及触发通知 |

**分析:**
- V3.7 通知中心是 R4 的自然延伸，职责完全对口
- API 从 ~10 增加到 ~12，仍在合理范围
- 新增的@提及通知需要与评论模块（原 R2）的事件联动，需新增接口契约

**结论:** ✅ **可直接使用**

微调建议：
```diff
+ 新增职责: V3.7 企业端通知中心 + @提及通知触发
+ 新增契约: C19 评论模块(R2-b) → R4: COMMENT_MENTION 事件
```

---

### R5 wc-file-dev（文件服务）

| 维度 | 评估 |
|------|------|
| 原始职责 | 文件：OSS 直传/交付物/合同 PDF |
| 代码范围 | `modules/file` + `modules/contract` |
| 原始 API | ~5 个 |
| V3.6 新增 | 任务附件 API（2 个：POST metadata + DELETE） |
| V3.7 新增 | 里程碑附件 + 交付物版本浏览增强 |

**分析:**
- API 从 ~5 增加到 ~8，仍在合理范围
- 附件系统（task_attachments + milestone_attachments）是 R5 的自然延伸
- 文件服务本身技术复杂度不高（OSS 直传 + 元数据管理），工作量偏轻

**结论:** ✅ **可直接使用**

微调建议：
```diff
+ 新增职责: V3.6 任务附件 + V3.7 里程碑附件 + 交付物版本浏览
+ 代码范围: modules/file + modules/contract + task_attachments表 + milestone_attachments表
```

---

### R6 wc-pc-dev（企业 PC 端）

| 维度 | 评估 |
|------|------|
| 原始职责 | 企业 PC 端：Vue3 **15 个页面** |
| 代码范围 | `apps/pc-admin/` |
| 当前页面 | 13 个（已实现） |

**V3.6/V3.7 需新增页面:**

| 页面 | PRD 章节 | 复杂度 |
|------|---------|--------|
| ProjectListPage | §4.9.1 | 中 |
| ProjectDetailPage | §4.9.3 | 高 |
| ProjectBoardPage | V3.7 §2.2 | 高 |
| LlmConfigPage | §4.8.1 | 中 |
| AgentListPage | §4.8.2 | 中 |
| AI 任务顾问 Drawer | V3.6 AI | 极高 |
| NotificationPage | V3.7 §4.3 | 中 |
| 里程碑面板 | V3.7 §2.3 | 中 |
| 检查点面板 | V3.7 §3.2 | 中 |
| 评论 Tab | V3.7 §4.1 | 中 |
| 问题上报组件 | V3.7 §4.2 | 中 |
| 工作日志面板 | V3.7 §3.3 | 中 |
| 交付物版本浏览器 | V3.7 §3.4 | 中 |

**分析:**
- 页面数从 15 膨胀到 **26+**（含新页面 + 新面板/组件）
- 但前端 Agent 的工作模式是「消费 API + 组装 UI」，单个页面的复杂度比后端模块低
- `apps/platform-admin/`（运营后台 12 个页面）在原定义中**没有归属**
- R6 只负责 `pc-admin`，这个定位是清晰的

**结论:** ⚠️ **需扩展页面数描述，但角色本身可用**

```diff
- 职责: 企业PC端：Vue3 15个页面
+ 职责: 企业PC端：Vue3 26+页面（含V3.6项目/AI/LLM配置 + V3.7看板/检查点/评论/通知）
```

---

### R7 wc-mp-dev（零工小程序）

| 维度 | 评估 |
|------|------|
| 原始职责 | 零工小程序：Taro 4Tab + 7 分包 |
| 代码范围 | `apps/worker-mp/` |
| 当前页面 | 8 主页面 + 14 子包页面 = 22 页面 |
| V3.7 新增 | 检查点提交 + 问题上报 + 日报增强 + 通知入口 |

**分析:**
- V3.7 新增约 3-4 个子页面，增幅不大
- 小程序端不涉及项目管理/AI/LLM 配置等企业专属功能
- 工作量主要在 Sprint 1-2（核心闭环），Sprint 3-5 增量较少

**结论:** ✅ **可直接使用**

---

### R8 wc-qa-lead（测试）

| 维度 | 评估 |
|------|------|
| 原始职责 | 测试：E2E + 资金流 + 压测 |
| 代码范围 | `test/` + `k6-scripts/` |
| V3.6/V3.7 变更 | 测试范围从 ~70 API 扩展到 ~105 API |

**分析:**
- 测试范围按 API 数量线性增长，工作模式不变
- V3.7 新增 SLA 计时验证、cron 自动化验证是新的测试维度
- 建议增加 AI 对话端到端测试（Mock LLM 响应）

**结论:** ✅ **可直接使用**

---

### R9 wc-security-ops（安全）

| 维度 | 评估 |
|------|------|
| 原始职责 | 安全：OWASP + 加密审计 |
| 代码范围 | 全项目审计 |
| V3.6 新增 | API Key AES-256 加密审计 + SSRF 防护审计 + LLM Rate Limit 验证 |
| V3.7 新增 | @提及 XSS 防护 + 通知内容注入检查 |

**分析:**
- 安全审计本身是横切面工作，新增功能只增加审计点，不改变工作模式
- V3.6 的 CustomHTTPAdapter（用户自定义请求模板）是新的 SSRF 攻击面，需重点审计

**结论:** ✅ **可直接使用**

---

### R10 wc-schema-ops（数据架构）

| 维度 | 评估 |
|------|------|
| 原始职责 | 数据库：Schema/Migration/种子 |
| 代码范围 | `prisma/` |
| 原始表 | 23 表 + 11 枚举 |
| V3.6 新增 | 6 表（projects/llm_configs/ai_agents/ai_chat_sessions/task_attachments/llm_usage_monthly_log） |
| V3.7 新增 | 6 表（milestones/milestone_attachments/task_checkpoints/task_comments/task_issues/notifications重构）+ 3 表扩展 |

**分析:**
- 表从 23 → 35，增幅约 52%
- 迁移次数从 4 → 6+（V3.6 一次 + V3.7 一次或分两次）
- 工作模式不变（写 Prisma Schema + migrate + 种子数据）
- `.agents/context.md` C01 说的「23表」需要更新

**结论:** ✅ **可直接使用**

微调：更新 C01 契约中的表数量。

---

### R11 wc-devops（运维部署）

| 维度 | 评估 |
|------|------|
| 原始职责 | 运维：Docker/CI-CD/监控 |
| 代码范围 | `docker/` + `.github/` |
| V3.6/V3.7 变更 | 无直接影响；cron 任务部署配置可能需要更新 |

**分析:**
- 运维角色与功能增减关系不大，主要在 Sprint 末尾发力
- V3.6 引入 cron（月度统计重置）+ V3.7 引入多个 cron（风险计算/异常自动化），需在部署中确保 cron scheduler 正常

**结论:** ✅ **可直接使用**

---

## 2. 系统性问题

### 2.1 ❌ 运营后台无 Agent 归属

**问题:** PRD §18 定义了完整的平台运营管理后台，包括：
- 后端：`modules/platform`（34 个 API）
- 前端：`apps/platform-admin/`（12 个页面）

但原 12 个 Agent 中**没有任何一个**覆盖运营后台：
- R1-R5 是业务后端模块，不含 `modules/platform`
- R6 只覆盖 `apps/pc-admin/`，不含 `apps/platform-admin/`
- R7 只覆盖 `apps/worker-mp/`

**当前现状:** 运营后台已经全部实现（后端 34 API + 前端 12 页面），是在 Sprint 阶段外由通用开发完成的。

**影响:** 如果后续运营后台需要扩展（如 V3.7 新增「运营端监控仪表盘」「AI 用量监控」等 P2 需求），没有对口 Agent。

### 2.2 ❌ R2 严重过载

已在 §1 R2 详细分析。R2 原始 25 API → 全量 55 API，且技术栈跨度极大（NestJS 业务逻辑 + LLM HTTP Client + MongoDB + cron 调度 + 6 种 Adapter 策略模式）。

### 2.3 ⚠️ 接口契约文件（context.md）过时

| 问题 | 位置 | 说明 |
|------|------|------|
| C01 表数量 | context.md §2 | 写「23表」，实际已 27 表（代码），全量需 35+ 表 |
| C02 索引数量 | context.md §2 | 写「15条」，V3.6.1 已是 18 条，V3.7 预计 23+ 条 |
| C06 API 数量 | context.md §2 | 写「25 方法」，全量需 55+ 方法 |
| 缺失 C19-C22 | — | 新增事件（CHECKPOINT_SUBMITTED/ISSUE_CREATED/COMMENT_MENTION/MILESTONE_DUE）未定义 |
| 开发波次 | context.md §3 | 只写到 W12，缺少 W13-W18 |
| 缺少运营后台契约 | — | platform module 的 API/鉴权契约未纳入 |

### 2.4 ⚠️ 部分后端模块的 Agent 归属模糊

| 后端模块 | 原始归属 | 实际关联 | 问题 |
|---------|---------|---------|------|
| `modules/admin` | 未指定 | R1 (子账号管理) | 应明确归 R1 |
| `modules/checkin` | 未指定 | R2 (打卡逻辑) + R3 (周结算) | 跨两个 Agent |
| `modules/review` | 未指定 | R2 (评价触发) 或独立 | 应明确归属 |
| `modules/dispute` | 未指定 | R2 (争议仲裁) | 应明确归 R2 |
| `modules/platform` | 无归属 | 需新增 Agent 或扩展 R6 | §2.1 问题 |

---

## 3. 优化方案

### 方案 A：最小调整（保持 12 Agent 不拆分）

> **核心思路:** 不增加 Agent 数量，通过调整职责边界平衡负载。

**R2 减负措施:**
- 将 `project module` 归入 R5（R5 从「文件服务」升级为「项目+文件服务」，API 从 5→13）
- 将 `ai module`（LLM+Agent+对话）视为 R2 的子领域，但在执行计划中安排独立开发窗口（W13-W14）
- 将 `review module`（评价）+ `dispute module`（争议）正式归入 R2

**运营后台措施:**
- 将 `modules/platform` 归入 R1（R1 从「认证」升级为「认证+运营后台」）
- 将 `apps/platform-admin/` 归入 R6（R6 从「企业PC端」升级为「全部PC端」）

```
调整后负载:
R1: ~15 → ~49 API (auth 15 + platform 34) ← 但 platform 已完成，后续维护量小
R2: ~55 → ~43 API (减去 project 8 + 附件 2)
R3:  15 API (不变)
R4:  12 API (不变)
R5:  ~5 → ~13 API (原 file 5 + project 8)
```

**优点:** 不增加角色数，保持原架构简洁
**缺点:** R2 仍然 43 API 偏重；R1 承担已完成的 platform 维护不够清晰

---

### 方案 B：适度拆分（14 Agent）⭐ 推荐

> **核心思路:** 从 R2 中拆出 2 个独立 Agent，解决过载问题；新增运营后台 Agent。

#### 新增角色

| 新 Agent | Skill Slug | 职责 | 代码范围 | API 数 |
|---------|-----------|------|---------|--------|
| **R2-a** | `wc-project-dev` | 项目管理：CRUD/看板/里程碑/阶段流转 | `modules/project` | ~12 |
| **R2-b** | `wc-ai-dev` | AI 系统：LLM 配置/智能体/对话/Adapter | `modules/ai` | ~11 |

#### 运营后台处理

运营后台（§18）已完成实现，后续 P2 增量很小。不单独新增 Agent，而是：
- 后端 `modules/platform` → 归入 R1（认证+运营）
- 前端 `apps/platform-admin/` → 归入 R6（全部 PC 端）

#### 调整后 14 Agent 全景

| Agent | 原始 | 调整后职责 | API 数 | 变化 |
|-------|------|-----------|--------|------|
| R0 | 编排协调 | 不变 | — | ✅ |
| R1 | 认证 | 认证 + 子账号 + 运营后台维护 | ~18 (+维护 34) | ⚠️ 微调 |
| **R2** | **任务核心** | **任务核心（发布/撮合/执行/验收/状态机/检查点/评论/问题/数据分析）** | **~32** | **⚠️ 减负** |
| R2-a | — | **项目管理（CRUD/看板/里程碑/阶段/预警）** | **~12** | **❌ 新增** |
| R2-b | — | **AI 系统（LLM 配置/智能体/对话/6 Adapter/cron）** | **~11** | **❌ 新增** |
| R3 | 支付结算 | 不变 | ~15 | ✅ |
| R4 | 消息系统 | 消息 + 通知中心 | ~12 | ✅ |
| R5 | 文件服务 | 文件 + 附件系统 | ~8 | ✅ |
| R6 | 企业 PC 端 | 全部 PC 端（企业 26+ 页 + 运营 12 页） | ~38 页 | ⚠️ 微调 |
| R7 | 零工小程序 | 不变 | ~26 页 | ✅ |
| R8 | 测试 | 不变（测试范围扩大） | — | ✅ |
| R9 | 安全 | 不变（审计点增加） | — | ✅ |
| R10 | 数据架构 | 不变（表数量增加） | — | ✅ |
| R11 | 运维 | 不变（cron 部署增加） | — | ✅ |

#### 调整后 API 负载分布

```
R1  ████████████████████ 18 API (auth+admin+权限扩展)
R2  ████████████████████████████████ 32 API (task核心+检查点+评论+问题+分析)
R2a ████████████ 12 API (project+milestone+看板)
R2b ███████████ 11 API (LLM+agent+AI对话)
R3  ███████████████ 15 API (finance+wallet+settlement)
R4  ████████████ 12 API (message+notification+通知中心)
R5  ████████ 8 API  (file+contract+attachment)
    ──────────────────────────────────────────────
    总计: ~108 API (含V3.7增量)
```

#### 新增接口契约

| 编号 | 提供方 | 消费方 | 内容 |
|------|--------|--------|------|
| C19 | R2 | R4 | `COMMENT_MENTION` 事件：评论@某人 → 推送通知 |
| C20 | R2 | R4 | `ISSUE_CREATED` 事件：问题上报 → 推送通知 |
| C21 | R2-a | R4 | `MILESTONE_DUE` 事件：里程碑到期预警 → 推送通知 |
| C22 | R2 | R4 | `CHECKPOINT_SUBMITTED` 事件：检查点提交 → 推送企业审核通知 |
| C23 | R2-b | R2 | `AI_TASK_GENERATED` 事件：AI生成任务建议 → R2 处理一键填充 |
| C24 | R2-a | R2 | `ProjectService.getProjectById()` 内部调用：任务关联项目查询 |

#### 新增依赖关系

```
R10 Schema-Ops（数据库基座）
  ↓ Prisma Schema 35表 + Migration
R1 Auth-Dev ←──────────── 被所有后端角色依赖（JWT中间件）
  ↓ JwtModule + AuthGuard + @CurrentUser
  │
  ├─→ R2 Task-Dev ──→ R3 Pay-Dev
  │     ↕ C24           ↓ C12
  │   R2-a Project-Dev   R4 Msg-Dev ←── C19/C20/C21/C22
  │     ↕ C23
  │   R2-b AI-Dev
  │
  └─→ R5 File-Dev
```

---

### 方案 C：深度拆分（16 Agent）

> **核心思路:** 在方案 B 基础上，进一步拆出运营后台 Agent 和通知系统 Agent。

在方案 B 基础上再新增：
| 新 Agent | Skill Slug | 职责 | 来源 |
|---------|-----------|------|------|
| R12 | `wc-platform-dev` | 运营后台（后端 34 API + 前端 12 页面） | 从 R1 + R6 拆出 |
| R13 | `wc-notify-dev` | 通知中枢（通知中心 + 微信订阅消息 + @提及 + SLA 触发） | 从 R4 拆出 |

**优点:** 每个 Agent 职责极其清晰，单一职责原则贯彻到底
**缺点:** Agent 数量过多（16个），协调成本指数级增长；R12/R13 的 API 数量偏少（5-8个），角色太轻

**结论:** 除非团队规模 ≥ 8 人，否则不建议。

---

## 4. 方案对比总表

| 维度 | 方案 A (12) | 方案 B (14) ⭐ | 方案 C (16) |
|------|------------|--------------|------------|
| Agent 数量 | 12（不变） | 14（+2） | 16（+4） |
| R2 API 负载 | 43（仍偏重） | **32（合理）** | 32（同B） |
| 新增角色学习成本 | 零 | 低（2个子角色） | 中（4个新角色） |
| 协调复杂度 | 低 | 中 | 高 |
| 运营后台归属 | 分散在 R1+R6 | 分散在 R1+R6 | 独立 R12 |
| AI 系统独立性 | 嵌入 R2 | **独立 R2-b** | 独立 R2-b |
| 项目管理独立性 | 嵌入 R5 | **独立 R2-a** | 独立 R2-a |
| 适用团队规模 | 3-4 人 | **5-7 人** | 8+ 人 |
| 推荐指数 | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 5. 推荐结论

### 采用方案 B（14 Agent），原因：

1. **解决 R2 瓶颈:** 将 55 API 拆为 32+12+11，每个 Agent 负载合理
2. **AI 系统值得独立:** LLM Adapter 架构（6种适配器 + 流式解析 + SSRF 防护 + MongoDB 存储）技术复杂度极高，与业务 CRUD 差异巨大，分离有利于技术深度
3. **项目管理是新域:** 项目(project)与任务(task)虽然关联紧密，但项目管理有独立的状态机（5 态）、看板视图、里程碑体系，值得独立
4. **最小变更:** 仅新增 2 个子角色（R2-a/R2-b），保留所有原角色，学习成本最低
5. **运营后台已完成:** 不值得为已实现的模块新增专职 Agent

### 各 Agent 最终状态汇总

| Agent | 判定 | 行动项 |
|-------|------|--------|
| R0 编排 | ✅ 直接使用 | 职责描述增加 Sprint 3-5 |
| R1 认证 | ⚠️ 微调 | 代码范围 +modules/admin +modules/platform |
| **R2 任务** | **⚠️ 减负** | **拆出项目和 AI，保留核心 32 API** |
| **R2-a 项目** | **❌ 新增** | **新建 wc-project-dev，12 API** |
| **R2-b AI** | **❌ 新增** | **新建 wc-ai-dev，11 API** |
| R3 支付 | ✅ 直接使用 | 代码范围 +checkin 周结算 |
| R4 消息 | ✅ 直接使用 | 职责 +通知中心 +@提及 |
| R5 文件 | ✅ 直接使用 | 职责 +附件系统 |
| R6 PC端 | ⚠️ 微调 | 页面数 15→38+，+platform-admin |
| R7 小程序 | ✅ 直接使用 | — |
| R8 测试 | ✅ 直接使用 | 测试范围扩大到 105 API |
| R9 安全 | ✅ 直接使用 | 审计点增加 SSRF/XSS |
| R10 架构 | ✅ 直接使用 | 表数量 23→35+ |
| R11 运维 | ✅ 直接使用 | cron 部署配置 |

### 需同步更新的文件

| 文件 | 更新内容 |
|------|---------|
| `CLAUDE.md` §5 | 12 Agent 表格更新为 14 Agent |
| `.agents/context.md` §1 | 依赖图新增 R2-a / R2-b 节点 |
| `.agents/context.md` §2 | C01 表数 23→35; C06 方法数 25→32; 新增 C19-C24 |
| `.agents/context.md` §3 | 开发波次新增 W13-W18 |
| `docs/Agent_Execution_Plan.md` | 用 R2-a/R2-b 替代原 R2 对应任务行 |

---

**文档版本:** V1.0 · 原 12 Agent 角色可用性分析
**统计:** 12 原角色 · 5 维度评估 · 3 套方案对比 · 推荐 14 Agent 方案
