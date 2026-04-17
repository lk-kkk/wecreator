<template>
  <div style="max-width:500px">
    <h2>企业充值</h2>
    <a-card>
      <a-statistic title="当前可用余额" :value="balance.availableBalance" prefix="¥" style="margin-bottom:24px" />
      <a-form layout="vertical">
        <a-form-item label="充值金额(元)">
          <a-input-number v-model:value="amount" :min="1" :step="1000" style="width:100%" size="large" />
        </a-form-item>
        <a-button type="primary" block size="large" :loading="loading" @click="handleRecharge">
          {{ step === 'input' ? '生成支付二维码' : '已完成支付' }}
        </a-button>
      </a-form>
      <div v-if="step === 'qrcode'" style="text-align:center;margin-top:24px">
        <a-alert message="开发环境：点击「已完成支付」模拟回调" type="info" />
      </div>
    </a-card>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import request from '@/api/request'
const amount = ref(10000)
const loading = ref(false)
const step = ref<'input'|'qrcode'>('input')
const txNo = ref('')
const balance = ref({ balance: 0, lockedBalance: 0, availableBalance: 0 })
async function fetchBalance() {
  balance.value = await request.get<any,any>('/finance/balance')
}
async function handleRecharge() {
  if (step.value === 'input') {
    loading.value = true
    try {
      const res = await request.post<any,any>('/finance/recharge', { amount: amount.value })
      txNo.value = res.transactionNo
      step.value = 'qrcode'
    } finally { loading.value = false }
  } else {
    loading.value = true
    try {
      await request.post<any,any>('/finance/recharge/callback', { transactionNo: txNo.value })
      message.success('充值成功')
      step.value = 'input'
      await fetchBalance()
    } finally { loading.value = false }
  }
}
onMounted(fetchBalance)
</script>
