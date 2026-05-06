# Phase 5 自动化 Cron + 通知分发

## 基础 infra（P0 前置修复）

**`ScheduleModule.forRoot()` 未注册** — 已发现现有 3 个 `@Cron`（finance/checkin/weekly-settlement）**实际上从未被触发**。本次顺带修：
```ts
// apps/backend/src/app.module.ts
imports: [
  ...,
  ScheduleModule.forRoot(),
]
```

## 新建 Scheduler 模块

**目录**: `apps/backend/src/modules/scheduler/`

```
scheduler/
├── scheduler.module.ts      # 注册 + imports PrismaModule/NotificationModule
├── risk-level.cron.ts       # 5.1 每小时
├── sla-monitor.cron.ts      # 5.2 每 15 分钟
├── checkpoint-overdue.cron.ts # 5.3 每天 00:30
├── daily-missing.cron.ts    # 5.4 每天 09:00
├── milestone-remind.cron.ts # 5.5 每天 00:30
└── notification-cleanup.cron.ts # 5.6 每天 02:00
```

## 各 Cron 实现要点

### 5.1 风险等级 — `@Cron(CronExpression.EVERY_HOUR)`
- 任务：`status=in_progress` AND `endDate` 存在
- 项目：`status IN (planning, in_progress)` AND `expectedDeliveryDate` 存在
- 规则（同 PRD §7）：
  - `days_to_deadline <= 2 AND progress < 80%` → red
  - `days_to_deadline <= 5 AND progress < 70%` → yellow
  - else → green
- 等级变化 → `company_notification(type='risk_alert')` + 批量 `update`

### 5.2 SLA 超时 — `@Cron('*/15 * * * *')`
- `TaskIssue WHERE status='open' AND firstResponseAt IS NULL AND createdAt < NOW()-24h AND slaBreached=false`
- `update slaBreached=true` + 发通知给 `task.createdBy`
- 48h 级别再发第二次（TODO 用独立 `slaBreachedLevel` 字段追踪，先简版）

### 5.3 检查点逾期 — `@Cron('30 0 * * *')`
- `TaskCheckpoint WHERE status='pending' AND plannedDate < TODAY`
- → `status='overdue'` + 通知提交人（worker） & reviewer（企业）
- worker 端通过现有 comp-notification 一端入库；WX 模板消息留给 notify_dispatcher（5.4 也是）

### 5.4 日报缺失 — `@Cron('0 9 * * *')`
- 对所有 `in_progress` 任务的 `roleAssignment`：
  - 最近 3 个自然日（不含周末）都没有 `ProgressUpdate` → 通知
  - 企业 PM 收 `daily_missing` 通知（batched 每任务一条）

### 5.5 里程碑到期 — `@Cron('30 0 * * *')`
- `Milestone WHERE status='pending'`
  - `plannedDate - NOW ≤ 3 days` 且未发送过提醒 → 通知负责人（T-3）
  - `plannedDate < NOW` → `status='overdue'` + 红色通知

### 5.6 通知清理 — `@Cron('0 2 * * *')`
- 复用 `CompanyNotificationService.cleanup()`（已实现 90 天 + 999 条 MAX_UNREAD）
- 若未实现 per-user 999 限制则本次补

### 5.7 项目阶段自动流转
- 在 `TaskService.updateStatus` / `updateProgress` 后调用 `ProjectService.syncPhaseFromTasks(projectId)`
  - 任一任务 `in_progress` → `project.phase='execution'`（如果当前是 `requirement`）
  - 所有任务 `completed` → `project.phase='acceptance'`（如果当前是 `execution`）
- **取舍**: 不加 `phaseManuallySet` 字段（schema 没有，避免再开 Phase 1 migration）。采用**单调前进**：已是更后阶段则不回退，若企业手动回退则 cron 不 override。文档化此行为。

## 微信订阅消息（WX subscribe message）

PRD 说"复用现有 7 模板"。但搜索发现 backend **没有任何 WX 订阅消息发送代码**。这是一个**更大的子工程**（需 appSecret、access_token 缓存、模板 ID 配置、send-record 去重等），本 Phase **不实现**。

改采**抽象接口**策略：
- 新建 `NotifyDispatcherService`（stub）暴露 `dispatch(notification)` 方法
- 当前实现：仅写 `company_notification` 表（前端轮询消费，已在 Phase 3 接好）
- TODO 预留 provider 扩展点：`@Inject('WX_NOTIFY')` 可注入未来的 WX 实现

Phase 7 联调时若 WX 模板已就绪（独立 ticket），只需替换 provider 实现。

## 不做

- WX 模板消息真实发送 — 独立 ticket
- WebSocket 实时推送 — Phase 7 评估
- 埋点事件写入 — Phase 6

## 验证

1. `nest build` 通过
2. smoke-v3.7.ts 扩展 [15][16][17][18]：触发各 cron 的 `runOnce()` 方法，验证：
   - 5.1 风险等级变化写入 + 通知
   - 5.3 检查点超期改状态
   - 5.5 里程碑超期改状态
   - 5.6 90 天外通知删除
3. 其它（5.2 SLA / 5.4 日报缺失）编写单测难度大，**仅做 static smoke**：实例化服务后直接调 runOnce() 不报错即可

## Commit

- `feat(v3.7): Phase 5 Cron 自动化 + 项目阶段流转 + ScheduleModule 注册`
