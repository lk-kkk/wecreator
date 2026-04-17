<template>
  <div class="task-list-page">
    <!-- 页头 -->
    <div class="wc-page-header">
      <div>
        <h1 class="wc-page-title">任务广场</h1>
        <p class="wc-page-subtitle">管理所有任务的发布、执行与验收，审批零工报名</p>
      </div>
      <a-button type="primary" size="large" @click="$router.push('/task/create')">
        <template #icon><plus-outlined /></template>
        发布任务
      </a-button>
    </div>

    <!-- 内容卡片 -->
    <div class="wc-card">
      <!-- 状态 Tabs — V3.5 新增「待审批」Tab -->
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
        <!-- V3.5 待审批 Tab -->
        <a-tab-pane key="pending_approval">
          <template #tab>
            <span class="tab-with-badge">
              待审批
              <span v-if="tabCounts.pending_approval" class="tab-badge pending">{{ tabCounts.pending_approval }}</span>
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
          :placeholder="['创建开始', '创建结束']"
          format="MM-DD"
          @change="handleSearch"
        />
        <div style="flex: 1;" />
        <a-button @click="handleExport">
          <template #icon><export-outlined /></template>
          导出
        </a-button>
      </div>

      <!-- 任务表格 — V3.5 新增报名信息列 -->
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
              ¥{{ record.totalBudget >= 10000
                    ? (record.totalBudget / 10000).toFixed(1) + '万'
                    : record.totalBudget.toLocaleString() }}
            </span>
          </template>

          <!-- 角色数 -->
          <template v-if="column.key === 'roleCount'">
            <span class="role-count">
              <team-outlined style="color: var(--color-text-tertiary); margin-right: 4px;" />
              {{ record.roleCount }}
            </span>
          </template>

          <!-- V3.5 报名信息列 -->
          <template v-if="column.key === 'applicationInfo'">
            <span
              v-if="record.pendingApplications > 0"
              class="app-info app-info-pending"
              @click.stop="openApplicationDrawer(record)"
            >
              <span class="app-dot"></span>
              {{ record.pendingApplications }}人待审核
            </span>
            <span
              v-else-if="(record.approvedApplications || 0) + (record.rejectedApplications || 0) > 0"
              class="app-info app-info-done"
              @click.stop="openApplicationDrawer(record)"
            >
              <template v-if="record.approvedApplications > 0">✅{{ record.approvedApplications }}</template>
              <template v-if="record.approvedApplications > 0 && record.rejectedApplications > 0"> / </template>
              <template v-if="record.rejectedApplications > 0">❌{{ record.rejectedApplications }}</template>
            </span>
            <span v-else class="app-info app-info-empty">—</span>
          </template>

          <!-- 状态 -->
          <template v-if="column.key === 'status'">
            <span class="status-tag" :class="statusClass(record.status)">
              {{ statusLabel(record.status) }}
            </span>
          </template>

          <!-- 创建时间 -->
          <template v-if="column.key === 'createdAt'">
            <span class="time-text">{{ formatDate(record.createdAt) }}</span>
          </template>

          <!-- 操作 -->
          <template v-if="column.key === 'action'">
            <a-space :size="4">
              <a-button type="link" size="small" @click="openTaskDrawer(record.taskId)">详情</a-button>
              <a-button
                v-if="record.status === 'reviewing'"
                type="link" size="small"
                style="color: var(--color-accent);"
                @click="openTaskDrawer(record.taskId)"
              >验收</a-button>
            </a-space>
          </template>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">暂无任务</div>
            <div class="empty-desc">
              {{ activeTab === 'pending_approval' ? '没有待审批的报名申请' :
                 activeTab ? '该状态下没有任务' : '发布您的第一个任务，开始高效用工' }}
            </div>
            <a-button
              v-if="!activeTab"
              type="primary" style="margin-top: 16px;"
              @click="$router.push('/task/create')"
            >立即发布任务</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- ═══════════════ V3.5 报名管理抽屉 ═══════════════ -->
    <a-drawer
      v-model:open="appDrawerVisible"
      :width="560"
      placement="right"
      :destroyOnClose="true"
      class="app-drawer"
    >
      <template #title>
        <div class="app-drawer-title">
          <div class="app-drawer-heading">
            <span>报名管理</span>
            <span class="app-drawer-task-name">— {{ appDrawerTask?.title }}</span>
          </div>
          <div class="app-drawer-subtitle">
            <span class="status-tag" :class="statusClass(appDrawerTask?.status || '')">{{ statusLabel(appDrawerTask?.status || '') }}</span>
            <span class="sub-sep">·</span>
            <span>{{ appDrawerTask?.roleCount || 0 }}个角色岗位</span>
            <span class="sub-sep">·</span>
            <span class="sub-highlight">待审核 {{ appDrawerPendingCount }}人</span>
          </div>
        </div>
      </template>

      <!-- 状态筛选 Tabs -->
      <a-tabs v-model:activeKey="appFilterStatus" size="small" class="app-filter-tabs">
        <a-tab-pane key="">
          <template #tab>全部({{ applications.length }})</template>
        </a-tab-pane>
        <a-tab-pane key="pending">
          <template #tab>待审核({{ applications.filter(a => a.status === 'pending').length }})</template>
        </a-tab-pane>
        <a-tab-pane key="approved">
          <template #tab>已通过({{ applications.filter(a => a.status === 'approved').length }})</template>
        </a-tab-pane>
        <a-tab-pane key="rejected">
          <template #tab>已婉拒({{ applications.filter(a => a.status === 'rejected').length }})</template>
        </a-tab-pane>
      </a-tabs>

      <!-- 角色筛选 + 批量操作 -->
      <div class="app-toolbar">
        <a-select
          v-model:value="appFilterRole"
          placeholder="全部角色"
          allow-clear
          style="width: 160px"
          size="small"
        >
          <a-select-option v-for="role in appRoles" :key="role.taskRoleId" :value="role.taskRoleId">
            {{ role.roleName }} ({{ role.headcount }}人)
          </a-select-option>
        </a-select>
        <div style="flex: 1" />
        <template v-if="selectedAppIds.length > 0">
          <a-popconfirm
            :title="`确认通过已选的 ${selectedAppIds.length} 个报名？`"
            @confirm="handleBatchApprove"
            ok-text="确认" cancel-text="取消"
          >
            <a-button type="primary" size="small" ghost>
              <check-outlined /> 批量确认({{ selectedAppIds.length }})
            </a-button>
          </a-popconfirm>
          <a-button size="small" danger ghost @click="showBatchRejectModal" style="margin-left: 8px;">
            <close-outlined /> 批量婉拒({{ selectedAppIds.length }})
          </a-button>
        </template>
      </div>

      <!-- 报名卡片列表 -->
      <a-spin :spinning="appLoading">
        <div v-if="filteredApplications.length === 0 && !appLoading" class="app-empty">
          <a-empty :description="appFilterStatus === 'pending' ? '没有待审核的报名' : '暂无报名记录'" />
        </div>
        <div
          v-for="app in filteredApplications"
          :key="app.applicationId"
          class="app-card"
          :class="{ 'app-card-selected': selectedAppIds.includes(app.applicationId) }"
        >
          <!-- 卡片头 -->
          <div class="app-card-header">
            <a-checkbox
              v-if="app.status === 'pending'"
              :checked="selectedAppIds.includes(app.applicationId)"
              @change="toggleAppSelection(app.applicationId)"
              class="app-checkbox"
            />
            <div v-else class="app-checkbox-placeholder" />
            <a-avatar :size="40" :style="{ background: 'var(--color-primary)', flexShrink: 0 }">
              {{ (app.workerName || '?')[0] }}
            </a-avatar>
            <div class="app-card-info">
              <div class="app-card-name">{{ app.workerName || '未实名用户' }}</div>
              <div class="app-card-role">申请角色: <strong>{{ app.roleName }}({{ app.roleLevel || '—' }})</strong></div>
            </div>
            <div class="app-card-time">{{ formatRelativeTime(app.createdAt) }}</div>
          </div>

          <!-- 卡片体 -->
          <div class="app-card-body">
            <div class="app-card-stats">
              <span class="stat-item">⭐ {{ (app.avgRating || 0).toFixed(1) }}分</span>
              <span class="stat-divider">·</span>
              <span class="stat-item">已完成{{ app.completedCount || 0 }}单</span>
              <span class="stat-divider">·</span>
              <span class="stat-item" :class="app.verified ? 'stat-verified' : 'stat-unverified'">
                {{ app.verified ? '✅已认证' : '⚠️未认证' }}
              </span>
            </div>
            <div v-if="app.introduction" class="app-card-intro">「{{ app.introduction }}」</div>
            <div v-if="app.skills && app.skills.length > 0" class="app-card-skills">
              <a-tag v-for="skill in app.skills.slice(0, 3)" :key="skill" color="blue" class="skill-tag">{{ skill }}</a-tag>
              <span v-if="app.skills.length > 3" class="skill-more">+{{ app.skills.length - 3 }}</span>
            </div>
          </div>

          <!-- 卡片操作 -->
          <div class="app-card-actions">
            <template v-if="app.status === 'approved'">
              <span class="app-result-tag app-result-approved">✅ 已通过</span>
              <span class="app-result-time">{{ formatRelativeTime(app.reviewedAt) }}</span>
            </template>
            <template v-else-if="app.status === 'rejected'">
              <a-tooltip :title="app.rejectReason || '未填写原因'">
                <span class="app-result-tag app-result-rejected">❌ 已婉拒</span>
              </a-tooltip>
              <span class="app-result-time">{{ formatRelativeTime(app.reviewedAt) }}</span>
            </template>
            <template v-else>
              <template v-if="app.slotFull">
                <a-tooltip title="该角色已无空余名额，无法确认">
                  <span class="app-slot-full">名额已满</span>
                </a-tooltip>
              </template>
              <template v-else>
                <div style="flex: 1" />
                <a-button size="small" @click="viewWorkerProfile(app.workerId)">查看主页</a-button>
                <a-button size="small" danger ghost @click="showRejectModal(app)">婉拒</a-button>
                <a-popconfirm
                  title="确认通过该零工的报名？"
                  @confirm="handleApproveOne(app)"
                  ok-text="确认" cancel-text="取消"
                >
                  <a-button size="small" type="primary"><check-outlined /> 确认</a-button>
                </a-popconfirm>
              </template>
            </template>
          </div>
        </div>
      </a-spin>
    </a-drawer>

    <!-- 婉拒原因弹窗 -->
    <a-modal
      v-model:open="rejectModalVisible"
      :title="rejectBatch ? `批量婉拒 ${selectedAppIds.length} 个报名` : `婉拒 — ${rejectTarget?.workerName}`"
      @ok="handleRejectConfirm"
      :ok-button-props="{ disabled: rejectReason.trim().length < 10 }"
      ok-text="确认婉拒" cancel-text="取消"
    >
      <div style="margin-bottom: 8px; color: var(--color-text-secondary); font-size: 13px;">
        请填写婉拒原因（10-200字），将通知零工
      </div>
      <a-textarea
        v-model:value="rejectReason"
        placeholder="例如：该角色需要3年以上相关经验，暂不符合岗位要求..."
        :maxlength="200" :rows="4" show-count
      />
    </a-modal>

    <!-- ═══════════════ 任务详情抽屉 ═══════════════ -->
    <a-drawer
      v-model:open="taskDrawerVisible"
      :title="taskDetail?.title || '任务详情'"
      width="780" placement="right" :destroyOnClose="true"
    >
      <template v-if="taskDetail">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px">
          <a-tag :color="drawerStatusColor[taskDetail.status]">{{ drawerStatusLabel[taskDetail.status] }}</a-tag>
          <span style="color: var(--color-text-tertiary); font-size: 13px">#{{ taskDetail.taskId }}</span>
          <div style="flex: 1" />
          <a-button v-if="taskDetail.status === 'published'" danger size="small" @click="handleCancelTask">取消任务</a-button>
        </div>
        <a-card title="基本信息" :bordered="false" size="small" style="margin-bottom: 16px">
          <a-descriptions :column="2" size="small">
            <a-descriptions-item label="任务模式">{{ taskDetail.taskMode === 'task_package' ? '📦 任务包' : '📅 日薪制' }}</a-descriptions-item>
            <a-descriptions-item label="总预算"><span style="font-weight: 600">¥{{ taskDetail.totalBudget?.toLocaleString() }}</span></a-descriptions-item>
            <a-descriptions-item label="已锁定"><span style="color: var(--color-warning)">¥{{ taskDetail.lockedAmount?.toLocaleString() }}</span></a-descriptions-item>
            <a-descriptions-item label="工作地点">{{ taskDetail.address || '远程' }}</a-descriptions-item>
            <a-descriptions-item label="开始时间">{{ taskDetail.startDate ? dayjs(taskDetail.startDate).format('YYYY-MM-DD') : '—' }}</a-descriptions-item>
            <a-descriptions-item label="截止时间">{{ taskDetail.endDate ? dayjs(taskDetail.endDate).format('YYYY-MM-DD') : '—' }}</a-descriptions-item>
          </a-descriptions>
          <div style="margin-top: 8px; font-size: 13px; color: var(--color-text-secondary)">{{ taskDetail.description || '暂无描述' }}</div>
        </a-card>
        <a-card
          v-for="role in taskDetail.roles" :key="role.taskRoleId"
          :title="role.roleName" :bordered="false" size="small" style="margin-bottom: 12px"
        >
          <template #extra>
            <span style="color: var(--color-warning); font-weight: 600; margin-right: 8px">¥{{ Number(role.budget).toLocaleString() }} / 人</span>
            <a-tag>{{ role.headcount }} 人</a-tag>
          </template>
          <div v-if="role.skillTags" style="margin-bottom: 8px">
            <a-tag v-for="tag in role.skillTags.split(',')" :key="tag" color="blue">{{ tag.trim() }}</a-tag>
          </div>
          <div v-if="taskDetail.status === 'published' || taskDetail.status === 'in_progress'" style="margin-bottom: 8px">
            <a-button size="small" type="primary" ghost @click="openInviteDrawer(role)">
              <team-outlined /> 邀约零工到此角色
            </a-button>
            <span style="color: var(--color-text-tertiary); margin-left: 8px; font-size: 12px">
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
              v-for="d in drawerDeliverablesByRole(role.taskRoleId)" :key="d.deliverableId"
              :deliverable="d"
              @review="(result: 'approved' | 'rejected', note?: string) => submitReview(role.taskRoleId, result, note)"
            />
          </div>
        </a-card>
        <a-card v-if="activeConversation" title="💬 消息" :bordered="false" size="small" style="margin-top: 12px">
          <ImChatPanel :conversation="activeConversation" :task-title="taskDetail.title" />
        </a-card>
      </template>
      <a-skeleton v-else active />
    </a-drawer>

    <!-- 邀约零工抽屉 -->
    <a-drawer v-model:open="inviteDrawerVisible" :title="`邀约零工 — ${inviteRole?.roleName || ''}`" width="400">
      <a-spin :spinning="loadingWorkers">
        <div v-if="recommendedWorkers.length === 0 && !loadingWorkers">
          <a-empty description="暂无可推荐的零工" />
        </div>
        <div v-for="w in recommendedWorkers" :key="w.workerId" class="invite-worker-card">
          <div style="display: flex; align-items: center; gap: 8px">
            <a-avatar :size="36" style="background: var(--color-primary)">{{ (w.realName || '?')[0] }}</a-avatar>
            <div>
              <div style="font-weight: 600">{{ w.realName || '未填写' }}</div>
              <div style="font-size: 12px; color: var(--color-text-tertiary)">{{ w.city || '—' }} · 评分 {{ (w.avgRating || 0).toFixed(1) }} · 完成{{ w.completedCount || 0 }}单</div>
            </div>
          </div>
          <a-button type="primary" size="small" :loading="invitingId === w.workerId" @click="handleInviteWorker(w)">邀约</a-button>
        </div>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import {
  PlusOutlined, TeamOutlined, ExportOutlined,
  CheckOutlined, CloseOutlined,
} from '@ant-design/icons-vue'
import { taskApi } from '@/api/task'
import { recommendApi } from '@/api/recommendation'
import request from '@/api/request'
import DeliverableReview from '@/components/DeliverableReview.vue'
import ImChatPanel from '@/components/ImChatPanel.vue'

