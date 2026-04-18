<template>
  <div class="page-container">
    <a-page-header title="AI 大模型配置" sub-title="仅超级管理员可操作" :ghost="false" style="margin-bottom:16px" />

    <!-- 第一行：全局配置 + 测试结果 -->
    <a-row :gutter="16" style="margin-bottom:16px">
      <a-col :span="14">
        <a-card title="🤖 全局 LLM 接口配置" :bordered="false" :loading="loading">
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
              <a-input v-model:value="form.defaultModel" placeholder="gpt-4o / deepseek-chat" />
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
                  <template #icon>
                    <CheckCircleOutlined v-if="testResult?.success === true" style="color:#52c41a" />
                    <CloseCircleOutlined v-else-if="testResult?.success === false" style="color:#ff4d4f" />
                    <ApiOutlined v-else />
                  </template>
                  {{ testResult?.success === true ? '连接成功' : testResult?.success === false ? '连接失败' : '测试连接' }}
                </a-button>
              </a-space>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>

      <a-col :span="10">
        <!-- 测试结果卡片 -->
        <a-card title="🔗 连接测试结果" :bordered="false" size="small" style="margin-bottom:16px">
          <div v-if="!testResult" style="color:#bbb;text-align:center;padding:20px 0">
            <ApiOutlined style="font-size:32px;display:block;margin-bottom:8px" />
            <span style="font-size:13px">点击「测试连接」验证配置</span>
          </div>
          <template v-else>
            <a-result
              :status="testResult.success ? 'success' : 'error'"
              :title="testResult.success ? '连接成功' : '连接失败'"
              :sub-title="testResult.success ? `模型: ${testResult.model} · 响应延迟: ${testResult.latency}ms` : testResult.error"
              style="padding:16px 0"
            >
              <template v-if="testResult.success" #extra>
                <a-tag color="success">{{ testResult.model }}</a-tag>
                <a-tag color="blue">{{ testResult.latency }}ms</a-tag>
              </template>
            </a-result>
          </template>
        </a-card>

        <!-- 使用统计 -->
        <a-card title="📊 本月使用统计" :bordered="false" size="small">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-statistic title="调用次数" :value="config?.monthlyCallCount || 0" :value-style="{ fontSize: '22px' }" />
            </a-col>
            <a-col :span="12">
              <a-statistic title="Token 消耗" :value="config?.monthlyTokenCount || 0"
                :formatter="v => v >= 1000 ? (v/1000).toFixed(1)+'K' : String(v)"
                :value-style="{ fontSize: '22px' }" />
            </a-col>
          </a-row>
        </a-card>
      </a-col>
    </a-row>

    <!-- 第二行：模型预设列表 -->
    <a-card :bordered="false">
      <template #title>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>📋 已配置模型列表</span>
          <a-button type="primary" size="small" @click="openPresetCreate">
            <PlusOutlined /> 添加模型
          </a-button>
        </div>
      </template>

      <a-empty v-if="presets.length === 0" description="暂无已保存模型，点击「添加模型」保存常用模型配置" />

      <a-table v-else :data-source="presets" :columns="presetColumns" row-key="id"
        :pagination="false" size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'displayName'">
            <span style="font-weight:600">{{ record.displayName }}</span>
          </template>
          <template v-if="column.key === 'provider'">
            <a-tag :color="providerColor(record.provider)">{{ providerLabel(record.provider) }}</a-tag>
          </template>
          <template v-if="column.key === 'model'">
            <a-typography-text code>{{ record.modelName }}</a-typography-text>
          </template>
          <template v-if="column.key === 'apiKey'">
            <span style="color:#999;font-size:12px">{{ record.apiKeyMasked }}</span>
          </template>
          <template v-if="column.key === 'status'">
            <a-badge :status="record.isActive ? 'success' : 'default'"
              :text="record.isActive ? '启用' : '停用'" />
          </template>
          <template v-if="column.key === 'actions'">
            <a-space size="small">
              <a-button size="small" @click="testPreset(record)" :loading="testingPreset === record.id">
                {{ presetTestResults[record.id]?.success === true ? '✅' : presetTestResults[record.id]?.success === false ? '❌' : '测试' }}
              </a-button>
              <a-button size="small" @click="openPresetEdit(record)">编辑</a-button>
              <a-popconfirm title="确认删除此模型预设？" @confirm="deletePreset(record.id)">
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>

      <!-- 各预设的测试结果 inline -->
      <div v-for="(result, pid) in presetTestResults" :key="pid" style="margin-top:8px">
        <a-alert v-if="result.tested"
          :type="result.success ? 'success' : 'error'"
          :message="result.success
            ? `「${presets.find(p=>p.id===Number(pid))?.displayName}」连接成功 · ${result.model} · ${result.latency}ms`
            : `「${presets.find(p=>p.id===Number(pid))?.displayName}」${result.error}`"
          show-icon closable @close="delete presetTestResults[pid]" />
      </div>
    </a-card>

    <!-- 模型预设 新增/编辑 弹窗 -->
    <a-modal v-model:open="showPresetForm"
      :title="editingPresetId ? '编辑模型预设' : '添加模型预设'"
      @ok="handlePresetSave" :confirm-loading="savingPreset" width="560px" destroy-on-close>
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" style="margin-top:16px">
        <a-form-item label="预设名称" required>
          <a-input v-model:value="presetForm.displayName" placeholder="如：GPT-4o 主力 / DeepSeek 速答"
            :maxlength="60" show-count />
        </a-form-item>
        <a-form-item label="服务商" required>
          <a-select v-model:value="presetForm.provider" @change="onPresetProviderChange">
            <a-select-option value="openai">OpenAI</a-select-option>
            <a-select-option value="claude">Claude (Anthropic)</a-select-option>
            <a-select-option value="azure_openai">Azure OpenAI</a-select-option>
            <a-select-option value="qwen">通义千问 (Qwen)</a-select-option>
            <a-select-option value="zhipu">智谱 GLM</a-select-option>
            <a-select-option value="deepseek">DeepSeek</a-select-option>
            <a-select-option value="openai_compatible">OpenAI 兼容</a-select-option>
            <a-select-option value="custom_http">自定义 HTTP</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="API Key" :required="!editingPresetId">
          <a-input-password v-model:value="presetForm.apiKey"
            :placeholder="editingPresetId ? '留空则保留原有Key' : '输入此模型的 API Key'" />
        </a-form-item>
        <a-form-item label="Base URL">
          <a-input v-model:value="presetForm.baseUrl" :placeholder="presetDefaultBaseUrl" />
        </a-form-item>
        <a-form-item label="模型名称" required>
          <a-input v-model:value="presetForm.modelName" placeholder="如：gpt-4o / deepseek-chat" />
        </a-form-item>
        <a-form-item label="Temperature">
          <a-slider v-model:value="presetForm.temperature" :min="0" :max="2" :step="0.1" />
          <span style="font-size:12px;color:#999">{{ presetForm.temperature }}</span>
        </a-form-item>
        <a-form-item label="Max Tokens">
          <a-input-number v-model:value="presetForm.maxTokens" :min="256" :max="128000" style="width:160px" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, ApiOutlined,
} from '@ant-design/icons-vue'
import request from '@/api/request'

