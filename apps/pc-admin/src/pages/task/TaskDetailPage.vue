<template>
  <div class="task-detail-page">
    <!-- 顶部操作栏 -->
    <a-page-header
      :title="task?.title || '任务详情'"
      :sub-title="`#${taskId}`"
      @back="$router.back()"
    >
      <template #extra>
        <a-tag :color="statusColor[task?.status]">{{ statusLabel[task?.status] }}</a-tag>
        <a-button v-if="task?.status === 'published'" danger @click="handleCancel">取消任务</a-button>
      </template>
    </a-page-header>

    <a-spin :spinning="loading">
      <div class="detail-layout" v-if="task">
        <!-- ===================== 左栏：任务信息 ===================== -->
        <div class="col-left">
          <a-card title="基本信息" :bordered="false">
            <a-descriptions :column="1" size="small">
              <a-descriptions-item label="任务模式">{{ task.taskMode === 'task_package' ? '任务包' : '日薪制' }}</a-descriptions-item>
              <a-descriptions-item label="总预算">¥{{ task.totalBudget?.toLocaleString() }}</a-descriptions-item>
              <a-descriptions-item label="已锁定">¥{{ task.lockedAmount?.toLocaleString() }}</a-descriptions-item>
              <a-descriptions-item label="开始时间">{{ task.startDate ? dayjs(task.startDate).format('YYYY-MM-DD') : '—' }}</a-descriptions-item>
              <a-descriptions-item label="截止时间">{{ task.endDate ? dayjs(task.endDate).format('YYYY-MM-DD') : '—' }}</a-descriptions-item>
              <a-descriptions-item label="工作地点">{{ task.address || '远程' }}</a-descriptions-item>
              <a-descriptions-item label="发布时间">{{ task.publishedAt ? dayjs(task.publishedAt).format('MM-DD HH:mm') : '—' }}</a-descriptions-item>
            </a-descriptions>
            <a-divider />
            <div class="desc-text">{{ task.description || '暂无描述' }}</div>
          </a-card>
        </div>

        <!-- ===================== 中栏：角色 + 申请管理 + 交付物 ===================== -->
        <div class="col-center">
          <!-- V3.4: 申请管理 -->
          <a-card v-if="(task?.status === 'published' || task?.status === 'in_progress') && applications.length > 0" title="📝 申请管理" :bordered="false" class="role-card">
            <template #extra>
              <a-badge :count="pendingApplications.length" :number-style="{ backgroundColor: '#faad14' }" />
            </template>
            <div v-for="app in applications" :key="app.applicationId" class="application-row">
              <a-avatar :src="app.worker.avatarUrl || undefined" :size="36">{{ (app.worker.realName || '?')[0] }}</a-avatar>
              <div style="flex:1;min-width:0;margin-left:8px">
                <div style="font-weight:600">{{ app.worker.realName || `零工#${app.worker.workerId}` }}
                  <span style="font-weight:400;color:#999;font-size:12px;margin-left:4px">申请: {{ app.role.roleName }}</span>
                </div>
                <div style="font-size:12px;color:#666;margin-top:2px">{{ app.worker.city || '未知' }} · ⭐{{ (app.worker.avgRating || 0).toFixed(1) }} · {{ app.worker.completedCount || 0 }}单</div>
                <div style="font-size:12px;color:#888;margin-top:4px;font-style:italic">「{{ app.intro }}」</div>
                <div v-if="app.expectPay" style="font-size:12px;color:#ff4d4f;margin-top:2px">期望报酬: ¥{{ Number(app.expectPay).toLocaleString() }}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;margin-left:8px">
                <template v-if="app.status === 'pending'">
                  <a-popconfirm title="确认后零工将直接进入执行状态" @confirm="handleReviewApp(app.applicationId, 'approved')" ok-text="确认" cancel-text="取消">
                    <a-button type="primary" size="small">✅ 确认</a-button>
                  </a-popconfirm>
                  <a-button size="small" danger @click="showRejectModal(app.applicationId)">婩拒</a-button>
                </template>
                <a-tag v-else :color="app.status === 'approved' ? 'green' : 'red'">{{ app.status === 'approved' ? '已确认' : '已婩拒' }}</a-tag>
              </div>
            </div>
          </a-card>

          <a-card
            v-for="role in task.roles"
            :key="role.taskRoleId"
            :title="role.roleName"
            :bordered="false"
            class="role-card"
          >
            <template #extra>
              <span class="budget-badge">¥{{ Number(role.budget).toLocaleString() }} / 人</span>
              <a-tag>{{ role.headcount }} 人</a-tag>
            </template>

            <!-- 技能标签 -->
            <div v-if="role.skillTags" class="skill-tags">
              <a-tag v-for="tag in role.skillTags.split(',')" :key="tag" color="blue">{{ tag.trim() }}</a-tag>
            </div>

            <!-- 邀约按钮（角色有空位时显示） -->
            <div v-if="task?.status === 'published' || task?.status === 'in_progress'" style="margin-bottom:8px">
              <a-button size="small" type="primary" ghost @click="openInviteDrawer(role)">
                <team-outlined /> 邀约零工到此角色
              </a-button>
              <span style="color:#999;margin-left:8px;font-size:12px">
                已邀 {{ role.assignments?.length || 0 }} / {{ role.headcount }} 人
              </span>
            </div>

            <!-- 已接单零工 -->
            <div v-for="assignment in role.assignments" :key="assignment.assignmentId" class="assignment-row">
              <a-avatar :src="assignment.workerAvatar || undefined" :size="32">{{ (assignment.workerName || '?')[0] }}</a-avatar>
              <span class="worker-name">{{ assignment.workerName || `零工#${assignment.workerId}` }}</span>
              <a-progress :percent="assignment.progress" size="small" class="progress-bar" />
              <a-tag :color="assignStatusColor[assignment.status]">{{ assignStatusLabel[assignment.status] }}</a-tag>
              <a-button size="small" @click="openImPanel(assignment, role)">消息</a-button>
            </div>

            <!-- 交付物列表 -->
            <div v-if="deliverablesByRole(role.taskRoleId).length > 0">
              <a-divider orientation="left" plain>交付物</a-divider>
              <DeliverableReview
                v-for="d in deliverablesByRole(role.taskRoleId)"
                :key="d.deliverableId"
                :deliverable="d"
                @review="(result: 'approved' | 'rejected', note?: string) => submitReview(role.taskRoleId, result, note)"
              />
            </div>
          </a-card>
        </div>

        <!-- ===================== 右栏：IM 聊天面板 ===================== -->
        <div class="col-right">
          <ImChatPanel
            v-if="activeConversation"
            :conversation="activeConversation"
            :task-title="task.title"
          />
          <a-empty v-else description="点击零工旁【消息】按钮开始沟通" />
        </div>
      </div>
    </a-spin>

    <!-- 邀约零工抽屉 -->
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
          <div style="display:flex;align-items:center;gap:8px">
            <a-avatar :size="36" :style="{ background: 'var(--color-primary)' }">{{ (w.realName || '?')[0] }}</a-avatar>
            <div>
              <div style="font-weight:600">{{ w.realName || '未填写' }}</div>
              <div style="font-size:12px;color:#999">{{ w.city || '—' }} · 评分 {{ (w.avgRating || 0).toFixed(1) }} · 完成{{ w.completedCount || 0 }}单</div>
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
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { TeamOutlined } from '@ant-design/icons-vue'
import { taskApi } from '@/api/task'
import { recommendApi } from '@/api/recommendation'
import request from '@/api/request'
import DeliverableReview from '@/components/DeliverableReview.vue'
import ImChatPanel from '@/components/ImChatPanel.vue'

