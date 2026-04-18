<template>
  <div class="page-container">
    <a-page-header title="项目管理" :ghost="false" style="margin-bottom:16px">
      <template #extra>
        <a-radio-group v-model:value="viewMode" button-style="solid" size="small">
          <a-radio-button value="list"><AppstoreOutlined /> 列表</a-radio-button>
          <a-radio-button value="board"><ProjectOutlined /> 看板</a-radio-button>
        </a-radio-group>
        <a-button type="primary" @click="showCreate = true">
          <PlusOutlined /> 新建项目
        </a-button>
      </template>
    </a-page-header>

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
        :pagination="{ current: page, pageSize: 20, total, showTotal: (t:number) => `共 ${t} 项` }"
        @change="onTableChange" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a @click="goDetail(record.id)">{{ record.name }}</a>
            <div style="color:#999;font-size:12px">{{ record.projectNo }}</div>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
          <template v-if="column.key === 'riskLevel'">
            <a-badge :color="riskColor(record.riskLevel)" :text="riskLabel(record.riskLevel)" />
          </template>
          <template v-if="column.key === 'progress'">
            <a-progress :percent="record.progress" size="small" :stroke-color="riskColor(record.riskLevel)" />
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新建项目弹窗 -->
    <a-modal v-model:open="showCreate" title="新建项目" @ok="handleCreate" :confirm-loading="creating">
      <a-form :label-col="{ span: 5 }">
        <a-form-item label="项目名称" required>
          <a-input v-model:value="form.name" placeholder="输入项目名称" :maxlength="100" />
        </a-form-item>
        <a-form-item label="客户所在地">
          <a-input v-model:value="form.clientLocation" placeholder="选填" />
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
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { PlusOutlined, AppstoreOutlined, ProjectOutlined } from '@ant-design/icons-vue'
import { request } from '@/api/request'

const router = useRouter()
const viewMode = ref<'list' | 'board'>('board')
const loading = ref(false)
const list = ref<any[]>([])
const boardData = ref<any[]>([])
const total = ref(0)
const page = ref(1)

const showCreate = ref(false)
const creating = ref(false)
const form = ref({ name: '', clientLocation: '', description: '', expectedDeliveryDate: null as any })

const columns = [
  { title: '项目', key: 'name', dataIndex: 'name' },
  { title: '状态', key: 'status', dataIndex: 'status', width: 100 },
  { title: '阶段', dataIndex: 'phase', width: 100 },
  { title: '风险', key: 'riskLevel', width: 80 },
  { title: '进度', key: 'progress', width: 160 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
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

async function fetchList() {
  loading.value = true
  try {
    const res = await request.get('/projects', { params: { page: page.value, pageSize: 20 } })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
    // 计算进度
    list.value.forEach((p: any) => {
      const tasks = p.milestones?.length || 0
      p.progress = p.progress ?? 0
    })
  } finally { loading.value = false }
}

async function fetchBoard() {
  try {
    const res = await request.get('/projects/board')
    boardData.value = res.data || []
  } catch {}
}

function onTableChange(pag: any) { page.value = pag.current; fetchList() }

async function handleCreate() {
  if (!form.value.name) return message.warning('请输入项目名称')
  creating.value = true
  try {
    const body: any = { name: form.value.name }
    if (form.value.clientLocation) body.clientLocation = form.value.clientLocation
    if (form.value.description) body.description = form.value.description
    if (form.value.expectedDeliveryDate) body.expectedDeliveryDate = form.value.expectedDeliveryDate.format('YYYY-MM-DD')
    await request.post('/projects', body)
    message.success('项目创建成功')
    showCreate.value = false
    form.value = { name: '', clientLocation: '', description: '', expectedDeliveryDate: null }
    fetchList(); fetchBoard()
  } finally { creating.value = false }
}

function goDetail(id: number) { router.push(`/project/${id}`) }

onMounted(() => { fetchList(); fetchBoard() })
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
