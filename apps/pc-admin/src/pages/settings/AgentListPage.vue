<template>
  <div class="page-container">
    <a-page-header title="AI 智能体管理" :ghost="false" style="margin-bottom:16px">
      <template #extra>
        <a-button type="primary" @click="openCreate"><PlusOutlined /> 创建智能体</a-button>
      </template>
    </a-page-header>

    <a-alert v-if="presets.length === 0" type="info" show-icon style="margin-bottom:16px"
      message="提示：您还未配置任何模型预设"
      description="前往「AI大模型配置」添加模型预设后，可在创建智能体时为其单独指定专属模型和 API Key。" closable>
      <template #action>
        <a-button size="small" type="link" @click="$router.push('/settings/llm')">去配置模型</a-button>
      </template>
    </a-alert>

    <div v-if="loading" style="text-align:center;padding:40px"><a-spin size="large" /></div>
    <div v-else-if="agents.length === 0">
      <a-empty description="暂无智能体，点击「创建智能体」开始">
        <template #extra><a-button type="primary" @click="openCreate"><PlusOutlined />创建智能体</a-button></template>
      </a-empty>
    </div>

    <div v-else class="agent-grid">
      <a-card v-for="a in agents" :key="a.id" hoverable size="small" class="agent-card">
        <template #title>
          <div class="agent-header">
            <a-avatar :src="a.avatarUrl" :size="32" style="background:#0858F4;flex-shrink:0">{{ a.name[0] }}</a-avatar>
            <div class="agent-title-info">
              <span class="agent-name">{{ a.name }}</span>
              <div class="agent-tags">
                <a-tag v-if="a.isPreset" color="blue" size="small">预设</a-tag>
                <a-tag :color="a.isActive ? 'success' : 'default'" size="small">{{ a.isActive ? '启用' : '停用' }}</a-tag>
              </div>
            </div>
          </div>
        </template>
        <template #extra>
          <a-dropdown :trigger="['click']">
            <a-button type="text" size="small" class="more-btn" @click.stop><EllipsisOutlined style="font-size:16px" /></a-button>
            <template #overlay>
              <a-menu @click="({ key }: any) => handleMenuClick(key, a)">
                <a-menu-item key="edit"><EditOutlined /> 编辑</a-menu-item>
                <a-menu-item key="test"><MessageOutlined /> 测试对话</a-menu-item>
                <a-menu-item key="toggle"><PauseCircleOutlined v-if="a.isActive" /><PlayCircleOutlined v-else /> {{ a.isActive ? '停用' : '启用' }}</a-menu-item>
                <a-menu-divider v-if="!a.isPreset" />
                <a-menu-item v-if="!a.isPreset" key="delete" danger><DeleteOutlined /> 删除</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>

        <p style="color:#666;font-size:12px;margin:0 0 10px;line-height:1.5">{{ a.description }}</p>

        <div class="model-info">
          <template v-if="a.preset">
            <a-tag :color="providerColor(a.preset.provider)" size="small">{{ providerLabel(a.preset.provider) }}</a-tag>
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
        <div style="display:flex;align-items:center">
          <span style="font-size:12px;color:#999">本月调用: <strong>{{ a.monthlyCallCount }}</strong> 次</span>
        </div>
      </a-card>
    </div>

    <!-- ═══ 创建/编辑弹窗 ═══ -->
    <a-modal v-model:open="showForm" :title="editingId ? '编辑智能体' : '创建智能体'" @ok="handleSave" :confirm-loading="saving" width="640px" destroy-on-close>
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 17 }" style="margin-top:16px">
        <a-form-item label="名称" required><a-input v-model:value="form.name" placeholder="智能体名称（≤40字）" :maxlength="40" show-count /></a-form-item>
        <a-form-item label="描述" required><a-input v-model:value="form.description" placeholder="一句话介绍（≤200字）" :maxlength="200" show-count /></a-form-item>
        <a-form-item label="系统提示词" required><a-textarea v-model:value="form.systemPrompt" :rows="6" placeholder="定义智能体的角色、行为规则和输出格式..." :maxlength="10000" show-count /></a-form-item>
        <a-divider>模型配置（可选）</a-divider>
        <a-form-item label="模型预设">
          <a-select v-model:value="form.presetId" placeholder="选择已保存的模型预设" allow-clear @change="onPresetSelect" style="width:100%">
            <a-select-option v-if="presets.length === 0" :value="null" disabled>暂无预设</a-select-option>
            <a-select-option v-for="p in presets" :key="p.id" :value="p.id">
              <div style="display:flex;align-items:center;gap:8px">
                <a-tag :color="providerColor(p.provider)" size="small" style="margin:0">{{ providerLabel(p.provider) }}</a-tag>
                <span>{{ p.displayName }}</span>
                <a-typography-text code style="font-size:11px;margin:0">{{ p.modelName }}</a-typography-text>
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="selectedPreset" :wrapper-col="{ offset: 5, span: 17 }">
          <a-descriptions size="small" bordered :column="2" style="background:#f0f5ff;border-radius:6px">
            <a-descriptions-item label="服务商"><a-tag :color="providerColor(selectedPreset.provider)">{{ providerLabel(selectedPreset.provider) }}</a-tag></a-descriptions-item>
            <a-descriptions-item label="模型"><a-typography-text code>{{ selectedPreset.modelName }}</a-typography-text></a-descriptions-item>
            <a-descriptions-item label="Base URL" :span="2">{{ selectedPreset.baseUrl || '（默认）' }}</a-descriptions-item>
            <a-descriptions-item label="API Key" :span="2"><span style="color:#999">{{ selectedPreset.apiKeyMasked }}</span></a-descriptions-item>
          </a-descriptions>
        </a-form-item>
        <a-form-item label="模型覆盖"><a-input v-model:value="form.modelName" :placeholder="selectedPreset ? `覆盖预设（${selectedPreset.modelName}）` : '留空使用全局默认模型'" /></a-form-item>
        <a-form-item label="温度"><a-row :gutter="8"><a-col :span="18"><a-slider v-model:value="form.temperature" :min="0" :max="2" :step="0.1" /></a-col><a-col :span="6"><a-input-number v-model:value="form.temperature" :min="0" :max="2" :step="0.1" style="width:100%" /></a-col></a-row></a-form-item>
      </a-form>
    </a-modal>

    <!-- ═══ 测试对话弹窗 ═══ -->
    <a-modal v-model:open="showChat" :title="`测试对话 — ${chatAgent?.name || ''}`" width="680px" :footer="null" destroy-on-close class="chat-modal" @after-open-change="onChatOpen">
      <div class="chat-container">
        <!-- 智能体信息 -->
        <div class="chat-agent-bar">
          <a-avatar :src="chatAgent?.avatarUrl" :size="28" style="background:#0858F4">{{ chatAgent?.name?.[0] }}</a-avatar>
          <span style="font-weight:500">{{ chatAgent?.name }}</span>
          <a-tag v-if="chatAgent?.preset" :color="providerColor(chatAgent.preset.provider)" size="small">{{ chatAgent.preset.displayName }}</a-tag>
          <span style="color:#999;font-size:12px;margin-left:auto">{{ chatMessages.length / 2 }} 轮对话</span>
        </div>

        <!-- 消息列表 -->
        <div ref="chatListRef" class="chat-messages">
          <div v-if="!chatMessages.length" class="chat-empty">
            <div style="font-size:36px;margin-bottom:8px">💬</div>
            <div style="color:#999;font-size:12px">发送一条消息开始测试智能体</div>
            <div style="color:#bbb;font-size:12px;margin-top:4px">{{ chatAgent?.description }}</div>
          </div>
          <div v-for="(msg, i) in chatMessages" :key="i" class="chat-msg" :class="msg.role">
            <div class="chat-msg-avatar">
              <a-avatar v-if="msg.role === 'assistant'" :src="chatAgent?.avatarUrl" :size="28" style="background:#0858F4">{{ chatAgent?.name?.[0] }}</a-avatar>
              <a-avatar v-else :size="28" style="background:#1677ff">我</a-avatar>
            </div>
            <div class="chat-msg-bubble">
              <div class="chat-msg-content" v-html="renderMd(msg.content)"></div>
              <div v-if="msg.meta" class="chat-msg-meta">
                <span v-if="msg.meta.model">{{ msg.meta.model }}</span>
                <span v-if="msg.meta.tokens">{{ msg.meta.tokens }} tokens</span>
              </div>
            </div>
          </div>
          <div v-if="chatLoading" class="chat-msg assistant">
            <div class="chat-msg-avatar"><a-avatar :size="28" style="background:#0858F4">{{ chatAgent?.name?.[0] }}</a-avatar></div>
            <div class="chat-msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="chat-input-bar">
          <a-textarea ref="chatInputRef" v-model:value="chatInput" :rows="1" :auto-size="{ minRows:1, maxRows:4 }"
            placeholder="输入消息测试智能体... (Enter 发送, Shift+Enter 换行)"
            @keydown.enter.exact.prevent="sendChat" :disabled="chatLoading" />
          <a-button type="primary" :loading="chatLoading" @click="sendChat" :disabled="!chatInput.trim()">
            <SendOutlined />
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, MessageOutlined,
  SendOutlined, PauseCircleOutlined, PlayCircleOutlined, EllipsisOutlined,
} from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import request from '@/api/request'

