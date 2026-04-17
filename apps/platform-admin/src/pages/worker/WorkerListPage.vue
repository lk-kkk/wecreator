<template>
  <div>
    <h2>零工管理</h2>
    <a-space style="margin-bottom: 16px">
      <a-input-search v-model:value="search" placeholder="搜索姓名" @search="load" style="width: 200px" />
      <a-select v-model:value="status" placeholder="状态" allowClear @change="load" style="width: 120px">
        <a-select-option value="active">正常</a-select-option>
        <a-select-option value="suspended">封禁</a-select-option>
      </a-select>
      <a-select v-model:value="verified" placeholder="认证" allowClear @change="load" style="width: 120px">
        <a-select-option value="true">已认证</a-select-option>
        <a-select-option value="false">未认证</a-select-option>
      </a-select>
    </a-space>
    <a-table :dataSource="items" :columns="columns" :pagination="{ current: page, pageSize: 20, total }" @change="(p: any) => { page = p.current; load() }" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'"><a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status }}</a-tag></template>
        <template v-if="column.key === 'verified'"><a-tag :color="record.isVerified ? 'blue' : 'default'">{{ record.isVerified ? '已认证' : '未认证' }}</a-tag></template>
        <template v-if="column.key === 'action'">
          <a-space>
            <a @click="openDetail(record.id)">详情</a>
            <a-popconfirm v-if="record.status === 'active'" title="确认封禁?" @confirm="ban(record.id, 'ban')"><a style="color: red">封禁</a></a-popconfirm>
            <a-popconfirm v-if="record.status === 'suspended'" title="确认解封?" @confirm="ban(record.id, 'unban')"><a style="color: green">解封</a></a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:open="drawerVisible"
      :title="detail?.realName || '零工详情'"
      width="560"
      placement="right"
    >
      <template v-if="detail">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px">
          <a-avatar :size="48" style="background: #722ed1; font-size: 20px">{{ (detail.realName || '?')[0] }}</a-avatar>
          <div>
            <h3 style="margin: 0">{{ detail.realName || '未实名' }}</h3>
            <span style="color: #999">ID: {{ detail.id }}</span>
          </div>
          <div style="margin-left: auto">
            <a-tag :color="detail.status === 'active' ? 'green' : 'red'">{{ detail.status }}</a-tag>
            <a-tag :color="detail.isVerified ? 'blue' : 'default'">{{ detail.isVerified ? '已认证' : '未认证' }}</a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="2" size="small" style="margin-bottom: 16px">
          <a-descriptions-item label="城市">{{ detail.city || '-' }}</a-descriptions-item>
          <a-descriptions-item label="等级">{{ detail.level }}</a-descriptions-item>
          <a-descriptions-item label="评分">{{ detail.avgRating }}</a-descriptions-item>
          <a-descriptions-item label="完成数">{{ detail.completedCount }}</a-descriptions-item>
          <a-descriptions-item label="完成率">{{ ((detail.completionRate || 0) * 100).toFixed(1) }}%</a-descriptions-item>
          <a-descriptions-item label="注册时间">{{ detail.createdAt?.slice(0, 10) }}</a-descriptions-item>
        </a-descriptions>

        <a-card v-if="detail.wallet" title="💰 钱包" size="small" style="margin-bottom: 16px">
          <a-row :gutter="16">
            <a-col :span="8"><a-statistic title="可用" :value="detail.wallet.available" prefix="¥" /></a-col>
            <a-col :span="8"><a-statistic title="冻结" :value="detail.wallet.frozen" prefix="¥" /></a-col>
            <a-col :span="8"><a-statistic title="累计收入" :value="detail.wallet.totalEarned" prefix="¥" /></a-col>
          </a-row>
        </a-card>

        <a-tabs size="small">
          <a-tab-pane key="tasks" tab="任务记录">
            <a-table :dataSource="detail.tasks" :columns="[{ title:'标题',dataIndex:'title' },{ title:'状态',dataIndex:'status' },{ title:'时间',dataIndex:'invitedAt',customRender:({text}:any)=>text?.slice(0,10) }]" size="small" rowKey="id" :pagination="false" />
          </a-tab-pane>
          <a-tab-pane key="roles" tab="角色标签">
            <a-tag v-for="r in detail.roles" :key="r.roleName" color="blue" style="margin: 4px">{{ r.roleName }}</a-tag>
            <a-empty v-if="!detail.roles?.length" description="暂无角色" />
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
const search = ref(''), status = ref<string>(), verified = ref<string>()

// 详情抽屉
const drawerVisible = ref(false), detail = ref<any>(null)

const columns = [
  { title: '姓名', dataIndex: 'realName', key: 'realName' },
  { title: '城市', dataIndex: 'city', key: 'city' },
  { title: '认证', key: 'verified' },
  { title: '评分', dataIndex: 'avgRating', key: 'avgRating' },
  { title: '完成数', dataIndex: 'completedCount', key: 'completedCount' },
  { title: '状态', key: 'status' },
  { title: '注册时间', dataIndex: 'createdAt', key: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 10) },
  { title: '操作', key: 'action', width: 150 },
]

async function load() {
  loading.value = true
  const res = await platformApi.listWorkers({ page: page.value, pageSize: 20, search: search.value || undefined, status: status.value || undefined, verified: verified.value || undefined })
  items.value = res.items; total.value = res.total; loading.value = false
}

async function openDetail(id: number) {
  drawerVisible.value = true; detail.value = null
  detail.value = await platformApi.getWorker(id)
}

async function ban(id: number, action: string) { await platformApi.banWorker(id, { action, reason: '平台操作' }); message.success('操作成功'); load() }

onMounted(load)
</script>
