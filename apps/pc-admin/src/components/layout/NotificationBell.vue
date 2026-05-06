<!--
  NotificationBell — V3.7 §4.3 顶栏通知铃
  - Badge 显示未读数（>99 显示 99+）
  - Popover 展示最近 10 条未读，点击跳转实体并标记已读
  - 30 秒轮询 unread-count（组件卸载时清理）
-->
<template>
  <a-popover
    v-model:open="popoverOpen"
    trigger="click"
    placement="bottomRight"
    :overlay-style="{ width: '360px' }"
  >
    <template #title>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>🔔 通知</span>
        <a-button v-if="unreadCount > 0" type="link" size="small" @click="handleMarkAll">全部已读</a-button>
      </div>
    </template>

    <template #content>
      <a-spin :spinning="loading">
        <a-list
          :data-source="items"
          :locale="{ emptyText: '暂无未读通知' }"
          size="small"
        >
          <template #renderItem="{ item }">
            <a-list-item style="cursor:pointer;padding:8px 4px" @click="handleClick(item)">
              <a-list-item-meta>
                <template #avatar>
                  <a-avatar :style="{ background: typeColor(item.type), fontSize: '14px' }">
                    {{ typeIcon(item.type) }}
                  </a-avatar>
                </template>
                <template #title>
                  <span style="font-size:12px">{{ item.title }}</span>
                </template>
                <template #description>
                  <div style="font-size:12px;color:#666;line-height:1.4">
                    {{ item.content }}
                  </div>
                  <div style="font-size:11px;color:#bbb;margin-top:2px">
                    {{ formatTime(item.createdAt) }}
                  </div>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
        <div style="text-align:center;padding:8px 0;border-top:1px solid #f0f0f0;margin-top:4px">
          <a-button type="link" size="small" @click="goViewAll">查看全部通知 →</a-button>
        </div>
      </a-spin>
    </template>

    <a-tooltip title="消息通知">
      <a-badge
        :count="unreadCount"
        :overflow-count="99"
        class="header-notify"
        style="cursor:pointer"
      >
        <bell-outlined class="header-icon" />
      </a-badge>
    </a-tooltip>
  </a-popover>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BellOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { notificationApi, type Notification } from '@/api/notification'
import { analyticsApi } from '@/api/analytics'

const POLL_INTERVAL_MS = 30_000

const router = useRouter()
const popoverOpen = ref(false)
const loading = ref(false)
const unreadCount = ref(0)
const items = ref<Notification[]>([])
let pollTimer: any = null

const TYPE_META: Record<string, { color: string; icon: string }> = {
  issue_report:     { color: '#ff4d4f', icon: '⚠️' },
  risk_alert:       { color: '#faad14', icon: '🟡' },
  milestone_remind: { color: '#faad14', icon: '🏁' },
  acceptance:       { color: '#1890ff', icon: '✅' },
  task_application: { color: '#722ed1', icon: '📝' },
  checkpoint:       { color: '#13c2c2', icon: '📋' },
  comment_mention:  { color: '#722ed1', icon: '💬' },
  daily_missing:    { color: '#faad14', icon: '📝' },
  status_change:    { color: '#8c8c8c', icon: '🔄' },
}
const typeColor = (t: string) => TYPE_META[t]?.color || '#8c8c8c'
const typeIcon  = (t: string) => TYPE_META[t]?.icon  || '🔔'

function formatTime(t: string) {
  if (!t) return ''
  const d = new Date(t)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return d.toLocaleString('zh-CN')
}

async function refreshUnread() {
  try {
    const res = await notificationApi.unreadCount()
    unreadCount.value = res?.count ?? 0
  } catch {
    // 静默失败：避免顶栏弹 toast 骚扰
  }
}

async function loadRecent() {
  loading.value = true
  try {
    const res = await notificationApi.list({ page: 1, pageSize: 10, isRead: false })
    // 报名审批已移至工作台待办，铃铛不再展示
    items.value = (res?.list ?? []).filter(n => n.type !== 'task_application')
    unreadCount.value = res?.unread ?? unreadCount.value
  } catch (e: any) {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function handleClick(n: Notification) {
  analyticsApi.track({ event: 'notification_click', refType: n.refType || 'notification', refId: n.refId ?? n.id, props: { type: n.type } })
  try {
    await notificationApi.markRead([n.id])
  } catch {
    // 即使标记失败也继续跳转
  }
  popoverOpen.value = false
  unreadCount.value = Math.max(0, unreadCount.value - 1)
  items.value = items.value.filter(i => i.id !== n.id)

  // 跳转到关联实体
  if (n.refType === 'task_application' && n.refId) {
    router.push(`/task/${n.refId}`)
  } else if (n.refType === 'task' && n.refId) {
    router.push(`/task/${n.refId}`)
  } else if (n.refType === 'project' && n.refId) {
    router.push(`/project/${n.refId}`)
  } else {
    router.push('/notifications')
  }
}

async function handleMarkAll() {
  try {
    await notificationApi.markAllRead()
    unreadCount.value = 0
    items.value = []
    message.success('全部标记已读')
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function goViewAll() {
  popoverOpen.value = false
  router.push('/notifications')
}

// 打开 popover 时拉取最新 10 条未读
watch(popoverOpen, (open) => {
  if (open) loadRecent()
})

onMounted(() => {
  refreshUnread()
  pollTimer = setInterval(refreshUnread, POLL_INTERVAL_MS)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.header-icon { font-size: 18px; color: var(--color-text-secondary); }
.header-icon:hover { color: var(--color-primary); }
.header-notify { display: flex; align-items: center; }
</style>
