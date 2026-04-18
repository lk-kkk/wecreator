<template>
  <div class="page-container">
    <a-page-header title="AI 智能体管理" :ghost="false" style="margin-bottom:16px">
      <template #extra>
        <a-button type="primary" @click="openCreate">
          <PlusOutlined /> 创建智能体
        </a-button>
      </template>
    </a-page-header>

    <!-- 无预设提示 -->
    <a-alert v-if="presets.length === 0" type="info" show-icon style="margin-bottom:16px"
      message="提示：您还未配置任何模型预设"
      description="前往「AI大模型配置」添加模型预设后，可在创建智能体时为其单独指定专属模型和 API Key。"
      closable>
      <template #action>
        <a-button size="small" type="link" @click="$router.push('/settings/llm-config')">去配置模型</a-button>
      </template>
    </a-alert>

    <div v-if="loading" style="text-align:center;padding:40px">
      <a-spin size="large" />
    </div>
    <div v-else-if="agents.length === 0">
      <a-empty description="暂无智能体，点击「创建智能体」开始">
        <template #extra>
          <a-button type="primary" @click="openCreate"><PlusOutlined />创建智能体</a-button>
        </template>
      </a-empty>
    </div>

    <div v-else class="agent-grid">
      <a-card v-for="a in agents" :key="a.id" hoverable size="small" class="agent-card">
        <template #title>
          <div class="agent-header">
            <a-avatar :src="a.avatarUrl" :size="32" style="background:#0858F4;flex-shrink:0">
              {{ a.name[0] }}
            </a-avatar>
            <div class="agent-title-info">
              <span class="agent-name">{{ a.name }}</span>
              <div class="agent-tags">
                <a-tag v-if="a.isPreset" color="blue" size="small">预设</a-tag>
                <a-tag :color="a.isActive ? 'success' : 'default'" size="small">
                  {{ a.isActive ? '启用' : '停用' }}
                </a-tag>
              </div>
            </div>
          </div>
        </template>
        <template #extra>
          <a-dropdown>
            <a-button type="text" size="small"><EllipsisOutlined /></a-button>
            <template #overlay>
              <a-menu @click="({ key }:{key:string}) => onAgentAction(key, a)">
                <a-menu-item key="edit">编辑</a-menu-item>
                <a-menu-item key="toggle">{{ a.isActive ? '停用' : '启用' }}</a-menu-item>
                <a-menu-item key="delete" v-if="!a.isPreset" danger>删除</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>

        <p style="color:#666;font-size:13px;margin:0 0 10px;line-height:1.5">{{ a.description }}</p>

        <!-- 模型信息 -->
        <div class="model-info">
          <template v-if="a.preset">
            <a-tag :color="providerColor(a.preset.provider)" size="small">
              {{ providerLabel(a.preset.provider) }}
            </a-tag>
            <span class="model-name">{{ a.preset.displayName }}</span>
            <a-typography-text code style="font-size:11px">{{ a.modelName || a.preset.modelName }}</a-typography-text>
          </template>
          <template v-else-if="a.modelName">
            <a-tag color="default" size="small">自定义</a-tag>
            <a-typography-text code style="font-size:11px">{{ a.modelName }}</a-typography-text>
          </template>
          <template v-else>
            <span style="color:#bbb;font-size:12px">使用全局默认模型</span>
          </template>
        </div>

        <a-divider style="margin:8px 0" />
        <div style="font-size:12px;color:#999">
          本月调用: <strong>{{ a.monthlyCallCount }}</strong> 次
        </div>
      </a-card>
    </div>

    <!-- 创建/编辑弹窗 -->
    <a-modal v-model:open="showForm"
      :title="editingId ? '编辑智能体' : '创建智能体'"
      @ok="handleSave" :confirm-loading="saving" width="640px" destroy-on-close>
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }" style="margin-top:16px">
        <a-form-item label="名称" required>
          <a-input v-model:value="form.name" placeholder="智能体名称（≤40字）" :maxlength="40" show-count />
        </a-form-item>
        <a-form-item label="描述" required>
          <a-input v-model:value="form.description" placeholder="一句话介绍（≤200字）" :maxlength="200" show-count />
        </a-form-item>
        <a-form-item label="系统提示词" required>
          <a-textarea v-model:value="form.systemPrompt" :rows="6"
            placeholder="定义智能体的角色、行为规则和输出格式..." :maxlength="10000" show-count />
        </a-form-item>

        <!-- 模型选择区域 -->
        <a-divider>模型配置（可选）</a-divider>
        <a-form-item label="选择模型预设">
          <a-select v-model:value="form.presetId" placeholder="选择已保存的模型预设"
            allow-clear @change="onPresetSelect" style="width:100%">
            <a-select-option v-if="presets.length === 0" :value="null" disabled>
              暂无预设 — 请先在「AI大模型配置」中添加
            </a-select-option>
            <a-select-option v-for="p in presets" :key="p.id" :value="p.id">
              <div style="display:flex;align-items:center;gap:8px">
                <a-tag :color="providerColor(p.provider)" size="small" style="margin:0">
                  {{ providerLabel(p.provider) }}
                </a-tag>
                <span>{{ p.displayName }}</span>
                <a-typography-text code style="font-size:11px;margin:0">{{ p.modelName }}</a-typography-text>
              </div>
            </a-select-option>
          </a-select>
          <div style="font-size:12px;color:#999;margin-top:4px">
            选择预设后将使用预设的 API Key 和模型，可在「模型名称」中覆盖模型
          </div>
        </a-form-item>

        <!-- 选择了预设时显示预设摘要 -->
        <a-form-item v-if="selectedPreset" :wrapper-col="{ offset: 5, span: 17 }">
          <a-descriptions size="small" bordered :column="2"
            style="background:#f0f5ff;border-radius:6px;padding:0">
            <a-descriptions-item label="服务商">
              <a-tag :color="providerColor(selectedPreset.provider)">{{ providerLabel(selectedPreset.provider) }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="模型">
              <a-typography-text code>{{ selectedPreset.modelName }}</a-typography-text>
            </a-descriptions-item>
            <a-descriptions-item label="Base URL" :span="2">
              {{ selectedPreset.baseUrl || '（使用默认）' }}
            </a-descriptions-item>
            <a-descriptions-item label="API Key" :span="2">
              <span style="color:#999">{{ selectedPreset.apiKeyMasked }}</span>
            </a-descriptions-item>
          </a-descriptions>
        </a-form-item>

        <a-form-item label="模型名称覆盖">
          <a-input v-model:value="form.modelName"
            :placeholder="selectedPreset ? `覆盖预设模型（预设: ${selectedPreset.modelName}）` : '留空使用全局默认模型'" />
          <div style="font-size:12px;color:#999;margin-top:4px">
            填写后将覆盖预设的模型名称（API Key 仍使用预设的）
          </div>
        </a-form-item>
        <a-form-item label="温度">
          <a-row :gutter="8">
            <a-col :span="18">
              <a-slider v-model:value="form.temperature" :min="0" :max="2" :step="0.1" />
            </a-col>
            <a-col :span="6">
              <a-input-number v-model:value="form.temperature" :min="0" :max="2" :step="0.1" style="width:100%" />
            </a-col>
          </a-row>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, EllipsisOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import request from '@/api/request'

const router = useRouter()
const agents = ref<any[]>([])
const presets = ref<any[]>([])
const loading = ref(false)
const showForm = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)

