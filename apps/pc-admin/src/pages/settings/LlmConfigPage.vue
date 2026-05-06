<template>
  <div class="llm-page">
    <a-page-header title="AI 大模型配置" sub-title="管理企业的 LLM 接口和模型预设" :ghost="false" style="margin-bottom:16px">
      <template #extra>
        <a-space>
          <a-button @click="showGlobalConfig = true"><SettingOutlined /> 全局接口配置</a-button>
          <a-button type="primary" @click="openPresetCreate"><PlusOutlined /> 添加模型</a-button>
        </a-space>
      </template>
    </a-page-header>

    <!-- 全局配置摘要条 -->
    <a-card v-if="config" size="small" :bordered="false" style="margin-bottom:16px" class="config-summary">
      <a-row align="middle" :gutter="24">
        <a-col :flex="1">
          <a-space :size="16">
            <a-tag :color="providerColor(config.provider)" style="font-size:12px;padding:2px 10px">{{ providerLabel(config.provider) }}</a-tag>
            <span style="color:#333"><strong>默认模型：</strong><a-typography-text code>{{ config.defaultModel }}</a-typography-text></span>
            <span style="color:#999;font-size:12px">Base URL: {{ truncUrl(config.baseUrl || config.customChatUrl) || '（默认）' }}</span>
            <span style="color:#999;font-size:12px">Key: {{ config.apiKeyMasked }}</span>
          </a-space>
        </a-col>
        <a-col>
          <a-space :size="20">
            <a-statistic title="本月调用" :value="config.monthlyCallCount || 0" :value-style="{ fontSize:'16px' }" />
            <a-statistic title="Token消耗" :value="config.monthlyTokenCount || 0" :value-style="{ fontSize:'16px' }" />
            <a-button size="small" @click="handleGlobalTest" :loading="globalTesting">
              <template #icon><CheckCircleOutlined v-if="globalTestResult?.success" style="color:#52c41a" /><CloseCircleOutlined v-else-if="globalTestResult?.success === false" style="color:#ff4d4f" /><ApiOutlined v-else /></template>
              {{ globalTestResult?.success ? '连通' : globalTestResult?.success === false ? '失败' : '测试' }}
            </a-button>
            <a-button size="small" type="link" @click="showGlobalConfig = true"><EditOutlined /> 修改</a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>
    <a-alert v-else type="warning" show-icon style="margin-bottom:16px" message="尚未配置全局 LLM 接口" description="请先点击「全局接口配置」完成服务商、API Key 等基础设置。">
      <template #action><a-button size="small" type="primary" @click="showGlobalConfig = true">去配置</a-button></template>
    </a-alert>

    <!-- ═══ 主体：模型卡片网格 ═══ -->
    <div v-if="loading" style="text-align:center;padding:60px"><a-spin size="large" /></div>
    <a-empty v-else-if="!presets.length" description="暂无已保存模型，点击「添加模型」保存常用配置" style="padding:60px 0">
      <template #extra><a-button type="primary" @click="openPresetCreate"><PlusOutlined /> 添加模型</a-button></template>
    </a-empty>
    <div v-else class="preset-grid">
      <div v-for="preset in presets" :key="preset.id" class="preset-card" :class="{ inactive: !preset.isActive }">
        <div class="preset-card-header">
          <div class="preset-card-title"><a-tag :color="providerColor(preset.provider)" size="small">{{ providerLabel(preset.provider) }}</a-tag><span class="preset-name">{{ preset.displayName }}</span></div>
          <a-badge :status="preset.isActive ? 'success' : 'default'" :text="preset.isActive ? '启用' : '停用'" />
        </div>
        <div class="preset-card-body">
          <div class="preset-info-row"><span class="info-label">模型</span><a-typography-text code>{{ preset.modelName }}</a-typography-text></div>
          <div class="preset-info-row"><span class="info-label">接口</span><span class="info-value" :title="preset.baseUrl || preset.customChatUrl || ''">{{ truncUrl(preset.baseUrl || preset.customChatUrl) || '（默认）' }}</span></div>
          <div class="preset-info-row"><span class="info-label">Key</span><span style="color:#999;font-size:12px">{{ preset.apiKeyMasked }}</span></div>
        </div>
        <div class="preset-card-footer">
          <a-button size="small" @click="testPreset(preset)" :loading="testingPreset === preset.id">
            <template #icon><CheckCircleOutlined v-if="presetTestResults[preset.id]?.success" style="color:#52c41a" /><CloseCircleOutlined v-else-if="presetTestResults[preset.id]?.success === false" style="color:#ff4d4f" /><ApiOutlined v-else /></template>
            {{ presetTestResults[preset.id]?.success ? '通过' : presetTestResults[preset.id]?.success === false ? '失败' : '测试' }}
          </a-button>
          <a-button size="small" @click="openPresetEdit(preset)"><EditOutlined /> 编辑</a-button>
          <a-button size="small" @click="openPresetStats(preset)"><BarChartOutlined /> 调用统计</a-button>
          <a-popconfirm title="确认删除？" @confirm="deletePreset(preset.id)"><a-button size="small" danger><DeleteOutlined /></a-button></a-popconfirm>
        </div>
        <div v-if="presetTestResults[preset.id]?.tested" class="preset-test-result">
          <a-alert :type="presetTestResults[preset.id].success ? 'success' : 'error'" :message="presetTestResults[preset.id].success ? `✓ ${presetTestResults[preset.id].model} · ${presetTestResults[preset.id].latency}ms` : presetTestResults[preset.id].error" show-icon closable @close="delete presetTestResults[preset.id]" />
        </div>
      </div>
    </div>

    <!-- ═══ 全局接口配置弹窗 ═══ -->
    <a-modal v-model:open="showGlobalConfig" title="🤖 全局 LLM 接口配置" width="720px" :footer="null" destroy-on-close>
      <div class="quick-presets" style="margin-bottom:12px">
        <span class="quick-label">⚡ 快速预设</span>
        <div class="chip-row">
          <a-tag v-for="p in quickPresets" :key="p.key" class="preset-chip" :color="chipColor(p.key)" @click="applyQuickPreset(p)" style="cursor:pointer">{{ p.label }}</a-tag>
        </div>
      </div>
      <a-divider style="margin:8px 0 16px" />
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }">
        <a-form-item label="服务商" required><a-select v-model:value="form.provider" @change="onProviderChange"><a-select-option value="openai">OpenAI</a-select-option><a-select-option value="claude">Claude (Anthropic)</a-select-option><a-select-option value="azure_openai">Azure OpenAI</a-select-option><a-select-option value="qwen">通义千问 (Qwen)</a-select-option><a-select-option value="zhipu">智谱 GLM</a-select-option><a-select-option value="deepseek">DeepSeek</a-select-option><a-select-option value="openai_compatible">OpenAI 兼容</a-select-option><a-select-option value="custom_http">🔧 自定义 HTTP</a-select-option></a-select></a-form-item>
        <a-form-item label="API Key" :required="!config"><a-input-password v-model:value="form.apiKey" :placeholder="config ? `留空保留（尾号: ${config.apiKeyMasked?.slice(-4)})` : '输入API Key'" /><div v-if="config" class="field-hint">当前Key尾号：{{ config.apiKeyMasked }}</div></a-form-item>
        <template v-if="form.provider !== 'custom_http'">
          <a-form-item label="Base URL"><a-input v-model:value="form.baseUrl" :placeholder="defaultBaseUrl" /></a-form-item>
          <a-form-item label="默认模型" required><div style="display:flex;gap:8px"><a-auto-complete v-model:value="form.defaultModel" :options="modelSuggestions" style="flex:1" :filter-option="filterModel" placeholder="gpt-4o / deepseek-chat" /><a-tooltip title="从 Base URL 获取可用模型列表"><a-button @click="fetchModelList" :loading="fetchingModels"><template #icon><UnorderedListOutlined /></template>获取列表</a-button></a-tooltip></div><div v-if="fetchedModelCount > 0" class="field-hint" style="color:#52c41a">✓ 已获取 {{ fetchedModelCount }} 个可用模型</div></a-form-item>
        </template>
        <template v-if="form.provider === 'custom_http'">
          <a-divider style="margin:8px 0 12px">🔧 自定义配置</a-divider>
          <a-form-item label="Chat URL" required><a-input v-model:value="form.customChatUrl" placeholder="https://your-server/api/chat" /></a-form-item>
          <a-form-item label="默认模型" required><a-input v-model:value="form.defaultModel" placeholder="llama3 / qwen2" /></a-form-item>
          <a-form-item label="鉴权方式"><a-select v-model:value="form.customAuthType" style="width:240px"><a-select-option value="bearer">Bearer Token</a-select-option><a-select-option value="header">自定义 Header Key</a-select-option><a-select-option value="query">Query 参数</a-select-option><a-select-option value="none">无鉴权</a-select-option></a-select></a-form-item>
          <a-form-item v-if="form.customAuthType === 'header'" label="Header名"><a-input v-model:value="form.customAuthHeader" placeholder="X-API-Key" style="width:240px" /></a-form-item>
          <a-form-item label="额外请求头"><a-textarea v-model:value="form.customHeaders" :rows="2" placeholder='{"X-Custom":"value"}' /></a-form-item>
          <a-form-item label="响应路径"><a-input v-model:value="form.customResponsePath" placeholder="留空自动识别" /></a-form-item>
        </template>
        <a-divider style="margin:8px 0 12px" />
        <a-form-item label="Temperature"><a-row :gutter="8" align="middle"><a-col :span="16"><a-slider v-model:value="form.temperature" :min="0" :max="2" :step="0.1" /></a-col><a-col :span="5"><a-input-number v-model:value="form.temperature" :min="0" :max="2" :step="0.1" style="width:100%" /></a-col></a-row></a-form-item>
        <a-form-item label="Max Tokens"><a-input-number v-model:value="form.maxTokens" :min="256" :max="128000" style="width:160px" /></a-form-item>
        <a-form-item label="跳过TLS"><a-switch v-model:checked="form.allowInsecureHttps" /><span v-if="form.allowInsecureHttps" style="margin-left:8px;font-size:12px;color:#ff7875">⚠️ 已关闭证书验证</span></a-form-item>
        <a-form-item :wrapper-col="{ offset: 5 }"><a-space><a-button type="primary" @click="handleSave" :loading="saving">保存配置</a-button><a-button @click="handleTest" :loading="testing"><template #icon><ApiOutlined /></template>测试连接</a-button></a-space></a-form-item>
      </a-form>
      <!-- 测试结果 -->
      <div v-if="testResult" style="margin-top:8px"><a-alert :type="testResult.success ? 'success' : 'error'" :message="testResult.success ? `连接成功 · ${testResult.model} · ${testResult.latency}ms` : testResult.error" show-icon /></div>
    </a-modal>

    <!-- ═══ 预设新增/编辑弹窗 ═══ -->
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

    <!-- ═══ 调用统计弹窗 ═══ -->
    <a-modal v-model:open="showStats" :title="`📊 调用统计 — ${statsData?.displayName || ''}`" :footer="null" width="560px" destroy-on-close>
      <div v-if="loadingStats" style="text-align:center;padding:40px"><a-spin /></div>
      <template v-else-if="statsData">
        <a-descriptions :column="2" bordered size="small" style="margin-bottom:16px">
          <a-descriptions-item label="模型"><a-typography-text code>{{ statsData.modelName }}</a-typography-text></a-descriptions-item>
          <a-descriptions-item label="服务商"><a-tag :color="providerColor(statsData.provider)">{{ providerLabel(statsData.provider) }}</a-tag></a-descriptions-item>
          <a-descriptions-item label="创建时间" :span="2">{{ formatDate(statsData.createdAt) }}</a-descriptions-item>
        </a-descriptions>

        <a-row :gutter="16" style="margin-bottom:16px">
          <a-col :span="8"><a-card size="small"><a-statistic title="本月会话数" :value="statsData.thisMonth.sessions" :value-style="{ color:'#1677ff' }" /></a-card></a-col>
          <a-col :span="8"><a-card size="small"><a-statistic title="本月消息数" :value="statsData.thisMonth.messages" :value-style="{ color:'#1677ff' }" /></a-card></a-col>
          <a-col :span="8"><a-card size="small"><a-statistic title="本月Token" :value="statsData.thisMonth.tokens" :value-style="{ color:'#1677ff' }" /></a-card></a-col>
        </a-row>
        <a-row :gutter="16" style="margin-bottom:16px">
          <a-col :span="8"><a-card size="small"><a-statistic title="累计会话" :value="statsData.allTime.sessions" /></a-card></a-col>
          <a-col :span="8"><a-card size="small"><a-statistic title="累计消息" :value="statsData.allTime.messages" /></a-card></a-col>
          <a-col :span="8"><a-card size="small"><a-statistic title="累计Token" :value="statsData.allTime.tokens" /></a-card></a-col>
        </a-row>

        <a-divider style="margin:12px 0">绑定的智能体</a-divider>
        <a-empty v-if="!statsData.boundAgents?.length" description="暂无智能体使用此模型" :image-style="{ height:'40px' }" />
        <a-list v-else :data-source="statsData.boundAgents" size="small">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta :title="item.name" :description="`本月调用 ${item.monthlyCallCount} 次`" />
            </a-list-item>
          </template>
        </a-list>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, ApiOutlined,
  EditOutlined, DeleteOutlined, SettingOutlined, UnorderedListOutlined, BarChartOutlined,
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
const showGlobalConfig = ref(false)
const globalTesting = ref(false), globalTestResult = ref<any>(null)
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
// Stats
const showStats = ref(false), loadingStats = ref(false), statsData = ref<any>(null)

