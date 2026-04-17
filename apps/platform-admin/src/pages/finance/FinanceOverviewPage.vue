<template>
  <div>
    <h2>资金监控</h2>
    <a-row :gutter="16" style="margin-bottom: 24px">
      <a-col :span="6" v-for="c in cards" :key="c.label">
        <a-card size="small"><a-statistic :title="c.label" :value="c.value" prefix="¥" :value-style="{ color: c.color || '#333' }" /></a-card>
      </a-col>
    </a-row>
    <a-space>
      <a-button type="primary" @click="$router.push('/finance/transactions')">查看全部流水 →</a-button>
    </a-space>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { platformApi } from '@/api/platform'
const data = ref<any>({})
const cards = computed(() => [
  { label: '企业余额池', value: data.value.companyBalance || 0 },
  { label: '锁定资金', value: data.value.companyLocked || 0, color: '#faad14' },
  { label: '零工可用', value: data.value.workerAvailable || 0, color: '#52c41a' },
  { label: '零工冻结', value: data.value.workerFrozen || 0, color: '#f5222d' },
  { label: '本月GMV', value: data.value.gmvThisMonth || 0, color: '#1890ff' },
  { label: '本月结算', value: data.value.settleThisMonth || 0 },
  { label: '服务费收入', value: data.value.platformFee || 0, color: '#722ed1' },
])
onMounted(async () => { data.value = await platformApi.getFinanceOverview() })
</script>
