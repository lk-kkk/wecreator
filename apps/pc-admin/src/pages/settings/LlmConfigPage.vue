<template>
  <div class="page-container">
    <a-page-header title="AI 大模型配置" sub-title="仅超级管理员可操作" :ghost="false" style="margin-bottom:16px" />

    <a-row :gutter="16">
      <a-col :span="14">
        <a-card title="🤖 LLM 接口配置" :bordered="false" :loading="loading">
          <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
            <a-form-item label="服务商" required>
              <a-select v-model:value="form.provider" @change="onProviderChange">
                <a-select-option value="openai">OpenAI</a-select-option>
                <a-select-option value="claude">Claude (Anthropic)</a-select-option>
                <a-select-option value="azure_openai">Azure OpenAI</a-select-option>
                <a-select-option value="qwen">通义千问</a-select-option>
                <a-select-option value="zhipu">智谱 GLM</a-select-option>
                <a-select-option value="openai_compatible">OpenAI 兼容</a-select-option>
                <a-select-option value="custom_http">自定义 HTTP</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="API Key" :required="!config">
              <a-input-password v-model:value="form.apiKey" 
                :placeholder="config ? `留空则保留原有Key（末4位: ${config.apiKeyMasked?.slice(-4) || '****'})` : '输入API Key'" />
              <div v-if="config" style="font-size:11px;color:#999;margin-top:4px">
                当前Key尾号：{{ config.apiKeyMasked }} · 重新输入新Key可覆盖
              </div>
            </a-form-item>
            <a-form-item label="Base URL">
              <a-input v-model:value="form.baseUrl" :placeholder="defaultBaseUrl" />
            </a-form-item>
            <a-form-item label="默认模型" required>
              <a-input v-model:value="form.defaultModel" placeholder="gpt-4o / claude-3.5-sonnet" />
            </a-form-item>
            <a-form-item label="Temperature">
              <a-slider v-model:value="form.temperature" :min="0" :max="2" :step="0.1" />
            </a-form-item>
            <a-form-item label="Max Tokens">
              <a-input-number v-model:value="form.maxTokens" :min="256" :max="128000" style="width:160px" />
            </a-form-item>
            <a-form-item :wrapper-col="{ offset: 5 }">
              <a-space>
                <a-button type="primary" @click="handleSave" :loading="saving">保存配置</a-button>
                <a-button @click="handleTest" :loading="testing">
                  {{ testResult?.success === true ? '✅ 连接成功' : testResult?.success === false ? '❌ 连接失败' : '🔗 测试连接' }}
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>

      <a-col :span="10">
        <a-card title="📊 使用统计" :bordered="false" size="small">
          <a-statistic title="本月调用次数" :value="config?.monthlyCallCount || 0" style="margin-bottom:16px" />
          <a-statistic title="本月 Token 消耗" :value="config?.monthlyTokenCount || 0" />
          <a-divider />
          <a-alert v-if="testResult?.success === false" type="error" :message="testResult?.error" show-icon />
          <a-alert v-if="testResult?.success" type="success"
            :message="`连接成功 · 模型: ${testResult.model} · 延迟: ${testResult.latency}ms`" show-icon />
        </a-card>

        <a-card title="💡 说明" :bordered="false" size="small" style="margin-top:16px">
          <ul style="padding-left:16px;color:#666;font-size:13px">
            <li>API Key 使用 AES-256 加密存储</li>
            <li>支持 OpenAI / Claude / 通义 / 智谱 等主流服务商</li>
            <li>「OpenAI 兼容」支持 DeepSeek、Moonshot 等兼容接口</li>
            <li>月度统计每月1日自动重置</li>
          </ul>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import request from '@/api/request'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const config = ref<any>(null)
const testResult = ref<any>(null)
const form = ref({
  provider: 'openai', apiKey: '', baseUrl: '', defaultModel: 'gpt-4o',
  temperature: 0.7, maxTokens: 4096,
})

const defaultBaseUrl = computed(() => {
  const m: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  }
  return m[form.value.provider] || '请输入 Base URL'
})

function onProviderChange() {
  const models: Record<string, string> = {
    openai: 'gpt-4o', claude: 'claude-3.5-sonnet', qwen: 'qwen-plus', zhipu: 'glm-4',
  }
  form.value.defaultModel = models[form.value.provider] || ''
}

async function fetchConfig() {
  loading.value = true
  try {
    const res = await request.get('/company/llm-config')
    config.value = res.data
    if (res.data) {
      form.value.provider = res.data.provider
      form.value.baseUrl = res.data.baseUrl || ''
      form.value.defaultModel = res.data.defaultModel
      form.value.temperature = res.data.temperature
      form.value.maxTokens = res.data.maxTokens
    }
  } finally { loading.value = false }
}

async function handleSave() {
  if (!form.value.provider) return message.warning('请选择服务商')
  if (!form.value.defaultModel.trim()) return message.warning('请填写默认模型名称')
  // 首次配置必须提供 API Key；已有配置时留空表示「保持原Key不变」
  if (!form.value.apiKey.trim() && !config.value) return message.warning('首次配置必须输入 API Key')
  saving.value = true
  try {
    const body: Record<string, any> = {
      provider: form.value.provider,
      defaultModel: form.value.defaultModel,
      temperature: form.value.temperature,
      maxTokens: form.value.maxTokens,
    }
    // 只有用户实际输入了新Key才传递，空值后端会保留原有Key
    if (form.value.apiKey.trim()) body.apiKey = form.value.apiKey.trim()
    if (form.value.baseUrl.trim()) body.baseUrl = form.value.baseUrl.trim()
    await request.put('/company/llm-config', body)
    message.success('配置已保存')
    form.value.apiKey = '' // 保存成功后清空输入框（安全）
    fetchConfig()
  } catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '保存失败')
  } finally { saving.value = false }
}

async function handleTest() {
  testing.value = true
  testResult.value = null
  try {
    const res = await request.post('/company/llm-config/test')
    testResult.value = res.data
  } catch (e: any) {
    testResult.value = { success: false, error: e.message }
  } finally { testing.value = false }
}

onMounted(fetchConfig)
</script>