// ─── State ───
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const config = ref<any>(null)
const testResult = ref<any>(null)

const form = ref({
  provider: 'openai', apiKey: '', baseUrl: '', defaultModel: 'gpt-4o',
  temperature: 0.7, maxTokens: 4096,
})

// ─── Preset state ───
const presets = ref<any[]>([])
const showPresetForm = ref(false)
const savingPreset = ref(false)
const editingPresetId = ref<number | null>(null)
const testingPreset = ref<number | null>(null)
const presetTestResults = reactive<Record<number, any>>({})

const presetForm = ref({
  displayName: '', provider: 'openai', apiKey: '', baseUrl: '',
  modelName: '', temperature: 0.7, maxTokens: 4096,
})

const presetColumns = [
  { title: '预设名称', key: 'displayName', dataIndex: 'displayName', width: 160 },
  { title: '服务商', key: 'provider', dataIndex: 'provider', width: 120 },
  { title: '模型', key: 'model', dataIndex: 'modelName', width: 180 },
  { title: 'API Key', key: 'apiKey', dataIndex: 'apiKeyMasked', width: 100 },
  { title: '状态', key: 'status', dataIndex: 'isActive', width: 80 },
  { title: '操作', key: 'actions', width: 160 },
]

// ─── Computed ───
const defaultBaseUrl = computed(() => {
  const m: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    deepseek: 'https://api.deepseek.com/v1',
    azure_openai: 'https://{resource}.openai.azure.com/openai/deployments/{deployment}',
  }
  return m[form.value.provider] || '请输入 Base URL（OpenAI兼容格式）'
})

const presetDefaultBaseUrl = computed(() => {
  const m: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    claude: 'https://api.anthropic.com',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    deepseek: 'https://api.deepseek.com/v1',
  }
  return m[presetForm.value.provider] || '请输入 Base URL'
})

// ─── Helpers ───
const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI', claude: 'Claude', azure_openai: 'Azure', qwen: '通义',
  zhipu: '智谱', deepseek: 'DeepSeek', openai_compatible: 'OAI兼容', custom_http: '自定义',
}
const PROVIDER_COLORS: Record<string, string> = {
  openai: 'green', claude: 'orange', azure_openai: 'blue', qwen: 'cyan',
  zhipu: 'purple', deepseek: 'magenta', openai_compatible: 'geekblue', custom_http: 'default',
}
function providerLabel(p: string) { return PROVIDER_LABELS[p] || p }
function providerColor(p: string) { return PROVIDER_COLORS[p] || 'default' }

