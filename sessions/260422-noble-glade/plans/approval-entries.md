# 审批入口三合一：列表徽标 + 工作台待办卡 + 独立审批中心

> 目标：把分散在任务详情页里的三类审批（报名申请 / 检查点 / 交付物），通过"统一聚合 + 多入口跳转"的方式浮出水面。

## 一、后端（新增 1 个聚合接口）

### `GET /api/v1/approvals/summary` — 待办聚合

作用：一次拉回当前企业账号下三类待办的总数 + 每类 Top N 条（点击可直达任务详情并锚定 Tab）。

返回：

```jsonc
{
  "counts": {
    "applications": 3,      // pending 状态的报名申请
    "checkpoints":  2,      // status=submitted 的检查点
    "deliverables": 4       // 含 file 且 status=submitted / pending 的交付物
  },
  "items": {
    "applications": [
      { "applicationId": 12, "taskId": 18, "taskNo": "TSK-...", "taskTitle": "...",
        "workerId": 9, "workerName": "李康", "createdAt": "..." }
    ],
    "checkpoints": [
      { "checkpointId": 5, "taskId": 18, "taskNo": "...", "taskTitle": "...",
        "name": "初稿提交", "submittedAt": "..." }
    ],
    "deliverables": [
      { "deliverableId": 7, "taskId": 18, "taskRoleId": 3, "taskTitle": "...",
        "fileName": "...", "version": 2, "submittedAt": "..." }
    ]
  }
}
```

### 实现位置

新建模块 `apps/backend/src/modules/approval/` —
- `approval.controller.ts`（1 个 GET 路由）
- `approval.service.ts`（3 段 prisma 查询）
- `approval.module.ts`
- 在 `app.module.ts` 引入

**鉴权**：`JwtAuthGuard` + `userType === 'company'`，过滤规则：
- applications：`taskRole.task.companyId = user.companyId` AND `status=pending`
- checkpoints：`task.companyId = user.companyId` AND `status='submitted'`
- deliverables：`task.companyId = user.companyId` AND `status='submitted'`

各类按 `submittedAt / createdAt DESC` 各取 Top 20。

## 二、前端 PC（3 处联动）

### 2.1 新增「审批中心」菜单 + 页面

- 路由：`/approval`（`views/approval/ApprovalCenterPage.vue`）
- 菜单：`MainLayout.vue` 插入在「争议管理」上方，icon `audit-outlined`
- 页面结构：顶部 3 个 Tab
  1. **📝 报名审批**（applications）
  2. **📋 检查点审核**（checkpoints）
  3. **📦 交付物验收**（deliverables）
- 每个 Tab 表格：任务编号 / 任务名 / 关键字段 / 提交时间 / 操作
- 操作：
  - 报名 → 内嵌 `通过/婉拒`（调现有 `applicationApi.review`）
  - 检查点 → 弹窗通过/退回（调 `checkpointApi.review`）
  - 交付物 → 弹窗验收通过/退回（调 `taskApi.review`）
- 任意操作成功后 `emit('updated')` 重新拉 summary，并广播事件让 Dashboard / Task 列表刷新（通过 `window.dispatchEvent(new CustomEvent('approval:updated'))`）

### 2.2 Dashboard 顶部「待办聚合卡」

- 位于 KPI 卡下方、图表行上方
- 3 个小卡片：报名 / 检查点 / 交付物，展示总数 + "查看" 按钮
- 点击 → `router.push('/approval?tab=<type>')`
- 挂载时 `approvalApi.summary()` 拉数据；监听 `approval:updated` 事件自动刷新

### 2.3 任务列表行徽标

- 在 `TaskListPage.vue` 的列里，把 `任务名称` 单元格旁或 `操作` 列前新增一个只读列 `待办`
- 单元格用 3 个小 `a-badge` 紧凑展示：
  ```
  📝3  📋2  📦1
  ```
  数字为 0 时不显示
- **数据来源**：前端拿到列表后，再 batch 调 `approvalApi.summary()` 一次，在前端按 taskId 聚合到每一行（避免改列表接口）

## 三、API 前端封装

新建 `apps/pc-admin/src/api/approval.ts`：

```ts
export const approvalApi = {
  summary: () => request.get<any, ApprovalSummary>('/approvals/summary'),
}
```

## 四、变更清单

| # | 文件 | 动作 |
|---|------|------|
| 1 | `apps/backend/src/modules/approval/approval.service.ts` | 新建 |
| 2 | `apps/backend/src/modules/approval/approval.controller.ts` | 新建 |
| 3 | `apps/backend/src/modules/approval/approval.module.ts` | 新建 |
| 4 | `apps/backend/src/app.module.ts` | import + providers |
| 5 | `apps/pc-admin/src/api/approval.ts` | 新建 |
| 6 | `apps/pc-admin/src/router/index.ts`（或路由文件） | 加 `/approval` |
| 7 | `apps/pc-admin/src/layouts/MainLayout.vue` | 菜单项 |
| 8 | `apps/pc-admin/src/pages/approval/ApprovalCenterPage.vue` | 新建 |
| 9 | `apps/pc-admin/src/pages/dashboard/DashboardPage.vue` | 插入待办卡 |
| 10 | `apps/pc-admin/src/pages/task/TaskListPage.vue` | 加徽标列 |

## 五、验证路径

1. 用企业账号登录 → 侧边栏出现「审批中心」
2. Dashboard 顶部 3 个数字和点击跳转正常
3. 任务列表每行出现 `📝N 📋N 📦N` 徽标
4. 审批中心操作（通过/退回）后数字正确下降，详情页同步
5. `tsc --noEmit` 两端都过

---

准备好后直接动手，预计 10-15 分钟。
