<template>
  <div class="page-container">
    <a-page-header title="项目管理" :ghost="false" style="margin-bottom:12px">
      <template #extra>
        <a-radio-group v-model:value="viewMode" button-style="solid" size="small">
          <a-radio-button value="list"><AppstoreOutlined /> 列表</a-radio-button>
          <a-radio-button value="board"><ProjectOutlined /> 看板</a-radio-button>
        </a-radio-group>
        <a-button type="primary" @click="openCreate">
          <PlusOutlined /> 新建项目
        </a-button>
      </template>
    </a-page-header>

    <!-- 筛选区 -->
    <a-card :bordered="false" style="margin-bottom:12px" size="small">
      <a-row :gutter="16" align="middle">
        <a-col :span="7">
          <a-input-search v-model:value="searchKeyword" placeholder="搜索项目名称/编号" @search="fetchList" allow-clear />
        </a-col>
        <a-col :span="5">
          <a-select v-model:value="filterStatus" placeholder="状态筛选" allow-clear style="width:100%" @change="fetchList">
            <a-select-option value="planning">规划中</a-select-option>
            <a-select-option value="active">进行中</a-select-option>
            <a-select-option value="suspended">已暂停</a-select-option>
            <a-select-option value="completed">已完成</a-select-option>
            <a-select-option value="archived">已归档</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <a-select v-model:value="filterManager" placeholder="负责人筛选" allow-clear style="width:100%" @change="fetchList">
            <a-select-option v-for="m in managerOptions" :key="m.value" :value="m.value">{{ m.label }}</a-select-option>
          </a-select>
        </a-col>
        <a-col>
          <a-button @click="resetFilters">重置</a-button>
        </a-col>
      </a-row>
    </a-card>

    <!-- 看板视图 -->
    <div v-if="viewMode === 'board'" class="board-grid">
      <a-card v-for="p in boardData" :key="p.id" hoverable size="small"
        :class="['board-card', `risk-${p.riskLevel}`]" @click="goDetail(p.id)">
        <template #title>
          <div class="board-title">
            <a-tag :color="statusColor(p.status)" size="small">{{ statusLabel(p.status) }}</a-tag>
            <span>{{ p.name }}</span>
          </div>
        </template>
        <a-progress :percent="p.progress" :stroke-color="riskColor(p.riskLevel)" size="small" />
        <div class="board-meta">
          <span>📋 {{ p.completedTaskCount }}/{{ p.taskCount }} 任务</span>
          <span>🏁 {{ p.completedMilestoneCount }}/{{ p.milestoneCount }} 里程碑</span>
        </div>
        <div v-if="p.overdueMilestoneCount > 0" class="board-warning">
          ⚠️ {{ p.overdueMilestoneCount }} 个里程碑已逾期
        </div>
      </a-card>
    </div>

    <!-- 列表视图 -->
    <a-card v-else :bordered="false">
      <a-table :columns="columns" :data-source="list" :loading="loading"
        :pagination="{ current: page, pageSize: 20, total, showTotal: (t: number) => `共 ${t} 项` }"
        @change="onTableChange" row-key="id" size="middle">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a @click="goDetail(record.id)" style="font-weight:500">{{ record.name }}</a>
            <div style="color:#999;font-size:11px">{{ record.projectNo }}</div>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
          <template v-if="column.key === 'managerName'">
            {{ record.managerName || record.managerId }}
          </template>
          <template v-if="column.key === 'taskCount'">
            {{ (record.tasks || []).length }}
          </template>
          <template v-if="column.key === 'riskLevel'">
            <a-badge :color="riskColor(record.riskLevel)" :text="riskLabel(record.riskLevel)" />
          </template>
          <template v-if="column.key === 'progress'">
            <a-progress :percent="calcProgress(record)" size="small" :stroke-color="riskColor(record.riskLevel)" />
          </template>
          <template v-if="column.key === 'action'">
            <a @click="goDetail(record.id)">详情</a>
            <a-divider type="vertical" />
            <a-popconfirm
              v-if="record.status !== 'archived'"
              title="确认归档？归档后项目不可编辑"
              @confirm="archiveProject(record.id)"
            >
              <a style="color:#ff4d4f">归档</a>
            </a-popconfirm>
            <span v-else style="color:#bbb">已归档</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建项目弹窗 -->
    <a-modal v-model:open="showCreate" title="新建项目" @ok="handleCreate" :confirm-loading="creating" :width="520">
      <a-form :label-col="{ span: 6 }" style="margin-top:16px">
        <a-form-item label="项目名称" required>
          <a-input v-model:value="form.name" placeholder="输入项目名称" :maxlength="100" />
        </a-form-item>
        <a-form-item label="项目负责人">
          <a-select v-model:value="form.managerId" placeholder="默认为当前用户" allow-clear :options="managerOptions" />
        </a-form-item>
        <a-form-item label="客户所在地">
          <a-input v-model:value="form.clientLocation" placeholder="选填，如：北京市" />
        </a-form-item>
        <a-form-item label="项目描述">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="选填" />
        </a-form-item>
        <a-form-item label="预期交付日">
          <a-date-picker v-model:value="form.expectedDeliveryDate" style="width:100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, AppstoreOutlined, ProjectOutlined } from '@ant-design/icons-vue'
