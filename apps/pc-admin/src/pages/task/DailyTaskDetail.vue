<template>
  <div class="daily-task-page">
    <!-- 顶部信息 -->
    <a-page-header
      :title="task?.title || '人天任务详情'"
      sub-title="`ID: ${taskId}`"
      @back="$router.back()"
    >
      <template #extra>
        <a-tag :color="statusColor[task?.status]">{{ statusLabel[task?.status] }}</a-tag>
      </template>
    </a-page-header>

    <div class="page-body">
      <!-- 左栏：任务概况 + 角色分配 -->
      <div class="left-panel">
        <a-card title="任务概况" class="mb-4">
          <a-descriptions :column="2" size="small">
            <a-descriptions-item label="模式">人天计费</a-descriptions-item>
            <a-descriptions-item label="人天费率">
              ¥{{ task?.dailyRate || role?.suggestedDaily || '—' }}/天
            </a-descriptions-item>
            <a-descriptions-item label="预估周期">{{ task?.estimatedDays || '—' }}天</a-descriptions-item>
            <a-descriptions-item label="预算">¥{{ task?.totalBudget }}</a-descriptions-item>
          </a-descriptions>
        </a-card>

        <a-card title="人员分配">
          <a-table
            :data-source="assignments"
            :columns="assignCols"
            :pagination="false"
            size="small"
            row-key="assignmentId"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'worker'">
                <span>{{ record.workerName || record.workerId }}</span>
              </template>
              <template v-if="column.key === 'actions'">
                <a-button size="small" @click="openCheckins(record)">查看打卡</a-button>
              </template>
            </template>
          </a-table>
        </a-card>
      </div>

      <!-- 右栏：打卡时间轴 -->
      <div class="right-panel">
        <a-card :title="`打卡记录 · ${currentAssignment?.workerName || ''}`" v-if="currentAssignment">
          <div class="timeline-toolbar">
            <a-radio-group v-model:value="filterStatus" @change="loadCheckins">
              <a-radio-button value="">全部</a-radio-button>
              <a-radio-button value="pending">待确认</a-radio-button>
              <a-radio-button value="confirmed">已确认</a-radio-button>
              <a-radio-button value="auto_confirmed">自动确认</a-radio-button>
              <a-radio-button value="rejected">已驳回</a-radio-button>
            </a-radio-group>
          </div>

          <div class="checkin-summary">
            <span>共 {{ checkinTotal }} 天 · 已确认 {{ confirmedCount }} 天</span>
          </div>

          <a-timeline class="checkin-timeline">
            <a-timeline-item
              v-for="item in checkins"
              :key="item.checkinId"
              :color="checkinColor[item.status]"
            >
              <div class="checkin-item">
                <div class="checkin-date">
                  <b>{{ formatDate(item.checkinDate) }}</b>
                  <a-tag :color="checkinTagColor[item.status]" size="small">
                    {{ checkinStatusLabel[item.status] }}
                  </a-tag>
                </div>
                <div class="checkin-times">
                  <span>上班：{{ formatTime(item.checkinTime) }}</span>
                  <span v-if="item.checkoutTime">下班：{{ formatTime(item.checkoutTime) }}</span>
                </div>
                <div v-if="item.workLog" class="checkin-log">{{ item.workLog }}</div>
                <div v-if="item.screenshotUrl" class="checkin-screenshot">
                  <a :href="item.screenshotUrl" target="_blank">查看截图</a>
                </div>
                <div v-if="item.gpsLat" class="checkin-gps">
                  GPS: {{ item.gpsLat }}, {{ item.gpsLng }}
                </div>
                <div v-if="item.status === 'pending'" class="checkin-actions">
                  <a-button
                    type="primary" size="small"
                    @click="handleConfirm(item.checkinId)"
                  >确认</a-button>
                  <a-button
                    danger size="small" style="margin-left: 8px"
                    @click="openRejectModal(item.checkinId)"
                  >驳回</a-button>
                </div>
              </div>
            </a-timeline-item>
          </a-timeline>

          <div v-if="checkins.length === 0" class="empty-text">暂无打卡记录</div>
        </a-card>

        <a-empty v-else description="请在左侧选择人员查看打卡记录" />
      </div>
    </div>

    <!-- 驳回原因弹窗 -->
    <a-modal
      v-model:open="rejectModal"
      title="驳回原因"
      @ok="handleReject"
      ok-text="确认驳回"
      ok-type="danger"
    >
      <a-textarea
        v-model:value="rejectReason"
        placeholder="请填写驳回原因（必填）"
        :rows="4"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { taskApi } from '@/api/task'
