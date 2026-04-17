<template>
  <div class="task-list-page">
    <!-- 页头 -->
    <div class="wc-page-header">
      <div>
        <h1 class="wc-page-title">任务管理</h1>
        <p class="wc-page-subtitle">管理所有任务的发布、执行与验收</p>
      </div>
      <a-button type="primary" size="large" @click="$router.push('/task/create')">
        <template #icon><plus-outlined /></template>
        发布任务
      </a-button>
    </div>

    <!-- 内容卡片 -->
    <div class="wc-card">
      <!-- 状态 Tabs -->
      <a-tabs v-model:activeKey="activeTab" @change="handleTabChange" class="task-tabs">
        <a-tab-pane key="" tab="全部任务" />
        <a-tab-pane key="draft">
          <template #tab>
            <span class="tab-with-badge">
              草稿
              <span v-if="tabCounts.draft" class="tab-badge draft">{{ tabCounts.draft }}</span>
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="published">
          <template #tab>
            <span class="tab-with-badge">
              招募中
              <span v-if="tabCounts.published" class="tab-badge matching">{{ tabCounts.published }}</span>
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="in_progress">
          <template #tab>
            <span class="tab-with-badge">
              进行中
              <span v-if="tabCounts.in_progress" class="tab-badge progress">{{ tabCounts.in_progress }}</span>
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="reviewing">
          <template #tab>
            <span class="tab-with-badge">
              验收中
              <span v-if="tabCounts.reviewing" class="tab-badge review">{{ tabCounts.reviewing }}</span>
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="completed" tab="已完成" />
      </a-tabs>

      <!-- 筛选条 -->
      <div class="filter-bar">
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索任务名称..."
          style="width: 240px;"
          @search="handleSearch"
          allow-clear
        />
        <a-select
          v-model:value="filterMode"
          placeholder="全部模式"
          allow-clear
          style="width: 130px;"
          @change="handleSearch"
        >
          <a-select-option value="task_package">📦 任务包</a-select-option>
          <a-select-option value="daily_rate">📅 人天模式</a-select-option>
        </a-select>
        <a-range-picker
          v-model:value="dateRange"
          style="width: 240px;"
          placeholder="['创建开始', '创建结束']"
          format="MM-DD"
          @change="handleSearch"
        />
        <div style="flex: 1;" />
        <a-button @click="handleExport">
          <template #icon><export-outlined /></template>
          导出
        </a-button>
      </div>

      <!-- 任务表格 -->
      <a-table
        :columns="columns"
        :data-source="taskList"
        :loading="loading"
        :pagination="{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (t: number) => `共 ${t} 条`,
          showSizeChanger: true,
        }"
        row-key="taskId"
        @change="handleTableChange"
        class="task-table"
      >
        <template #bodyCell="{ column, record }">

          <!-- 任务名称 -->
          <template v-if="column.key === 'title'">
            <div class="task-title-cell" @click="openTaskDrawer(record.taskId)">
              <span class="task-mode-badge" :class="record.taskMode === 'task_package' ? 'mode-pkg' : 'mode-day'">
                {{ record.taskMode === 'task_package' ? '📦' : '📅' }}
              </span>
              <span class="task-name">{{ record.title }}</span>
            </div>
          </template>

          <!-- 预算 -->
          <template v-if="column.key === 'totalBudget'">
            <span class="amount-number budget-val">
              ¥{{ record.totalBudget.toLocaleString() }}
            </span>
          </template>

          <!-- 状态 -->
          <template v-if="column.key === 'status'">
            <span class="status-tag" :class="statusClass(record.status)">
              {{ statusLabel(record.status) }}
            </span>
          </template>

          <!-- 角色数 -->
          <template v-if="column.key === 'roleCount'">
            <span class="role-count">
              <team-outlined style="color: var(--color-text-tertiary); margin-right: 4px;" />
              {{ record.roleCount }}
            </span>
          </template>

          <!-- 创建时间 -->
          <template v-if="column.key === 'createdAt'">
            <span class="time-text">{{ formatDate(record.createdAt) }}</span>
          </template>

          <!-- 操作 -->
          <template v-if="column.key === 'action'">
            <a-space :size="4">
              <a-button
                type="link"
                size="small"
                @click="openTaskDrawer(record.taskId)"
              >
                详情
              </a-button>
              <a-button
                v-if="record.status === 'reviewing'"
                type="link"
                size="small"
                style="color: var(--color-accent);"
                @click="openTaskDrawer(record.taskId)"
              >
                验收
              </a-button>
            </a-space>
          </template>

        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">暂无任务</div>
            <div class="empty-desc">
              {{ activeTab ? '该状态下没有任务' : '发布您的第一个任务，开始高效用工' }}
            </div>
            <a-button
              v-if="!activeTab"
              type="primary"
              style="margin-top: 16px;"
              @click="$router.push('/task/create')"
            >
              立即发布任务
            </a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- ===================== 任务详情抽屉 ===================== -->
    <a-drawer
      v-model:open="taskDrawerVisible"
      :title="taskDetail?.title || '任务详情'"
      width="780"
      placement="right"
      :destroyOnClose="true"
    >
      <template v-if="taskDetail">
        <!-- 顶部状态条 -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px">
          <a-tag :color="drawerStatusColor[taskDetail.status]">{{ drawerStatusLabel[taskDetail.status] }}</a-tag>
          <span style="color: #999; font-size: 13px">#{{ taskDetail.taskId }}</span>
          <div style="flex: 1" />
          <a-button v-if="taskDetail.status === 'published'" danger size="small" @click="handleCancelTask">取消任务</a-button>
        </div>

        <!-- 基本信息 -->
        <a-card title="基本信息" :bordered="false" size="small" style="margin-bottom: 16px">
          <a-descriptions :column="2" size="small">
            <a-descriptions-item label="任务模式">{{ taskDetail.taskMode === 'task_package' ? '📦 任务包' : '📅 日薪制' }}</a-descriptions-item>
            <a-descriptions-item label="总预算"><span style="font-weight: 600">¥{{ taskDetail.totalBudget?.toLocaleString() }}</span></a-descriptions-item>
            <a-descriptions-item label="已锁定"><span style="color: #faad14">¥{{ taskDetail.lockedAmount?.toLocaleString() }}</span></a-descriptions-item>
            <a-descriptions-item label="工作地点">{{ taskDetail.address || '远程' }}</a-descriptions-item>
            <a-descriptions-item label="开始时间">{{ taskDetail.startDate ? dayjs(taskDetail.startDate).format('YYYY-MM-DD') : '—' }}</a-descriptions-item>
            <a-descriptions-item label="截止时间">{{ taskDetail.endDate ? dayjs(taskDetail.endDate).format('YYYY-MM-DD') : '—' }}</a-descriptions-item>
          </a-descriptions>
          <div style="margin-top: 8px; font-size: 13px; color: #666">{{ taskDetail.description || '暂无描述' }}</div>
        </a-card>

        <!-- 角色 & 分配 -->
        <a-card
          v-for="role in taskDetail.roles"
          :key="role.taskRoleId"
          :title="role.roleName"
          :bordered="false"
          size="small"
          style="margin-bottom: 12px"
        >
          <template #extra>
            <span style="color: #faad14; font-weight: 600; margin-right: 8px">¥{{ Number(role.budget).toLocaleString() }} / 人</span>
            <a-tag>{{ role.headcount }} 人</a-tag>
          </template>

          <div v-if="role.skillTags" style="margin-bottom: 8px">
            <a-tag v-for="tag in role.skillTags.split(',')" :key="tag" color="blue">{{ tag.trim() }}</a-tag>
          </div>

          <div v-if="taskDetail.status === 'published' || taskDetail.status === 'in_progress'" style="margin-bottom: 8px">
            <a-button size="small" type="primary" ghost @click="openInviteDrawer(role)">
              <team-outlined /> 邀约零工到此角色
            </a-button>
            <span style="color: #999; margin-left: 8px; font-size: 12px">
              已邀 {{ role.assignments?.length || 0 }} / {{ role.headcount }} 人
            </span>
          </div>

          <div v-for="assignment in role.assignments" :key="assignment.assignmentId" class="drawer-assignment-row">
            <a-avatar :src="assignment.workerAvatar || undefined" :size="32">{{ (assignment.workerName || '?')[0] }}</a-avatar>
            <span style="min-width: 80px; font-size: 13px">{{ assignment.workerName || `零工#${assignment.workerId}` }}</span>
            <a-progress :percent="assignment.progress" size="small" style="flex: 1" />
            <a-tag :color="drawerAssignColor[assignment.status]">{{ drawerAssignLabel[assignment.status] }}</a-tag>
            <a-button size="small" @click="openImPanel(assignment, role)">消息</a-button>
          </div>

          <div v-if="drawerDeliverablesByRole(role.taskRoleId).length > 0">
            <a-divider orientation="left" plain>交付物</a-divider>
            <DeliverableReview
              v-for="d in drawerDeliverablesByRole(role.taskRoleId)"
              :key="d.deliverableId"
              :deliverable="d"
              @review="(result: 'approved' | 'rejected', note?: string) => submitReview(role.taskRoleId, result, note)"
            />
          </div>
        </a-card>

        <!-- IM 面板 -->
        <a-card v-if="activeConversation" title="💬 消息" :bordered="false" size="small" style="margin-top: 12px">
          <ImChatPanel
            :conversation="activeConversation"
            :task-title="taskDetail.title"
          />
        </a-card>
      </template>
      <a-skeleton v-else active />
    </a-drawer>

    <!-- 邀约零工抽屉 (嵌套) -->
    <a-drawer
      v-model:open="inviteDrawerVisible"
      :title="`邀约零工 — ${inviteRole?.roleName || ''}`"
      width="400"
    >
      <a-spin :spinning="loadingWorkers">
        <div v-if="recommendedWorkers.length === 0 && !loadingWorkers">
          <a-empty description="暂无可推荐的零工" />
        </div>
        <div v-for="w in recommendedWorkers" :key="w.workerId" class="invite-worker-card">
          <div style="display: flex; align-items: center; gap: 8px">
            <a-avatar :size="36" style="background: var(--color-primary)">{{ (w.realName || '?')[0] }}</a-avatar>
            <div>
              <div style="font-weight: 600">{{ w.realName || '未填写' }}</div>
              <div style="font-size: 12px; color: #999">{{ w.city || '—' }} · 评分 {{ (w.avgRating || 0).toFixed(1) }} · 完成{{ w.completedCount || 0 }}单</div>
            </div>
          </div>
          <a-button
            type="primary" size="small"
            :loading="invitingId === w.workerId"
            @click="handleInviteWorker(w)"
          >邀约</a-button>
        </div>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { PlusOutlined, TeamOutlined, ExportOutlined } from '@ant-design/icons-vue'