import request from '@/api/request'

const router = useRouter()
// V3.7: /project/board 路由使用看板视图，其他地方使用列表
const _route = useRoute()
const viewMode = ref<'list' | 'board'>(_route.path.includes('/project/board') ? 'board' : 'list')
watch(viewMode, (v) => {
  const targetPath = v === 'board' ? '/project/board' : '/project/list'
  if (_route.path !== targetPath) router.replace(targetPath)
})
const loading = ref(false)
const list = ref<any[]>([])
const boardData = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const searchKeyword = ref('')
const filterStatus = ref<string | undefined>()
const filterManager = ref<number | undefined>()
const managerOptions = ref<{ value: number; label: string }[]>([])

const showCreate = ref(false)
const creating = ref(false)
const form = ref({
  name: '', clientLocation: '', description: '',
  expectedDeliveryDate: null as any, managerId: null as number | null,
})

const columns = [
  { title: '项目', key: 'name', dataIndex: 'name' },
  { title: '状态', key: 'status', dataIndex: 'status', width: 100 },
  { title: '阶段', dataIndex: 'phase', width: 90 },
  { title: '负责人', key: 'managerName', width: 90 },
  { title: '任务数', key: 'taskCount', width: 75, align: 'center' as const },
  { title: '风险', key: 'riskLevel', width: 80 },
  { title: '进度', key: 'progress', width: 150 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 150, customRender: ({ text }: any) => text?.slice(0, 10) },
  { title: '操作', key: 'action', width: 110 },
]

const statusMap: Record<string, { label: string; color: string }> = {
  planning: { label: '规划中', color: 'default' },
  active: { label: '进行中', color: 'processing' },
  suspended: { label: '已暂停', color: 'warning' },
  completed: { label: '已完成', color: 'success' },
  archived: { label: '已归档', color: '' },
}
const statusColor = (s: string) => statusMap[s]?.color || 'default'
const statusLabel = (s: string) => statusMap[s]?.label || s
const riskColor = (r: string) => r === 'red' ? '#ff4d4f' : r === 'yellow' ? '#faad14' : '#52c41a'
const riskLabel = (r: string) => r === 'red' ? '高风险' : r === 'yellow' ? '需关注' : '正常'
const calcProgress = (p: any) => {
  const tasks = p.tasks || []
  if (!tasks.length) return 0
  return Math.round(tasks.filter((t: any) => t.status === 'completed').length / tasks.length * 100)
}

async function loadManagers() {
  try {
    const res = await request.get('/admin/subaccounts')
    managerOptions.value = (res.data || []).map((u: any) => ({ value: u.id, label: u.name }))
  } catch {}
}

async function fetchList() {
  loading.value = true
  try {
    const params: any = { page: page.value, pageSize: 20 }
    if (filterStatus.value) params.status = filterStatus.value
    if (searchKeyword.value) params.keyword = searchKeyword.value
    const res = await request.get('/projects', { params })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } finally { loading.value = false }
}

async function fetchBoard() {
  try {
    const res = await request.get('/projects/board')
    boardData.value = res.data || []
  } catch {}
}

function resetFilters() {
  searchKeyword.value = ''
  filterStatus.value = undefined
  filterManager.value = undefined
  page.value = 1
  fetchList()
}

function onTableChange(pag: any) { page.value = pag.current; fetchList() }

function openCreate() {
  form.value = { name: '', clientLocation: '', description: '', expectedDeliveryDate: null, managerId: null }
  showCreate.value = true
}

async function handleCreate() {
  if (!form.value.name.trim()) return message.warning('请输入项目名称')
  creating.value = true
  try {
    const body: any = { name: form.value.name }
    if (form.value.clientLocation) body.clientLocation = form.value.clientLocation
    if (form.value.description) body.description = form.value.description
    if (form.value.expectedDeliveryDate) body.expectedDeliveryDate = form.value.expectedDeliveryDate.format('YYYY-MM-DD')
    if (form.value.managerId) body.managerId = form.value.managerId
    await request.post('/projects', body)
    message.success('项目创建成功')
    showCreate.value = false
    fetchList(); fetchBoard()
  } finally { creating.value = false }
}

async function archiveProject(id: number) {
  try {
    await request.patch(`/projects/${id}/status`, { status: 'archived' })
    message.success('项目已归档')
    fetchList(); fetchBoard()
  } catch (e: any) { message.error(e?.response?.data?.message || '归档失败') }
}

function goDetail(id: number) { router.push(`/project/${id}`) }

onMounted(() => { fetchList(); fetchBoard(); loadManagers() })
</script>

<style scoped>
.board-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.board-card { border-radius: 8px; transition: box-shadow .2s; }
.board-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.1); }
.board-card.risk-red { border-left: 3px solid #ff4d4f; }
.board-card.risk-yellow { border-left: 3px solid #faad14; }
.board-card.risk-green { border-left: 3px solid #52c41a; }
.board-title { display: flex; align-items: center; gap: 8px; }
.board-meta { display: flex; gap: 16px; margin-top: 8px; font-size: 13px; color: #666; }
.board-warning { margin-top: 6px; color: #ff4d4f; font-size: 12px; }
</style>