// ╔══════════════════════════════════════════════════════════════╗
// ║  任务列表                                                    ║
// ╚══════════════════════════════════════════════════════════════╝

const activeTab = ref('')
const loading = ref(false)
const taskList = ref<any[]>([])
const searchKeyword = ref('')
const filterMode = ref<string | undefined>(undefined)
const dateRange = ref<any>(null)
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const tabCounts = reactive<Record<string, number>>({})

// V3.5 表格列定义 — 新增「报名信息」列
const columns = [
  { title: '任务名称', key: 'title', ellipsis: true },
  { title: '预算', key: 'totalBudget', width: 110, align: 'right' as const },
  { title: '角色', key: 'roleCount', width: 72, align: 'center' as const },
  { title: '报名信息', key: 'applicationInfo', width: 140, align: 'center' as const },
  { title: '状态', key: 'status', width: 96 },
  { title: '创建时间', key: 'createdAt', width: 120 },
  { title: '操作', key: 'action', width: 100, align: 'right' as const },
]

const statusLabelMap: Record<string, string> = {
  draft: '草稿', published: '招募中', in_progress: '进行中',
  reviewing: '验收中', completed: '已完成', closed: '已关闭', cancelled: '已取消',
}
const statusClassMap: Record<string, string> = {
  draft: 'status-draft', published: 'status-matching', in_progress: 'status-progress',
  reviewing: 'status-review', completed: 'status-completed', closed: 'status-closed', cancelled: 'status-closed',
}
const statusLabel = (s: string) => statusLabelMap[s] || s
const statusClass = (s: string) => statusClassMap[s] || 'status-draft'

