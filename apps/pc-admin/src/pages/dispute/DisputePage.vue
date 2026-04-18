<template>
  <div class="page-container">
    <a-page-header title="争议仲裁管理" sub-title="Dispute Management" />

    <!-- 统计卡片 -->
    <a-row :gutter="16" class="stat-row">
      <a-col :span="6">
        <a-card size="small"><a-statistic title="待处理" :value="stats.pending" value-style="color:#FC6400" /></a-card>
      </a-col>
      <a-col :span="6">
        <a-card size="small"><a-statistic title="处理中" :value="stats.processing" value-style="color:#0858F4" /></a-card>
      </a-col>
      <a-col :span="6">
        <a-card size="small"><a-statistic title="已解决" :value="stats.resolved" value-style="color:#38D048" /></a-card>
      </a-col>
      <a-col :span="6">
        <a-card size="small"><a-statistic title="总数" :value="stats.total" /></a-card>
      </a-col>
    </a-row>

    <!-- 筛选 -->
    <a-card class="filter-card">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-select v-model:value="filters.status" placeholder="状态筛选" allow-clear @change="fetchList">
            <a-select-option value="pending">待处理</a-select-option>
            <a-select-option value="under_review">处理中</a-select-option>
            <a-select-option value="resolved">已解决</a-select-option>
            <a-select-option value="cancelled">已撤销</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-input-search v-model:value="filters.keyword" placeholder="搜索任务名/描述" @search="fetchList" />
        </a-col>
      </a-row>
    </a-card>

    <!-- 列表 -->
    <a-card>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" @change="onTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
          </template>
          <template v-if="column.key === 'amount'">
            ¥{{ record.disputeAmount?.toLocaleString() }}
          </template>
          <template v-if="column.key === 'action'">
            <a-button type="link" @click="viewDetail(record)">查看</a-button>
            <a-button v-if="record.status==='pending'" type="link" danger @click="cancelDispute(record)">撤销</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:open="drawer.open" :title="`争议 #${drawer.data?.id}`" width="560" placement="right">
      <template v-if="drawer.data">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="任务">{{ drawer.data.taskTitle }}</a-descriptions-item>
          <a-descriptions-item label="类型">{{ drawer.data.disputeType }}</a-descriptions-item>
          <a-descriptions-item label="描述">{{ drawer.data.description }}</a-descriptions-item>
          <a-descriptions-item label="争议金额">¥{{ drawer.data.disputeAmount?.toLocaleString() }}</a-descriptions-item>
          <a-descriptions-item label="状态"><a-tag :color="statusColor(drawer.data.status)">{{ statusLabel(drawer.data.status) }}</a-tag></a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ drawer.data.createdAt }}</a-descriptions-item>
        </a-descriptions>
        <a-divider>证据材料</a-divider>
        <a-empty v-if="!drawer.data.evidences?.length" description="暂无证据" />
        <a-timeline v-else>
          <a-timeline-item v-for="e in drawer.data.evidences" :key="e.id">
            <div><strong>{{ e.uploaderType }}</strong> — {{ e.description }}</div>
            <a v-if="e.fileUrl" :href="e.fileUrl" target="_blank">查看附件</a>
          </a-timeline-item>
        </a-timeline>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import request from '@/api/request'

const loading = ref(false)
const list = ref<any[]>([])
const stats = reactive({ pending: 0, processing: 0, resolved: 0, total: 0 })
const filters = reactive({ status: undefined as string | undefined, keyword: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const drawer = reactive({ open: false, data: null as any })

const columns = [
  { title: '#', dataIndex: 'id', key: 'id', width: 60 },
  { title: '任务', dataIndex: 'taskTitle', key: 'taskTitle', ellipsis: true },
  { title: '类型', dataIndex: 'disputeType', key: 'disputeType', width: 120 },
  { title: '争议金额', key: 'amount', width: 120 },
  { title: '状态', key: 'status', width: 100 },
  { title: '发起方', dataIndex: 'initiatorType', key: 'initiatorType', width: 80 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' as const },
]

const statusMap: Record<string, { label: string; color: string }> = {
  pending:      { label: '待处理', color: 'orange' },
  under_review: { label: '处理中', color: 'blue' },
  resolved:     { label: '已解决', color: 'green' },
  cancelled:    { label: '已撤销', color: 'default' },
}
const statusLabel = (s: string) => statusMap[s]?.label ?? s
const statusColor = (s: string) => statusMap[s]?.color ?? 'default'

async function fetchList() {
  loading.value = true
  try {
    const res = await request.get<any, any>('/disputes', {
      params: { page: pagination.current, pageSize: pagination.pageSize, status: filters.status, keyword: filters.keyword || undefined },
    })
    const data = res.data ?? res
    list.value = data.list ?? data.disputes ?? data
    pagination.total = data.total ?? list.value.length
    // simple stats
    stats.total = pagination.total
    stats.pending = list.value.filter((d: any) => d.status === 'pending').length
    stats.processing = list.value.filter((d: any) => d.status === 'under_review').length
    stats.resolved = list.value.filter((d: any) => d.status === 'resolved').length
  } catch { /* fallback */ } finally { loading.value = false }
}

function onTableChange(pag: any) {
  pagination.current = pag.current
  fetchList()
}

async function viewDetail(record: any) {
  try {
    const res = await request.get<any, any>(`/disputes/${record.id}`)
    drawer.data = res.data ?? res
    drawer.open = true
  } catch { drawer.data = record; drawer.open = true }
}

async function cancelDispute(record: any) {
  try {
    await request.patch<any, any>(`/disputes/${record.id}/cancel`)
    message.success('争议已撤销')
    fetchList()
  } catch { message.error('撤销失败') }
}

onMounted(fetchList)
</script>

<style scoped>
.page-container { padding: 0; }
.stat-row { margin-bottom: 16px; }
.filter-card { margin-bottom: 16px; }
</style>