// ═══ Computed ═══
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
function truncUrl(url: string|null|undefined) { if (!url) return ''; try { const u = new URL(url); return u.hostname + (u.pathname !== '/' ? u.pathname : '') } catch { return url.slice(0, 40) } }
function formatDate(d: string) { if (!d) return ''; return new Date(d).toLocaleDateString('zh-CN') }

function onProviderChange() {
  const models: Record<string,string> = { openai:'gpt-4o', claude:'claude-3-5-sonnet-20241022', qwen:'qwen-plus', zhipu:'glm-4', deepseek:'deepseek-chat', openai_compatible:'', custom_http:'' }
  form.value.defaultModel = models[form.value.provider] ?? ''
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
    const body: Record<string,any> = { provider: form.value.provider, defaultModel: form.value.defaultModel, temperature: form.value.temperature, maxTokens: form.value.maxTokens, allowInsecureHttps: form.value.allowInsecureHttps }
    if (form.value.apiKey.trim()) body.apiKey = form.value.apiKey.trim()
    if (form.value.baseUrl.trim()) body.baseUrl = form.value.baseUrl.trim()
    if (form.value.provider === 'custom_http') {
      if (form.value.customChatUrl.trim()) body.customChatUrl = form.value.customChatUrl.trim()
      if (form.value.customAuthType) body.customAuthType = form.value.customAuthType
      if (form.value.customAuthHeader.trim()) body.customAuthHeader = form.value.customAuthHeader.trim()
      if (form.value.customResponsePath.trim()) body.customResponsePath = form.value.customResponsePath.trim()
      if (form.value.customHeaders.trim()) { try { JSON.parse(form.value.customHeaders); body.customHeaders = form.value.customHeaders.trim() } catch { message.error('额外请求头格式错误'); return } }
    }
    await request.put('/company/llm-config', body)
    message.success('配置已保存'); form.value.apiKey = ''; showGlobalConfig.value = false; fetchConfig()
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
async function handleGlobalTest() {
  globalTesting.value = true; globalTestResult.value = null
  try {
    const res = await request.post('/company/llm-config/test')
    globalTestResult.value = res
    if (res?.success) message.success(`全局连接成功`)
    else message.error(res?.error || '连接失败')
  } catch (e: any) { globalTestResult.value = { success: false, error: e.message } }
  finally { globalTesting.value = false }
}

// ═══ Presets CRUD ═══
async function fetchPresets() { const res = await request.get('/company/model-presets'); presets.value = res || [] }
function openPresetCreate() {
  editingPresetId.value = null
  presetForm.value = { displayName:'', provider:'openai', apiKey:'', baseUrl:'', modelName:'', temperature:0.7, maxTokens:4096, customChatUrl:'', customAuthType:'bearer', customAuthHeader:'', customRequestTemplate:'', customResponsePath:'', customHeaders:'', allowInsecureHttps:false }
  showPresetForm.value = true
}
function openPresetEdit(preset: any) {
  editingPresetId.value = preset.id
  presetForm.value = { displayName: preset.displayName, provider: preset.provider, apiKey: '', baseUrl: preset.baseUrl || '', modelName: preset.modelName, temperature: preset.temperature, maxTokens: preset.maxTokens, customChatUrl: preset.customChatUrl || '', customAuthType: preset.customAuthType || 'bearer', customAuthHeader: preset.customAuthHeader || '', customRequestTemplate: preset.customRequestTemplate || '', customResponsePath: preset.customResponsePath || '', customHeaders: preset.customHeaders ? JSON.stringify(preset.customHeaders, null, 2) : '', allowInsecureHttps: preset.allowInsecureHttps ?? false }
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
    const body: Record<string,any> = { displayName: presetForm.value.displayName.trim(), provider: presetForm.value.provider, modelName: presetForm.value.modelName.trim(), temperature: presetForm.value.temperature, maxTokens: presetForm.value.maxTokens, allowInsecureHttps: presetForm.value.allowInsecureHttps }
    if (presetForm.value.apiKey.trim()) body.apiKey = presetForm.value.apiKey.trim()
    if (presetForm.value.baseUrl.trim()) body.baseUrl = presetForm.value.baseUrl.trim()
    if (presetForm.value.provider === 'custom_http' || presetForm.value.provider === 'custom') {
      if (presetForm.value.customChatUrl.trim()) body.customChatUrl = presetForm.value.customChatUrl.trim()
      if (presetForm.value.customAuthType) body.customAuthType = presetForm.value.customAuthType
      if (presetForm.value.customAuthHeader.trim()) body.customAuthHeader = presetForm.value.customAuthHeader.trim()
      if (presetForm.value.customRequestTemplate.trim()) body.customRequestTemplate = presetForm.value.customRequestTemplate.trim()
      if (presetForm.value.customResponsePath.trim()) body.customResponsePath = presetForm.value.customResponsePath.trim()
      if (presetForm.value.customHeaders.trim()) { try { JSON.parse(presetForm.value.customHeaders); body.customHeaders = presetForm.value.customHeaders.trim() } catch { message.error('请求头JSON格式错误'); return } }
    }
    if (editingPresetId.value) { await request.put(`/company/model-presets/${editingPresetId.value}`, body); message.success('已更新') }
    else { await request.post('/company/model-presets', body); message.success('已添加') }
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

// ═══ Preset Stats ═══
async function openPresetStats(preset: any) {
  showStats.value = true; loadingStats.value = true; statsData.value = null
  try { statsData.value = await request.get(`/company/model-presets/${preset.id}/stats`) }
  catch (e: any) { message.error('获取统计失败'); showStats.value = false }
  finally { loadingStats.value = false }
}

onMounted(() => { fetchConfig(); fetchPresets() })
</script>

<style scoped>
.llm-page { max-width: 1400px; }
.config-summary { background: #fafafa; }
.quick-presets { margin-bottom: 0; }
.quick-label { font-size: 12px; color: #999; font-weight: 500; margin-right: 8px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.preset-chip { border-radius: 6px !important; }
.preset-chip:hover { opacity: 0.8; transform: translateY(-1px); transition: all 0.15s; }
.field-hint { font-size: 11px; color: #999; margin-top: 3px; }
.preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.preset-card { border: 1px solid #f0f0f0; border-radius: 8px; padding: 14px; transition: all 0.2s; background: #fff; }
.preset-card:hover { border-color: #d9d9d9; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.preset-card.inactive { opacity: 0.55; }
.preset-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.preset-card-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.preset-name { font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.preset-card-body { margin-bottom: 10px; }
.preset-info-row { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 4px; }
.info-label { color: #999; min-width: 32px; flex-shrink: 0; }
.info-value { color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.preset-card-footer { display: flex; gap: 6px; flex-wrap: wrap; }
.preset-test-result { margin-top: 8px; }
</style>
