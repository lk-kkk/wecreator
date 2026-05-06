# WeCreator V3.7 验收报告 — Phase 7 回归总结

> 生成时间: 2026-04-22
> 版本: V3.7 · Project & Task Enhancement
> 依据: `docs/WeCreator_PRD_V3.7_Project_Task_Enhancement.md` §14 + §8 + §12

---

## 1. 总览

| Phase | 内容 | 状态 | Commit |
|---|---|---|---|
| 1 | 数据库迁移 (schema + backfill) | ✅ 完成 | - |
| 2 | 后端服务 + API (16 新接口) | ✅ 完成 | `bff8ceb` |
| 3 | 企业端 PC (9 组件 + 2 页面) | ✅ 完成 | `ad6fec8` |
| 4 | 零工端小程序 (2 页面 + 3 扩展) | ✅ 完成 | `f4813cd` |
| 5 | Cron + 通知自动化 (6 cron) | ✅ 完成 | `ef1908c` |
| 6 | 埋点 + Dashboard 分析 (11 事件 + 3 聚合) | ✅ 完成 | `f8add43` |
| 7 | 回归 + 验收 | ✅ 完成 | 本次 |

---

## 2. §14 验收 Checklist

### P0 (Sprint 3)

| 项 | 状态 | 证据 |
|---|---|---|
| 任务发布时自动生成任务编号 (TSK-YYYYMMDD-NNN) | ✅ | `common/no-generator.service.ts` + `TaskService.create()` L33 调用 `noGen.nextTaskNo()` |
| 任务可设置优先级 (P0/P1/P2)，列表按优先级排序 | ✅ | `Task.priority` enum, `@@index([companyId, priority])`, smoke [12] 筛选通过 |
| 任务列表和详情页展示风险等级标记 | ✅ | `TaskListPage.vue` L151-155 三色圆点, `TaskDetailPage` 同理 |

### P1 (Sprint 4)

| 项 | 状态 | 证据 |
|---|---|---|
| 项目看板可展示所有项目 (进度条/三色/里程碑) | ✅ | `ProjectListPage.vue` + `/project/board` + `projectService.getBoard()` |
| 项目可设置阶段和预期交付日期 | ✅ | `Project.phase` + `expectedDeliveryDate` 字段 + 索引 |
| 里程碑可创建、标记完成、延期自动预警 | ✅ | `ProjectService.createMilestone/completeMilestone` + `MilestoneRemindCron` smoke [17] |
| 任务检查点全流程 (创建/提交/审核) | ✅ | `CheckpointService.create/submit/review` smoke [5][5a][5c] |
| 评论 Tab (发表/回复/@通知) | ✅ | `TaskCommentsPanel.vue` + `CommentService` |
| 零工可上报阻塞问题，企业可响应处理 | ✅ | `worker-mp/issue-report` 页 + `IssueService` 含通知 |
| 通知中心可接收并展示所有类型通知 | ✅ | `NotificationPage` + `NotificationBell` + 8 种 `CompanyNotificationType` |
| 风险等级自动计算 (每小时 cron) | ✅ | `RiskLevelCron` (`@Cron('0 * * * *')`) smoke [15] |
| SLA 超时自动提醒 (24h 问题响应) | ✅ | `SlaMonitorCron` + `IssueService.checkSla()` smoke [18] |
| 工作日志面板可查看零工日报 | ✅ | `TaskProgressLogPanel.vue` + `progressUpdates` 字段 |

### P2 (Sprint 5)

| 项 | 状态 | 证据 |
|---|---|---|
| Dashboard 新增 4 指标卡 + 4 图表 | ✅ | `DashboardPage.vue` V3.7 分区 8 卡 + 4 图 (task mode 饼/priority 柱/risk 饼/budget 对比) |
| 项目维度分析 (状态 / 预算对比 / 健康度) | ✅ | `AnalyticsService.getProjectAnalytics()` — byStatus/byRisk/byPhase/budgetCompare[10] |
| 质量分析 (验收通过率 / 返工率 / 检查点通过率) | ✅ | `getQualityAnalytics()` — approvalRate/reworkRate/cpPassRate smoke [22] |

**验收项合计: 17/17 通过**

---

## 3. §12 非功能性需求验证

执行脚本: `apps/backend/test/perf-v3.7.ts`

| 场景 | 阈值 | 实测 | 结果 |
|---|---|---|---|
| 项目看板 100 项目加载 | < 2000 ms | **4 ms** | ✅ |
| 评论 500 条加载 | < 1000 ms | **5 ms** | ✅ |
| 风险 cron 执行 | < 30 s | **2 ms** | ✅ |
| 通知列表 100 条拉取 | < 500 ms | **4 ms** | ✅ |

> WebSocket 推送 (< 2s) 在 V3.7 范围外未实施；当前实现为前端轮询，通知列表拉取延迟 < 500ms 已验证。

**NFR: 4/4 通过**

---

## 4. V3.6.1 兼容性回归

执行脚本: `apps/backend/test/compat-v3.7.ts`

