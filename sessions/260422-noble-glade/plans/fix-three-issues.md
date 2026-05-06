# 修复三个逻辑问题

排查后三个问题的根因都已经定位清楚，本计划给出针对性修复。

---

## 问题 1 — 小程序服务广场看不到"被邀约企业"的任务

### 根因

后端 `GET /marketplace/tasks` 严格按 **V3.4 零工库模型** 过滤：只返回 `CompanyWorkerPool` 中存在关系的企业的任务（见
[`apps/backend/src/modules/task/marketplace.controller.ts`](apps/backend/src/modules/task/marketplace.controller.ts) 的 `getPoolCompanyIds` + `companyId: { in: companyIds }`）。

但是在 [`apps/backend/src/modules/assignment/assignment.service.ts`](apps/backend/src/modules/assignment/assignment.service.ts) 的 `inviteWorker` 方法里，企业直接向某个零工发起邀约时**只创建了 `roleAssignment`，没有把该零工写入企业的零工库**。

结果：零工收到邀约 → 进入小程序 → 服务广场完全是空的（连邀约自己的企业都搜不到），
因为零工库为空 → `companyIds.length === 0` → 直接返回 `hint: 您尚未被企业纳入零工库`。

### 修复方案

在 `inviteWorker` 里，**校验完槽位后、创建 assignment 的同一事务中，upsert 一条 `CompanyWorkerPool`**（`inviteStatus` 取已有值或 `registered`，来源标记为 `invited`）。

关键点：
- 用 `upsert`，避免重复邀约 / 已在池中时报错
- 放在事务里以保持与 assignment 原子性
- 不覆盖已有的 `verified` 状态（已在库里的零工不降级）

伪代码：
```ts
await this.prisma.$transaction(async (tx) => {
  await tx.companyWorkerPool.upsert({
    where: { companyId_workerId: { companyId: BigInt(companyId), workerId: BigInt(workerId) } },
    create: {
      companyId: BigInt(companyId),
      workerId: BigInt(workerId),
      inviteStatus: 'registered',  // 触发后默认进入
      source: 'invited',
    },
    update: {},  // 已存在则不变
  });
  await tx.roleAssignment.create({ ... });
});
```

同时在 `TaskApplicationController.reviewApplication` 的 `approved` 分支也补一把 upsert（申请通过也应保证在零工库里）——不过申请本身就只对在零工库的零工开放，这里更多是兜底。

### 可能的后续优化（本计划外）

- 企业取消邀约 / 零工拒绝后是否要从池中移除？按 V3.4 语义不应移除（曾合作过的零工保留）
- 小程序在"已被邀约"列表页加一个"来看看企业主页"入口，但这是产品优化

---

## 问题 2 — 企业管理平台新建完任务后不能编辑

### 根因

后端 `PUT /tasks/:id/draft`、`POST /tasks/:id/roles` 等接口**已经存在**，
前端 [`TaskCreatePage.vue`](apps/pc-admin/src/pages/task/TaskCreatePage.vue) 也已经支持 `?id=xxx`
来加载草稿（见 `onMounted` 里的 `route.query.id` → `loadDraft`）。

唯一缺的是 [`TaskListPage.vue`](apps/pc-admin/src/pages/task/TaskListPage.vue)
**操作列没有"编辑"按钮**——只有"详情"和"验收"。草稿状态任务无法进入编辑页。

### 修复方案

在 `TaskListPage.vue` 的操作列，针对 `draft` / `pending_review` 状态增加"编辑"按钮，
路由到 `/task/create?id={taskId}`：

```vue
<a-button
  v-if="record.status === 'draft' || record.status === 'pending_review'"
  type="link" size="small"
  @click="$router.push(`/task/create?id=${record.taskId}`)"
>编辑</a-button>
```

同时把任务详情抽屉中，草稿状态也加一个"去编辑"按钮，方便从详情跳转。

### 额外健壮性

`loadDraft` 当前失败会跳 `/task/square`，加一条 toast 说明——原代码已有 `message.error('加载草稿失败')`，OK。

---

## 问题 3 — 新建项目后列表依然是空的

### 根因

[`apps/pc-admin/src/api/request.ts`](apps/pc-admin/src/api/request.ts) 的响应拦截器会**统一 unwrap**：

