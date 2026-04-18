<template>
  <div class="task-create-page">
    <a-page-header :title="isEditMode ? '编辑任务' : '发布任务'" @back="$router.back()">
      <template #extra>
        <a-tag v-if="draftId" color="blue">草稿 #{{ draftId }}</a-tag>
        <span v-if="lastSavedAt" class="auto-save-hint">
          <check-circle-outlined style="color:var(--color-success)" /> {{ lastSavedAt }}
        </span>
        <a-button v-if="hasLlm" type="default" @click="aiDrawerOpen = true" style="margin-left:8px">
          🤖 AI 任务顾问
        </a-button>
      </template>
    </a-page-header>

    <a-steps :current="currentStep" style="margin-bottom: 32px; max-width: 800px">
      <a-step title="基本信息" />
      <a-step title="角色配置" />
      <a-step title="预算设定" />
      <a-step title="时间地点" />
      <a-step title="确认发布" />
    </a-steps>

    <!-- 步骤1：基本信息 -->
    <div v-show="currentStep === 0">
      <a-form :model="form" layout="vertical" style="max-width: 600px">
        <a-form-item label="任务标题" required>
          <a-input v-model:value="form.title" placeholder="例如：双11电商产品拍摄" :maxlength="100" show-count />
        </a-form-item>
        <a-form-item label="任务描述">
          <a-textarea v-model:value="form.description" :rows="4" placeholder="详细描述任务需求、交付标准、注意事项等..." show-count :maxlength="2000" />
        </a-form-item>
        <a-form-item label="任务模式" required>
          <a-radio-group v-model:value="form.taskMode" button-style="solid">
            <a-radio-button value="task_package">
              <span>📦 任务包模式</span>
              <div style="font-size:11px;color:#999;margin-top:2px">按交付物验收结算</div>
            </a-radio-button>
            <a-radio-button value="daily_rate">
              <span>📅 人天模式</span>
              <div style="font-size:11px;color:#999;margin-top:2px">按工时计费结算</div>
            </a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="关联项目">
          <a-select
            v-model:value="form.projectId"
            placeholder="可选：关联到已有项目"
            allow-clear
            show-search
            :filter-option="filterProjectOption"
            :options="projectOptions"
            @focus="loadProjects"
            style="width:100%"
          />
        </a-form-item>
        <a-form-item label="需求附件">
          <div
            class="attachment-upload-area"
            @drop.prevent="onFileDrop"
            @dragover.prevent
            @dragenter.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            :class="{ 'drag-over': isDragOver }"
          >
            <div v-if="attachments.length === 0" class="upload-hint">
              <inbox-outlined style="font-size:32px;color:#bbb" />
              <p style="margin:8px 0 4px">将文件拖到此处，或 <a @click.stop="triggerFileInput">点击上传</a></p>
              <p style="color:#999;font-size:12px;margin:0">支持 PDF / Word / Excel / PPT / ZIP / 图片 / PSD，单文件 ≤50MB，最多10个</p>
            </div>
            <div v-else class="attachment-list">
              <div v-for="(f, i) in attachments" :key="i" class="attachment-item">
                <span class="file-icon">{{ fileIcon(f.fileType) }}</span>
                <span class="file-name" :title="f.fileName">{{ f.fileName }}</span>
                <span class="file-size">{{ formatSize(f.fileSize) }}</span>
                <a-tag v-if="f.uploading" color="processing" size="small">处理中</a-tag>
                <a-tag v-else-if="f.error" color="error" size="small">失败</a-tag>
                <a-tag v-else color="success" size="small">已就绪</a-tag>
                <a-button type="link" danger size="small" @click="removeAttachment(i)">×</a-button>
              </div>
              <a v-if="attachments.length < 10" @click.stop="triggerFileInput" style="font-size:13px;margin-top:6px;display:inline-block">+ 继续添加</a>
            </div>
            <input
              ref="fileInputRef"
              type="file"
              multiple
              style="display:none"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.jpg,.jpeg,.png,.psd,.ai,.sketch"
              @change="onFileSelect"
            />
          </div>
        </a-form-item>
      </a-form>
    </div>

    <!-- 步骤2：角色配置 -->
    <div v-show="currentStep === 1">
      <div style="max-width: 800px">
        <a-alert v-if="form.roles.length === 0" message="请至少添加一个角色岗位" description="点击下方按钮添加角色，也可从平台推荐角色中快速选择。" type="info" show-icon style="margin-bottom: 16px" />
        <div v-if="form.roles.length === 0 && platformRoles.length > 0" class="quick-roles">
          <span class="quick-label">快速添加：</span>
          <a-button v-for="r in platformRoles.slice(0, 8)" :key="r.roleName" size="small" @click="quickAddRole(r)">+ {{ r.roleName }}</a-button>
        </div>
        <div v-for="(role, idx) in form.roles" :key="idx" class="role-item">
          <div class="role-header">
            <span class="role-index">角色 {{ idx + 1 }}</span>
            <a-popconfirm title="确定删除该角色？" @confirm="removeRole(idx)">
              <a-button type="link" danger size="small"><delete-outlined /> 删除</a-button>
            </a-popconfirm>
          </div>
          <a-row :gutter="16">
            <a-col :span="8">
              <a-form-item label="角色名称" required>
                <a-select v-model:value="role.roleName" placeholder="选择或搜索角色" show-search :filter-option="filterOption" @change="(val: string) => onRoleSelect(idx, val)">
                  <a-select-option v-for="r in platformRoles" :key="r.roleName" :value="r.roleName">
                    {{ r.roleName }}<span v-if="r.suggestedDaily" style="color:#999;float:right">¥{{ r.suggestedDaily }}/天</span>
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="需求人数" required>
                <a-input-number v-model:value="role.headcount" :min="1" :max="50" style="width:100%" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="单人预算(元)" required>
                <a-input-number v-model:value="role.budget" :min="100" :step="500" :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')" style="width:100%" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="16">
              <a-form-item label="技能要求">
                <a-select v-model:value="role.skillTagsArr" mode="multiple" placeholder="选择技能标签" :options="skillTagOptions" allow-clear :max-tag-count="4" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="角色要求说明">
                <a-input v-model:value="role.description" placeholder="简述该角色的具体工作内容" :maxlength="200" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
        <a-button type="dashed" block @click="addRole" class="add-role-btn"><plus-outlined /> 添加角色岗位</a-button>
      </div>
    </div>

    <!-- 步骤3：预算设定 -->
    <div v-show="currentStep === 2">
      <a-form layout="vertical" style="max-width: 500px">
        <a-form-item label="任务总预算(元)" required>
          <a-input-number v-model:value="form.totalBudget" :min="1" :step="1000" style="width:100%" :formatter="(v: any) => `¥ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')" />
          <div v-if="suggestedBudget > 0" class="budget-suggest">💡 按角色配置建议：<a-button type="link" size="small" @click="form.totalBudget = suggestedBudget">¥{{ suggestedBudget.toLocaleString() }}</a-button></div>
        </a-form-item>
        <div class="budget-summary">
          <div class="budget-row"><span>角色预算合计</span><span :class="{ 'over-budget': rolesBudgetSum > form.totalBudget }">¥{{ rolesBudgetSum.toLocaleString() }}</span></div>
          <div class="budget-row"><span>平台服务费 (8%)</span><span>¥{{ Math.round(form.totalBudget * 0.08).toLocaleString() }}</span></div>
          <div class="budget-row total"><span>发布需锁定金额</span><span>¥{{ Math.round(form.totalBudget * 1.08).toLocaleString() }}</span></div>
        </div>
        <a-alert v-if="rolesBudgetSum > form.totalBudget" message="角色预算合计超过总预算" type="error" show-icon style="margin-top:12px" />
        <a-alert v-else-if="form.totalBudget > 0 && rolesBudgetSum <= form.totalBudget" :message="`预算匹配 ✓ 剩余 ¥${(form.totalBudget - rolesBudgetSum).toLocaleString()}`" type="success" show-icon style="margin-top:12px" />
      </a-form>
    </div>

    <!-- 步骤4：时间地点 -->
    <div v-show="currentStep === 3">
      <a-form layout="vertical" style="max-width: 600px">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="开始日期"><a-date-picker v-model:value="startDate" style="width: 100%" placeholder="请选择开始日期" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="结束日期"><a-date-picker v-model:value="endDate" style="width: 100%" placeholder="请选择结束日期" :disabled-date="disabledEndDate" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="工作地点"><a-cascader v-model:value="addressCascade" :options="regionOptions" placeholder="选择省份 / 城市" style="width: 100%" change-on-select /></a-form-item>
        <a-form-item label="详细地址"><a-input v-model:value="form.addressDetail" placeholder="例如：西湖区文三路XX号XX楼（选填）" :maxlength="200" /></a-form-item>
      </a-form>
    </div>

    <!-- 步骤5：确认发布 -->
    <div v-show="currentStep === 4">
      <a-descriptions bordered :column="2" style="max-width: 700px">
        <a-descriptions-item label="任务标题" :span="2">{{ form.title }}</a-descriptions-item>
        <a-descriptions-item label="任务模式">{{ form.taskMode === 'task_package' ? '📦 任务包' : '📅 人天制' }}</a-descriptions-item>
        <a-descriptions-item label="总预算">¥{{ form.totalBudget.toLocaleString() }}</a-descriptions-item>
        <a-descriptions-item v-if="form.projectId" label="关联项目" :span="2">
          {{ projectOptions.find(p => p.value === form.projectId)?.label || String(form.projectId) }}
        </a-descriptions-item>
        <a-descriptions-item label="角色岗位" :span="2">
          <div v-for="(r, i) in form.roles" :key="i" style="margin-bottom:4px">
            <a-tag color="blue">{{ r.roleName }}</a-tag> × {{ r.headcount }}人 · ¥{{ r.budget.toLocaleString() }}/人
            <span v-if="r.description" style="color:#999;margin-left:8px">{{ r.description }}</span>
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="工作地点">{{ fullAddress || '远程/未指定' }}</a-descriptions-item>
        <a-descriptions-item label="时间">{{ dateRange || '未指定' }}</a-descriptions-item>
        <a-descriptions-item v-if="attachments.length > 0" label="附件" :span="2">
          <a-space wrap>
            <span v-for="(a, i) in attachments" :key="i">{{ fileIcon(a.fileType) }} {{ a.fileName }}</span>
          </a-space>
        </a-descriptions-item>
        <a-descriptions-item label="锁定金额" :span="2">
          <span style="color:var(--color-warning);font-weight:700">¥{{ Math.round(form.totalBudget * 1.08).toLocaleString() }}</span>
          <span style="color:#999;margin-left:8px">（含8%平台服务费）</span>
        </a-descriptions-item>
      </a-descriptions>
      <a-alert message="发布后将自动锁定账户资金，请确认余额充足" type="warning" show-icon style="margin-top:16px;max-width:700px" />
    </div>

    <!-- 底部操作栏 -->
    <div class="step-actions">
      <a-button v-if="currentStep > 0" @click="currentStep--"><left-outlined /> 上一步</a-button>
      <a-button v-if="currentStep < 4" type="primary" @click="nextStep">下一步 <right-outlined /></a-button>
      <a-button v-if="currentStep === 4" @click="handleSaveDraft" :loading="saving">保存草稿</a-button>
      <a-button v-if="currentStep === 4" type="primary" :loading="publishing" @click="handlePublish">确认发布</a-button>
    </div>

    <!-- AI 任务顾问 Drawer -->
    <a-drawer
      v-model:open="aiDrawerOpen"
      title="🤖 AI 任务顾问"
      placement="right"
      :width="560"
      :body-style="{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }"
    >
      <div style="padding:12px 16px;border-bottom:1px solid #f0f0f0;display:flex;gap:8px;align-items:center;flex-shrink:0">
        <span style="color:#666;font-size:13px;white-space:nowrap">智能体：</span>
        <a-select v-model:value="selectedAgentId" style="width:200px" size="small" :options="agentOptions" @change="onAgentChange" />
        <span style="color:#999;font-size:12px;margin-left:auto">{{ aiRoundCount }}/30轮</span>
      </div>

      <div ref="msgListRef" class="ai-msg-list">
        <div v-if="aiMessages.length === 0" class="ai-welcome">
          <div style="font-size:48px;margin-bottom:12px">🤖</div>
          <div style="font-size:15px;font-weight:600">你好！我是 AI 任务顾问</div>
          <div style="color:#999;font-size:13px;margin-top:8px;line-height:1.6">
            告诉我你想做什么任务，我来帮你规划角色、预算和工期<br/>
            对话结束后可一键将建议填充到表单
          </div>
        </div>
        <div v-for="(msg, i) in aiMessages" :key="i" :class="['ai-msg', msg.role]">
          <div class="ai-msg-bubble">
            <pre style="white-space:pre-wrap;margin:0;font-family:inherit;font-size:14px;line-height:1.6">{{ msg.content }}</pre>
          </div>
        </div>
        <div v-if="aiLoading" class="ai-msg assistant">
          <div class="ai-msg-bubble"><a-spin size="small" style="margin-right:8px" /> AI 正在思考...</div>
        </div>
      </div>

      <div v-if="aiSuggestion" style="padding:10px 16px;border-top:1px solid #f0f0f0;background:#f6ffed;flex-shrink:0">
        <a-alert type="success" message="AI 已生成任务建议，点击填充到表单" style="margin-bottom:8px" />
        <a-button type="primary" block @click="fillFromAI">⚡ 一键填充到表单</a-button>
      </div>

      <div style="padding:12px 16px;border-top:1px solid #f0f0f0;flex-shrink:0">
        <a-row :gutter="8">
          <a-col :flex="1">
            <a-textarea
              v-model:value="aiInput" :rows="3"
              placeholder="描述你的任务需求，例如：我要拍一支30秒的产品短视频，风格偏商业..."
              :disabled="aiLoading || aiRoundCount >= 30"
              @keydown.ctrl.enter="sendAiMessage" :maxlength="2000"
            />
          </a-col>
          <a-col>
            <a-button type="primary" :loading="aiLoading" :disabled="aiRoundCount >= 30"
              @click="sendAiMessage" style="height:100%;min-height:72px">发送</a-button>
          </a-col>
        </a-row>
        <div style="color:#999;font-size:11px;margin-top:4px">Ctrl+Enter 快速发送</div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, InboxOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { taskApi } from '@/api/task'
