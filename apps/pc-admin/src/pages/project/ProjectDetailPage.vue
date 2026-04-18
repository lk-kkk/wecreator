<template>
  <div class="page-container">
    <a-page-header :title="project?.name || '项目详情'" :sub-title="project?.projectNo"
      :ghost="false" @back="$router.back()" style="margin-bottom:16px">
      <template #tags>
        <a-tag :color="statusColor(project?.status)">{{ statusLabel(project?.status) }}</a-tag>
        <a-badge :color="riskColor(project?.riskLevel)" :text="riskLabel(project?.riskLevel)" />
      </template>
      <template #extra>
        <a-dropdown>
          <a-button>更多操作 <DownOutlined /></a-button>
          <template #overlay>
            <a-menu @click="onAction">
              <a-menu-item key="active">激活（进行中）</a-menu-item>
              <a-menu-item key="suspended">暂停</a-menu-item>
              <a-menu-item key="completed">标记完成</a-menu-item>
              <a-menu-item key="archived" danger>归档（不可逆）</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </template>
      <a-descriptions :column="4" size="small">
        <a-descriptions-item label="阶段">{{ phaseLabel(project?.phase) }}</a-descriptions-item>
        <a-descriptions-item label="预期交付">{{ project?.expectedDeliveryDate?.slice(0,10) || '未设定' }}</a-descriptions-item>
        <a-descriptions-item label="负责人">{{ project?.managerName || project?.managerId }}</a-descriptions-item>
        <a-descriptions-item label="客户所在地">{{ project?.clientLocation || '-' }}</a-descriptions-item>
      </a-descriptions>
    </a-page-header>

    <a-row :gutter="16">
      <!-- 左: 里程碑 -->
      <a-col :span="10">
        <a-card title="🏁 里程碑" :bordered="false" size="small">
          <template #extra>
            <a-button type="link" size="small" @click="showMsCreate = true">+ 新增</a-button>
          </template>
          <a-timeline v-if="milestones.length">
            <a-timeline-item v-for="m in milestones" :key="m.id"
              :color="m.status === 'completed' ? 'green' : m.status === 'overdue' ? 'red' : 'blue'">
              <div class="ms-item">
                <strong>{{ m.name }}</strong>
                <a-tag v-if="m.status==='completed'" color="success" size="small">已完成</a-tag>
                <a-tag v-else-if="m.status==='overdue'" color="error" size="small">已逾期</a-tag>
                <a-tag v-else color="processing" size="small">{{ m.plannedDate?.slice(0,10) }}</a-tag>
                <a-button v-if="m.status==='pending'" type="link" size="small"
                  @click="completeMilestone(m.id)">✓ 完成</a-button>
              </div>
              <div v-if="m.description" style="color:#999;font-size:12px">{{ m.description }}</div>
            </a-timeline-item>
          </a-timeline>
          <a-empty v-else description="暂无里程碑" />
        </a-card>
      </a-col>

      <!-- 右: 关联任务 -->
      <a-col :span="14">
        <a-card title="📋 关联任务" :bordered="false" size="small">
          <template #extra>
            <span style="color:#666;font-size:13px;margin-right:12px">
              关联预算：<strong style="color:var(--color-primary)">¥{{ totalBudget.toLocaleString() }}</strong>
            </span>
            <a-button type="primary" size="small" @click="createRelatedTask">
              <plus-outlined /> 新建关联任务
            </a-button>
          </template>
          <a-list :data-source="project?.tasks || []" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta :title="item.title">
                  <template #description>
                    <a-space>
                      <a-tag>{{ item.taskMode === 'daily_rate' ? '人天' : '任务包' }}</a-tag>
                      <a-tag :color="taskStatusColor(item.status)">{{ taskStatusLabel(item.status) }}</a-tag>
                      <span v-if="item.totalBudget" style="font-size:12px;color:#666">¥{{ Number(item.totalBudget).toLocaleString() }}</span>
                      <span v-for="r in item.roles" :key="r.id" style="font-size:12px;color:#999">
                        {{ r.roleName }}×{{ r.headcount }}
                      </span>
                    </a-space>
                  </template>
                </a-list-item-meta>
              </a-list-item>
            </template>
            <template #emptyDescription>暂无关联任务</template>
          </a-list>
        </a-card>

        <!-- 项目统计 -->
        <a-card :bordered="false" size="small" style="margin-top:12px">
          <a-row :gutter="16" justify="space-around">
            <a-col :span="8" style="text-align:center">
              <div style="font-size:24px;font-weight:700;color:var(--color-primary)">{{ (project?.tasks||[]).length }}</div>
              <div style="font-size:12px;color:#999">关联任务</div>
            </a-col>
            <a-col :span="8" style="text-align:center">
              <div style="font-size:24px;font-weight:700;color:#52c41a">{{ completedTaskCount }}</div>
              <div style="font-size:12px;color:#999">已完成任务</div>
            </a-col>
            <a-col :span="8" style="text-align:center">
              <div style="font-size:24px;font-weight:700;color:#faad14">{{ milestones.filter(m => m.status === 'overdue').length }}</div>
              <div style="font-size:12px;color:#999">逾期里程碑</div>
            </a-col>
          </a-row>
        </a-card>
      </a-col>
    </a-row>

    <!-- 新建里程碑弹窗 -->
    <a-modal v-model:open="showMsCreate" title="新增里程碑" @ok="handleMsCreate" :confirm-loading="msCreating">
      <a-form :label-col="{ span: 5 }" style="margin-top:16px">
        <a-form-item label="名称" required>
          <a-input v-model:value="msForm.name" placeholder="里程碑名称" :maxlength="50" />
        </a-form-item>
        <a-form-item label="计划日期" required>
          <a-date-picker v-model:value="msForm.plannedDate" style="width:100%" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea v-model:value="msForm.description" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { DownOutlined, PlusOutlined } from '@ant-design/icons-vue'
