<template>
  <div class="page-container">
    <a-page-header title="通知中心" :ghost="false" style="margin-bottom:16px">
      <template #extra>
        <a-button @click="markAllRead" :disabled="!unreadCount">全部已读 ({{ unreadCount }})</a-button>
      </template>
    </a-page-header>

    <a-card :bordered="false">
      <a-tabs v-model:activeKey="tab">
        <a-tab-pane key="all" tab="全部" />
        <a-tab-pane key="unread" tab="未读" />
        <a-tab-pane key="task" tab="任务" />
        <a-tab-pane key="finance" tab="财务" />
        <a-tab-pane key="system" tab="系统" />
      </a-tabs>

      <a-list :data-source="filtered" :loading="loading" item-layout="horizontal">
        <template #renderItem="{ item }">
          <a-list-item :class="{ 'notification-unread': !item.isRead }">
            <a-list-item-meta>
              <template #avatar>
                <a-avatar :style="{ background: typeColor(item.type) }">
                  {{ typeIcon(item.type) }}
                </a-avatar>
              </template>
              <template #title>
                <span>{{ item.title }}</span>
                <a-tag v-if="!item.isRead" color="blue" size="small" style="margin-left:8px">未读</a-tag>
              </template>
              <template #description>
                <div>{{ item.content }}</div>
                <div style="color:#ccc;font-size:12px;margin-top:4px">{{ formatTime(item.createdAt) }}</div>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-button v-if="!item.isRead" type="link" size="small" @click="markRead(item.id)">标记已读</a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { request } from '@/api/request'

const tab = ref('all')
const loading = ref(false)
const notifications = ref<any[]>([])
const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length)

const filtered = computed(() => {
  let list = notifications.value
  if (tab.value === 'unread') list = list.filter(n => !n.isRead)
  else if (tab.value !== 'all') list = list.filter(n => n.type?.startsWith(tab.value))
  return list
})

const typeColor = (t: string) => {
  if (t?.includes('task')) return '#0858F4'
  if (t?.includes('finance')) return '#38D048'
  if (t?.includes('dispute')) return '#E04CFC'
  return '#666'
}
const typeIcon = (t: string) => {
  if (t?.includes('task')) return '📋'
  if (t?.includes('finance')) return '💰'
  if (t?.includes('dispute')) return '⚖️'
  return '🔔'
}
const formatTime = (t: string) => t ? new Date(t).toLocaleString('zh-CN') : ''

async function fetchNotifications() {
  loading.value = true
  try {
    const res = await request.get('/notifications', { params: { page: 1, pageSize: 100 } })
    notifications.value = res.data?.list || res.data || []
  } finally { loading.value = false }
}

async function markRead(id: number) {
  await request.put(`/notifications/${id}/read`)
  const n = notifications.value.find(n => n.id === id)
  if (n) n.isRead = true
}

async function markAllRead() {
  await request.put('/notifications/read-all')
  notifications.value.forEach(n => n.isRead = true)
  message.success('全部标记已读')
}

onMounted(fetchNotifications)
</script>

<style scoped>
.notification-unread { background: #f6f8ff; }
</style>