import request from '@/api/request'

const router = useRouter()
const route = useRoute()
const currentStep = ref(0)
const publishing = ref(false)
const saving = ref(false)
const platformRoles = ref<any[]>([])
const skillTags = ref<any[]>([])
const startDate = ref<any>(null)
const endDate = ref<any>(null)
const addressCascade = ref<string[]>([])
const draftId = ref<number | null>(null)
const lastSavedAt = ref('')
const isEditMode = computed(() => !!draftId.value)

interface RoleItem { roleName: string; headcount: number; budget: number; skillTagsArr: string[]; description: string }

const form = reactive({
  title: '', description: '', taskMode: 'task_package' as 'task_package' | 'daily_rate',
  totalBudget: 0, addressDetail: '', roles: [] as RoleItem[],
  projectId: null as number | null,
})

// ─── 附件 ───
const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const attachments = ref<Array<{ fileName: string; fileUrl: string; fileSize: number; fileType: string; uploading?: boolean; error?: boolean }>>([])

function triggerFileInput() { fileInputRef.value?.click() }
function fileIcon(type: string) {
  const m: Record<string, string> = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', ppt:'📑', pptx:'📑', zip:'🗜', rar:'🗜', jpg:'🖼', jpeg:'🖼', png:'🖼', psd:'🎨', ai:'🎨', sketch:'🎨' }
  return m[type?.toLowerCase()] || '📁'
}
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
async function processFiles(files: FileList | File[]) {
  const arr = Array.from(files)
  if (attachments.value.length + arr.length > 10) { message.warning('附件最多10个'); return }
  for (const file of arr) {
    if (file.size > 50 * 1024 * 1024) { message.warning(`${file.name} 超过50MB限制`); continue }
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const entry = { fileName: file.name, fileUrl: '', fileSize: file.size, fileType: ext, uploading: true, error: false }
    attachments.value.push(entry)
    const idx = attachments.value.length - 1
    try {
      attachments.value[idx].fileUrl = URL.createObjectURL(file)
      attachments.value[idx].uploading = false
    } catch {
      attachments.value[idx].uploading = false
      attachments.value[idx].error = true
    }
  }
}
function onFileSelect(e: Event) { const i = e.target as HTMLInputElement; if (i.files) processFiles(i.files); i.value = '' }
function onFileDrop(e: DragEvent) { isDragOver.value = false; if (e.dataTransfer?.files) processFiles(e.dataTransfer.files) }
function removeAttachment(idx: number) { attachments.value.splice(idx, 1) }