const router = useRouter()
const agents = ref<any[]>([])
const presets = ref<any[]>([])
const loading = ref(false)
const showForm = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ name: '', description: '', systemPrompt: '', modelName: '', temperature: 0.7, presetId: null as number | null })
const selectedPreset = computed(() => form.value.presetId ? presets.value.find(p => p.id === form.value.presetId) : null)

// Chat state
const showChat = ref(false)
const chatAgent = ref<any>(null)
const chatInput = ref('')
const chatLoading = ref(false)
const chatSessionUuid = ref<string | null>(null)
const chatMessages = ref<Array<{ role: 'user' | 'assistant'; content: string; meta?: any }>>([])
const chatListRef = ref<HTMLElement | null>(null)
const chatInputRef = ref<any>(null)

// ─── Helpers ───
const PROVIDER_LABELS: Record<string, string> = { openai:'OpenAI', claude:'Claude', azure_openai:'Azure', qwen:'通义', zhipu:'智谱', deepseek:'DeepSeek', openai_compatible:'OAI兼容', custom_http:'自定义' }
const PROVIDER_COLORS: Record<string, string> = { openai:'green', claude:'orange', azure_openai:'blue', qwen:'cyan', zhipu:'purple', deepseek:'magenta', openai_compatible:'geekblue', custom_http:'default' }
function providerLabel(p: string) { return PROVIDER_LABELS[p] || p }
function providerColor(p: string) { return PROVIDER_COLORS[p] || 'default' }

