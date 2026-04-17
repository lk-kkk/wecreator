<template>
  <div>
    <h2>审计日志</h2>
    <a-space style="margin-bottom: 16px">
      <a-select v-model:value="action" placeholder="操作类型" allowClear @change="load" style="width: 180px">
        <a-select-option v-for="a in ['company_approve','company_reject','company_freeze','worker_ban','worker_unban','task_force_close','dispute_accept','dispute_resolve','withdrawal_approve','config_update','admin_create']" :key="a" :value="a">{{ a }}</a-select-option>
      </a-select>
      <a-select v-model:value="targetType" placeholder="目标类型" allowClear @change="load" style="width: 140px">
        <a-select-option v-for="t in ['company','worker','task','dispute','transaction','system','platform_admin']" :key="t" :value="t">{{ t }}</a-select-option>
      </a-select>
    </a-space>
    <a-table :dataSource="items" :columns="columns" :pagination="{ current: page, pageSize: 20, total }" @change="p => { page = p.current; load() }" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'detail'"><a-tooltip :title="record.detail"><span>{{ record.detail?.slice(0, 50) }}{{ record.detail?.length > 50 ? '...' : '' }}</span></a-tooltip></template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { platformApi } from '@/api/platform'
const items = ref<any[]>([]), total = ref(0), page = ref(1), loading = ref(false)
const action = ref<string>(), targetType = ref<string>()
const columns = [
  { title: '操作人', dataIndex: 'adminName' }, { title: '操作', dataIndex: 'action' },
  { title: '目标类型', dataIndex: 'targetType' }, { title: '目标ID', dataIndex: 'targetId' },
  { title: '详情', key: 'detail' },
  { title: '时间', dataIndex: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 19) },
]
async function load() {
  loading.value = true
  const res = await platformApi.listAuditLogs({ page: page.value, pageSize: 20, action: action.value || undefined, targetType: targetType.value || undefined })
  items.value = res.items; total.value = res.total; loading.value = false
}
onMounted(load)
</script>