// ─── 关联项目 ───
const projectOptions = ref<{ value: number; label: string }[]>([])
let projectsLoaded = false
async function loadProjects() {
  if (projectsLoaded) return
  try {
    const res = await request.get('/projects', { params: { pageSize: 100 } })
    projectOptions.value = (res.data?.list || []).map((p: any) => ({ value: p.id, label: `${p.projectNo} · ${p.name}` }))
    projectsLoaded = true
  } catch {}
}
function filterProjectOption(input: string, option: any) {
  return (option.label as string).toLowerCase().includes(input.toLowerCase())
}

// ─── AI 顾问 ───
const aiDrawerOpen = ref(false)
const hasLlm = ref(false)
const agentOptions = ref<{ value: number; label: string }[]>([])
const selectedAgentId = ref<number | null>(null)
const aiMessages = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
const aiInput = ref('')
const aiLoading = ref(false)
const aiSuggestion = ref<any>(null)
const aiSessionUuid = ref<string | null>(null)
const aiRoundCount = ref(0)
const msgListRef = ref<HTMLElement | null>(null)

async function checkLlmConfig() {
  try {
    await request.get('/company/llm-config')
    hasLlm.value = true
    const agRes = await request.get('/company/agents')
    const agents = (agRes.data || []).filter((a: any) => a.isActive)
    agentOptions.value = agents.map((a: any) => ({ value: a.id, label: a.name }))
    if (agents.length > 0) selectedAgentId.value = agents[0].id
  } catch { hasLlm.value = false }
}
function onAgentChange() { aiSessionUuid.value = null; aiMessages.value = []; aiRoundCount.value = 0; aiSuggestion.value = null }