// ─── Global config ───
function onProviderChange() {
  const models: Record<string, string> = {
    openai: 'gpt-4o', claude: 'claude-3-5-sonnet-20241022',
    qwen: 'qwen-plus', zhipu: 'glm-4', deepseek: 'deepseek-chat',
    openai_compatible: '', custom_http: '',
  }
  form.value.defaultModel = models[form.value.provider] ?? ''
  if (!form.value.baseUrl) {
    const urls: Record<string, string> = {
      deepseek: 'https://api.deepseek.com/v1',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    }
    form.value.baseUrl = urls[form.value.provider] || ''
  }
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
  if (!form.value.apiKey.trim() && !config.value) return message.warning('首次配置必须输入 API Key')
  saving.value = true
  try {
    const body: Record<string, any> = {
      provider: form.value.provider, defaultModel: form.value.defaultModel,
      temperature: form.value.temperature, maxTokens: form.value.maxTokens,
    }
    if (form.value.apiKey.trim()) body.apiKey = form.value.apiKey.trim()
    if (form.value.baseUrl.trim()) body.baseUrl = form.value.baseUrl.trim()
    await request.put('/company/llm-config', body)
    message.success('配置已保存')
    form.value.apiKey = ''
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
    if (res.data?.success) {
      message.success(`连接成功 · ${res.data.model} · ${res.data.latency}ms`)
    } else {
      message.error(res.data?.error || '连接失败')
    }
  } catch (e: any) {
    testResult.value = { success: false, error: e.message }
    message.error('连接失败')
  } finally { testing.value = false }
}

// ─── Presets ───
async function fetchPresets() {
  const res = await request.get('/company/model-presets')
  presets.value = res.data || []
}

function openPresetCreate() {
  editingPresetId.value = null
  presetForm.value = {
    displayName: '', provider: 'openai', apiKey: '', baseUrl: '',
    modelName: '', temperature: 0.7, maxTokens: 4096,
  }
  showPresetForm.value = true
}

function openPresetEdit(preset: any) {
  editingPresetId.value = preset.id
  presetForm.value = {
    displayName: preset.displayName,
    provider: preset.provider,
    apiKey: '',
    baseUrl: preset.baseUrl || '',
    modelName: preset.modelName,
    temperature: preset.temperature,
    maxTokens: preset.maxTokens,
  }
  showPresetForm.value = true
}

function onPresetProviderChange() {
  const models: Record<string, string> = {
    openai: 'gpt-4o', claude: 'claude-3-5-sonnet-20241022',
    qwen: 'qwen-plus', zhipu: 'glm-4', deepseek: 'deepseek-chat',
    openai_compatible: '', custom_http: '',
  }
  presetForm.value.modelName = models[presetForm.value.provider] ?? ''
  if (!presetForm.value.baseUrl) {
    const urls: Record<string, string> = {
      deepseek: 'https://api.deepseek.com/v1',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    }
    presetForm.value.baseUrl = urls[presetForm.value.provider] || ''
  }
}

async function handlePresetSave() {
  if (!presetForm.value.displayName.trim()) return message.warning('请输入预设名称')
  if (!presetForm.value.modelName.trim()) return message.warning('请输入模型名称')
  if (!presetForm.value.apiKey.trim() && !editingPresetId.value) return message.warning('新建预设必须输入 API Key')
  savingPreset.value = true
  try {
    const body: Record<string, any> = {
      displayName: presetForm.value.displayName.trim(),
      provider: presetForm.value.provider,
      modelName: presetForm.value.modelName.trim(),
      temperature: presetForm.value.temperature,
      maxTokens: presetForm.value.maxTokens,
    }
    if (presetForm.value.apiKey.trim()) body.apiKey = presetForm.value.apiKey.trim()
    if (presetForm.value.baseUrl.trim()) body.baseUrl = presetForm.value.baseUrl.trim()

    if (editingPresetId.value) {
      await request.put(`/company/model-presets/${editingPresetId.value}`, body)
      message.success('预设已更新')
    } else {
      await request.post('/company/model-presets', body)
      message.success('模型预设已添加')
    }
    showPresetForm.value = false
    fetchPresets()
  } catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '保存失败')
  } finally { savingPreset.value = false }
}

async function deletePreset(id: number) {
  try {
    await request.delete(`/company/model-presets/${id}`)
    message.success('已删除')
    delete presetTestResults[id]
    fetchPresets()
  } catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '删除失败')
  }
}

async function testPreset(preset: any) {
  testingPreset.value = preset.id
  delete presetTestResults[preset.id]
  try {
    const res = await request.post(`/company/model-presets/${preset.id}/test`)
    presetTestResults[preset.id] = { ...res.data, tested: true }
  } catch (e: any) {
    presetTestResults[preset.id] = { success: false, error: e.message, tested: true }
  } finally { testingPreset.value = null }
}

onMounted(() => {
  fetchConfig()
  fetchPresets()
})
</script>