const route = useRoute()
const taskId = Number(route.params.id)

const loading = ref(false)
const task = ref<any>(null)
const activeConversation = ref<any>(null)
const applications = ref<any[]>([])
const pendingApplications = computed(() => applications.value.filter((a: any) => a.status === 'pending'))

const statusColor: Record<string, string> = {
  draft: 'default', pending_review: 'processing', published: 'blue',
  in_progress: 'green', completed: 'green', cancelled: 'red',
}
const statusLabel: Record<string, string> = {
  draft: '草稿', pending_review: '审核中', published: '已发布',
  in_progress: '执行中', completed: '已完成', cancelled: '已取消',
}
const assignStatusColor: Record<string, string> = {
  invited: 'orange', accepted: 'green', rejected: 'red', expired: 'default', completed: 'purple',
}
const assignStatusLabel: Record<string, string> = {
  invited: '待接单', accepted: '执行中', rejected: '已拒绝', expired: '已过期', completed: '已完成',
}

const deliverablesByRole = (roleId: number) =>
  (task.value?.deliverables || []).filter(
    (d: any) => task.value.roles.find((r: any) => r.taskRoleId === roleId)?.assignments
      .some((a: any) => a.assignmentId === d.assignmentId)
  )

async function load() {
  loading.value = true
  try {
    const res = await taskApi.detailFull(taskId)
    task.value = res.data ?? res
    loadApplications()
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function handleCancel() {
  await taskApi.cancel(taskId)
  message.success('任务已取消')
  load()
}

function openImPanel(assignment: any, role: any) {
  activeConversation.value = { assignment, role, taskId }
}

// V3.4: 申请管理
async function loadApplications() {
  try {
    const res = await request.get<any,any>(`/tasks/${taskId}/applications`)
    applications.value = res.list || res.data?.list || []
  } catch {
    applications.value = []
  }
}

async function handleReviewApp(appId: number, action: 'approved' | 'rejected', reason?: string) {
  try {
    const body: any = { action }
    if (reason) body.rejectReason = reason
    await request.post(`/tasks/${taskId}/applications/${appId}/review`, body)
    message.success(action === 'approved' ? '已确认，零工已进入执行状态' : '已婩拒')
    load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function showRejectModal(appId: number) {
  const reason = window.prompt('请输入婩拒原因（必填）')
  if (reason && reason.trim()) {
    handleReviewApp(appId, 'rejected', reason.trim())
  } else if (reason !== null) {
    message.warning('婩拒时必须填写原因')
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
    // Fallback to general search
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
  if (!inviteRole.value) return
  invitingId.value = worker.workerId
  try {
    await request.post(`/tasks/${taskId}/roles/${inviteRole.value.taskRoleId}/invite/${worker.workerId}`)
    message.success(`已成功邀约 ${worker.realName}！`)
    inviteDrawerVisible.value = false
    load()
  } catch (err: any) {
    message.error(err?.message || '邀约失败')
  } finally {
    invitingId.value = null
  }
}

async function submitReview(roleId: number, result: 'approved' | 'rejected', reviewNote?: string) {
  try {
    await taskApi.review(taskId, roleId, { result, reviewNote })
    message.success(result === 'approved' ? '验收通过 ✓' : '已退回')
    load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

onMounted(load)
</script>

<style scoped>
.task-detail-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.detail-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 12px;
  padding: 0 16px 16px;
  overflow: hidden;
}
.col-left,
.col-center,
.col-right {
  overflow-y: auto;
  height: 100%;
}
.role-card {
  margin-bottom: 12px;
}
.skill-tags {
  margin-bottom: 8px;
}
.assignment-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-light);
}
.worker-name {
  min-width: 80px;
  font-size: 13px;
}
.progress-bar {
  flex: 1;
}
.budget-badge {
  color: var(--color-warning);
  font-weight: 600;
  margin-right: 8px;
}
.desc-text {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
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
.application-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
}
.application-row:last-child {
  border-bottom: none;
}
</style>
