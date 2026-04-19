<template>
  <div class="llm-page">
    <a-page-header title="AI 大模型配置" sub-title="管理企业的 LLM 接口和模型预设" :ghost="false" style="margin-bottom:16px" />

    <a-row :gutter="16" style="margin-bottom:16px">
      <a-col :span="14">
        <a-card title="🤖 全局 LLM 接口配置" :bordered="false" :loading="loading">
          <div class="quick-presets">
            <span class="quick-label">⚡ 快速预设</span>
            <div class="chip-row">
              <a-tag v-for="p in quickPresets" :key="p.key" class="preset-chip" :color="chipColor(p.key)" @click="applyQuickPreset(p)" style="cursor:pointer">{{ p.label }}</a-tag>
            </div>
          </div>
          <a-divider style="margin:12px 0 16px" />
          <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
            <a-form-item label="服务商" required>
              <a-select v-model:value="form.provider" @change="onProviderChange">
                <a-select-option value="openai">OpenAI</a-select-option>
                <a-select-option value="claude">Claude (Anthropic)</a-select-option>
                <a-select-option value="azure_openai">Azure OpenAI</a-select-option>
                <a-select-option value="qwen">通义千问 (Qwen)</a-select-option>
                <a-select-option value="zhipu">智谱 GLM</a-select-option>
                <a-select-option value="deepseek">DeepSeek</a-select-option>
                <a-select-option value="openai_compatible">OpenAI 兼容（Moonshot / Kimi 等）</a-select-option>
                <a-select-option value="custom_http">🔧 自定义 HTTP（内网/私有部署）</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="API Key" :required="!config">
              <a-input-password v-model:value="form.apiKey" :placeholder="config ? `留空保留（尾号: ${config.apiKeyMasked?.slice(-4)})` : '输入API Key'" />
              <div v-if="config" class="field-hint">当前Key尾号：{{ config.apiKeyMasked }}</div>
            </a-form-item>
            <template v-if="form.provider !== 'custom_http'">
              <a-form-item label="Base URL">
                <a-input v-model:value="form.baseUrl" :placeholder="defaultBaseUrl" />
              </a-form-item>
              <a-form-item label="默认模型" required>
                <div style="display:flex;gap:8px">
                  <a-auto-complete v-model:value="form.defaultModel" :options="modelSuggestions" style="flex:1" :filter-option="filterModel" placeholder="gpt-4o / deepseek-chat" />
                  <a-tooltip title="从 Base URL 获取可用模型列表">
                    <a-button @click="fetchModelList" :loading="fetchingModels"><template #icon><UnorderedListOutlined /></template>获取列表</a-button>
                  </a-tooltip>
                </div>
                <div v-if="fetchedModelCount > 0" class="field-hint" style="color:#52c41a">✓ 已获取 {{ fetchedModelCount }} 个可用模型</div>
              </a-form-item>
            </template>
            <template v-if="form.provider === 'custom_http'">
              <a-divider style="margin:8px 0 12px">🔧 自定义 HTTPS 请求配置</a-divider>
              <a-form-item label="Chat URL" required><a-input v-model:value="form.customChatUrl" placeholder="https://your-server/api/chat" /><div class="field-hint">完整的聊天接口地址</div></a-form-item>
              <a-form-item label="默认模型" required><a-input v-model:value="form.defaultModel" placeholder="如：llama3 / qwen2" /></a-form-item>
              <a-form-item label="鉴权方式"><a-select v-model:value="form.customAuthType" style="width:240px"><a-select-option value="bearer">Bearer Token</a-select-option><a-select-option value="header">自定义 Header Key</a-select-option><a-select-option value="query">Query 参数</a-select-option><a-select-option value="none">无鉴权</a-select-option></a-select></a-form-item>
              <a-form-item v-if="form.customAuthType === 'header'" label="Header名称"><a-input v-model:value="form.customAuthHeader" placeholder="X-API-Key" style="width:240px" /></a-form-item>
              <a-form-item label="额外请求头"><a-textarea v-model:value="form.customHeaders" :rows="2" placeholder='{"X-Custom":"value"}' /></a-form-item>
              <a-form-item label="响应取值路径"><a-input v-model:value="form.customResponsePath" placeholder="留空自动识别" /><div class="field-hint">如 result 或 output.0.text</div></a-form-item>
            </template>
            <a-divider style="margin:8px 0 12px" />
            <a-form-item label="Temperature"><a-row :gutter="8" align="middle"><a-col :span="16"><a-slider v-model:value="form.temperature" :min="0" :max="2" :step="0.1" /></a-col><a-col :span="5"><a-input-number v-model:value="form.temperature" :min="0" :max="2" :step="0.1" style="width:100%" /></a-col></a-row></a-form-item>
            <a-form-item label="Max Tokens"><a-input-number v-model:value="form.maxTokens" :min="256" :max="128000" style="width:160px" /></a-form-item>
            <a-form-item label="跳过TLS"><a-switch v-model:checked="form.allowInsecureHttps" /><span v-if="form.allowInsecureHttps" style="margin-left:8px;font-size:12px;color:#ff7875">⚠️ 已关闭证书验证</span><div class="field-hint">用于自签名 TLS 证书的私有 HTTPS 服务</div></a-form-item>
            <a-form-item :wrapper-col="{ offset: 5 }">
              <a-space>
                <a-button type="primary" @click="handleSave" :loading="saving">保存配置</a-button>
                <a-button @click="handleTest" :loading="testing"><template #icon><CheckCircleOutlined v-if="testResult?.success === true" style="color:#52c41a" /><CloseCircleOutlined v-else-if="testResult?.success === false" style="color:#ff4d4f" /><ApiOutlined v-else /></template>{{ testBtnText }}</a-button>
                <a-dropdown v-if="presets.length > 0" placement="bottomLeft"><a-button><DownloadOutlined /> 从预设加载</a-button><template #overlay><a-menu @click="loadFromPreset"><a-menu-item v-for="p in presets" :key="p.id"><div style="display:flex;align-items:center;gap:8px"><a-tag :color="providerColor(p.provider)" size="small" style="margin:0">{{ providerLabel(p.provider) }}</a-tag><span>{{ p.displayName }}</span><span style="color:#999;font-size:11px">{{ p.modelName }}</span></div></a-menu-item></a-menu></template></a-dropdown>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card title="🔗 连接测试结果" :bordered="false" size="small" style="margin-bottom:16px">
          <div v-if="!testResult" style="color:#bbb;text-align:center;padding:20px 0"><ApiOutlined style="font-size:32px;display:block;margin-bottom:8px" /><span style="font-size:13px">点击「测试连接」验证配置</span></div>
          <template v-else><a-result :status="testResult.success ? 'success' : 'error'" :title="testResult.success ? '连接成功' : '连接失败'" :sub-title="testResult.success ? `模型: ${testResult.model} · 延迟: ${testResult.latency}ms` : testResult.error" style="padding:16px 0"><template v-if="testResult.success" #extra><a-tag color="success">{{ testResult.model }}</a-tag><a-tag color="blue">{{ testResult.latency }}ms</a-tag></template></a-result></template>
        </a-card>
        <a-card title="📊 本月使用统计" :bordered="false" size="small"><a-row :gutter="16"><a-col :span="12"><a-statistic title="调用次数" :value="config?.monthlyCallCount || 0" :value-style="{ fontSize: '22px' }" /></a-col><a-col :span="12"><a-statistic title="Token 消耗" :value="config?.monthlyTokenCount || 0" :value-style="{ fontSize: '22px' }" /></a-col></a-row></a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false">
      <template #title><div style="display:flex;align-items:center;justify-content:space-between"><span>📋 已配置模型列表 <a-tag v-if="presets.length" style="margin-left:8px">{{ presets.length }}个</a-tag></span><a-button type="primary" size="small" @click="openPresetCreate"><PlusOutlined /> 添加模型</a-button></div></template>
      <a-empty v-if="!presets.length" description="暂无已保存模型，点击「添加模型」保存常用配置" />
      <div v-else class="preset-grid">
        <div v-for="preset in presets" :key="preset.id" class="preset-card" :class="{ inactive: !preset.isActive }">
          <div class="preset-card-header"><div class="preset-card-title"><a-tag :color="providerColor(preset.provider)" size="small">{{ providerLabel(preset.provider) }}</a-tag><span class="preset-name">{{ preset.displayName }}</span></div><a-badge :status="preset.isActive ? 'success' : 'default'" :text="preset.isActive ? '启用' : '停用'" /></div>
          <div class="preset-card-body">
            <div class="preset-info-row"><span class="info-label">模型</span><a-typography-text code>{{ preset.modelName }}</a-typography-text></div>
            <div class="preset-info-row"><span class="info-label">接口</span><span class="info-value" :title="preset.baseUrl || preset.customChatUrl || ''">{{ truncUrl(preset.baseUrl || preset.customChatUrl) || '（默认）' }}</span></div>
            <div class="preset-info-row"><span class="info-label">Key</span><span style="color:#999;font-size:12px">{{ preset.apiKeyMasked }}</span></div>
          </div>
          <div class="preset-card-footer">
            <a-button size="small" @click="testPreset(preset)" :loading="testingPreset === preset.id"><template #icon><CheckCircleOutlined v-if="presetTestResults[preset.id]?.success" style="color:#52c41a" /><CloseCircleOutlined v-else-if="presetTestResults[preset.id]?.success === false" style="color:#ff4d4f" /><ApiOutlined v-else /></template>{{ presetTestResults[preset.id]?.success ? '通过' : presetTestResults[preset.id]?.success === false ? '失败' : '测试' }}</a-button>
            <a-button size="small" @click="openPresetEdit(preset)"><EditOutlined /> 编辑</a-button>
            <a-popconfirm title="确认删除？" @confirm="deletePreset(preset.id)"><a-button size="small" danger><DeleteOutlined /></a-button></a-popconfirm>
          </div>
          <div v-if="presetTestResults[preset.id]?.tested" class="preset-test-result"><a-alert :type="presetTestResults[preset.id].success ? 'success' : 'error'" :message="presetTestResults[preset.id].success ? `✓ ${presetTestResults[preset.id].model} · ${presetTestResults[preset.id].latency}ms` : presetTestResults[preset.id].error" show-icon closable @close="delete presetTestResults[preset.id]" /></div>
        </div>
      </div>
    </a-card>

    <a-modal v-model:open="showPresetForm" :title="editingPresetId ? '编辑模型预设' : '添加模型预设'" @ok="handlePresetSave" :confirm-loading="savingPreset" width="620px" destroy-on-close>
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" style="margin-top:16px">
        <a-form-item label="预设名称" required><a-input v-model:value="presetForm.displayName" placeholder="如：GPT-4o 主力" :maxlength="60" show-count /></a-form-item>
        <a-form-item label="服务商" required><a-select v-model:value="presetForm.provider" @change="onPresetProviderChange"><a-select-option value="openai">OpenAI</a-select-option><a-select-option value="claude">Claude</a-select-option><a-select-option value="azure_openai">Azure OpenAI</a-select-option><a-select-option value="qwen">通义千问</a-select-option><a-select-option value="zhipu">智谱 GLM</a-select-option><a-select-option value="deepseek">DeepSeek</a-select-option><a-select-option value="openai_compatible">OpenAI 兼容</a-select-option><a-select-option value="custom_http">🔧 自定义 HTTPS</a-select-option></a-select></a-form-item>
        <a-form-item label="API Key" :required="!editingPresetId"><a-input-password v-model:value="presetForm.apiKey" :placeholder="editingPresetId ? '留空保留' : '输入 API Key'" /></a-form-item>
        <template v-if="!isCustomHttp"><a-form-item label="Base URL"><a-input v-model:value="presetForm.baseUrl" :placeholder="presetDefaultBaseUrl" /></a-form-item><a-form-item label="模型名称" required><a-auto-complete v-model:value="presetForm.modelName" :options="presetModelSuggestions" :filter-option="filterModel" placeholder="gpt-4o" /></a-form-item></template>
        <template v-if="isCustomHttp">
          <a-divider style="margin:8px 0 12px">🔧 自定义配置</a-divider>
          <a-form-item label="Chat URL" required><a-input v-model:value="presetForm.customChatUrl" placeholder="https://your-server/api/chat" /></a-form-item>
          <a-form-item label="模型名称" required><a-input v-model:value="presetForm.modelName" placeholder="llama3" /></a-form-item>
          <a-form-item label="鉴权方式"><a-select v-model:value="presetForm.customAuthType" style="width:200px"><a-select-option value="bearer">Bearer Token</a-select-option><a-select-option value="header">自定义 Header</a-select-option><a-select-option value="query">Query 参数</a-select-option><a-select-option value="none">无鉴权</a-select-option></a-select></a-form-item>
          <a-form-item v-if="presetForm.customAuthType === 'header'" label="Header名"><a-input v-model:value="presetForm.customAuthHeader" placeholder="X-API-Key" style="width:220px" /></a-form-item>
          <a-form-item label="额外请求头"><a-textarea v-model:value="presetForm.customHeaders" :rows="2" placeholder='{"X-Custom":"val"}' /></a-form-item>
          <a-form-item label="响应路径"><a-input v-model:value="presetForm.customResponsePath" placeholder="留空自动识别" /></a-form-item>
          <a-form-item label="请求模板"><a-textarea v-model:value="presetForm.customRequestTemplate" :rows="3" placeholder="留空用OpenAI格式" /></a-form-item>
          <a-form-item label="跳过TLS"><a-switch v-model:checked="presetForm.allowInsecureHttps" /><span v-if="presetForm.allowInsecureHttps" style="margin-left:8px;font-size:12px;color:#ff7875">⚠️ 已关闭</span></a-form-item>
        </template>
        <a-divider style="margin:8px 0 12px" />
        <a-form-item label="Temperature"><a-row :gutter="8"><a-col :span="16"><a-slider v-model:value="presetForm.temperature" :min="0" :max="2" :step="0.1" /></a-col><a-col :span="6"><a-input-number v-model:value="presetForm.temperature" :min="0" :max="2" :step="0.1" style="width:100%" /></a-col></a-row></a-form-item>
        <a-form-item label="Max Tokens"><a-input-number v-model:value="presetForm.maxTokens" :min="256" :max="128000" style="width:160px" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, ApiOutlined,
  EditOutlined, DeleteOutlined, DownloadOutlined, UnorderedListOutlined,
} from '@ant-design/icons-vue'
import request from '@/api/request'

