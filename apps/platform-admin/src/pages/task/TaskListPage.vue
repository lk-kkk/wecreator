<template>
  <div>
    <h2>任务监控</h2>
    <a-space style="margin-bottom: 16px">
      <a-input-search v-model:value="search" placeholder="搜索任务标题" @search="load" style="width: 200px" />
      <a-select v-model:value="status" placeholder="状态" allowClear @change="load" style="width: 140px">
        <a-select-option v-for="s in ['draft','published','in_progress','reviewing','completed','closed','cancelled']" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <a-select v-model:value="mode" placeholder="模式" allowClear @change="load" style="width: 120px">
        <a-select-option value="task_package">任务包</a-select-option>
        <a-select-option value="daily_rate">人天</a-select-option>
      </a-select>
    </a-space>
    <a-table :dataSource="items" :columns="columns" :pagination="{ current: page, pageSize: 20, total }" @change="(p: any) => { page = p.current; load() }" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.hasDispute ? 'orange' : record.status === 'completed' ? 'green' : 'blue'">{{ record.status }}{{ record.hasDispute ? ' ⚡' : '' }}</a-tag>
        </template>
        <template v-if="column.key === 'budget'">¥{{ record.totalBudget?.toLocaleString() }}</template>
        <template v-if="column.key === 'action'"><a @click="openDetail(record.id)">详情</a></template>
      </template>
    </a-table>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="detail?.title || '任务详情'"
      width="680"
      placement="right"
    >
      <template v-if="detail">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px">
          <a-tag color="blue">{{ detail.mode }}</a-tag>
          <a-tag :color="detail.status === 'completed' ? 'green' : 'blue'">{{ detail.status }}</a-tag>
          <span style="color: #999; margin-left: auto">{{ detail.company?.name }}</span>
          <a-popconfirm title="确认强制关闭？" @confirm="forceClose" v-if="!['completed','closed','cancelled'].includes(detail.status)">
            <a-button danger size="small">强制关闭</a-button>
          </a-popconfirm>
        </div>

        <a-descriptions bordered :column="2" size="small" style="margin-bottom: 16px">
          <a-descriptions-item label="总预算"><span style="font-weight: 600">¥{{ detail.totalBudget?.toLocaleString() }}</span></a-descriptions-item>
          <a-descriptions-item label="锁定资金"><span style="color: #faad14">¥{{ detail.lockedAmount?.toLocaleString() }}</span></a-descriptions-item>
          <a-descriptions-item label="截止日期">{{ detail.endDate?.slice(0, 10) || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ detail.createdAt?.slice(0, 10) }}</a-descriptions-item>
        </a-descriptions>

        <a-tabs size="small">
          <a-tab-pane key="roles" tab="角色 & 分配">
            <div v-for="role in detail.roles" :key="role.id" style="margin-bottom: 16px">
              <h4 style="margin-bottom: 8px">{{ role.roleName }} <span style="color: #999">(¥{{ role.budget?.toLocaleString() }} × {{ role.headcount }}人)</span></h4>
              <a-table :dataSource="role.assignments" :columns="assignCols" size="small" :pagination="false" />
            </div>
            <a-empty v-if="!detail.roles?.length" description="暂无角色" />
          </a-tab-pane>
          <a-tab-pane key="disputes" :tab="`争议 (${detail.disputes?.length || 0})`">
            <a-table :dataSource="detail.disputes" :columns="disputeCols" size="small" :pagination="false" />
          </a-tab-pane>
          <a-tab-pane key="txns" :tab="`资金 (${detail.transactions?.length || 0})`">
            <a-table :dataSource="detail.transactions" :columns="txnCols" size="small" :pagination="false" />
          </a-tab-pane>
        </a-tabs>
      </template>
      <a-skeleton v-else active />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { platformApi } from '@/api/platform'

const items = ref<any[]>([]), total = ref(0), page = ref(1), loading = ref(false)
const search = ref(''), status = ref<string>(), mode = ref<string>()

// 详情抽屉
const drawerVisible = ref(false), detail = ref<any>(null)

const columns = [
  { title: '标题', dataIndex: 'title', key: 'title' },
  { title: '企业', dataIndex: 'companyName', key: 'companyName' },
  { title: '模式', dataIndex: 'mode', key: 'mode' },
  { title: '状态', key: 'status' },
  { title: '预算', key: 'budget' },
  { title: '角色数', dataIndex: 'roleCount', key: 'roleCount' },
  { title: '创建时间', dataIndex: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 10) },
  { title: '操作', key: 'action', width: 80 },
]

const assignCols = [
  { title: '零工', dataIndex: 'workerName' },
  { title: '状态', dataIndex: 'status' },
  { title: '进度', dataIndex: 'progress', customRender: ({ text }: any) => text + '%' },
]

const disputeCols = [
  { title: '状态', dataIndex: 'status' },
  { title: '原因', dataIndex: 'reason' },
  { title: '时间', dataIndex: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 10) },
]

const txnCols = [
  { title: '类型', dataIndex: 'type' },
  { title: '方向', dataIndex: 'direction' },
  { title: '金额', dataIndex: 'amount', customRender: ({ text }: any) => '¥' + text?.toLocaleString() },
  { title: '状态', dataIndex: 'status' },
  { title: '时间', dataIndex: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 10) },
]

async function load() {
  loading.value = true
  const res = await platformApi.listTasks({ page: page.value, pageSize: 20, search: search.value || undefined, status: status.value || undefined, mode: mode.value || undefined })
  items.value = res.items; total.value = res.total; loading.value = false
}

async function openDetail(id: number) {
  drawerVisible.value = true; detail.value = null
  detail.value = await platformApi.getTask(id)
}

async function forceClose() {
  await platformApi.forceCloseTask(detail.value.id, '管理员强制关闭')
  message.success('已关闭')
  detail.value = await platformApi.getTask(detail.value.id)
  load()
}

onMounted(load)
</script>