function formatDate(d: string) {
  if (!d) return '—'
  const date = new Date(d)
  return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatRelativeTime(d: string) {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}小时前`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}天前`
  return formatDate(d)
}

async function fetchList() {
  loading.value = true
  try {
    const params: Record<string, any> = {
      keyword: searchKeyword.value || undefined,
      taskMode: filterMode.value || undefined,
      page: pagination.current,
      pageSize: pagination.pageSize,
    }
    // V3.5: 待审批Tab使用特殊筛选参数
    if (activeTab.value === 'pending_approval') {
      params.hasPendingApplications = true
    } else if (activeTab.value) {
      params.status = activeTab.value
    }
    const res = await taskApi.list(params)
    taskList.value = res.list || []
    pagination.total = res.total || 0
    // 更新Tab计数
    if (res.counts) {
      Object.assign(tabCounts, res.counts)
    }
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
  message.info('导出功能开发中...')
}

// ────────────────────────────────────────────────────────────
// V3.5 报名管理抽屉
// ────────────────────────────────────────────────────────────

const appDrawerVisible = ref(false)
const appDrawerTask = ref<any>(null)
const appLoading = ref(false)
const applications = ref<any[]>([])
const appRoles = ref<any[]>([])
const appFilterStatus = ref('')
const appFilterRole = ref<number | undefined>(undefined)
const selectedAppIds = ref<number[]>([])

const appDrawerPendingCount = computed(() =>
  applications.value.filter(a => a.status === 'pending').length
)

const filteredApplications = computed(() => {
  let list = applications.value
  if (appFilterStatus.value) {
    list = list.filter(a => a.status === appFilterStatus.value)
  }
  if (appFilterRole.value) {
    list = list.filter(a => a.roleId === appFilterRole.value)
  }
  return list
})

async function openApplicationDrawer(task: any) {
  appDrawerTask.value = task
  appDrawerVisible.value = true
  appFilterStatus.value = ''
  appFilterRole.value = undefined
  selectedAppIds.value = []
  await loadApplications(task.taskId)
}

async function loadApplications(taskId: number) {
  appLoading.value = true
  try {
    const res = await request.get<any, any>(`/tasks/${taskId}/applications`)
    const data = res.data ?? res
    applications.value = data.applications || data.list || []
    appRoles.value = data.roles || []
  } catch {
    applications.value = []
    appRoles.value = []
  } finally {
    appLoading.value = false
  }
}

function toggleAppSelection(id: number) {
  const idx = selectedAppIds.value.indexOf(id)
  if (idx >= 0) {
    selectedAppIds.value.splice(idx, 1)
  } else {
    selectedAppIds.value.push(id)
  }
}

async function handleApproveOne(app: any) {
  try {
    await request.post(`/tasks/${appDrawerTask.value.taskId}/applications/${app.applicationId}/review`, {
      action: 'approve',
    })
    message.success(`已通过 ${app.workerName} 的报名`)
    await loadApplications(appDrawerTask.value.taskId)
    fetchList()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function handleBatchApprove() {
  try {
    await request.post(`/tasks/${appDrawerTask.value.taskId}/applications/batch-review`, {
      applicationIds: selectedAppIds.value,
      action: 'approve',
    })
    message.success(`已批量通过 ${selectedAppIds.value.length} 个报名`)
    selectedAppIds.value = []
    await loadApplications(appDrawerTask.value.taskId)
    fetchList()
  } catch (e: any) {
    message.error(e?.message || '批量操作失败')
  }
}

// 婩拒 Modal
const rejectModalVisible = ref(false)
const rejectReason = ref('')
const rejectTarget = ref<any>(null)
const rejectBatch = ref(false)

function showRejectModal(app: any) {
  rejectTarget.value = app
  rejectBatch.value = false
  rejectReason.value = ''
  rejectModalVisible.value = true
}

function showBatchRejectModal() {
  rejectBatch.value = true
  rejectTarget.value = null
  rejectReason.value = ''
  rejectModalVisible.value = true
}

async function handleRejectConfirm() {
  if (rejectReason.value.trim().length < 10) {
    message.warning('婩拒原因至少10字')
    return
  }
  try {
    if (rejectBatch.value) {
      await request.post(`/tasks/${appDrawerTask.value.taskId}/applications/batch-review`, {
        applicationIds: selectedAppIds.value,
        action: 'reject',
        rejectReason: rejectReason.value.trim(),
      })
      message.success(`已批量婩拒 ${selectedAppIds.value.length} 个报名`)
      selectedAppIds.value = []
    } else if (rejectTarget.value) {
      await request.post(
        `/tasks/${appDrawerTask.value.taskId}/applications/${rejectTarget.value.applicationId}/review`,
        { action: 'reject', rejectReason: rejectReason.value.trim() }
      )
      message.success(`已婩拒 ${rejectTarget.value.workerName}`)
    }
    rejectModalVisible.value = false
    await loadApplications(appDrawerTask.value.taskId)
    fetchList()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function viewWorkerProfile(workerId: number) {
  window.open(`/worker/pool?detail=${workerId}`, '_blank')
}

// ────────────────────────────────────────────────────────────
// 任务详情抽屉
// ────────────────────────────────────────────────────────────

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

/* ======= Tabs ======= */
.task-tabs { margin-bottom: 0; }
.task-tabs :deep(.ant-tabs-nav) { margin-bottom: 0 !important; padding: 0 4px; }
.tab-with-badge { display: inline-flex; align-items: center; gap: 6px; }
.tab-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9px; font-size: 11px; font-weight: 600; line-height: 1;
}
.tab-badge.draft    { background: #F0F0F0; color: #888888; }
.tab-badge.matching { background: #D0DCFC; color: #0858F4; }
.tab-badge.pending  { background: #FDE8E0; color: #E8383C; }
.tab-badge.progress { background: #D0F4F0; color: #34B8A8; }
.tab-badge.review   { background: var(--color-accent-bg); color: #FC6400; }

/* ======= 筛选条 ======= */
.filter-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 0; border-top: 1px solid var(--color-border-light);
}

/* ======= 表格 ======= */
.task-table { margin-top: 4px; }
.task-title-cell { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.task-title-cell:hover .task-name { color: var(--color-primary); }
.task-mode-badge {
  width: 24px; height: 24px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
}
.mode-pkg { background: var(--color-primary-bg-soft); }
.mode-day { background: var(--color-accent-bg); }
.task-name {
  font-size: 14px; color: var(--color-text-primary);
  font-weight: 500; transition: color var(--duration-fast);
}
.budget-val { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.role-count { font-size: 13px; color: var(--color-text-secondary); }
.time-text  { font-size: 13px; color: var(--color-text-tertiary); }

/* ======= V3.5 报名信息列 ======= */
.app-info {
  font-size: 13px; cursor: pointer; border-radius: 4px;
  padding: 2px 8px; transition: background var(--duration-fast);
}
.app-info:hover { background: var(--color-bg-hover); }
.app-info-pending {
  color: var(--color-primary); font-weight: 500;
  display: inline-flex; align-items: center; gap: 5px;
}
.app-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-error); flex-shrink: 0;
  animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.app-info-done { color: var(--color-text-tertiary); font-size: 12px; }
.app-info-empty { color: var(--color-text-quaternary); }

/* ======= 空状态 ======= */
.empty-state { padding: 48px 0; text-align: center; }
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px; }
.empty-desc { font-size: 13px; color: var(--color-text-tertiary); }

/* ======= V3.5 报名管理抽屉 ======= */
.app-drawer-title { line-height: 1.4; }
.app-drawer-heading { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.app-drawer-task-name { font-weight: 400; color: var(--color-text-secondary); margin-left: 4px; }
.app-drawer-subtitle {
  font-size: 13px; color: var(--color-text-tertiary); margin-top: 4px;
  display: flex; align-items: center; gap: 6px;
}
.sub-sep { color: var(--color-border); }
.sub-highlight { color: var(--color-primary); font-weight: 500; }

.app-filter-tabs { margin-bottom: 0; }
.app-filter-tabs :deep(.ant-tabs-nav) { margin-bottom: 12px !important; }

.app-toolbar {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 16px; padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.app-empty { padding: 40px 0; }

/* 报名卡片 */
.app-card {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 12px;
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
}
.app-card:hover {
  border-color: var(--color-primary-border);
  box-shadow: 0 2px 8px rgba(8, 88, 244, 0.06);
}
.app-card-selected {
  border-color: var(--color-primary) !important;
  background: var(--color-primary-bg-soft);
}

.app-card-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
}
.app-checkbox { flex-shrink: 0; }
.app-checkbox-placeholder { width: 16px; flex-shrink: 0; }
.app-card-info { flex: 1; min-width: 0; }
.app-card-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.app-card-role { font-size: 12px; color: var(--color-text-tertiary); margin-top: 2px; }
.app-card-role strong { color: var(--color-text-secondary); font-weight: 500; }
.app-card-time { font-size: 12px; color: var(--color-text-quaternary); white-space: nowrap; flex-shrink: 0; }

.app-card-body { padding-left: 26px; margin-bottom: 10px; }
.app-card-stats {
  display: flex; align-items: center; gap: 4px;
  font-size: 12px; color: var(--color-text-tertiary); margin-bottom: 6px;
}
.stat-item { white-space: nowrap; }
.stat-divider { color: var(--color-border); }
.stat-verified { color: var(--color-success); }
.stat-unverified { color: var(--color-warning); }

.app-card-intro {
  font-size: 13px; color: var(--color-text-secondary);
  line-height: 1.5; margin-bottom: 6px;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}

.app-card-skills { display: flex; flex-wrap: wrap; gap: 4px; }
.skill-tag { font-size: 11px !important; margin: 0 !important; }
.skill-more { font-size: 11px; color: var(--color-text-quaternary); line-height: 22px; }

.app-card-actions {
  display: flex; align-items: center; gap: 8px;
  padding-top: 10px; border-top: 1px solid var(--color-border-light);
  padding-left: 26px;
}

.app-result-tag {
  font-size: 13px; font-weight: 500; padding: 2px 8px;
  border-radius: 4px;
}
.app-result-approved { color: var(--color-success); background: var(--color-success-bg, #f0fff0); }
.app-result-rejected { color: var(--color-error); background: var(--color-error-bg, #fff0f0); cursor: help; }
.app-result-time { font-size: 12px; color: var(--color-text-quaternary); }

.app-slot-full {
  font-size: 12px; color: var(--color-text-quaternary);
  background: var(--color-bg-hover); padding: 2px 8px; border-radius: 4px;
}

/* ======= 任务详情抽屉 ======= */
.drawer-assignment-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; border-bottom: 1px solid var(--color-border-light);
}
.invite-worker-card {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px; border: 1px solid var(--color-border-light);
  border-radius: 8px; margin-bottom: 8px; transition: background .2s;
}
.invite-worker-card:hover { background: var(--color-bg-hover); }
</style>