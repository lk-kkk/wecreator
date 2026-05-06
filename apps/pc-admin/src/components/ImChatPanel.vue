<template>
  <a-card :title="`与 ${workerName} 的对话`" :bordered="false" class="im-panel">
    <template #extra>
      <span class="task-hint">{{ taskTitle }}</span>
    </template>

    <!-- 消息列表 -->
    <div ref="msgListRef" class="msg-list">
      <a-spin v-if="loading && messages.length === 0" style="display:block;text-align:center;margin-top:40px" />
      <template v-for="msg in messages" :key="msg.id || msg.tempId">
        <div :class="['msg-row', isSelfMsg(msg) ? 'msg-self' : 'msg-other']">
          <a-avatar :size="28" class="msg-avatar">{{ msg.senderType === 'company' ? '企' : '工' }}</a-avatar>
          <div class="msg-bubble">
            <span class="msg-content">{{ msg.content }}</span>
            <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
          </div>
        </div>
      </template>
      <div v-if="!loading && messages.length === 0" class="empty-msg">暂无消息，发送第一条吧～</div>
    </div>

    <!-- 输入框 -->
    <div class="input-area">
      <a-textarea
        v-model:value="inputText"
        :rows="2"
        placeholder="输入消息..."
        :auto-size="{ minRows: 2, maxRows: 4 }"
        @pressEnter.prevent="sendMessage"
      />
      <a-button type="primary" @click="sendMessage" :disabled="!inputText.trim() || sending || !conversationId">
        发送
      </a-button>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import dayjs from 'dayjs'
import { useUserStore } from '@/stores/user'
import request from '@/api/request'

const props = defineProps<{
  conversation: { assignment: any; role: any; taskId: number }
  taskTitle: string
}>()

const userStore = useUserStore()
const currentUserId = computed(() => userStore.userId)
const workerName = computed(() =>
  props.conversation.assignment.workerName
    || props.conversation.assignment.realName
    || `零工#${props.conversation.assignment.workerId}`
)

const messages = ref<any[]>([])
const inputText = ref('')
const msgListRef = ref<HTMLElement | null>(null)
const sending = ref(false)
const loading = ref(false)
let conversationId: number | null = null
let pollTimer: number | null = null

const POLL_INTERVAL_MS = 5000

function isSelfMsg(msg: any) {
  if (msg.senderType) return msg.senderType === 'company'
  return msg.senderId === currentUserId.value
}

// ── 打开/获取会话 ──────────────────────────────────────
async function ensureConversation() {
  const res: any = await request.post('/conversations/open', {
    taskId: props.conversation.taskId,
    workerId: props.conversation.assignment.workerId,
  })
  conversationId = res?.id ?? null
  if (!conversationId) throw new Error('会话初始化失败')
}

// ── 加载历史消息 ─────────────────────────────────────
async function loadHistory(silent = false) {
  if (!conversationId) return
  if (!silent) loading.value = true
  try {
    const res: any = await request.get(`/conversations/${conversationId}/messages`, {
      params: { page: 1, pageSize: 50 },
    })
    // 后端返回 { list, total, page, pageSize }，按 createdAt 降序
    const list = (res?.list ?? []).slice().reverse()
    // 保留尚未回收的乐观消息（tempId 存在且没有对应的正式消息）
    const pending = messages.value.filter(m => m.tempId && !list.some((s: any) => s.content === m.content && s.senderType === m.senderType))
    messages.value = [...list, ...pending]
    scrollToBottom()
  } catch (err: any) {
    if (!silent) antMessage.error(err?.response?.data?.message || err?.message || '加载历史消息失败')
  } finally {
    if (!silent) loading.value = false
  }
}

// ── 发送消息（HTTP）─────────────────────────────────────
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text) return
  if (!conversationId) {
    antMessage.warning('会话初始化中，请稍候')
    return
  }
  const tempId = `temp-${Date.now()}`
  // 乐观 UI
  messages.value.push({
    tempId,
    conversationId,
    senderId: currentUserId.value,
    senderType: 'company',
    content: text,
    createdAt: new Date().toISOString(),
  })
  inputText.value = ''
  scrollToBottom()

  sending.value = true
  try {
    const res: any = await request.post(`/conversations/${conversationId}/messages`, {
      content: text,
      type: 'text',
    })
    // 用服务端返回的正式消息替换乐观气泡
    const idx = messages.value.findIndex(m => m.tempId === tempId)
    if (idx >= 0 && res) messages.value[idx] = res
  } catch (err: any) {
    // 回滚乐观 UI
    messages.value = messages.value.filter(m => m.tempId !== tempId)
    antMessage.error(err?.response?.data?.message || err?.message || '发送失败')
  } finally {
    sending.value = false
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (msgListRef.value) msgListRef.value.scrollTop = msgListRef.value.scrollHeight
  })
}

function formatTime(ts: string) {
  return ts ? dayjs(ts).format('MM-DD HH:mm') : ''
}

function startPoll() {
  stopPoll()
  pollTimer = window.setInterval(() => loadHistory(true), POLL_INTERVAL_MS)
}
function stopPoll() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

async function bootstrap() {
  stopPoll()
  messages.value = []
  conversationId = null
  try {
    await ensureConversation()
    await loadHistory(false)
    startPoll()
  } catch (err: any) {
    antMessage.error(err?.response?.data?.message || err?.message || '会话初始化失败')
  }
}

onMounted(bootstrap)
onUnmounted(stopPoll)

watch(
  () => [props.conversation?.taskId, props.conversation?.assignment?.workerId],
  () => { bootstrap() },
)
</script>

<style scoped>
.im-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}
:deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  overflow: hidden;
}
.msg-list {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}
.msg-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  margin-bottom: 8px;
}
.msg-self { flex-direction: row-reverse; }
.msg-bubble {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}
.msg-self .msg-bubble { align-items: flex-end; }
.msg-content {
  background: #fff;
  border: 1px solid var(--color-border);
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}
.msg-self .msg-content {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.msg-time {
  font-size: 11px;
  color: #bbb;
  margin-top: 2px;
}
.input-area {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}
.input-area .ant-btn { flex-shrink: 0; }
.task-hint { font-size: 12px; color: #999; max-width: 120px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.empty-msg { text-align: center; color: #ccc; font-size: 12px; margin-top: 40px; }
</style>
