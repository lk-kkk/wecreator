<template>
  <div class="page-container">
    <a-page-header title="通知中心" :ghost="false" style="margin-bottom:16px">
      <template #extra>
        <a-button @click="markAllRead" :disabled="unreadCount === 0">
          全部已读 <span v-if="unreadCount">({{ unreadCount }})</span>
        </a-button>
      </template>
    </a-page-header>

    <a-card :bordered="false">
      <a-tabs v-model:activeKey="tab" @change="handleTabChange">
        <a-tab-pane key="all" tab="全部" />
        <a-tab-pane key="unread" tab="未读" />
        <a-tab-pane key="issue_report" tab="问题上报" />
        <a-tab-pane key="risk_alert" tab="风险预警" />
        <a-tab-pane key="milestone_remind" tab="里程碑" />
        <a-tab-pane key="acceptance" tab="验收" />
        <a-tab-pane key="checkpoint" tab="检查点" />
        <a-tab-pane key="comment_mention" tab="评论 @" />
        <a-tab-pane key="status_change" tab="状态变更" />
      </a-tabs>

      <a-list :data-source="notifications" :loading="loading" item-layout="horizontal">
        <template #renderItem="{ item }">
          <a-list-item
            :class="{ 'notification-unread': !item.isRead }"
            style="cursor:pointer"
            @click="openNotification(item)"
          >
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
              <a-button
                v-if="!item.isRead"
                type="link"
                size="small"
                @click.stop="markRead(item.id)"
              >标记已读</a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>

      <div style="text-align:center;margin-top:16px">
        <a-pagination
          v-model:current="page"
          :page-size="pageSize"
          :total="total"
          :show-total="(t: number) => `共 ${t} 条`"
          show-size-changer
          :page-size-options="['20', '50', '100']"
          @change="fetchNotifications"
          @show-size-change="handleSizeChange"
        />
      </div>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { notificationApi, type Notification, type NotificationListParams } from '@/api/notification'

const router = useRouter()
const tab = ref('all')
const loading = ref(false)
const notifications = ref<Notification[]>([])
const total = ref(0)
const unreadCount = ref(0)
const page = ref(1)
const pageSize = ref(20)

const TYPE_META: Record<string, { color: string; icon: string }> = {
  issue_report:     { color: '#ff4d4f', icon: '⚠️' },
  risk_alert:       { color: '#faad14', icon: '🟡' },
  milestone_remind: { color: '#faad14', icon: '🏁' },
  acceptance:       { color: '#1890ff', icon: '✅' },
  checkpoint:       { color: '#13c2c2', icon: '📋' },
  comment_mention:  { color: '#722ed1', icon: '💬' },
  daily_missing:    { color: '#faad14', icon: '📝' },
  status_change:    { color: '#8c8c8c', icon: '🔄' },
}
const typeColor = (t: string) => TYPE_META[t]?.color || '#666'
const typeIcon  = (t: string) => TYPE_META[t]?.icon  || '🔔'
const formatTime = (t: string) => (t ? new Date(t).toLocaleString('zh-CN') : '')

function buildParams(): NotificationListParams {
  const params: NotificationListParams = { page: page.value, pageSize: pageSize.value }
  if (tab.value === 'unread') {
    params.isRead = false
  } else if (tab.value !== 'all') {
    params.type = tab.value
  }
  return params
}

async function fetchNotifications() {
  loading.value = true
  try {
    const res = await notificationApi.list(buildParams())
    notifications.value = res?.list ?? []
    total.value = res?.total ?? 0
    unreadCount.value = res?.unread ?? 0
  } catch (e: any) {
    message.error(e?.message || '加载通知失败')
    notifications.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  page.value = 1
  fetchNotifications()
}

function handleSizeChange(_current: number, size: number) {
  pageSize.value = size
  page.value = 1
  fetchNotifications()
}

async function markRead(id: number) {
  try {
    await notificationApi.markRead([id])
    const n = notifications.value.find((x) => x.id === id)
    if (n) n.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function markAllRead() {
  try {
    await notificationApi.markAllRead()
    notifications.value.forEach((n) => (n.isRead = true))
    unreadCount.value = 0
    message.success('全部标记已读')
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function openNotification(n: Notification) {
  if (!n.isRead) markRead(n.id)
  if (n.refType === 'task' && n.refId) router.push(`/task/${n.refId}`)
  else if (n.refType === 'project' && n.refId) router.push(`/project/${n.refId}`)
}

onMounted(fetchNotifications)
</script>

<style scoped>
.notification-unread { background: #f6f8ff; }
</style>
