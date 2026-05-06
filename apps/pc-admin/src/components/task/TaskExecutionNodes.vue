<template>
  <div class="execution-nodes">
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && nodes.length === 0" description="暂无执行过程数据" />

      <!-- 节点时间线 -->
      <a-timeline v-if="nodes.length > 0" mode="left" class="node-timeline">
        <a-timeline-item
          v-for="(node, idx) in nodes"
          :key="node.nodeId"
          :color="nodeColor(node.status)"
        >
          <!-- 节点头部 -->
          <div class="node-header">
            <span class="node-name">{{ node.name }}</span>
            <a-tag :color="nodeStatusColor(node.status)" size="small">{{ nodeStatusLabel(node.status) }}</a-tag>
            <span v-if="node.plannedDate" class="node-date">
              📅 {{ formatDate(node.plannedDate) }}
            </span>
          </div>

          <!-- 进度条 -->
          <div class="node-progress">
            <span class="progress-label">任务进度</span>
            <a-progress :percent="node.progressPct" size="small" :status="progressStatus(node.status)" style="flex: 1" />
          </div>

          <!-- 节点描述 -->
          <div v-if="node.description" class="node-desc">{{ node.description }}</div>

          <!-- 工作日志（日报汇总） -->
          <div v-if="node.logs && node.logs.length > 0" class="node-section">
            <div class="section-title" @click="toggleSection(idx, 'logs')">
              <span>📝 工作日志 ({{ node.logs.length }})</span>
              <span class="toggle-icon">{{ expandedSections[`${idx}-logs`] ? '▾' : '▸' }}</span>
            </div>
            <div v-if="expandedSections[`${idx}-logs`]" class="section-content">
              <div v-for="log in node.logs" :key="log.id" class="log-entry">
                <div class="log-meta">
                  <a-avatar size="small" style="background: var(--color-primary)">{{ (log.workerName || '?')[0] }}</a-avatar>
                  <span class="log-worker">{{ log.workerName }}</span>
                  <span class="log-progress">进度: {{ log.progressPct }}%</span>
                  <span class="log-time">{{ formatTime(log.createdAt) }}</span>
                </div>
                <div v-if="log.dailySummary" class="log-text">
                  <strong>📌 今日完成：</strong>{{ log.dailySummary }}
                </div>
                <div v-else-if="log.content" class="log-text">
                  <strong>📝 工作内容：</strong>{{ log.content }}
                </div>
                <div v-if="log.issues" class="log-text warn">
                  <strong>⚠️ 问题：</strong>{{ log.issues }}
                </div>
                <div v-if="log.tomorrowPlan" class="log-text">
                  <strong>🎯 明日计划：</strong>{{ log.tomorrowPlan }}
                </div>
                <div v-if="log.screenshots?.length" class="log-screenshots">
                  <img v-for="s in log.screenshots" :key="s" :src="s" class="log-thumb" />
                </div>
              </div>
            </div>
          </div>

          <!-- 过程交付物（附件） -->
          <div v-if="node.attachments && node.attachments.length > 0" class="node-section">
            <div class="section-title" @click="toggleSection(idx, 'attachments')">
              <span>📎 过程交付物 ({{ node.attachments.length }})</span>
              <span class="toggle-icon">{{ expandedSections[`${idx}-attachments`] ? '▾' : '▸' }}</span>
            </div>
            <div v-if="expandedSections[`${idx}-attachments`]" class="section-content">
              <div v-for="att in node.attachments" :key="att.attachmentId" class="att-item">
                <span class="att-icon">{{ fileIcon(att.fileType) }}</span>
                <a :href="att.fileUrl" target="_blank" class="att-name">{{ att.fileName }}</a>
                <span class="att-size">{{ formatFileSize(att.fileSize) }}</span>
                <span class="att-time">{{ formatTime(att.createdAt) }}</span>
              </div>
            </div>
          </div>

          <!-- 提交与审核信息 -->
          <div v-if="node.submitContent" class="node-submit">
            <strong>📤 零工提交：</strong>{{ node.submitContent }}
            <span v-if="node.submittedAt" class="submit-time">· {{ formatTime(node.submittedAt) }}</span>
          </div>
          <div v-if="node.reviewComment" class="node-review" :class="node.status === 'passed' ? 'review-pass' : 'review-reject'">
            <strong>{{ node.status === 'passed' ? '✅ 审核通过' : '❌ 审核不通过' }}：</strong>{{ node.reviewComment }}
          </div>
        </a-timeline-item>
      </a-timeline>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { taskApi } from '@/api/task'

const props = defineProps<{ taskId: number }>()

