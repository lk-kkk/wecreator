<template>
  <div class="msg-panel">
    <div class="panel-head">
      <span class="hint">该任务下与零工的所有沟通记录</span>
      <a-button size="small" @click="load" :loading="loading">刷新</a-button>
    </div>

    <a-empty v-if="!loading && list.length === 0" description="暂无消息记录" />

    <div v-else class="conv-list">
      <div
        v-for="conv in list"
        :key="conv.id"
        class="conv-item"
        @click="onOpen(conv)"
      >
        <a-avatar :size="36" :src="conv.workerAvatar || undefined">
          {{ (conv.workerName || '?')[0] }}
        </a-avatar>
        <div class="conv-main">
          <div class="conv-head">
            <span class="worker-name">{{ conv.workerName || `零工#${conv.workerId}` }}</span>
            <span class="role-name" v-if="conv.roleName">· {{ conv.roleName }}</span>
            <a-badge v-if="conv.unreadCount > 0" :count="conv.unreadCount" class="unread-badge" />
            <span class="last-time">{{ formatTime(conv.lastMessage?.createdAt || conv.lastMsgAt) }}</span>
          </div>
          <div class="last-msg">
            <span v-if="conv.lastMessage">
              <span v-if="conv.lastMessage.senderType === 'company'" class="from-tag">我：</span>
              {{ conv.lastMessage.type === 'text' ? conv.lastMessage.content : `[${conv.lastMessage.type}]` }}
            </span>
            <span v-else class="no-msg">暂无消息</span>
          </div>
        </div>
        <a-button type="link" size="small">打开对话</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { message as antMessage } from 'ant-design-vue'
import dayjs from 'dayjs'
import request from '@/api/request'

const props = defineProps<{
  taskId: number
  roles: any[]
}>()

const emit = defineEmits<{
  (e: 'open', payload: { workerId: number; assignment?: any; role?: any }): void
}>()

const list = ref<any[]>([])
const loading = ref(false)

// 将 conversation 匹配到当前任务的零工（补上 workerName、roleName、头像）
function enrich(conv: any) {
  for (const role of props.roles || []) {
    const a = (role.assignments || []).find((x: any) => Number(x.workerId) === Number(conv.workerId))
    if (a) {
      return {
        ...conv,
        workerName:   a.workerName || `零工#${conv.workerId}`,
        workerAvatar: a.workerAvatar || null,
        roleName:     role.roleName || '',
        assignment:   a,
        role,
      }
    }
  }
  return { ...conv, workerName: conv.workerName || `零工#${conv.workerId}`, workerAvatar: null, roleName: '' }
}

async function load() {
  loading.value = true
  try {
    const res: any = await request.get('/conversations', { params: { page: 1, pageSize: 200 } })
    const all = (res?.list ?? []) as any[]
    // 仅保留当前任务的会话
    const filtered = all.filter(c => Number(c.taskId) === Number(props.taskId))
    list.value = filtered.map(enrich)
  } catch (err: any) {
    antMessage.error(err?.response?.data?.message || err?.message || '加载消息记录失败')
  } finally {
    loading.value = false
  }
}

function onOpen(conv: any) {
  emit('open', { workerId: conv.workerId, assignment: conv.assignment, role: conv.role })
}

function formatTime(ts: string | Date | undefined | null) {
  if (!ts) return ''
  const d = dayjs(ts)
  const now = dayjs()
  if (d.isSame(now, 'day')) return d.format('HH:mm')
  if (d.year() === now.year()) return d.format('MM-DD HH:mm')
  return d.format('YYYY-MM-DD')
}

onMounted(load)
watch(() => props.taskId, load)
</script>

<style scoped>
.msg-panel { padding: 4px 0; }
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4px 8px;
}
.hint { color: #999; font-size: 12px; }
.conv-list { display: flex; flex-direction: column; gap: 4px; }
.conv-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.conv-item:hover { background: var(--color-bg-muted, #f7f7f9); border-color: var(--color-border, #eee); }
.conv-main { flex: 1; min-width: 0; }
.conv-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.worker-name { font-weight: 500; }
.role-name { color: #999; font-size: 12px; }
.unread-badge { margin-left: 4px; }
.last-time { margin-left: auto; font-size: 11px; color: #bbb; }
.last-msg {
  margin-top: 2px;
  color: #666;
  font-size: 12px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.from-tag { color: var(--color-primary, #1677ff); }
.no-msg { color: #ccc; }
</style>