async function sendAiMessage() {
  const msg = aiInput.value.trim()
  if (!msg || aiLoading.value) return
  if (aiRoundCount.value >= 30) { message.warning('对话已达30轮上限，请整理后开始新会话'); return }
  if (!selectedAgentId.value) { message.warning('请先选择一个智能体'); return }
  aiMessages.value.push({ role: 'user', content: msg })
  aiInput.value = ''
  aiLoading.value = true
  aiRoundCount.value++
  await nextTick()
  msgListRef.value?.scrollTo({ top: msgListRef.value.scrollHeight, behavior: 'smooth' })
  try {
    const res = await request.post('/ai/chat', {
      agentId: selectedAgentId.value, message: msg,
      ...(aiSessionUuid.value && { sessionUuid: aiSessionUuid.value }),
      ...(draftId.value && { taskDraftId: draftId.value }),
    })
    const data = (res as any).data || res
    aiSessionUuid.value = data.sessionUuid
    aiMessages.value.push({ role: 'assistant', content: data.response })
    if (data.isComplete) { try { aiSuggestion.value = JSON.parse(data.response) } catch {} }
    if (!aiSuggestion.value) {
      const m = data.response.match(/```json\n?([\s\S]+?)\n?```/)
      if (m) { try { const p = JSON.parse(m[1]); if (p?.title) aiSuggestion.value = p } catch {} }
    }
  } catch (e: any) {
    const s = e?.response?.status
    const errMsg = s === 429 ? '调用过于频繁，请等待后重试' : s === 403 ? '本月AI调用额度已用完，请联系管理员' : s === 504 ? 'AI响应超时，请重新发送' : 'AI 暂时无法回复，请稍后再试'
    aiMessages.value.push({ role: 'assistant', content: `⚠️ ${errMsg}` })
  } finally {
    aiLoading.value = false
    await nextTick()
    msgListRef.value?.scrollTo({ top: msgListRef.value.scrollHeight, behavior: 'smooth' })
  }
}

