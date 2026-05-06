<template>
  <div class="cp-panel">
    <div class="cp-header">
      <span class="cp-summary">
        已完成 {{ passedCount }} / {{ list.length }}
        <a-tag v-if="overdueCount > 0" color="red" style="margin-left:8px">{{ overdueCount }} 个逾期</a-tag>
      </span>
      <a-button size="small" type="primary" ghost @click="openCreate">+ 添加检查点</a-button>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && list.length === 0" description="暂无检查点" />

      <div v-for="cp in list" :key="cp.id" class="cp-item" :class="`cp-${cp.status}`">
        <div class="cp-line1">
          <span class="cp-icon">{{ statusIcon(cp.status) }}</span>
          <span class="cp-name">{{ cp.name }}</span>
          <a-tag :color="typeColor(cp.type)" size="small">{{ typeLabel(cp.type) }}</a-tag>
          <span class="cp-date">{{ formatDate(cp.plannedDate) }}</span>
          <a-tag :color="statusColor(cp.status)">{{ statusLabel(cp.status) }}</a-tag>
          <span v-if="cp.revisionCount > 0" class="cp-revision">第 {{ cp.revisionCount + 1 }} 次</span>
        </div>
        <div v-if="cp.description" class="cp-desc">{{ cp.description }}</div>
        <div v-if="cp.submitContent" class="cp-submit">
          <strong>📤 零工提交：</strong>{{ cp.submitContent }}
          <span v-if="cp.submittedAt" class="cp-time">· {{ formatTime(cp.submittedAt) }}</span>
        </div>
        <div v-if="cp.reviewComment" class="cp-review">
          <strong>{{ cp.status === 'passed' ? '✅ 审核通过' : '❌ 审核不通过' }}：</strong>{{ cp.reviewComment }}
        </div>
        <div class="cp-actions">
          <a-button
            v-if="cp.status === 'submitted'"
            size="small"
            type="primary"
            @click="openReview(cp, 'passed')"
          >通过</a-button>
          <a-button
            v-if="cp.status === 'submitted'"
            size="small"
            danger
            @click="openReview(cp, 'rejected')"
          >退回</a-button>
          <a-popconfirm
            v-if="cp.status === 'pending'"
            title="确定删除该检查点？"
            @confirm="handleDelete(cp.id)"
          >
            <a-button size="small" danger type="link">删除</a-button>
          </a-popconfirm>
        </div>
      </div>
    </a-spin>

    <!-- 创建 Modal -->
    <a-modal v-model:open="createVisible" title="新增检查点" :confirm-loading="creating" @ok="handleCreate">
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="检查点名称" required>
          <a-input v-model:value="createForm.name" :maxlength="50" placeholder="如：中期进度检查" />
        </a-form-item>
        <a-form-item label="类型" required>
          <a-radio-group v-model:value="createForm.type">
            <a-radio value="progress_check">进度检查</a-radio>
            <a-radio value="quality_gate">质量卡点</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="计划日期" required>
          <a-date-picker v-model:value="createForm.plannedDate" style="width:100%" />
        </a-form-item>
        <a-form-item label="验收人 ID" required>
          <a-input-number v-model:value="createForm.reviewerId" :min="1" style="width:100%" />
          <div style="font-size:12px;color:#999;margin-top:4px">填写企业成员的 user ID，默认为当前用户</div>
        </a-form-item>
        <a-form-item label="说明">
          <a-textarea v-model:value="createForm.description" :rows="2" :maxlength="200" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 审核 Modal -->
    <a-modal v-model:open="reviewVisible" :title="reviewAction === 'passed' ? '通过检查点' : '退回检查点'" :confirm-loading="reviewing" @ok="handleReview">
      <a-form layout="vertical">
        <a-form-item :label="reviewAction === 'passed' ? '审核意见（选填）' : '退回原因（必填）'">
          <a-textarea v-model:value="reviewComment" :rows="3" :maxlength="500" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { checkpointApi, type Checkpoint } from '@/api/checkpoint'

const props = defineProps<{ taskId: number; currentUserId?: number }>()

const loading = ref(false)
const list = ref<Checkpoint[]>([])

const passedCount = computed(() => list.value.filter((c) => c.status === 'passed').length)
const overdueCount = computed(() => list.value.filter((c) => c.status === 'overdue').length)

async function load() {
  loading.value = true
  try {
    list.value = await checkpointApi.list(props.taskId)
  } catch (e: any) {
    message.error(e?.message || '加载检查点失败')
  } finally {
    loading.value = false
  }
}

watch(() => props.taskId, load)

