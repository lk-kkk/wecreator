<template>
  <div>
    <h2>平台参数配置</h2>
    <a-form :model="config" layout="horizontal" :label-col="{ span: 8 }" :wrapper-col="{ span: 8 }" @finish="save">
      <a-form-item label="服务费率"><a-input-number v-model:value="config.serviceFeeRate" :min="0" :max="1" :step="0.01" style="width: 100%" /><template #extra>当前: {{ (config.serviceFeeRate * 100).toFixed(0) }}%</template></a-form-item>
      <a-form-item label="提现单笔限额"><a-input-number v-model:value="config.withdrawalSingleLimit" :min="100" prefix="¥" style="width: 100%" /></a-form-item>
      <a-form-item label="提现日限额"><a-input-number v-model:value="config.withdrawalDailyLimit" :min="1000" prefix="¥" style="width: 100%" /></a-form-item>
      <a-form-item label="充值单笔限额"><a-input-number v-model:value="config.rechargeSingleLimit" :min="100" prefix="¥" style="width: 100%" /></a-form-item>
      <a-form-item label="验收超时(工作日)"><a-input-number v-model:value="config.acceptanceTimeoutDays" :min="1" :max="10" style="width: 100%" /></a-form-item>
      <a-form-item label="争议SLA(小时)"><a-input-number v-model:value="config.disputeSlaHours" :min="24" :max="168" style="width: 100%" /></a-form-item>
      <a-form-item :wrapper-col="{ offset: 8 }"><a-button type="primary" html-type="submit">保存配置</a-button></a-form-item>
    </a-form>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { platformApi } from '@/api/platform'
const config = reactive<any>({})
onMounted(async () => { Object.assign(config, await platformApi.getConfig()) })
async function save() { await platformApi.updateConfig(config); message.success('已保存') }
</script>