const loading = ref(false)
const nodes = ref<any[]>([])
const expandedSections = reactive<Record<string, boolean>>({})

function toggleSection(idx: number, type: string) {
  const key = `${idx}-${type}`
  expandedSections[key] = !expandedSections[key]
}

async function loadNodes() {
  loading.value = true
  try {
    const res = await taskApi.getExecutionNodes(props.taskId)
    const data = res.data ?? res
    nodes.value = data.nodes || []
    // 默认展开第一个有日志的节点
    nodes.value.forEach((n: any, idx: number) => {
      if (n.logs?.length > 0 && idx === 0) expandedSections[`${idx}-logs`] = true
      if (n.attachments?.length > 0 && idx === 0) expandedSections[`${idx}-attachments`] = true
    })
  } catch {
    nodes.value = []
  } finally {
    loading.value = false
  }
}

// helpers
const nodeColor = (s: string) => {
  const map: Record<string, string> = { passed: 'green', submitted: 'blue', pending: 'gray', rejected: 'red', overdue: 'red' }
  return map[s] || 'gray'
}
const nodeStatusColor = (s: string) => {
  const map: Record<string, string> = { passed: 'green', submitted: 'blue', pending: 'default', rejected: 'red', overdue: 'red' }
  return map[s] || 'default'
}
const nodeStatusLabel = (s: string) => {
  const map: Record<string, string> = { passed: '已通过', submitted: '已提交', pending: '待执行', rejected: '被退回', overdue: '已逾期' }
  return map[s] || s
}
const progressStatus = (s: string) => {
  if (s === 'passed') return 'success'
  if (s === 'rejected' || s === 'overdue') return 'exception'
  return 'active'
}

function formatDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}
function formatTime(d: string) {
  if (!d) return '—'
  const date = new Date(d)
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}
function fileIcon(type: string) {
  const icons: Record<string, string> = { pdf: '📄', doc: '📝', docx: '📝', xlsx: '📊', xls: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', zip: '📦', rar: '📦' }
  return icons[type?.toLowerCase()] || '📁'
}

onMounted(loadNodes)
watch(() => props.taskId, loadNodes)
</script>

<style scoped>
.execution-nodes { padding: 8px 0; }

.node-timeline :deep(.ant-timeline-item-content) { padding-bottom: 20px; }

.node-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.node-name { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
.node-date { font-size: 12px; color: var(--color-text-tertiary); margin-left: auto; }

.node-progress {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.progress-label { font-size: 12px; color: var(--color-text-tertiary); white-space: nowrap; }

.node-desc {
  font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px;
  padding: 6px 10px; background: #f9f9f9; border-radius: 4px;
}

.node-section { margin-top: 8px; }
.section-title {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; font-weight: 500; color: var(--color-text-secondary);
  padding: 6px 0; cursor: pointer; user-select: none;
}
.section-title:hover { color: var(--color-primary); }
.toggle-icon { font-size: 12px; }

.section-content {
  padding-left: 4px; border-left: 2px solid var(--color-border-light); margin-left: 4px;
}

/* 日志 */
.log-entry {
  padding: 8px 10px; margin-bottom: 6px; background: #fafbfc; border-radius: 4px;
}
.log-meta {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
}
.log-worker { font-size: 12px; font-weight: 500; }
.log-progress { font-size: 11px; color: var(--color-primary); margin-left: auto; }
.log-time { font-size: 11px; color: var(--color-text-quaternary); }
.log-text { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; margin-top: 4px; }
.log-text.warn { color: var(--color-warning); }
.log-screenshots { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.log-thumb { width: 48px; height: 48px; object-fit: cover; border-radius: 4px; cursor: pointer; }

/* 附件 */
.att-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; margin-bottom: 4px; background: #fafbfc; border-radius: 4px;
}
.att-icon { font-size: 16px; }
.att-name {
  font-size: 12px; color: var(--color-primary); text-decoration: none; flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.att-name:hover { text-decoration: underline; }
.att-size { font-size: 11px; color: var(--color-text-quaternary); }
.att-time { font-size: 11px; color: var(--color-text-quaternary); }

/* 提交/审核 */
.node-submit {
  font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;
  padding: 6px 10px; background: #e6f7ff; border-radius: 4px;
}
.submit-time { font-size: 11px; color: var(--color-text-tertiary); }
.node-review {
  font-size: 12px; margin-top: 6px; padding: 6px 10px; border-radius: 4px;
}
.review-pass { background: #f6ffed; color: #389e0d; }
.review-reject { background: #fff1f0; color: #cf1322; }
</style>