import request from '@/api/request'

const route = useRoute()
const router = useRouter()
const projectId = Number(route.params.id)
const project = ref<any>(null)
const milestones = ref<any[]>([])

const showMsCreate = ref(false)
const msCreating = ref(false)
const msForm = ref({ name: '', plannedDate: null as any, description: '' })

const totalBudget = computed(() =>
  (project.value?.tasks || []).reduce((sum: number, t: any) => sum + (Number(t.totalBudget) || 0), 0)
)
const completedTaskCount = computed(() =>
  (project.value?.tasks || []).filter((t: any) => t.status === 'completed').length
)

const statusColor = (s?: string) => {
  const m: Record<string, string> = { planning:'default', active:'processing', suspended:'warning', completed:'success', archived:'' }
  return m[s||''] || 'default'
}
const statusLabel = (s?: string) => {
  const m: Record<string, string> = { planning:'规划中', active:'进行中', suspended:'已暂停', completed:'已完成', archived:'已归档' }
  return m[s||''] || s || ''
}
const phaseLabel = (p?: string) => {
  const m: Record<string, string> = { requirement:'需求阶段', execution:'执行阶段', acceptance:'验收阶段' }
  return m[p||''] || p || '-'
}
const riskColor = (r?: string) => r === 'red' ? '#ff4d4f' : r === 'yellow' ? '#faad14' : '#52c41a'
const riskLabel = (r?: string) => r === 'red' ? '高风险' : r === 'yellow' ? '需关注' : '正常'
const taskStatusColor = (s: string) => {
  const m: Record<string, string> = { draft:'default', published:'blue', in_progress:'processing', completed:'success', closed:'default' }
  return m[s] || 'default'
}
const taskStatusLabel = (s: string) => {
  const m: Record<string, string> = { draft:'草稿', published:'招募中', in_progress:'执行中', reviewing:'验收中', completed:'已完成', closed:'已关闭' }
  return m[s] || s
}

async function fetchProject() {
  const res = await request.get(`/projects/${projectId}`)
  project.value = res.data
  milestones.value = res.data?.milestones || []
}

async function handleMsCreate() {
  if (!msForm.value.name || !msForm.value.plannedDate) return message.warning('请填写必要信息')
  msCreating.value = true
  try {
    await request.post(`/projects/${projectId}/milestones`, {
      name: msForm.value.name,
      plannedDate: msForm.value.plannedDate.format('YYYY-MM-DD'),
      description: msForm.value.description || undefined,
    })
    message.success('里程碑创建成功')
    showMsCreate.value = false
    msForm.value = { name: '', plannedDate: null, description: '' }
    fetchProject()
  } finally { msCreating.value = false }
}

async function completeMilestone(mid: number) {
  await request.post(`/projects/${projectId}/milestones/${mid}/complete`)
  message.success('里程碑已完成')
  fetchProject()
}

async function onAction({ key }: { key: string }) {
  try {
    await request.patch(`/projects/${projectId}/status`, { status: key })
    message.success('状态已更新')
    fetchProject()
  } catch (e: any) { message.error(e?.response?.data?.message || '操作失败') }
}

function createRelatedTask() {
  router.push({ path: '/task/create', query: { projectId: String(projectId) } })
}

onMounted(fetchProject)
</script>

<style scoped>
.ms-item { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
