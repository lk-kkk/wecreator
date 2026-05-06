# Phase 3 前端（企业端 PC）收尾

## 现状盘点（已完成 ~80%）

| Step | 状态 | 证据 |
|---|---|---|
| 3.1 任务信息增强 | ✅ | `TaskCreatePage.vue` 已有优先级/验收标准；`TaskListPage.vue` 已加 taskNo/priority/riskLevel 列+筛选 |
| 3.2 项目看板页 | ✅ | `ProjectListPage.vue` 已有 list/board 双视图 + 三色预警卡片；路由 `/project/board` 已就位 |
| 3.3 里程碑组件 | ✅ | `ProjectDetailPage.vue` 已有里程碑 timeline + 新增弹窗 + 一键完成 |
| 3.4 项目表单增强 | ✅ | `expectedDeliveryDate` 已展示，状态扩展在 `ProjectListPage` 筛选已含 |
| 3.5 任务详情（中栏） | ✅ | `TaskCheckpointPanel / TaskProgressLogPanel / DeliverableVersionBrowser` 均已挂载 |
| 3.6 讨论 Tab + 问题 | ✅ | `TaskCommentsPanel / TaskIssuesPanel` 均已挂载 |
| **3.7 通知中心** | 🔴 **缺口** | 路径错误 + 未接未读徽标 + 无 NotificationBell popover + 无轮询 |

## 3.7 具体改动（Execute 模式直接修改）

### A. 修复 API 路径 (`apps/pc-admin/src/api/notification.ts`)

前端全部用的 `/notifications/*`，但后端 V3.7 controller 是 `/company-notifications/*`，且 `markAllRead` 和批量已读都走同一个 `PUT /read`（body 不同）。

重写成：

| 方法 | 路径 | body |
|---|---|---|
| `list(params)` | `GET /company-notifications` | query `page/pageSize/type/isRead` |
| `unreadCount()` | `GET /company-notifications/unread-count` | — |
| `markRead(ids)` | `PUT /company-notifications/read` | `{ ids: number[] }` |
| `markAllRead()` | `PUT /company-notifications/read` | `{ all: true }` |

返回类型：`list` 字段（不是 `items`），含 `{ total, unread, page, pageSize, list }`。

### B. 新建 `components/layout/NotificationBell.vue`

- 🔔 图标 + `<a-badge :count="unread">`
- 点击触发 `<a-popover>` 展示最近 10 条未读（`list({ pageSize: 10, isRead: false })`）
- 每条点击：调 `markRead([id])` → 跳转 `refType/refId` 对应页面
- Popover 底部"查看全部"→ `/notifications`
- 30 秒轮询 `unreadCount`，组件卸载时 `clearInterval`

### C. 替换 `MainLayout.vue` 中硬编码 bell

把现在的 `<a-badge :count="0"><bell-outlined/></a-badge>` 替换为 `<NotificationBell />`。

### D. 修正 `NotificationPage.vue`

- 把 `res?.items` 改为 `res?.list`
- tab 切换时真正传 `type` / `isRead` 给后端（当前是前端 computed 过滤，100 条上限不够；保守做法是保留前端过滤，但改成 pageSize 200 并 TODO 接分页）
- 底部加分页组件
- 逐条已读用 `markRead([id])`

### E. 本地验证

前端 `pnpm --filter pc-admin build` 通过即可（后端 smoke 已绿，E2E 联调放到 Phase 7）。

### F. 提交

1 个 commit：
`feat(v3.7): Phase 3 通知中心对接 V3.7 company-notifications`

## 不做的事

- 不做 WebSocket 实时推送（PRD 允许 30s 轮询作为降级方案，Phase 5 Cron 联调再补）
- 不补 Storybook / 单测（PRD 验收项但 Phase 7 再统一做）
- 不改项目/任务详情页已经 working 的组件（避免引入回归）

## 影响面 & 风险

- **API 返回字段 `list` vs `items`** — NotificationPage 当前解析错，但因为企业通知历来是空的，用户感知不到。修正后有可能暴露其它潜在字段不一致 → 我在改动里会 dump 一次接口 raw response 做 sanity check。
- **顶栏 bell 轮询** — 每 30s 一次 `unreadCount`（纯计数，响应小），无显著负载。
- **未读徽标 99+** — 用 `<a-badge :count="unread" :overflow-count="99">`。