import { taskApi } from '@/api/task'
import { recommendApi } from '@/api/recommendation'
import request from '@/api/request'
import DeliverableReview from '@/components/DeliverableReview.vue'
import ImChatPanel from '@/components/ImChatPanel.vue'

const activeTab = ref('')
const loading = ref(false)
const taskList = ref<any[]>([])
const searchKeyword = ref('')
const filterMode = ref<string | undefined>(undefined)
const dateRange = ref<any>(null)
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

// 各状态计数（从接口或本地统计）
const tabCounts = reactive<Record<string, number>>({})

const columns = [
  { title: '任务名称', key: 'title', ellipsis: true },
  { title: '预算', key: 'totalBudget', width: 120, align: 'right' as const },
  { title: '角色数', key: 'roleCount', width: 90, align: 'center' as const },
  { title: '状态', key: 'status', width: 96 },
  { title: '创建时间', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 100, align: 'right' as const },
]

// 状态映射（V1.1 色彩体系）
const statusLabelMap: Record<string, string> = {
  draft:       '草稿',
  published:   '招募中',
  in_progress: '进行中',
  reviewing:   '验收中',
  completed:   '已完成',
  closed:      '已关闭',
  cancelled:   '已取消',
}

const statusClassMap: Record<string, string> = {
  draft:       'status-draft',
  published:   'status-matching',
  in_progress: 'status-progress',
  reviewing:   'status-review',
  completed:   'status-completed',
  closed:      'status-closed',
  cancelled:   'status-closed',
}