```ts
if (body && typeof body === 'object' && 'code' in body) {
  if (body.code !== 0) return Promise.reject(...)
  return body.data   // 🔑 已经返回业务数据本体
}
```

所以调用方拿到的 `res` 就是 `{ list, total, page, pageSize }`。

但是 [`ProjectListPage.vue`](apps/pc-admin/src/pages/project/ProjectListPage.vue) 写成了：

```ts
list.value = res.data?.list || []       // ❌ 多了一层 .data
total.value = res.data?.total || 0      // ❌
boardData.value = res.data || []         // ❌
managerOptions.value = (res.data || []).map(...)  // ❌
```

所以 `list` 永远是空数组，新建项目之后刷新依然看不到。

同样的问题还波及：
- [`ProjectDetailPage.vue`](apps/pc-admin/src/pages/project/ProjectDetailPage.vue) 的 `fetchProject`
- [`DailyTaskDetail.vue`](apps/pc-admin/src/pages/task/DailyTaskDetail.vue) 的详情和打卡列表

### 修复方案

把这些文件里**所有** `res.data.xxx` / `res.data` 改为直接使用 `res.xxx` / `res`：

#### ProjectListPage.vue

```diff
- const res = await request.get('/admin/subaccounts')
- managerOptions.value = (res.data || []).map(...)
+ const res: any = await request.get('/admin/subaccounts')
+ managerOptions.value = (res || []).map(...)

- const res = await request.get('/projects', { params })
- list.value = res.data?.list || []
- total.value = res.data?.total || 0
+ const res: any = await request.get('/projects', { params })
+ list.value = res?.list || []
+ total.value = res?.total || 0

- const res = await request.get('/projects/board')
- boardData.value = res.data || []
+ const res: any = await request.get('/projects/board')
+ boardData.value = res || []
```

#### ProjectDetailPage.vue

```diff
- const res = await request.get(`/projects/${projectId}`)
- project.value = res.data
- milestones.value = res.data?.milestones || []
+ const res: any = await request.get(`/projects/${projectId}`)
+ project.value = res
+ milestones.value = res?.milestones || []
```

#### DailyTaskDetail.vue

```diff
- task.value = res.data
- assignments.value = res.data?.roles?.flatMap(...)
- role.value = res.data?.roles?.[0]
+ task.value = res
+ assignments.value = res?.roles?.flatMap(...)
+ role.value = res?.roles?.[0]

- checkins.value     = res.data.list
- checkinTotal.value = res.data.total
+ checkins.value     = res?.list ?? []
+ checkinTotal.value = res?.total ?? 0
```

---

## 涉及文件清单

| # | 文件 | 动作 |
|---|------|------|
| 1 | `apps/backend/src/modules/assignment/assignment.service.ts` | 修改 `inviteWorker`：事务化 + upsert 零工库 |
| 2 | `apps/pc-admin/src/pages/task/TaskListPage.vue` | 操作列 + 详情抽屉：新增"编辑"按钮（仅草稿态） |
| 3 | `apps/pc-admin/src/pages/project/ProjectListPage.vue` | 去掉多余的 `.data` 层级 |
| 4 | `apps/pc-admin/src/pages/project/ProjectDetailPage.vue` | 去掉多余的 `.data` 层级 |
| 5 | `apps/pc-admin/src/pages/task/DailyTaskDetail.vue` | 去掉多余的 `.data` 层级 |

---

## 验证步骤

修复后建议验证：

1. **小程序服务广场**
   - 企业 A 邀约零工 W → 检查 DB：`CompanyWorkerPool(A, W)` 应存在
   - 零工 W 打开服务广场 → 能看到企业 A 发布的 `published` 任务
   - 零工 W 之前已在企业 B 的库里 → 能同时看到 A 和 B 的任务

2. **任务编辑**
   - 任务列表"草稿"Tab：每一行操作列应出现「编辑」按钮
   - 点击 → 跳到 `/task/create?id=xxx`，原数据正确回显
   - 修改后点「保存草稿」或「立即发布」应成功

3. **项目列表**
   - 点击「新建项目」→ 填写名称 → 确认
   - 弹窗关闭后列表应立刻出现新项目（`fetchList` 成功拿到 `list`）
   - 切到「看板」也能看到同一项目
   - 点进项目详情：基本信息、里程碑正常加载
