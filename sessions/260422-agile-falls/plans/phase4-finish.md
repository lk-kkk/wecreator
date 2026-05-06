# Phase 4 零工端小程序 — 收尾

## 现状盘点（本地已完成 ~90%）

| Step | 状态 | 证据 |
|---|---|---|
| 4.1 工作日报增强 | ✅ | `execute/index.tsx` 已含 dailySummary(50-500) / tomorrowPlan / issues + 提交 payload |
| 4.2 检查点提交 | ✅ | `checkpoint-submit/index.tsx` 列表+提交表单+状态展示 |
| 4.3 问题上报 | ✅ | `issue-report/index.tsx` 列表+上报表单+企业回复展示 |
| 4.4 评论/讨论 | ✅ | `comments/index.tsx` 嵌套评论+发送+重要高亮 |
| `app.config.ts` 路由注册 | ✅ | 3 个新页面已在子包路由 |
| `execute/index.tsx` 底部入口 | ✅ | 3 个按钮导航到新页面 |

## 缺口

### A. comments 页字段 bug (🔴 必修)

后端 `CommentService.list` 返回 `{ list, total }`，但前端用 `payload.items` → 评论**永远加载为空**。

改 `comments/index.tsx`:
```diff
- setAll(payload.items || payload || [])
+ setAll(payload.list || payload.items || payload || [])
```

### B. "我的任务"列表 ⚠️ 未解决问题图标 (Step 4.3 验收项)

**后端**: `AssignmentService.getWorkerTasks` 返回值聚合 `unresolvedIssueCount`（按 taskId 查 TaskIssue status in ('open','in_progress')）。

**前端** `pages/index/index.tsx` 任务卡片上，`unresolvedIssueCount > 0` 时右上角显示 `⚠️ N`。

### C. `task.ts` API 层补齐 `updateProgress` 日报字段 (🟡 收拢)

把 execute 页绕过的直 request 调用统一回 `taskApi.updateProgress(assignmentId, { progress, note, dailySummary, tomorrowPlan, issues })`，避免之后零散改动难以追溯。

### D. 订阅消息模板 (🟡 存量复用)

PRD 说"复用现有 7 模板中的评论提醒或新增"。后端 Phase 2 已在 `comment.service.ts` 写入 `company_notification`，WX 订阅消息发送走现有 `wx.subscribeMessage` 链路（属 Phase 5 范围），本 phase 不做。

## 不做

- 零工端任务详情页新加「讨论」Tab（execute 页底部已有按钮跳转 comments 页，重复实现无价值；Phase 7 联调再评估）
- 订阅消息新模板（Phase 5）

## 验证

- `pnpm --filter worker-mp build:weapp` 编译通过
- 后端：`nest build` 通过，可选跑一次 smoke 确认 `getWorkerTasks` 字段不破坏
