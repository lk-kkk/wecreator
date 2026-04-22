<template>
  <div class="issues-panel">
    <div class="issues-header">
      <span class="summary">
        待响应 <strong class="text-red">{{ openCount }}</strong> ·
        处理中 <strong class="text-blue">{{ inProgressCount }}</strong> ·
        已解决 <strong class="text-green">{{ resolvedCount }}</strong>
      </span>
      <a-button size="small" type="primary" ghost @click="openCreate">+ 上报问题</a-button>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && list.length === 0" description="暂无问题" />

      <div v-for="i in list" :key="i.id" class="issue-item" :class="`issue-${i.status}`">
        <div class="issue-line1">
          <span class="issue-icon">{{ statusIcon(i.status) }}</span>
          <span class="issue-title">{{ i.title }}</span>
          <a-tag :color="typeColor(i.type)">{{ typeLabel(i.type) }}</a-tag>
          <a-tag :color="statusColor(i.status)">{{ statusLabel(i.status) }}</a-tag>
          <a-tag v-if="i.slaBreached" color="red">⚠️ SLA 超时</a-tag>
          <span class="issue-time">{{ formatTime(i.createdAt) }}</span>
        </div>
        <div class="issue-meta">
          上报: {{ i.reporterName || (i.reporterType === 'worker' ? `零工#${i.reporterId}` : `企业#${i.reporterId}`) }}
          <span v-if="i.status === 'open'" class="sla-timer">
            · 距首次响应 {{ slaRemaining(i) }}
          </span>
        </div>
        <div class="issue-desc">{{ i.description }}</div>
        <div v-if="i.attachments?.length" class="issue-attachments">
          <a v-for="u in i.attachments" :key="u" :href="u" target="_blank" class="attach-link">📎 附件</a>
        </div>
        <div v-if="i.response" class="issue-response">
          <strong>💬 企业回复：</strong>{{ i.response }}
        </div>
        <div class="issue-actions">
          <a-button v-if="i.status === 'open'" size="small" @click="openReply(i, 'in_progress')">
            标记处理中
          </a-button>
          <a-button
            v-if="i.status === 'open' || i.status === 'in_progress'"
            type="primary"
            size="small"
            @click="openReply(i, 'resolved')"
          >标记已解决</a-button>
          <a-button
            v-if="i.status !== 'closed' && i.status !== 'resolved'"
            size="small"
            @click="openReply(i, 'closed')"
          >关闭</a-button>
        </div>
      </div>
    </a-spin>

    <!-- 上报 Modal -->
    <a-modal v-model:open="createVisible" title="上报问题" :confirm-loading="creating" @ok="handleCreate">
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="问题标题" required>
          <a-input v-model:value="createForm.title" :maxlength="100" placeholder="简要描述问题" />
        </a-form-item>
        <a-form-item label="问题类型" required>
          <a-select v-model:value="createForm.type">
            <a-select-option value="requirement_unclear">需求不明确</a-select-option>
            <a-select-option value="technical_block">技术障碍</a-select-option>
            <a-select-option value="resource_missing">资源缺失</a-select-option>
            <a-select-option value="other">其他</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="详细描述" required>
          <a-textarea v-model:value="createForm.description" :rows="4" :maxlength="500" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 回复/更新状态 Modal -->
    <a-modal v-model:open="replyVisible" :title="replyModalTitle" :confirm-loading="replying" @ok="handleReply">
      <a-form layout="vertical">
        <a-form-item label="处理说明（可选）">
          <a-textarea v-model:value="replyContent" :rows="3" :maxlength="500" placeholder="填写处理情况 / 回复内容" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { issueApi, ISSUE_TYPE_LABEL, ISSUE_STATUS_LABEL, type TaskIssue, type IssueType, type IssueStatus } from '@/api/issue'

const props = defineProps<{ taskId: number }>()

const loading = ref(false)
const list = ref<TaskIssue[]>([])

const openCount = computed(() => list.value.filter((i) => i.status === 'open').length)
const inProgressCount = computed(() => list.value.filter((i) => i.status === 'in_progress').length)
const resolvedCount = computed(() => list.value.filter((i) => i.status === 'resolved').length)

async function load() {
  loading.value = true
  try {
    list.value = await issueApi.list(props.taskId)
  } catch (e: any) {
    message.error(e?.message || '加载问题失败')
  } finally {
    loading.value = false
  }
}
watch(() => props.taskId, load)