const statusLabel = (s: string) => statusLabelMap[s] || s
const statusClass = (s: string) => statusClassMap[s] || 'status-draft'

function formatDate(d: string) {
  if (!d) return '—'
  const date = new Date(d)
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

async function fetchList() {
  loading.value = true
  try {
    const res = await taskApi.list({
      status: activeTab.value || undefined,
      keyword: searchKeyword.value || undefined,
      taskMode: filterMode.value || undefined,
      page: pagination.current,
      pageSize: pagination.pageSize,
    })
    taskList.value = res.list
    pagination.total = res.total
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  pagination.current = 1
  fetchList()
}

function handleSearch() {
  pagination.current = 1
  fetchList()
}

function handleTableChange(pag: any) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  fetchList()
}

function handleExport() {
  // TODO: 导出逻辑
}

// ===================== 任务详情抽屉 =====================
const taskDrawerVisible = ref(false)
const taskDetail = ref<any>(null)
const activeConversation = ref<any>(null)

const drawerStatusColor: Record<string, string> = {
  draft: 'default', pending_review: 'processing', published: 'blue',
  in_progress: 'green', completed: 'green', cancelled: 'red',
  reviewing: 'orange', closed: 'default',
}
const drawerStatusLabel: Record<string, string> = {
  draft: '草稿', pending_review: '审核中', published: '已发布',
  in_progress: '执行中', completed: '已完成', cancelled: '已取消',
  reviewing: '验收中', closed: '已关闭',
}
const drawerAssignColor: Record<string, string> = {
  invited: 'orange', accepted: 'green', rejected: 'red', expired: 'default', completed: 'purple',
}
const drawerAssignLabel: Record<string, string> = {
  invited: '待接单', accepted: '执行中', rejected: '已拒绝', expired: '已过期', completed: '已完成',
}

const drawerDeliverablesByRole = (roleId: number) =>
  (taskDetail.value?.deliverables || []).filter(
    (d: any) => taskDetail.value.roles.find((r: any) => r.taskRoleId === roleId)?.assignments
      .some((a: any) => a.assignmentId === d.assignmentId)
  )

async function openTaskDrawer(taskId: number) {
  taskDrawerVisible.value = true
  taskDetail.value = null
  activeConversation.value = null
  try {
    const res = await taskApi.detailFull(taskId)
    taskDetail.value = res.data ?? res
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  }
}

async function handleCancelTask() {
  if (!taskDetail.value) return
  await taskApi.cancel(taskDetail.value.taskId)
  message.success('任务已取消')
  const res = await taskApi.detailFull(taskDetail.value.taskId)
  taskDetail.value = res.data ?? res
  fetchList()
}

function openImPanel(assignment: any, role: any) {
  activeConversation.value = { assignment, role, taskId: taskDetail.value?.taskId }
}

async function submitReview(roleId: number, result: 'approved' | 'rejected', reviewNote?: string) {
  try {
    await taskApi.review(taskDetail.value.taskId, roleId, { result, reviewNote })
    message.success(result === 'approved' ? '验收通过 ✓' : '已退回')
    const res = await taskApi.detailFull(taskDetail.value.taskId)
    taskDetail.value = res.data ?? res
    fetchList()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

// ── 邀约抽屉 ──
const inviteDrawerVisible = ref(false)
const inviteRole = ref<any>(null)
const recommendedWorkers = ref<any[]>([])
const loadingWorkers = ref(false)
const invitingId = ref<number | null>(null)

async function openInviteDrawer(role: any) {
  inviteRole.value = role
  inviteDrawerVisible.value = true
  loadingWorkers.value = true
  try {
    const res = await recommendApi.forRole(role.taskRoleId)
    recommendedWorkers.value = (res as any)?.data || res || []
  } catch {
    try {
      const res2 = await request.get<any,any>('/workers', { params: { pageSize: 20 } })
      recommendedWorkers.value = res2.list || []
    } catch {
      recommendedWorkers.value = []
    }
  } finally {
    loadingWorkers.value = false
  }
}

async function handleInviteWorker(worker: any) {
  if (!inviteRole.value || !taskDetail.value) return
  invitingId.value = worker.workerId
  try {
    await request.post(`/tasks/${taskDetail.value.taskId}/roles/${inviteRole.value.taskRoleId}/invite/${worker.workerId}`)
    message.success(`已成功邀约 ${worker.realName}！`)
    inviteDrawerVisible.value = false
    const res = await taskApi.detailFull(taskDetail.value.taskId)
    taskDetail.value = res.data ?? res
    fetchList()
  } catch (err: any) {
    message.error(err?.message || '邀约失败')
  } finally {
    invitingId.value = null
  }
}

onMounted(fetchList)
</script>

<style scoped>
.task-list-page { padding-bottom: 32px; }

/* Tabs */
.task-tabs {
  margin-bottom: 0;
}

.task-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0 !important;
  padding: 0 4px;
}

.tab-with-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.tab-badge.draft     { background: #F0F0F0; color: #888888; }
.tab-badge.matching  { background: #D0DCFC; color: #0858F4; }
.tab-badge.progress  { background: #D0F4F0; color: #34B8A8; }
.tab-badge.review    { background: var(--color-accent-bg); color: #FC6400; }

/* 筛选条 */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border-light);
}

/* 表格 */
.task-table {
  margin-top: 4px;
}

/* 任务名称 */
.task-title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.task-title-cell:hover .task-name {
  color: var(--color-primary);
}

.task-mode-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.mode-pkg { background: var(--color-primary-bg-soft); }
.mode-day { background: var(--color-accent-bg); }

.task-name {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
  transition: color var(--duration-fast);
}

/* 预算 */
.budget-val {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* 角色数 */
.role-count {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* 时间 */
.time-text {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

/* 空状态 */
.empty-state {
  padding: 48px 0;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

/* 抽屉内样式 */
.drawer-assignment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.invite-worker-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: background .2s;
}
.invite-worker-card:hover {
  background: var(--color-bg-hover);
}
</style>
