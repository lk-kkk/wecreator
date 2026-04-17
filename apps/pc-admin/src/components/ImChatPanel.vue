<template>
  <a-card :title="`与 ${workerName} 的对话`" :bordered="false" class="im-panel">
    <template #extra>
      <span class="task-hint">{{ taskTitle }}</span>
    </template>

    <!-- 消息列表 -->
    <div ref="msgListRef" class="msg-list">
      <template v-for="msg in messages" :key="msg._id || msg.tempId">
        <div :class="['msg-row', msg.senderId === currentUserId ? 'msg-self' : 'msg-other']">
          <a-avatar :size="28" class="msg-avatar">{{ msg.senderType === 'company' ? '企' : '工' }}</a-avatar>
          <div class="msg-bubble">
            <span class="msg-content">{{ msg.content }}</span>
            <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
          </div>
        </div>
      </template>
      <div v-if="messages.length === 0" class="empty-msg">暂无消息，发送第一条吧～</div>
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
      <a-button type="primary" @click="sendMessage" :disabled="!inputText.trim()">发送</a-button>
    </div>
  </a-card>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
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
  props.conversation.assignment.workerName || `零工#${props.conversation.assignment.workerId}`
)

const messages = ref<any[]>([])
const inputText = ref('')
const msgListRef = ref<HTMLElement | null>(null)
let socket: Socket | null = null
let conversationId: number | null = null

// 加载历史消息
async function loadHistory() {
  try {
    // 获取会话列表，找到匹配当前零工+任务的会话
    const res = await request.get<any, any>('/conversations')
    const convList = res.data ?? res
    const conv = convList.find(
      (c: any) => c.taskId === props.conversation.taskId &&
        c.workerId === props.conversation.assignment.workerId
    )
    if (conv) {
      conversationId = conv.id
      const hRes = await request.get<any, any>(`/conversations/${conv.id}/messages`)
      messages.value = hRes.data ?? hRes
    }
  } catch {}
}

// 连接 WebSocket
function connectWs() {
  const token = localStorage.getItem('wc_access_token')
  if (!token) return
  socket = io(`${import.meta.env.VITE_API_BASE?.replace('/api/v1', '') || 'http://localhost:3000'}/chat`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })
  socket.on('new_message', (msg: any) => {
    messages.value.push(msg)
    scrollToBottom()
  })
}

function sendMessage() {
  if (!inputText.value.trim() || !socket) return
  const tempId = `temp-${Date.now()}`
  const payload = {
    conversationId,
    receiverId: props.conversation.assignment.workerId,
    content: inputText.value.trim(),
    taskId: props.conversation.taskId,
  }
  // 乐观 UI
  messages.value.push({
    tempId,
    senderId: currentUserId.value,
    senderType: 'company',
    content: payload.content,
    createdAt: new Date().toISOString(),
  })
  socket.emit('send_message', payload)
  inputText.value = ''
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (msgListRef.value) {
      msgListRef.value.scrollTop = msgListRef.value.scrollHeight
    }
  })
}

function formatTime(ts: string) {
  return dayjs(ts).format('HH:mm')
}

onMounted(async () => {
  await loadHistory()
  connectWs()
  scrollToBottom()
})

onUnmounted(() => {
  socket?.disconnect()
})

watch(() => props.conversation, async () => {
  messages.value = []
  socket?.disconnect()
  await loadHistory()
  connectWs()
})
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
.msg-self {
  flex-direction: row-reverse;
}
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
  font-size: 13px;
  line-height: 1.5;
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
.empty-msg { text-align: center; color: #ccc; font-size: 13px; margin-top: 40px; }
</style>
