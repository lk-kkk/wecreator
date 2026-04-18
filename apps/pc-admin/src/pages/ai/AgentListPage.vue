<template>
  <div class="page-container">
    <a-page-header title="AI 智能体管理" :ghost="false" style="margin-bottom:16px">
      <template #extra>
        <a-button type="primary" @click="openCreate">
          <PlusOutlined /> 创建智能体
        </a-button>
      </template>
    </a-page-header>

    <div class="agent-grid">
      <a-card v-for="a in agents" :key="a.id" hoverable size="small" class="agent-card">
        <template #title>
          <div class="agent-header">
            <a-avatar :src="a.avatarUrl" :size="32">{{ a.name[0] }}</a-avatar>
            <span>{{ a.name }}</span>
            <a-tag v-if="a.isPreset" color="blue" size="small">预设</a-tag>
            <a-tag :color="a.isActive ? 'success' : 'default'" size="small">
              {{ a.isActive ? '启用' : '停用' }}
            </a-tag>
          </div>
        </template>
        <template #extra>
          <a-dropdown>
            <a-button type="text" size="small">⋮</a-button>
            <template #overlay>
              <a-menu @click="({ key }:{key:string}) => onAgentAction(key, a)">
                <a-menu-item key="edit">编辑</a-menu-item>
                <a-menu-item key="toggle">{{ a.isActive ? '停用' : '启用' }}</a-menu-item>
                <a-menu-item key="delete" v-if="!a.isPreset" danger>删除</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
        <p style="color:#666;font-size:13px;margin:0">{{ a.description }}</p>
        <div style="margin-top:8px;font-size:12px;color:#999">
          <span v-if="a.modelName">模型: {{ a.modelName }} · </span>
          本月调用: {{ a.monthlyCallCount }}
        </div>
      </a-card>
    </div>

    <!-- 创建/编辑弹窗 -->
    <a-modal v-model:open="showForm" :title="editingId ? '编辑智能体' : '创建智能体'"
      @ok="handleSave" :confirm-loading="saving" width="600px">
      <a-form :label-col="{ span: 4 }">
        <a-form-item label="名称" required>
          <a-input v-model:value="form.name" placeholder="智能体名称(≤40字)" :maxlength="40" />
        </a-form-item>
        <a-form-item label="描述" required>
          <a-input v-model:value="form.description" placeholder="一句话介绍(≤200字)" :maxlength="200" />
        </a-form-item>
        <a-form-item label="系统提示" required>
          <a-textarea v-model:value="form.systemPrompt" :rows="6"
            placeholder="定义智能体的角色、行为规则和输出格式..." />
        </a-form-item>
        <a-form-item label="指定模型">
          <a-input v-model:value="form.modelName" placeholder="留空使用全局默认模型" />
        </a-form-item>
        <a-form-item label="温度">
          <a-slider v-model:value="form.temperature" :min="0" :max="2" :step="0.1" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { request } from '@/api/request'

const agents = ref<any[]>([])
const showForm = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const form = ref({ name: '', description: '', systemPrompt: '', modelName: '', temperature: 0.7 })

async function fetchAgents() {
  const res = await request.get('/company/agents')
  agents.value = res.data || []
}

function openCreate() {
  editingId.value = null
  form.value = { name: '', description: '', systemPrompt: '', modelName: '', temperature: 0.7 }
  showForm.value = true
}

function onAgentAction(key: string, agent: any) {
  if (key === 'edit') {
    editingId.value = agent.id
    form.value = {
      name: agent.name, description: agent.description, systemPrompt: agent.systemPrompt,
      modelName: agent.modelName || '', temperature: agent.temperature ?? 0.7,
    }
    showForm.value = true
  } else if (key === 'toggle') {
    toggleAgent(agent.id)
  } else if (key === 'delete') {
    Modal.confirm({
      title: '确认删除', content: `确定删除智能体「${agent.name}」？`,
      onOk: () => deleteAgent(agent.id),
    })
  }
}

async function handleSave() {
  if (!form.value.name || !form.value.description || !form.value.systemPrompt) {
    return message.warning('请填写必要信息')
  }
  saving.value = true
  try {
    const body = { ...form.value, modelName: form.value.modelName || undefined }
    if (editingId.value) {
      await request.put(`/company/agents/${editingId.value}`, body)
      message.success('更新成功')
    } else {
      await request.post('/company/agents', body)
      message.success('创建成功')
    }
    showForm.value = false
    fetchAgents()
  } finally { saving.value = false }
}

async function toggleAgent(id: number) {
  await request.patch(`/company/agents/${id}/toggle`)
  message.success('状态已更新')
  fetchAgents()
}

async function deleteAgent(id: number) {
  await request.delete(`/company/agents/${id}`)
  message.success('已删除')
  fetchAgents()
}

onMounted(fetchAgents)
</script>

<style scoped>
.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
.agent-card { border-radius: 8px; }
.agent-header { display: flex; align-items: center; gap: 8px; }
</style>