const form = ref({
  name: '', description: '', systemPrompt: '',
  modelName: '', temperature: 0.7,
  presetId: null as number | null,
})

const selectedPreset = computed(() =>
  form.value.presetId ? presets.value.find(p => p.id === form.value.presetId) : null
)

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

function onPresetSelect(id: number | null) {
  if (id) {
    const preset = presets.value.find(p => p.id === id)
    // 自动填入预设的温度（若用户未手动修改过）
    if (preset && form.value.temperature === 0.7) {
      form.value.temperature = preset.temperature
    }
  }
}

// ─── Data loading ───
async function fetchData() {
  loading.value = true
  try {
    const [agentRes, presetRes] = await Promise.all([
      request.get('/company/agents'),
      request.get('/company/model-presets'),
    ])
    agents.value = agentRes.data || []
    presets.value = presetRes.data || []
  } finally { loading.value = false }
}

// ─── Form ───
function openCreate() {
  editingId.value = null
  form.value = { name: '', description: '', systemPrompt: '', modelName: '', temperature: 0.7, presetId: null }
  showForm.value = true
}

function onAgentAction(key: string, agent: any) {
  if (key === 'edit') {
    editingId.value = agent.id
    form.value = {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      modelName: agent.modelName || '',
      temperature: agent.temperature ?? 0.7,
      presetId: agent.presetId || null,
    }
    showForm.value = true
  } else if (key === 'toggle') {
    toggleAgent(agent.id)
  } else if (key === 'delete') {
    Modal.confirm({
      title: '确认删除',
      content: `确定删除智能体「${agent.name}」？`,
      onOk: () => deleteAgent(agent.id),
    })
  }
}

async function handleSave() {
  if (!form.value.name.trim()) return message.warning('请填写名称')
  if (!form.value.description.trim()) return message.warning('请填写描述')
  if (!form.value.systemPrompt.trim()) return message.warning('请填写系统提示词')
  saving.value = true
  try {
    const body: Record<string, any> = {
      name: form.value.name.trim(),
      description: form.value.description.trim(),
      systemPrompt: form.value.systemPrompt.trim(),
      temperature: form.value.temperature,
    }
    if (form.value.modelName.trim()) body.modelName = form.value.modelName.trim()
    if (form.value.presetId) body.presetId = form.value.presetId

    if (editingId.value) {
      // 编辑时若清空了presetId，需要传null
      body.presetId = form.value.presetId ?? null
      await request.put(`/company/agents/${editingId.value}`, body)
      message.success('更新成功')
    } else {
      await request.post('/company/agents', body)
      message.success('创建成功')
    }
    showForm.value = false
    fetchData()
  } catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '操作失败')
  } finally { saving.value = false }
}

async function toggleAgent(id: number) {
  await request.patch(`/company/agents/${id}/toggle`)
  message.success('状态已更新')
  fetchData()
}

async function deleteAgent(id: number) {
  await request.delete(`/company/agents/${id}`)
  message.success('已删除')
  fetchData()
}

onMounted(fetchData)
</script>

<style scoped>
.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.agent-card { border-radius: 8px; }
.agent-header { display: flex; align-items: center; gap: 10px; }
.agent-title-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.agent-name { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-tags { display: flex; gap: 4px; }
.model-info {
  display: flex; align-items: center; gap: 6px;
  background: #f5f7fa; border-radius: 4px; padding: 6px 8px;
  flex-wrap: wrap;
}
.model-name { font-size: 12px; color: #333; font-weight: 500; }
</style>
