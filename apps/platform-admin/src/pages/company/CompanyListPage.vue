<template>
  <div>
    <h2>企业管理</h2>
    <a-space style="margin-bottom: 16px">
      <a-input-search v-model:value="search" placeholder="搜索企业名/信用代码" @search="load" style="width: 240px" />
      <a-select v-model:value="status" placeholder="审核状态" allowClear style="width: 140px" @change="load">
        <a-select-option value="pending">待审核</a-select-option>
        <a-select-option value="active">已通过</a-select-option>
        <a-select-option value="suspended">已冻结</a-select-option>
      </a-select>
    </a-space>
    <a-table :dataSource="items" :columns="columns" :pagination="{ current: page, pageSize: 20, total }" @change="(p: any) => { page = p.current; load() }" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'active' ? 'green' : record.status === 'pending' ? 'orange' : 'red'">{{ record.status }}</a-tag>
        </template>
        <template v-if="column.key === 'balance'">¥{{ record.balance?.toLocaleString() }}</template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a @click="openDetail(record.id)">详情</a>
            <a-popconfirm v-if="record.status === 'pending'" title="审核通过？" @confirm="approve(record.id)"><a style="color: green">通过</a></a-popconfirm>
            <a v-if="record.status === 'active'" style="color: red" @click="showFreeze(record, 'freeze')">冻结</a>
            <a v-if="record.status === 'suspended'" style="color: green" @click="showFreeze(record, 'unfreeze')">解冻</a>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 冻结弹窗 -->
    <a-modal v-model:open="freezeModal" :title="freezeAction === 'freeze' ? '冻结企业' : '解冻企业'" @ok="doFreeze">
      <a-input v-model:value="freezeReason" placeholder="请输入原因" />
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="detail?.name || '企业详情'"
      width="640"
      placement="right"
      :loading="drawerLoading"
    >
      <template v-if="detail">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
          <a-avatar :size="48" style="background: #1890ff; font-size: 20px">{{ (detail.name || '企')[0] }}</a-avatar>
          <div>
            <h3 style="margin: 0">{{ detail.name }}</h3>
            <span style="color: #999">{{ detail.creditCode }}</span>
          </div>
          <a-tag :color="detail.status === 'active' ? 'green' : detail.status === 'pending' ? 'orange' : 'red'" style="margin-left: auto">{{ detail.status }}</a-tag>
        </div>

        <a-descriptions bordered :column="2" size="small" style="margin-bottom: 20px">
          <a-descriptions-item label="联系邮箱">{{ detail.contactEmail || '-' }}</a-descriptions-item>
          <a-descriptions-item label="行业">{{ detail.industryTag || '-' }}</a-descriptions-item>
          <a-descriptions-item label="注册时间">{{ detail.createdAt?.slice(0, 10) }}</a-descriptions-item>
          <a-descriptions-item label="任务数">{{ detail.taskCount }}</a-descriptions-item>
          <a-descriptions-item label="可用余额"><span style="color: #52c41a; font-weight: 600">¥{{ detail.balance?.toLocaleString() }}</span></a-descriptions-item>
          <a-descriptions-item label="锁定余额"><span style="color: #faad14">¥{{ detail.lockedBalance?.toLocaleString() }}</span></a-descriptions-item>
          <a-descriptions-item label="累计充值">¥{{ detail.totalRecharge?.toLocaleString() }}</a-descriptions-item>
          <a-descriptions-item label="累计结算">¥{{ detail.totalSettlement?.toLocaleString() }}</a-descriptions-item>
        </a-descriptions>

        <a-tabs size="small">
          <a-tab-pane key="tasks" tab="任务列表">
            <a-table :dataSource="detail.tasks" :columns="taskCols" rowKey="id" size="small" :pagination="false" />
          </a-tab-pane>
          <a-tab-pane key="users" tab="子账号">
            <a-table :dataSource="detail.users" :columns="userCols" rowKey="id" size="small" :pagination="false" />
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
const search = ref(''), status = ref<string>()
const freezeModal = ref(false), freezeAction = ref(''), freezeReason = ref(''), freezeId = ref(0)

// 详情抽屉
const drawerVisible = ref(false), drawerLoading = ref(false), detail = ref<any>(null)

const columns = [
  { title: '企业名称', dataIndex: 'name', key: 'name' },
  { title: '信用代码', dataIndex: 'creditCode', key: 'creditCode' },
  { title: '状态', key: 'status' },
  { title: '余额', key: 'balance' },
  { title: '任务数', dataIndex: 'taskCount', key: 'taskCount' },
  { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 10) },
  { title: '操作', key: 'action', width: 200 },
]

const taskCols = [
  { title: '标题', dataIndex: 'title' },
  { title: '状态', dataIndex: 'status' },
  { title: '预算', dataIndex: 'budget', customRender: ({ text }: any) => '¥' + text?.toLocaleString() },
  { title: '创建时间', dataIndex: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 10) },
]

const userCols = [
  { title: '姓名', dataIndex: 'name' },
  { title: '角色', dataIndex: 'role' },
  { title: '状态', dataIndex: 'status' },
]

async function load() {
  loading.value = true
  const res = await platformApi.listCompanies({ page: page.value, pageSize: 20, search: search.value || undefined, status: status.value || undefined })
  items.value = res.items; total.value = res.total; loading.value = false
}

async function openDetail(id: number) {
  drawerVisible.value = true; drawerLoading.value = true; detail.value = null
  detail.value = await platformApi.getCompany(id)
  drawerLoading.value = false
}

async function approve(id: number) { await platformApi.approveCompany(id); message.success('已通过'); load() }
function showFreeze(r: any, action: string) { freezeId.value = r.id; freezeAction.value = action; freezeReason.value = ''; freezeModal.value = true }
async function doFreeze() { await platformApi.freezeCompany(freezeId.value, { action: freezeAction.value, reason: freezeReason.value }); freezeModal.value = false; message.success('操作成功'); load() }

onMounted(load)
</script>