// ═══ Quick Presets ═══
const quickPresets = [
  { key: 'openai', label: 'OpenAI', provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { key: 'deepseek', label: 'DeepSeek', provider: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { key: 'claude', label: 'Claude', provider: 'claude', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  { key: 'qwen', label: '通义千问', provider: 'qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { key: 'zhipu', label: '智谱GLM', provider: 'zhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  { key: 'moonshot', label: 'Moonshot', provider: 'openai_compatible', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-128k' },
  { key: 'doubao', label: '豆包', provider: 'openai_compatible', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-seed-2-0-pro-260215' },
  { key: 'ruijie', label: '锐捷UniAPI', provider: 'openai_compatible', baseUrl: 'https://uniapi.ruijie.com.cn/v1', model: 'claude-opus-4-7' },
  { key: 'ollama', label: 'Ollama本地', provider: 'custom_http', baseUrl: '', model: 'llama3', extra: { customChatUrl: 'http://localhost:11434/v1/chat/completions', customAuthType: 'none' } },
] as const

function chipColor(key: string) {
  const m: Record<string,string> = { openai:'green', deepseek:'magenta', claude:'orange', qwen:'cyan', zhipu:'purple', moonshot:'geekblue', doubao:'volcano', ruijie:'blue', ollama:'default' }
  return m[key] || 'default'
}

function applyQuickPreset(p: (typeof quickPresets)[number]) {
  form.value.provider = p.provider; form.value.baseUrl = p.baseUrl; form.value.defaultModel = p.model
  if ('extra' in p && p.extra) { form.value.customChatUrl = (p.extra as any).customChatUrl || ''; form.value.customAuthType = (p.extra as any).customAuthType || 'bearer' }
  else { form.value.customChatUrl = ''; form.value.customAuthType = 'bearer' }
  message.info(`已切换至 ${p.label} 预设`)
}

// ═══ Model Suggestions ═══
const MODEL_MAP: Record<string,string[]> = {
  openai: ['gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo','o3-mini','o4-mini'],
  claude: ['claude-sonnet-4-20250514','claude-opus-4-20250514','claude-3-5-sonnet-20241022'],
  deepseek: ['deepseek-chat','deepseek-coder','deepseek-reasoner'],
  qwen: ['qwen-plus','qwen-turbo','qwen-max','qwen-long'],
  zhipu: ['glm-4','glm-4-flash','glm-3-turbo'],
  openai_compatible: ['moonshot-v1-128k','moonshot-v1-32k'],
}
const fetchedModels = ref<string[]>([])
const fetchedModelCount = ref(0)
const fetchingModels = ref(false)

const modelSuggestions = computed(() => {
  const all = [...new Set([...(MODEL_MAP[form.value.provider] || []), ...fetchedModels.value])]
  return all.map(m => ({ value: m }))
})
const presetModelSuggestions = computed(() => (MODEL_MAP[presetForm.value.provider] || []).map(m => ({ value: m })))
function filterModel(input: string, option: any) { return (option?.value || '').toLowerCase().includes(input.toLowerCase()) }

async function fetchModelList() {
  const base = (form.value.baseUrl || defaultBaseUrl.value).replace(/\/+$/, '')
  if (!base || base.includes('{')) { message.warning('请先填写有效的 Base URL'); return }
  fetchingModels.value = true
  try {
    const key = form.value.apiKey || ''
    const headers: Record<string,string> = { 'Content-Type': 'application/json' }
    if (key) headers['Authorization'] = `Bearer ${key}`
    const res = await fetch(base + '/models', { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const models = (data.data || []).map((m: any) => m.id).filter(Boolean).sort()
    fetchedModels.value = models; fetchedModelCount.value = models.length
    message.success(`获取到 ${models.length} 个可用模型`)
  } catch (e: any) { message.error(`获取模型列表失败: ${e.message}`) }
  finally { fetchingModels.value = false }
}

// ═══ State ═══
const loading = ref(false), saving = ref(false), testing = ref(false)
const config = ref<any>(null), testResult = ref<any>(null)
const form = ref({
  provider: 'openai', apiKey: '', baseUrl: '', defaultModel: 'gpt-4o',
  temperature: 0.7, maxTokens: 4096, allowInsecureHttps: false,
  customChatUrl: '', customAuthType: 'bearer', customAuthHeader: '',
  customHeaders: '', customResponsePath: '',
})
const presets = ref<any[]>([])
const showPresetForm = ref(false), savingPreset = ref(false)
const editingPresetId = ref<number|null>(null), testingPreset = ref<number|null>(null)
const presetTestResults = reactive<Record<number,any>>({})
const presetForm = ref({
  displayName: '', provider: 'openai', apiKey: '', baseUrl: '',
  modelName: '', temperature: 0.7, maxTokens: 4096,
  customChatUrl: '', customAuthType: 'bearer', customAuthHeader: '',
  customRequestTemplate: '', customResponsePath: '', customHeaders: '',
  allowInsecureHttps: false,
})
const isCustomHttp = computed(() => presetForm.value.provider === 'custom_http' || presetForm.value.provider === 'custom')

// ═══ Computed ═══
const testBtnText = computed(() => testResult.value?.success === true ? '连接成功 ✓' : testResult.value?.success === false ? '连接失败 ✗' : '测试连接')
const defaultBaseUrl = computed(() => {
  const m: Record<string,string> = { openai:'https://api.openai.com/v1', claude:'https://api.anthropic.com', qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1', zhipu:'https://open.bigmodel.cn/api/paas/v4', deepseek:'https://api.deepseek.com/v1', azure_openai:'https://{resource}.openai.azure.com/openai/deployments/{deployment}' }
  return m[form.value.provider] || '请输入 Base URL'
})
const presetDefaultBaseUrl = computed(() => {
  const m: Record<string,string> = { openai:'https://api.openai.com/v1', claude:'https://api.anthropic.com', qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1', zhipu:'https://open.bigmodel.cn/api/paas/v4', deepseek:'https://api.deepseek.com/v1' }
  return m[presetForm.value.provider] || '请输入 Base URL'
})

// ═══ Helpers ═══
const LABELS: Record<string,string> = { openai:'OpenAI', claude:'Claude', azure_openai:'Azure', qwen:'通义', zhipu:'智谱', deepseek:'DeepSeek', openai_compatible:'OAI兼容', custom_http:'自定义' }
const COLORS: Record<string,string> = { openai:'green', claude:'orange', azure_openai:'blue', qwen:'cyan', zhipu:'purple', deepseek:'magenta', openai_compatible:'geekblue', custom_http:'default' }
function providerLabel(p: string) { return LABELS[p] || p }
function providerColor(p: string) { return COLORS[p] || 'default' }
function authTypeLabel(t: string) { return { bearer:'Bearer Token', header:'自定义Header', query:'Query参数', none:'无鉴权' }[t] || t }
function truncUrl(url: string|null|undefined) { if (!url) return ''; try { const u = new URL(url); return u.hostname + (u.pathname !== '/' ? u.pathname : '') } catch { return url.slice(0, 40) } }

function onProviderChange() {
  const models: Record<string,string> = { openai:'gpt-4o', claude:'claude-3-5-sonnet-20241022', qwen:'qwen-plus', zhipu:'glm-4', deepseek:'deepseek-chat', openai_compatible:'', custom_http:'' }
  form.value.defaultModel = models[form.value.provider] ?? ''
  if (!form.value.baseUrl) {
    const urls: Record<string,string> = { deepseek:'https://api.deepseek.com/v1', qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1', zhipu:'https://open.bigmodel.cn/api/paas/v4' }
    form.value.baseUrl = urls[form.value.provider] || ''
  }
  fetchedModels.value = []; fetchedModelCount.value = 0
}

// ═══ Global Config CRUD ═══
async function fetchConfig() {
  loading.value = true
  try {
    const res = await request.get('/company/llm-config')
    config.value = res
    if (res) {
      form.value.provider = res.provider; form.value.baseUrl = res.baseUrl || ''
      form.value.defaultModel = res.defaultModel; form.value.temperature = res.temperature
      form.value.maxTokens = res.maxTokens; form.value.allowInsecureHttps = res.allowInsecureHttps ?? false
      // custom_http fields
      form.value.customChatUrl = res.customChatUrl || ''; form.value.customAuthType = res.customAuthType || 'bearer'
      form.value.customAuthHeader = res.customAuthHeader || ''; form.value.customHeaders = res.customHeaders ? JSON.stringify(res.customHeaders) : ''
      form.value.customResponsePath = res.customResponsePath || ''
    }
  } finally { loading.value = false }
}

async function handleSave() {
  if (!form.value.provider) return message.warning('请选择服务商')
  if (!form.value.defaultModel.trim()) return message.warning('请填写默认模型名称')
  if (!form.value.apiKey.trim() && !config.value) return message.warning('首次配置必须输入 API Key')
  saving.value = true
  try {
    const body: Record<string,any> = {
      provider: form.value.provider, defaultModel: form.value.defaultModel,
      temperature: form.value.temperature, maxTokens: form.value.maxTokens,
      allowInsecureHttps: form.value.allowInsecureHttps,
    }
    if (form.value.apiKey.trim()) body.apiKey = form.value.apiKey.trim()
    if (form.value.baseUrl.trim()) body.baseUrl = form.value.baseUrl.trim()
    // custom_http fields
    if (form.value.provider === 'custom_http') {
      if (form.value.customChatUrl.trim()) body.customChatUrl = form.value.customChatUrl.trim()
      if (form.value.customAuthType) body.customAuthType = form.value.customAuthType
      if (form.value.customAuthHeader.trim()) body.customAuthHeader = form.value.customAuthHeader.trim()
      if (form.value.customResponsePath.trim()) body.customResponsePath = form.value.customResponsePath.trim()
      if (form.value.customHeaders.trim()) {
        try { JSON.parse(form.value.customHeaders); body.customHeaders = form.value.customHeaders.trim() }
        catch { message.error('额外请求头格式错误'); return }
      }
    }
    await request.put('/company/llm-config', body)
    message.success('配置已保存'); form.value.apiKey = ''; fetchConfig()
  } catch (e: any) { message.error(e?.message || '保存失败') }
  finally { saving.value = false }
}

async function handleTest() {
  testing.value = true; testResult.value = null
  try {
    const res = await request.post('/company/llm-config/test')
    testResult.value = res
    if (res?.success) message.success(`连接成功 · ${res.model} · ${res.latency}ms`)
    else message.error(res?.error || '连接失败')
  } catch (e: any) { testResult.value = { success: false, error: e.message }; message.error('连接失败') }
  finally { testing.value = false }
}

function loadFromPreset({ key }: { key: string|number }) {
  const preset = presets.value.find(p => p.id === Number(key))
  if (!preset) return
  form.value.provider = preset.provider
  form.value.baseUrl = preset.baseUrl || ''
  form.value.defaultModel = preset.modelName
  form.value.temperature = preset.temperature
  form.value.maxTokens = preset.maxTokens
  form.value.allowInsecureHttps = preset.allowInsecureHttps ?? false
  if (preset.provider === 'custom_http') {
    form.value.customChatUrl = preset.customChatUrl || ''
    form.value.customAuthType = preset.customAuthType || 'bearer'
    form.value.customAuthHeader = preset.customAuthHeader || ''
    form.value.customResponsePath = preset.customResponsePath || ''
    form.value.customHeaders = preset.customHeaders ? JSON.stringify(preset.customHeaders) : ''
  }
  message.info(`已从「${preset.displayName}」加载配置`)
}

// ═══ Presets CRUD ═══
async function fetchPresets() {
  const res = await request.get('/company/model-presets')
  presets.value = res || []
}

function openPresetCreate() {
  editingPresetId.value = null
  presetForm.value = { displayName:'', provider:'openai', apiKey:'', baseUrl:'', modelName:'', temperature:0.7, maxTokens:4096, customChatUrl:'', customAuthType:'bearer', customAuthHeader:'', customRequestTemplate:'', customResponsePath:'', customHeaders:'', allowInsecureHttps:false }
  showPresetForm.value = true
}

function openPresetEdit(preset: any) {
  editingPresetId.value = preset.id
  presetForm.value = {
    displayName: preset.displayName, provider: preset.provider, apiKey: '',
    baseUrl: preset.baseUrl || '', modelName: preset.modelName,
    temperature: preset.temperature, maxTokens: preset.maxTokens,
    customChatUrl: preset.customChatUrl || '', customAuthType: preset.customAuthType || 'bearer',
    customAuthHeader: preset.customAuthHeader || '', customRequestTemplate: preset.customRequestTemplate || '',
    customResponsePath: preset.customResponsePath || '',
    customHeaders: preset.customHeaders ? JSON.stringify(preset.customHeaders, null, 2) : '',
    allowInsecureHttps: preset.allowInsecureHttps ?? false,
  }
  showPresetForm.value = true
}

function onPresetProviderChange() {
  const models: Record<string,string> = { openai:'gpt-4o', claude:'claude-3-5-sonnet-20241022', qwen:'qwen-plus', zhipu:'glm-4', deepseek:'deepseek-chat', openai_compatible:'', custom_http:'' }
  presetForm.value.modelName = models[presetForm.value.provider] ?? ''
}

async function handlePresetSave() {
  if (!presetForm.value.displayName.trim()) return message.warning('请输入预设名称')
  if (!presetForm.value.modelName.trim()) return message.warning('请输入模型名称')
  if (!presetForm.value.apiKey.trim() && !editingPresetId.value) return message.warning('新建预设必须输入 API Key')
  savingPreset.value = true
  try {
    const body: Record<string,any> = {
      displayName: presetForm.value.displayName.trim(), provider: presetForm.value.provider,
      modelName: presetForm.value.modelName.trim(), temperature: presetForm.value.temperature,
      maxTokens: presetForm.value.maxTokens, allowInsecureHttps: presetForm.value.allowInsecureHttps,
    }
    if (presetForm.value.apiKey.trim()) body.apiKey = presetForm.value.apiKey.trim()
    if (presetForm.value.baseUrl.trim()) body.baseUrl = presetForm.value.baseUrl.trim()
    if (presetForm.value.provider === 'custom_http' || presetForm.value.provider === 'custom') {
      if (presetForm.value.customChatUrl.trim()) body.customChatUrl = presetForm.value.customChatUrl.trim()
      if (presetForm.value.customAuthType) body.customAuthType = presetForm.value.customAuthType
      if (presetForm.value.customAuthHeader.trim()) body.customAuthHeader = presetForm.value.customAuthHeader.trim()
      if (presetForm.value.customRequestTemplate.trim()) body.customRequestTemplate = presetForm.value.customRequestTemplate.trim()
      if (presetForm.value.customResponsePath.trim()) body.customResponsePath = presetForm.value.customResponsePath.trim()
      if (presetForm.value.customHeaders.trim()) {
        try { JSON.parse(presetForm.value.customHeaders); body.customHeaders = presetForm.value.customHeaders.trim() }
        catch { message.error('额外请求头 JSON 格式错误'); return }
      }
    }
    if (editingPresetId.value) { await request.put(`/company/model-presets/${editingPresetId.value}`, body); message.success('预设已更新') }
    else { await request.post('/company/model-presets', body); message.success('模型预设已添加') }
    showPresetForm.value = false; fetchPresets()
  } catch (e: any) { message.error(e?.message || '保存失败') }
  finally { savingPreset.value = false }
}

async function deletePreset(id: number) {
  try { await request.delete(`/company/model-presets/${id}`); message.success('已删除'); delete presetTestResults[id]; fetchPresets() }
  catch (e: any) { message.error(e?.message || '删除失败') }
}

async function testPreset(preset: any) {
  testingPreset.value = preset.id; delete presetTestResults[preset.id]
  try { const res = await request.post(`/company/model-presets/${preset.id}/test`); presetTestResults[preset.id] = { ...res, tested: true } }
  catch (e: any) { presetTestResults[preset.id] = { success: false, error: e.message, tested: true } }
  finally { testingPreset.value = null }
}

onMounted(() => { fetchConfig(); fetchPresets() })
</script>

<style scoped>
.llm-page { max-width: 1400px; }
.quick-presets { margin-bottom: 0; }
.quick-label { font-size: 13px; color: #999; font-weight: 500; margin-right: 8px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.preset-chip { border-radius: 6px !important; }
.preset-chip:hover { opacity: 0.8; transform: translateY(-1px); transition: all 0.15s; }
.field-hint { font-size: 11px; color: #999; margin-top: 3px; }

/* ── Preset Grid ── */
.preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.preset-card {
  border: 1px solid var(--color-border-light, #f0f0f0); border-radius: 8px;
  padding: 14px; transition: all 0.2s; background: #fff;
}
.preset-card:hover { border-color: #d9d9d9; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.preset-card.inactive { opacity: 0.55; }
.preset-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.preset-card-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.preset-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preset-card-body { margin-bottom: 10px; }
.preset-info-row { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
.info-label { color: #999; min-width: 32px; flex-shrink: 0; }
.info-value { color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.preset-card-footer { display: flex; gap: 6px; }
.preset-test-result { margin-top: 8px; }
</style>
