<template>
  <div>
    <h2>交易流水</h2>
    <a-space style="margin-bottom: 16px">
      <a-select v-model:value="type" placeholder="类型" allowClear @change="load" style="width: 120px">
        <a-select-option v-for="t in ['recharge','settlement','withdraw','refund','lock','unlock']" :key="t" :value="t">{{ t }}</a-select-option>
      </a-select>
      <a-select v-model:value="txStatus" placeholder="状态" allowClear @change="load" style="width: 120px">
        <a-select-option v-for="s in ['pending','completed','failed']" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
    </a-space>
    <a-table :dataSource="items" :columns="columns" :pagination="{ current: page, pageSize: 20, total }" @change="p => { page = p.current; load() }" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'amount'"><span :style="{ color: record.isAbnormal ? '#f5222d' : '', fontWeight: record.isAbnormal ? 'bold' : '' }">¥{{ record.amount?.toLocaleString() }}{{ record.isAbnormal ? ' ⚠️' : '' }}</span></template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { platformApi } from '@/api/platform'
const items = ref<any[]>([]), total = ref(0), page = ref(1), loading = ref(false)
const type = ref<string>(), txStatus = ref<string>()
const columns = [
  { title: '交易号', dataIndex: 'transactionNo' },
  { title: '类型', dataIndex: 'type' },
  { title: '方向', dataIndex: 'direction' },
  { title: '金额', key: 'amount' },
  { title: '状态', dataIndex: 'status' },
  { title: '时间', dataIndex: 'createdAt', customRender: ({ text }: any) => text?.slice(0, 19) },
]
async function load() {
  loading.value = true
  const res = await platformApi.listTransactions({ page: page.value, pageSize: 20, type: type.value || undefined, status: txStatus.value || undefined })
  items.value = res.items; total.value = res.total; loading.value = false
}
onMounted(load)
</script>