// 创建
const createVisible = ref(false)
const creating = ref(false)
const createForm = ref({
  name: '',
  type: 'progress_check' as 'progress_check' | 'quality_gate',
  plannedDate: null as any,
  reviewerId: props.currentUserId || 1,
  description: '',
})
function openCreate() {
  createForm.value = {
    name: '',
    type: 'progress_check',
    plannedDate: null,
    reviewerId: props.currentUserId || 1,
    description: '',
  }
  createVisible.value = true
}
async function handleCreate() {
  if (!createForm.value.name || !createForm.value.plannedDate || !createForm.value.reviewerId) {
    message.warning('请填写必填项')
    return
  }
  creating.value = true
  try {
    await checkpointApi.create(props.taskId, {
      name: createForm.value.name,
      type: createForm.value.type,
      plannedDate: dayjs(createForm.value.plannedDate).format('YYYY-MM-DD'),
      reviewerId: createForm.value.reviewerId,
      description: createForm.value.description || undefined,
    })
    message.success('已创建')
    createVisible.value = false
    load()
  } catch (e: any) {
    message.error(e?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

// 审核
const reviewVisible = ref(false)
const reviewing = ref(false)
const reviewAction = ref<'passed' | 'rejected'>('passed')
const reviewTarget = ref<Checkpoint | null>(null)
const reviewComment = ref('')
function openReview(cp: Checkpoint, action: 'passed' | 'rejected') {
  reviewTarget.value = cp
  reviewAction.value = action
  reviewComment.value = ''
  reviewVisible.value = true
}
async function handleReview() {
  if (!reviewTarget.value) return
  if (reviewAction.value === 'rejected' && !reviewComment.value.trim()) {
    message.warning('退回时必须填写原因')
    return
  }
  reviewing.value = true
  try {
    await checkpointApi.review(props.taskId, reviewTarget.value.id, {
      result: reviewAction.value,
      reviewComment: reviewComment.value || undefined,
    })
    message.success(reviewAction.value === 'passed' ? '已通过' : '已退回')
    reviewVisible.value = false
    load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  } finally {
    reviewing.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await checkpointApi.remove(props.taskId, id)
    message.success('已删除')
    load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

// UI helpers
const statusIcon = (s: string) =>
  ({ passed: '✅', rejected: '❌', submitted: '📤', overdue: '⏰', pending: '⭕' } as any)[s] || '⭕'
const statusLabel = (s: string) =>
  ({ pending: '待检查', submitted: '已提交', passed: '已通过', rejected: '不通过', overdue: '已逾期' } as any)[s] || s
const statusColor = (s: string) =>
  ({ passed: 'green', rejected: 'red', submitted: 'blue', overdue: 'volcano', pending: 'default' } as any)[s] || 'default'
const typeLabel = (t: string) => (t === 'progress_check' ? '进度检查' : '质量卡点')
const typeColor = (t: string) => (t === 'progress_check' ? 'cyan' : 'purple')
const formatDate = (d: string) => dayjs(d).format('MM-DD')
const formatTime = (d: string) => dayjs(d).format('MM-DD HH:mm')

onMounted(load)
defineExpose({ reload: load })
</script>

<style scoped>
.cp-panel { padding: 8px 0; }
.cp-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 8px 12px; border-bottom: 1px solid #f0f0f0; margin-bottom: 8px;
}
.cp-summary { color: #666; font-size: 12px; }
.cp-item {
  padding: 10px 12px; border-left: 3px solid #d9d9d9; background: #fafafa;
  margin-bottom: 8px; border-radius: 0 4px 4px 0;
}
.cp-passed { border-left-color: #52c41a; }
.cp-submitted { border-left-color: #1890ff; }
.cp-rejected { border-left-color: #ff4d4f; }
.cp-overdue { border-left-color: #fa541c; background: #fff2e8; }
.cp-line1 {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.cp-icon { font-size: 16px; }
.cp-name { font-weight: 600; }
.cp-date { color: #666; font-size: 12px; }
.cp-revision { color: #faad14; font-size: 12px; }
.cp-desc { color: #666; font-size: 12px; margin-top: 4px; }
.cp-submit, .cp-review {
  font-size: 12px; color: #333; margin-top: 6px; padding: 6px 8px;
  background: #fff; border-radius: 4px; line-height: 1.6;
}
.cp-review strong { color: #ff4d4f; }
.cp-passed .cp-review strong { color: #52c41a; }
.cp-time { color: #999; margin-left: 6px; }
.cp-actions { margin-top: 6px; display: flex; gap: 6px; }
</style>
