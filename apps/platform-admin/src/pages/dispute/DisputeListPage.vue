<template>
  <div>
    <h2>争议仲裁</h2>
    <a-select v-model:value="status" placeholder="状态" allowClear @change="load" style="width: 160px; margin-bottom: 16px">
      <a-select-option value="pending">待受理</a-select-option>
      <a-select-option value="investigating">调查中</a-select-option>
      <a-select-option value="resolved_worker">已裁决(零工)</a-select-option>
      <a-select-option value="resolved_company">已裁决(企业)</a-select-option>
    </a-select>
    <a-table :dataSource="items" :columns="columns" :pagination="{ current: page, pageSize: 20, total }" @change="(p: any) => { page = p.current; load() }" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'sla'">
          <a-tag :color="record.sla === 'overdue' ? 'red' : record.sla === 'warning' ? 'orange' : 'green'">{{ record.sla }}</a-tag>
        </template>
        <template v-if="column.key === 'action'"><a @click="openDetail(record.id)">处理</a></template>
      </template>
    </a-table>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="detail ? `争议 #${detail.id}` : '争议详情'"
      width="600"
      placement="right"
    >
      <template v-if="detail">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px">
          <span style="font-weight: 600; font-size: 15px">{{ detail.taskTitle }}</span>
          <a-tag :color="detail.status === 'pending' ? 'orange' : detail.status === 'investigating' ? 'blue' : 'green'" style="margin-left: auto">{{ detail.status }}</a-tag>
        </div>

        <a-descriptions bordered :column="2" size="small" style="margin-bottom: 16px">
          <a-descriptions-item label="企业">{{ detail.companyName }}</a-descriptions-item>
          <a-descriptions-item label="零工">{{ detail.workerName }}</a-descriptions-item>
          <a-descriptions-item label="角色">{{ detail.roleName }}</a-descriptions-item>
          <a-descriptions-item label="涉及金额"><span style="color: #f5222d; font-weight: 600">¥{{ detail.amount?.toLocaleString() }}</span></a-descriptions-item>
          <a-descriptions-item label="发起方">{{ detail.initiatorType }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ detail.createdAt?.slice(0, 19) }}</a-descriptions-item>
        </a-descriptions>

        <a-card title="争议说明" size="small" style="margin-bottom: 16px">{{ detail.reason }}</a-card>
        <a-card v-if="detail.resolution" title="裁决结果" size="small" style="margin-bottom: 16px">
          <a-alert :message="detail.resolution" type="success" show-icon />
        </a-card>

        <!-- 操作区 -->
        <a-card v-if="['pending','investigating'].includes(detail.status)" title="🔨 仲裁操作">
          <a-button v-if="detail.status === 'pending'" type="primary" @click="accept" style="margin-bottom: 12px">受理争议</a-button>
          <template v-if="detail.status === 'investigating'">
            <a-form layout="vertical">
              <a-form-item label="裁决类型">
                <a-radio-group v-model:value="resolveType">
                  <a-radio value="full_settlement">全额结算给零工</a-radio>
                  <a-radio value="partial_settlement">部分结算</a-radio>
                  <a-radio value="full_refund">全额退款给企业</a-radio>
                  <a-radio value="negotiate">建议协商</a-radio>
                </a-radio-group>
              </a-form-item>
              <a-form-item v-if="resolveType === 'partial_settlement'" label="结算比例">
                <a-slider v-model:value="ratio" :min="0" :max="100" />
                <span>{{ ratio }}%</span>
              </a-form-item>
              <a-form-item label="裁决说明">
                <a-textarea v-model:value="explanation" :rows="4" placeholder="请详细说明裁决依据（至少10字）" />
              </a-form-item>
              <a-button type="primary" @click="resolve" :disabled="explanation.length < 10">确认裁决</a-button>
            </a-form>
          </template>
        </a-card>
      </template>
      <a-skeleton v-else active />
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { platformApi } from '@/api/platform'

const items = ref<any[]>([]), total = ref(0), page = ref(1), loading = ref(false), status = ref<string>()

// 详情抽屉
const drawerVisible = ref(false), detail = ref<any>(null)
const resolveType = ref('full_settlement'), ratio = ref(50), explanation = ref('')

const columns = [
  { title: '任务', dataIndex: 'taskTitle', key: 'taskTitle' },
  { title: '企业', dataIndex: 'companyName' },
  { title: '发起方', dataIndex: 'initiatorType' },
  { title: '状态', dataIndex: 'status' },
  { title: 'SLA', key: 'sla' },
  { title: '创建时间', dataIndex: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 10) },
  { title: '操作', key: 'action', width: 80 },
]

async function load() {
  loading.value = true
  const res = await platformApi.listDisputes({ page: page.value, pageSize: 20, status: status.value || undefined })
  items.value = res.items; total.value = res.total; loading.value = false
}

async function openDetail(id: number) {
  drawerVisible.value = true; detail.value = null
  resolveType.value = 'full_settlement'; ratio.value = 50; explanation.value = ''
  detail.value = await platformApi.getDispute(id)
}

async function accept() {
  await platformApi.acceptDispute(detail.value.id); message.success('已受理')
  detail.value = await platformApi.getDispute(detail.value.id); load()
}

async function resolve() {
  await platformApi.resolveDispute(detail.value.id, {
    type: resolveType.value,
    ratio: resolveType.value === 'partial_settlement' ? ratio.value : undefined,
    explanation: explanation.value,
  })
  message.success('裁决已生效')
  detail.value = await platformApi.getDispute(detail.value.id); load()
}

onMounted(load)
</script>