import { checkinApi } from '@/api/checkin'

const route = useRoute()
const taskId = Number(route.params.id)

const task         = ref<any>(null)
const role         = ref<any>(null)
const assignments  = ref<any[]>([])
const checkins     = ref<any[]>([])
const checkinTotal = ref(0)
const currentAssignment = ref<any>(null)
const filterStatus = ref('')
const rejectModal  = ref(false)
const rejectReason = ref('')
const rejectTarget = ref<number | null>(null)

const confirmedCount = computed(
  () => checkins.value.filter(c => c.status === 'confirmed' || c.status === 'auto_confirmed').length,
)

const assignCols = [
  { title: '零工', key: 'worker', dataIndex: 'workerName' },
  { title: '状态', key: 'status', dataIndex: 'status' },
  { title: '操作', key: 'actions' },
]

const statusLabel: Record<string, string> = {
  draft: '草稿', published: '已发布', in_progress: '进行中',
  completed: '已完成', cancelled: '已取消',
}
const statusColor: Record<string, string> = {
  draft: 'default', published: 'blue', in_progress: 'processing',
  completed: 'success', cancelled: 'error',
}
const checkinStatusLabel: Record<string, string> = {
  pending: '待确认', confirmed: '已确认',
  auto_confirmed: '自动确认', rejected: '已驳回',
}
const checkinColor: Record<string, string> = {
  pending: 'blue', confirmed: 'green',
  auto_confirmed: 'gray', rejected: 'red',
}
const checkinTagColor: Record<string, string> = {
  pending: 'processing', confirmed: 'success',
  auto_confirmed: 'default', rejected: 'error',
}

const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('zh-CN') : '—'
const formatTime = (d: any) => d ? new Date(d).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'

async function loadTask() {
  try {
    const res = await taskApi.detailFull(taskId)
    task.value = res.data
    assignments.value = res.data?.roles?.flatMap((r: any) => r.assignments) || []
    role.value = res.data?.roles?.[0]
  } catch {
    message.error('加载任务失败')
  }
}

async function openCheckins(asgn: any) {
  currentAssignment.value = asgn
  await loadCheckins()
}

async function loadCheckins() {
  if (!currentAssignment.value) return
  try {
    const res = await checkinApi.list(currentAssignment.value.assignmentId, {
      status: filterStatus.value || undefined,
    })
    checkins.value     = res.data.list
    checkinTotal.value = res.data.total
  } catch {
    message.error('加载打卡记录失败')
  }
}

async function handleConfirm(checkinId: number) {
  try {
    await checkinApi.confirm(checkinId)
    message.success('确认成功')
    loadCheckins()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '确认失败')
  }
}

function openRejectModal(checkinId: number) {
  rejectTarget.value = checkinId
  rejectReason.value = ''
  rejectModal.value  = true
}

async function handleReject() {
  if (!rejectReason.value.trim()) {
    message.warning('请填写驳回原因')
    return
  }
  try {
    await checkinApi.reject(rejectTarget.value!, rejectReason.value)
    message.success('已驳回')
    rejectModal.value = false
    loadCheckins()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '驳回失败')
  }
}

onMounted(loadTask)
</script>

<style scoped>
.daily-task-page { background: var(--color-bg-page); min-height: 100vh; }
.page-body {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 16px;
  padding: 16px 24px;
}
.mb-4 { margin-bottom: 16px; }
.timeline-toolbar { margin-bottom: 16px; }
.checkin-summary { margin-bottom: 16px; color: #666; font-size: 13px; }
.checkin-item { padding-bottom: 4px; }
.checkin-date { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.checkin-times { font-size: 13px; color: #555; display: flex; gap: 16px; }
.checkin-log { margin-top: 4px; font-size: 12px; color: #888; white-space: pre-wrap; }
.checkin-screenshot { margin-top: 4px; }
.checkin-gps { font-size: 11px; color: #aaa; margin-top: 2px; }
.checkin-actions { margin-top: 8px; }
.checkin-timeline { padding: 8px 0; }
.empty-text { color: #aaa; text-align: center; padding: 32px; }
</style>
