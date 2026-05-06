# 修复：消息发送 + 任务编号显示

## 问题 1：PC 企业端点"消息"发不出去，小程序收不到

### 根因（三件事叠加）

1. **前端 token key 写错**
   [`apps/pc-admin/src/components/ImChatPanel.vue`](apps/pc-admin/src/components/ImChatPanel.vue) 里用的是 `localStorage.getItem('wc_access_token')`，
   但 `request.ts`、登录流程里存的一直是 **`wc_token`**。
   结果 `token` 永远是 `null`，`io()` 时 `auth.token` 缺失，服务端网关判定 `401 Unauthorized` 直接 disconnect。

2. **后端没有"开启/获取会话"的 HTTP 接口**
   网关里 `handleSendMessage` 要求 `dto.conversationId`。但 `MessageController` 只有
   `GET /conversations`（列表）和 `GET /conversations/:id/messages`（历史）两个接口。
   企业第一次给零工发消息时根本没有会话，前端 `loadHistory` 里 `convList.find(...) === undefined` →
   `conversationId` 一直是 `null` → emit `send_message { conversationId: null }` →
   网关 `getConversationById(null) === null` → 抛 `WsException('Conversation not found')`，消息永远发不出去。

3. **零工名显示问题（次要）**
   `ImChatPanel` 里 `props.conversation.assignment.workerName` 其实没拼上，标题显示异常，
   但不影响发送。修复时顺手整理。

### 修复方案

#### 后端

在 [`apps/backend/src/modules/message/message.controller.ts`](apps/backend/src/modules/message/message.controller.ts) 增加：

```ts
@Post('open')
@ApiOperation({ summary: '打开或创建会话（企业→零工主动发起）' })
async openConversation(
  @CurrentUser() user: JwtPayload,
  @Body() dto: { taskId: number; workerId?: number; companyUserId?: number },
) {
  // 仅企业端可打开（需 companyUserId=当前用户）
  if (user.userType !== 'company') {
    throw new ForbiddenException('仅企业用户可主动创建会话');
  }
  if (!dto.workerId) throw new BadRequestException('缺少 workerId');
  
  const conv = await this.messageService.getOrCreateConversation(
    BigInt(dto.taskId),
    BigInt(user.userId),
    BigInt(dto.workerId),
  );
  return {
    id: Number(conv.id),
    taskId: Number(conv.taskId),
    companyUserId: Number(conv.companyUserId),
    workerId: Number(conv.workerId),
    lastMsgAt: conv.lastMsgAt,
  };
}
```

额外兜底：[`message.gateway.ts`](apps/backend/src/modules/message/message.gateway.ts)
的 `handleSendMessage` 对 `conversationId` 做强类型校验，若缺失或非数字则返回 ack
`{ success: false, error: '缺少会话ID' }` 而不是抛异常（便于前端提示）。

#### PC 前端 `ImChatPanel.vue`

改造 `loadHistory` + `connectWs` 流程：

```ts
async function ensureConversation() {
  const res: any = await request.post('/conversations/open', {
    taskId: props.conversation.taskId,
    workerId: props.conversation.assignment.workerId,
  })
  conversationId = res.id
  // 拉历史
  try {
    const hRes: any = await request.get(`/conversations/${conversationId}/messages`)
    messages.value = hRes?.list ?? hRes?.data?.list ?? []
  } catch { messages.value = [] }
}
```

并修复：
- token key: `wc_access_token` → `wc_token`
- `sendMessage` 里 `if (!conversationId)` 时 `message.warning('会话初始化中，请稍候')` + toast
- `socket` 连接失败时给用户提示（`connect_error` 事件）
- 新消息事件名服务端是 `NEW_MESSAGE = 'new_message'`，前端已对齐，确认无误

#### 小程序（作为接收端，主要是验证）

小程序 [`pages/message/index.tsx`](apps/worker-mp/src/pages/message/index.tsx) 
当前的 WebSocket 连接逻辑 OK（token key 正确 `wc_token`），但会话列表是懒加载的，
新建会话后零工要**下拉或重开页面**才能看到。本次先不改 UI，
只要 PC 发消息成功，后端 `redis.publish` 广播给 `workerId` 的 socket，
零工若正打开消息页就能立即收到 `new_message` 事件。

---

## 问题 2：任务前面没有任务编号

### 根因

数据库 [`Task.taskNo`](apps/backend/prisma/schema.prisma#L179) 字段存在（`TSK-YYYYMMDD-NNN`），
创建任务时 [`task.service.ts:33`](apps/backend/src/modules/task/task.service.ts#L33) 也正确调用了 `nextTaskNo()` 写入。

但 [`formatTask` 方法](apps/backend/src/modules/task/task.service.ts#L453) **没有把 `taskNo` 字段序列化出去**，
所以列表 / 详情接口返回的数据里根本不包含 `taskNo`，前端拿不到。

前端 [`TaskListPage.vue:537`](apps/pc-admin/src/pages/task/TaskListPage.vue#L537) 和
[`TaskDetailPage.vue:21-22`](apps/pc-admin/src/pages/task/TaskDetailPage.vue#L21) **UI 早就准备好**显示任务编号，
只等后端给数据。

### 修复方案

在 `formatTask` 方法返回对象中加一行：

```diff
  private formatTask(task: any) {
    return {
      taskId: Number(task.id),
+     taskNo: task.taskNo ?? null,  // V3.7 任务编号
      title: task.title,
      ...
    };
  }
```

即可。现有所有已创建的任务都已经有 taskNo（创建时写入过），
只是没返回给前端。改完重启后，列表和详情立刻显示任务编号。

---

## 涉及文件

| # | 文件 | 动作 |
|---|------|------|
| 1 | `apps/backend/src/modules/message/message.controller.ts` | +`POST /conversations/open` |
| 2 | `apps/backend/src/modules/message/message.gateway.ts` | `handleSendMessage` 参数校验兜底 |
| 3 | `apps/backend/src/modules/task/task.service.ts` | `formatTask` 加 `taskNo` 字段 |
| 4 | `apps/pc-admin/src/components/ImChatPanel.vue` | 修 token key + 主动打开会话 + 错误提示 |

## 验证步骤

1. **消息**
   - PC 端进某个任务详情/列表抽屉 → 点某个零工旁的「消息」按钮
   - 聊天面板加载出来（新会话时显示"暂无消息"）
   - 输入文字 → 回车或点「发送」 → **消息出现在自己的气泡里，不再报错**
   - 浏览器 DevTools → Network → WS 选项卡，能看到 `new_message` 事件
   - 零工在小程序「消息」Tab，能看到这个新会话（需手动刷新一次会话列表）
   - 零工保持在消息页时，后续消息会实时 push

2. **任务编号**
   - 打开 PC 端 `/task/square` → 列表的「任务编号」列显示 `TSK-20260422-001` 格式
   - 点进详情 → 顶部 V37 徽章区域显示 `#TSK-...` 标签