function fillFromAI() {
  if (!aiSuggestion.value) return
  const s = aiSuggestion.value
  const hasExisting = !!(form.title || form.description)
  const doFill = () => {
    if (s.title) form.title = s.title
    if (s.description) form.description = s.description
    if (s.taskMode && ['task_package', 'daily_rate'].includes(s.taskMode)) form.taskMode = s.taskMode
    if (s.startDate) startDate.value = dayjs(s.startDate)
    if (s.endDate) endDate.value = dayjs(s.endDate)
    if (Array.isArray(s.suggestedRoles) && s.suggestedRoles.length > 0) {
      form.roles = s.suggestedRoles.map((r: any) => ({
        roleName: r.roleName || '', headcount: r.headcount || 1, budget: r.budget || 0,
        skillTagsArr: r.skillTags ? r.skillTags.split(',').map((x: string) => x.trim()) : [],
        description: '',
      }))
    }
    aiDrawerOpen.value = false
    message.success('AI建议已填充到表单')
  }
  if (hasExisting) {
    Modal.confirm({ title: '覆盖已有内容？', content: '当前表单已有内容，确认用AI建议覆盖？', onOk: doFill })
  } else { doFill() }
}

// ─── 表单计算 ───
const rolesBudgetSum = computed(() => form.roles.reduce((s, r) => s + (r.budget || 0) * (r.headcount || 1), 0))
const suggestedBudget = computed(() => rolesBudgetSum.value)
const skillTagOptions = computed(() => skillTags.value.map(t => ({ label: `${t.name}${t.hot ? ' 🔥' : ''}`, value: t.name })))
const fullAddress = computed(() => [...(addressCascade.value || []), form.addressDetail].filter(Boolean).join(' '))
const dateRange = computed(() => {
  if (!startDate.value && !endDate.value) return ''
  return `${startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : '?'} 至 ${endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : '?'}`
})