function renderMd(text: string) {
  // Simple markdown: bold, code blocks, inline code, newlines
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function onPresetSelect(id: number | null) {
  if (id) {
    const preset = presets.value.find(p => p.id === id)
    if (preset && form.value.temperature === 0.7) form.value.temperature = preset.temperature
  }
}

// ─── Data ───
async function fetchData() {
  loading.value = true
  try {
    const [agentRes, presetRes] = await Promise.all([
      request.get('/company/agents'),
      request.get('/company/model-presets'),
    ])
    agents.value = agentRes || []
    presets.value = presetRes || []
  } finally { loading.value = false }
}

// ─── Form ───
function openCreate() {
  editingId.value = null
  form.value = { name: '', description: '', systemPrompt: '', modelName: '', temperature: 0.7, presetId: null }
  showForm.value = true
}
function handleMenuClick(key: string, agent: any) {
  if (key === 'edit') {
    editingId.value = agent.id
    form.value = { name: agent.name, description: agent.description, systemPrompt: agent.systemPrompt, modelName: agent.modelName || '', temperature: agent.temperature ?? 0.7, presetId: agent.presetId || null }
    showForm.value = true
  } else if (key === 'toggle') {
    toggleAgent(agent.id)
  } else if (key === 'test') {
    openChat(agent)
  } else if (key === 'delete') {
    Modal.confirm({ title: '确认删除', content: `确定删除智能体「${agent.name}」？此操作不可恢复。`, okText: '删除', okType: 'danger', cancelText: '取消', onOk: () => deleteAgent(agent.id) })
  }
}
async function handleSave() {
  if (!form.value.name.trim()) return message.warning('请填写名称')
  if (!form.value.description.trim()) return message.warning('请填写描述')
  if (!form.value.systemPrompt.trim()) return message.warning('请填写系统提示词')
  saving.value = true
  try {
    const body: Record<string, any> = { name: form.value.name.trim(), description: form.value.description.trim(), systemPrompt: form.value.systemPrompt.trim(), temperature: form.value.temperature }
    if (form.value.modelName.trim()) body.modelName = form.value.modelName.trim()
    if (editingId.value) { body.presetId = form.value.presetId ?? null; await request.put(`/company/agents/${editingId.value}`, body); message.success('更新成功') }
    else { if (form.value.presetId) body.presetId = form.value.presetId; await request.post('/company/agents', body); message.success('创建成功') }
    showForm.value = false; fetchData()
  } catch (e: any) { message.error(e?.response?.data?.message || e?.message || '操作失败') }
  finally { saving.value = false }
}
async function toggleAgent(id: number) { await request.patch(`/company/agents/${id}/toggle`); message.success('状态已更新'); fetchData() }
async function deleteAgent(id: number) { await request.delete(`/company/agents/${id}`); message.success('已删除'); fetchData() }

// ─── Chat Test ───
function openChat(agent: any) {
  chatAgent.value = agent
  chatInput.value = ''
  chatLoading.value = false
  chatSessionUuid.value = null
  chatMessages.value = []
  showChat.value = true
}
function onChatOpen(visible: boolean) {
  if (visible) nextTick(() => chatInputRef.value?.focus?.())
}
function scrollToBottom() {
  nextTick(() => {
    if (chatListRef.value) chatListRef.value.scrollTop = chatListRef.value.scrollHeight
  })
}
async function sendChat() {
  const text = chatInput.value.trim()
  if (!text || chatLoading.value) return
  chatMessages.value.push({ role: 'user', content: text })
  chatInput.value = ''
  chatLoading.value = true
  scrollToBottom()
  try {
    const body: Record<string, any> = { agentId: chatAgent.value.id, message: text }
    if (chatSessionUuid.value) body.sessionUuid = chatSessionUuid.value
    const res = await request.post('/ai/chat', body)
    chatSessionUuid.value = res.sessionUuid
    chatMessages.value.push({ role: 'assistant', content: res.response, meta: { model: res.model, tokens: res.tokensUsed } })
  } catch (e: any) {
    const errMsg = e?.response?.data?.message || e?.message || '未知错误'
    chatMessages.value.push({ role: 'assistant', content: `❌ ${errMsg}` })
  } finally {
    chatLoading.value = false
    scrollToBottom()
  }
}

onMounted(fetchData)
</script>

<style scoped>
.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
.agent-card { border-radius: 8px; }
.agent-header { display: flex; align-items: center; gap: 10px; }
.agent-title-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.agent-name { font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-tags { display: flex; gap: 4px; }
.model-info { display: flex; align-items: center; gap: 6px; background: #f5f7fa; border-radius: 4px; padding: 6px 8px; flex-wrap: wrap; }
.model-name { font-size: 12px; color: #333; font-weight: 500; }
.more-btn { color: #999; border-radius: 4px; }
.more-btn:hover { color: #333; background: #f5f5f5; }

/* ── Chat Dialog ── */
.chat-container { display: flex; flex-direction: column; height: 520px; margin: -24px -24px -12px; border-radius: 0 0 8px 8px; overflow: hidden; }
.chat-agent-bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #fafafa; border-bottom: 1px solid #f0f0f0; flex-shrink: 0; }
:deep(.ant-modal-header) { padding-right: 48px; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; background: #f8f9fb; }
.chat-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
.chat-msg { display: flex; gap: 10px; margin-bottom: 16px; }
.chat-msg.user { flex-direction: row-reverse; }
.chat-msg-avatar { flex-shrink: 0; }
.chat-msg-bubble { max-width: 80%; }
.chat-msg.user .chat-msg-bubble { background: #1677ff; color: #fff; border-radius: 12px 12px 2px 12px; padding: 10px 14px; }
.chat-msg.assistant .chat-msg-bubble { background: #fff; border: 1px solid #e8e8e8; border-radius: 12px 12px 12px 2px; padding: 10px 14px; }
.chat-msg-content { font-size: 12px; line-height: 1.6; word-break: break-word; }
.chat-msg-content :deep(pre.code-block) { background: #f6f6f6; border-radius: 6px; padding: 8px 10px; font-size: 12px; overflow-x: auto; margin: 6px 0; }
.chat-msg.user .chat-msg-content :deep(pre.code-block) { background: rgba(255,255,255,0.15); }
.chat-msg-content :deep(code.inline-code) { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
.chat-msg-meta { display: flex; gap: 8px; font-size: 11px; color: #bbb; margin-top: 4px; }
.chat-msg.user .chat-msg-meta { color: rgba(255,255,255,0.6); }

/* Typing indicator */
.typing-indicator { display: flex; gap: 4px; padding: 4px 0; }
.typing-indicator span { width: 6px; height: 6px; border-radius: 50%; background: #ccc; animation: typing 1.2s infinite ease-in-out; }
.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }

.chat-input-bar { display: flex; gap: 8px; padding: 12px 16px; background: #fff; border-top: 1px solid #f0f0f0; flex-shrink: 0; align-items: flex-end; }
.chat-input-bar :deep(.ant-input) { border-radius: 8px; resize: none; }
.chat-input-bar .ant-btn { border-radius: 8px; height: 36px; width: 36px; display: flex; align-items: center; justify-content: center; }
</style>