// 创建
const createVisible = ref(false)
const creating = ref(false)
const createForm = ref({ title: '', type: 'requirement_unclear' as IssueType, description: '' })
function openCreate() {
  createForm.value = { title: '', type: 'requirement_unclear', description: '' }
  createVisible.value = true
}
async function handleCreate() {
  if (!createForm.value.title || !createForm.value.description) {
    message.warning('请填写标题和描述')
    return
  }
  if (createForm.value.description.length < 50) {
    message.warning('描述至少 50 字')
    return
  }
  creating.value = true
  try {
    await issueApi.create(props.taskId, { ...createForm.value })
    message.success('已上报')
    createVisible.value = false
    load()
  } catch (e: any) {
    message.error(e?.message || '上报失败')
  } finally {
    creating.value = false
  }
}

// 回复 / 状态
const replyVisible = ref(false)
const replying = ref(false)
const replyTarget = ref<TaskIssue | null>(null)
const replyStatus = ref<IssueStatus>('in_progress')
const replyContent = ref('')
const replyModalTitle = computed(() => {
  return { in_progress: '标记处理中', resolved: '标记已解决', closed: '关闭问题', open: '回复' }[replyStatus.value] || '更新问题'
})
function openReply(i: TaskIssue, status: IssueStatus) {
  replyTarget.value = i
  replyStatus.value = status
  replyContent.value = ''
  replyVisible.value = true
}
async function handleReply() {
  if (!replyTarget.value) return
  replying.value = true
  try {
    await issueApi.update(props.taskId, replyTarget.value.id, {
      status: replyStatus.value,
      response: replyContent.value || undefined,
    })
    message.success('已更新')
    replyVisible.value = false
    load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  } finally {
    replying.value = false
  }
}

// UI
const statusIcon = (s: string) => ({ open: '🔴', in_progress: '🟡', resolved: '✅', closed: '⚪' } as any)[s] || '⚪'
const statusLabel = (s: string) => ISSUE_STATUS_LABEL[s as IssueStatus] || s
const statusColor = (s: string) => ({ open: 'red', in_progress: 'orange', resolved: 'green', closed: 'default' } as any)[s] || 'default'
const typeLabel = (t: string) => ISSUE_TYPE_LABEL[t as IssueType] || t
const typeColor = (t: string) => ({ requirement_unclear: 'purple', technical_block: 'volcano', resource_missing: 'geekblue', other: 'default' } as any)[t] || 'default'
const formatTime = (d: string) => dayjs(d).format('MM-DD HH:mm')
function slaRemaining(i: TaskIssue): string {
  const deadline = dayjs(i.createdAt).add(24, 'hour')
  const diff = deadline.diff(dayjs(), 'minute')
  if (diff <= 0) return '已超时'
  if (diff < 60) return `剩 ${diff} 分钟`
  const h = Math.floor(diff / 60)
  return `剩 ${h} 小时 ${diff % 60} 分`
}

onMounted(load)
defineExpose({ reload: load })
</script>

<style scoped>
.issues-panel { padding: 8px 0; }
.issues-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 8px 12px; border-bottom: 1px solid #f0f0f0; margin-bottom: 8px;
}
.summary { color: #666; font-size: 13px; }
.text-red { color: #ff4d4f; }
.text-blue { color: #1677ff; }
.text-green { color: #52c41a; }
.issue-item {
  padding: 10px 12px; border-left: 3px solid #d9d9d9;
  background: #fafafa; margin-bottom: 8px; border-radius: 0 4px 4px 0;
}
.issue-open { border-left-color: #ff4d4f; background: #fff1f0; }
.issue-in_progress { border-left-color: #faad14; }
.issue-resolved { border-left-color: #52c41a; }
.issue-line1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.issue-icon { font-size: 14px; }
.issue-title { font-weight: 600; }
.issue-time { color: #999; font-size: 12px; margin-left: auto; }
.issue-meta { color: #666; font-size: 12px; margin-top: 4px; }
.sla-timer { color: #ff4d4f; }
.issue-desc { font-size: 13px; margin-top: 6px; line-height: 1.6; white-space: pre-wrap; }
.issue-attachments { margin-top: 4px; }
.attach-link { margin-right: 8px; font-size: 12px; }
.issue-response {
  margin-top: 6px; padding: 6px 8px; background: #fff;
  border-radius: 4px; font-size: 12px; line-height: 1.6;
}
.issue-actions { margin-top: 6px; display: flex; gap: 6px; }
</style>