function filterOption(input: string, option: any) { return option.value?.toLowerCase().includes(input.toLowerCase()) }
function disabledEndDate(current: any) { return startDate.value ? current && current < dayjs(startDate.value).startOf('day') : false }
function addRole() { form.roles.push({ roleName: '', headcount: 1, budget: 0, skillTagsArr: [], description: '' }) }
function quickAddRole(r: any) {
  form.roles.push({ roleName: r.roleName, headcount: 1, budget: r.suggestedDaily || 800,
    skillTagsArr: r.skillTags ? r.skillTags.split(',').map((s: string) => s.trim()) : [], description: r.description || '' })
}
function onRoleSelect(idx: number, roleName: string) {
  const pr = platformRoles.value.find(r => r.roleName === roleName)
  if (pr) {
    const role = form.roles[idx]
    if (role.budget === 0 && pr.suggestedDaily) role.budget = pr.suggestedDaily
    if (role.skillTagsArr.length === 0 && pr.skillTags) role.skillTagsArr = pr.skillTags.split(',').map((s: string) => s.trim())
  }
}
function removeRole(idx: number) { form.roles.splice(idx, 1) }

function nextStep() {
  if (currentStep.value === 0 && !form.title.trim()) { message.warning('请填写任务标题'); return }
  if (currentStep.value === 1) {
    if (form.roles.length === 0) { message.warning('请至少添加一个角色'); return }
    for (const r of form.roles) {
      if (!r.roleName) { message.warning('请为所有角色选择名称'); return }
      if (r.budget <= 0) { message.warning(`角色「${r.roleName}」预算需大亇0`); return }
    }
  }
  if (currentStep.value === 2) {
    if (form.totalBudget <= 0) { message.warning('总预算需大亇0'); return }
    if (rolesBudgetSum.value > form.totalBudget) { message.warning('角色预算合计超过总预算'); return }
  }
  if (currentStep.value === 3 && startDate.value && endDate.value && dayjs(endDate.value).isBefore(dayjs(startDate.value))) {
    message.warning('结束日期不能早于开始日期'); return
  }
  currentStep.value++
}