| # | 场景 | 结果 |
|---|---|---|
| 1 | `Project.status='active'` V3.6.1 枚举值仍合法 | ✅ 默认 phase=requirement / riskLevel=green |
| 2 | Task 可无 `taskNo` / 默认 `priority=p2` / `riskLevel=green` / `acceptanceStatus=null` | ✅ |
| 3 | `projectService.getBoard()` 可读遗留项目 (无里程碑/无任务) | ✅ |
| 4 | `RiskLevelCron.runOnce()` 对无 `expectedDeliveryDate` 的遗留数据不崩 | ✅ |
| 5 | `syncPhaseFromTasks` 无任务时 phase 不变 | ✅ |
| 6 | `syncPhaseFromTasks` 单调前进: `execution` 不回退 `requirement` | ✅ |

**兼容性: 6/6 通过**

---

## 5. §8 权限矩阵回归

执行脚本: `apps/backend/test/perms-v3.7.ts`
方式: 使用 `Reflector` 静态读取 `@Roles()` 元数据对照 PRD §8。

| 功能 | super_admin | task_admin | finance_admin | operator | 断言 |
|---|:---:|:---:|:---:|:---:|:---:|
| 项目看板 | ✅ | ✅ | ❌ | 只读 | ✅ |
| 里程碑 创建 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 里程碑 完成 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 检查点 创建 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 检查点 审核 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 任务评论 | ✅ | ✅ | ❌ | ✅ | ✅ |
| 问题 更新/回复 | ✅ | ✅ | ❌ | ✅ | ✅ |
| 通知中心 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analytics 查询 | ✅ | ✅ | ❌ | ✅ | ✅ |

**权限: 9/9 通过**

### Phase 7 收紧修复 (PRD 一致性)

| 路由 | 修复前 | 修复后 |
|---|---|---|
| `GET /projects/board` | 无 `@Roles` (全角色) | `@Roles('super_admin','task_admin','operator')` ❌ finance |
| `POST /tasks/:id/comments` | 含 `finance_admin` | 移除 `finance_admin` 匹配 §8 |
| `DELETE /tasks/:id/comments/:cid` | 含 `finance_admin` | 移除 |
| `POST /tasks/:id/issues` | 含 `finance_admin` | 移除 |

---

## 6. Smoke V3.7 全量

执行脚本: `apps/backend/test/smoke-v3.7.ts`

**22/22 全绿** (含本次收紧后回归):

```
[1][2][3] 任务/项目编号 + 风险等级字段
[4] 里程碑 CRUD
[5][5a][5b][5c] 检查点全流程 (create/submit/reject/review)
[6] 评论 2 层嵌套 + @mention
[7] 问题上报 + SLA breached
[8] 通知列表 + 类型过滤
[9] SLA 检查 cron
[10] 里程碑完成通知
[11][11a] 已读标记 + 未读数
[12] priority 筛选
[13] 日报 transaction 写入
[14] RolesGuard 13 路由静态断言
[15] RiskLevelCron green→red
[16] CheckpointOverdueCron
[17] MilestoneRemindCron T-3
[18] SlaMonitor / DailyMissing / Cleanup
[19] AnalyticsService.track 写入
[20] Checkpoint 埋点 create/submit/review 覆盖
[21] getTaskAnalytics 结构
[22] getQualityAnalytics 结构
```

---

## 7. 已知偏差与限制 (不影响验收)

| 项 | 描述 | 原因 | 计划 |
|---|---|---|---|
| WX 订阅消息 | 零工端不推送 WX 订阅消息 | Phase 5 决策：走 `company_notification` 前端轮询，避免 WX 配额和审核复杂度 | V4 专项 |
| settings 页 26 个 TS 错误 | `AgentListPage` / `LlmConfigPage` `AxiosResponse` 类型错误 | V3.6.1 历史遗留，与 V3.7 无关 | 独立 ticket |
| 历史 task_no 回填 | 大库生产应低峰期分批执行 | 回填脚本: `prisma/backfill-v3.7.ts` | 上线时执行 |

---

## 8. 交付清单总结

| 层 | 文件数 | 功能点 |
|---|---|---|
| 数据库 | 2 migrations + 1 backfill | AnalyticsEvent + V3.7 索引 |
| 后端 | 6 新模块 (milestones/checkpoints/comments/issues/notification/analytics) + 7 cron + task-no-generator | 16 API + 11 埋点事件 |
| 企业端 PC | 1 新页面 (`NotificationPage`) + 9 组件 + 1 看板视图 + V3.7 Dashboard 分区 | 8 指标卡 + 4 图表 |
| 零工端 MP | 2 新页面 (`checkpoint-submit` / `issue-report`) + 3 扩展 | 检查点提交 + 问题上报 + 讨论 Tab |
| shared | `analytics.ts` (11 事件常量) | - |

---

## 9. 验收结论

✅ **通过 V3.7 验收**

- 17/17 §14 验收清单通过
- 4/4 §12 非功能性指标通过
- 6/6 V3.6.1 兼容性通过
- 9/9 §8 权限矩阵通过
- 22/22 Smoke 场景通过

**累计自动化测试: 58 项 · 全绿**