function buildPayload() {
  return {
    title: form.title, description: form.description || undefined, taskMode: form.taskMode,
    totalBudget: form.totalBudget,
    startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
    endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined,
    address: fullAddress.value || undefined,
    ...(form.projectId && { projectId: form.projectId }),
    roles: form.roles.map(r => ({
      roleName: r.roleName, headcount: r.headcount, budget: r.budget,
      skillTags: r.skillTagsArr.length > 0 ? r.skillTagsArr.join(',') : undefined,
      description: r.description || undefined,
    })),
  }
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleAutoSave() { if (autoSaveTimer) clearTimeout(autoSaveTimer); autoSaveTimer = setTimeout(doAutoSave, 30000) }
async function doAutoSave() {
  if (!form.title.trim()) return
  try {
    if (!draftId.value) { const res = await taskApi.create(buildPayload()); draftId.value = res.taskId }
    else {
      await taskApi.updateDraft(draftId.value, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget,
        startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
        endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0 && form.roles.every(r => r.roleName)) await taskApi.setRoles(draftId.value, buildPayload().roles)
    }
    lastSavedAt.value = `已自动保存 ${dayjs().format('HH:mm:ss')}`
  } catch { /* 静默 */ }
}
watch(() => [form.title, form.description, form.taskMode, form.totalBudget, form.roles.length], scheduleAutoSave, { deep: true })

async function handleSaveDraft() {
  saving.value = true
  try {
    if (!draftId.value) { const res = await taskApi.create(buildPayload()); draftId.value = res.taskId }
    else {
      await taskApi.updateDraft(draftId.value, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget,
        startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
        endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0) await taskApi.setRoles(draftId.value, buildPayload().roles)
    }
    message.success('草稿已保存'); router.push('/task/square')
  } catch (err: any) { message.error(err?.response?.data?.message || err?.message || '保存失败') }
  finally { saving.value = false }
}

async function handlePublish() {
  publishing.value = true
  try {
    let taskId = draftId.value
    if (!taskId) { const res = await taskApi.create(buildPayload()); taskId = res.taskId }
    else {
      await taskApi.updateDraft(taskId, { title: form.title, description: form.description || undefined, totalBudget: form.totalBudget,
        startDate: startDate.value ? dayjs(startDate.value).format('YYYY-MM-DD') : undefined,
        endDate: endDate.value ? dayjs(endDate.value).format('YYYY-MM-DD') : undefined, address: fullAddress.value || undefined })
      if (form.roles.length > 0) await taskApi.setRoles(taskId, buildPayload().roles)
    }
    // 附件绑定到任务
    for (const att of attachments.value.filter(a => !a.error && a.fileUrl)) {
      try { await taskApi.addAttachment(taskId, { fileName: att.fileName, fileUrl: att.fileUrl, fileSize: att.fileSize, fileType: att.fileType }) } catch {}
    }
    await taskApi.publish(taskId); message.success('🎉 任务发布成功！'); router.push('/task/square')
  } catch (err: any) { message.error(err?.response?.data?.message || err?.message || '发布失败') }
  finally { publishing.value = false }
}

async function loadDraft(id: number) {
  try {
    const task = await taskApi.detail(id)
    form.title = task.title || ''; form.description = task.description || ''; form.taskMode = task.taskMode || 'task_package'; form.totalBudget = task.totalBudget || 0
    if (task.startDate) startDate.value = dayjs(task.startDate)
    if (task.endDate) endDate.value = dayjs(task.endDate)
    if (task.address) form.addressDetail = task.address
    if (task.projectId) form.projectId = task.projectId
    if (task.roles?.length > 0) {
      form.roles = task.roles.map((r: any) => ({
        roleName: r.roleName, headcount: r.headcount, budget: r.budget,
        skillTagsArr: r.skillTags ? r.skillTags.split(',').map((s: string) => s.trim()) : [], description: r.description || '' }))
    }
    draftId.value = id
  } catch { message.error('加载草稿失败'); router.push('/task/square') }
}

const regionOptions = [
  { value: '北京', label: '北京', children: [{ value: '北京市', label: '北京市' }] },
  { value: '上海', label: '上海', children: [{ value: '上海市', label: '上海市' }] },
  { value: '广东', label: '广东', children: [{ value: '广州市', label: '广州市' }, { value: '深圳市', label: '深圳市' }, { value: '东莞市', label: '东莞市' }, { value: '佛山市', label: '佛山市' }] },
  { value: '浙江', label: '浙江', children: [{ value: '杭州市', label: '杭州市' }, { value: '宁波市', label: '宁波市' }, { value: '温州市', label: '温州市' }, { value: '嘉兴市', label: '嘉兴市' }] },
  { value: '江苏', label: '江苏', children: [{ value: '南京市', label: '南京市' }, { value: '苏州市', label: '苏州市' }, { value: '无锡市', label: '无锡市' }] },
  { value: '四川', label: '四川', children: [{ value: '成都市', label: '成都市' }] },
  { value: '湖北', label: '湖北', children: [{ value: '武汉市', label: '武汉市' }] },
  { value: '湖南', label: '湖南', children: [{ value: '长沙市', label: '长沙市' }] },
  { value: '福建', label: '福建', children: [{ value: '福州市', label: '福州市' }, { value: '厦门市', label: '厦门市' }] },
  { value: '天津', label: '天津', children: [{ value: '天津市', label: '天津市' }] },
  { value: '重庆', label: '重庆', children: [{ value: '重庆市', label: '重庆市' }] },
  { value: '河南', label: '河南', children: [{ value: '郑州市', label: '郑州市' }, { value: '洛阳市', label: '洛阳市' }] },
  { value: '陕西', label: '陕西', children: [{ value: '西安市', label: '西安市' }] },
  { value: '辽宁', label: '辽宁', children: [{ value: '沈阳市', label: '沈阳市' }, { value: '大连市', label: '大连市' }] },
  { value: '山东', label: '山东', children: [{ value: '济南市', label: '济南市' }, { value: '青岛市', label: '青岛市' }] },
  { value: '远程', label: '🌐 远程/不限地区', children: [{ value: '远程办公', label: '远程办公' }] },
]

onMounted(async () => {
  try { platformRoles.value = await taskApi.getPlatformRoles() } catch {}
  try { skillTags.value = await taskApi.getSkillTags() } catch {}
  await checkLlmConfig()
  const editId = route.query.id ? Number(route.query.id) : null
  if (editId) await loadDraft(editId)
  // 接收从项目详情页跳转过来的项目预填
  const routeProjectId = route.query.projectId ? Number(route.query.projectId) : null
  if (routeProjectId) {
    form.projectId = routeProjectId
    await loadProjects()
  }
})
onUnmounted(() => { if (autoSaveTimer) clearTimeout(autoSaveTimer) })
</script>

<style scoped>
.task-create-page { padding-bottom: 80px; }
.auto-save-hint { font-size: 13px; color: var(--color-text-secondary); }
.quick-roles { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 16px; padding: 12px; background: var(--color-bg-hover); border-radius: var(--radius-lg); }
.quick-label { font-size: 13px; color: var(--color-text-secondary); }
.role-item { background: var(--color-bg-hover); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); padding: 16px; margin-bottom: 12px; }
.role-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.role-index { font-weight: 600; color: var(--color-primary); }
.add-role-btn { height: 48px; border-style: dashed; margin-top: 8px; }
.budget-suggest { font-size: 13px; color: var(--color-text-secondary); margin-top: 4px; }
.budget-summary { background: var(--color-bg-hover); border-radius: var(--radius-lg); padding: 16px; margin-top: 16px; }
.budget-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
.budget-row.total { border-top: 1px solid #e0e0e0; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 16px; }
.over-budget { color: var(--color-error); font-weight: 700; }
.step-actions { position: fixed; bottom: 0; left: 220px; right: 0; background: var(--color-bg-card); border-top: 1px solid var(--color-border-light); padding: 12px 24px; display: flex; gap: 12px; justify-content: flex-end; z-index: 10; }
/* 附件上传 */
.attachment-upload-area { border: 2px dashed #d9d9d9; border-radius: 8px; padding: 20px; text-align: center; transition: all .2s; background: #fafafa; cursor: pointer; }
.attachment-upload-area.drag-over { border-color: var(--color-primary); background: #f0f4ff; }
.attachment-list { text-align: left; }
.upload-hint { padding: 8px 0; }
.attachment-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
.file-icon { font-size: 18px; flex-shrink: 0; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.file-size { color: #999; font-size: 12px; flex-shrink: 0; }
/* AI 导师 */
.ai-msg-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
.ai-welcome { text-align: center; padding: 48px 24px; color: #666; }
.ai-msg { display: flex; }
.ai-msg.user { justify-content: flex-end; }
.ai-msg.assistant { justify-content: flex-start; }
.ai-msg-bubble { max-width: 82%; padding: 10px 14px; border-radius: 12px; }
.ai-msg.user .ai-msg-bubble { background: var(--color-primary); color: #fff; border-radius: 12px 12px 2px 12px; }
.ai-msg.assistant .ai-msg-bubble { background: #f5f5f5; color: #333; border-radius: 12px 12px 12px 2px; }
</style>