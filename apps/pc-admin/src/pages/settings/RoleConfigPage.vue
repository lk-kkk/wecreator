<template>
  <div class="role-config-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">角色配置</h1>
        <p class="page-desc">配置企业可用的任务角色，发布任务时将从这里选择</p>
      </div>
      <a-button type="primary" @click="showCreateModal = true">
        <plus-outlined /> 新建角色
      </a-button>
    </div>

    <!-- 从模板添加角色 -->
    <section class="template-section">
      <div class="section-title">
        <span class="title-icon">📋</span>
        <span>从平台模板添加</span>
      </div>
      <div class="template-hint">点击下方角色快速添加到企业配置中</div>
      <div class="template-grid">
        <div
          v-for="role in availableTemplates"
          :key="role.id"
          class="template-card"
          :class="{ added: isRoleExist(role.roleName) }"
          @click="!isRoleExist(role.roleName) && addFromTemplate(role)"
        >
          <div class="template-name">{{ role.roleName }}</div>
          <div class="template-category">{{ role.category || '通用' }}</div>
          <div v-if="role.suggestedDaily" class="template-rate">
            参考日薪: ¥{{ role.suggestedDaily }}
          </div>
          <div v-if="isRoleExist(role.roleName)" class="template-status">
            <span class="template-added">
              <check-outlined /> 已添加
            </span>
            <a-popconfirm
              title="确定从企业配置中移除该角色？"
              ok-text="移除"
              cancel-text="取消"
              @confirm.stop="removeTemplateRole(role.roleName)"
            >
              <a-button
                type="text"
                size="small"
                danger
                class="template-remove-btn"
                @click.stop
              >
                <delete-outlined />
              </a-button>
            </a-popconfirm>
          </div>
          <div v-else class="template-add">
            <plus-outlined /> 添加
          </div>
        </div>
      </div>
      <a-empty v-if="platformRoles.length === 0 && !loading" description="暂无平台角色模板" />
    </section>

    <!-- 已配置角色列表 -->
    <section class="roles-section">
      <div class="section-title">
        <span class="title-icon">👥</span>
        <span>已配置角色</span>
        <span class="role-count">{{ customRoles.length }}/50</span>
      </div>

      <a-spin :spinning="loading">
        <div v-if="customRoles.length === 0 && !loading" class="empty-roles">
          <div class="empty-icon">📭</div>
          <p>还没有配置任何角色</p>
          <p class="empty-hint">从上方模板添加，或点击右上角新建自定义角色</p>
        </div>

        <div v-else class="roles-grid">
          <div v-for="role in customRoles" :key="role.roleId" class="role-card">
            <div class="role-header">
              <span class="role-name">{{ role.name }}</span>
              <a-tag v-if="role.category" color="blue" size="small">{{ role.category }}</a-tag>
            </div>
            <div v-if="role.description" class="role-desc">{{ role.description }}</div>
            <div v-if="role.commonSkills?.length > 0" class="role-skills">
              <a-tag v-for="skill in role.commonSkills.slice(0, 5)" :key="skill" size="small">
                {{ skill }}
              </a-tag>
              <span v-if="role.commonSkills.length > 5" class="more-skills">
                +{{ role.commonSkills.length - 5 }}
              </span>
            </div>
            <div class="role-actions">
              <a-button type="text" size="small" @click="handleEdit(role)">
                <edit-outlined /> 编辑
              </a-button>
              <a-popconfirm
                title="确定删除该角色？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDelete(role.roleId)"
              >
                <a-button type="text" size="small" danger>
                  <delete-outlined /> 删除
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
      </a-spin>
    </section>

    <!-- 新建/编辑角色弹窗 -->
    <a-modal
      v-model:open="showCreateModal"
      :title="editingRole ? '编辑角色' : '新建角色'"
      :confirm-loading="saving"
      @ok="handleSave"
      @cancel="resetForm"
    >
      <a-form layout="vertical" class="role-form">
        <a-form-item label="角色名称" required>
          <a-input
            v-model:value="roleForm.name"
            placeholder="如：摄影师、UI设计师、文案策划"
            :maxlength="50"
            show-count
          />
        </a-form-item>

        <a-form-item label="分类">
          <a-select
            v-model:value="roleForm.category"
            placeholder="选择或输入分类"
            allow-clear
            show-search
            :options="categoryOptions"
          />
        </a-form-item>

        <a-form-item label="角色描述">
          <a-textarea
            v-model:value="roleForm.description"
            placeholder="描述该角色的主要职责和工作内容"
            :rows="3"
            :maxlength="500"
            show-count
          />
        </a-form-item>

        <a-form-item label="常用技能标签">
          <a-select
            v-model:value="roleForm.commonSkills"
            mode="tags"
            placeholder="输入或选择技能标签，最多10个"
            :max-tag-count="10"
            :options="skillTagOptions"
            allow-clear
          />
          <div class="form-hint">发布任务时可快速选用这些技能标签</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  CheckOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'
import request from '@/api/request'
import { taskApi } from '@/api/task'

interface CustomRole {
  roleId: number
  name: string
  category: string | null
  description: string | null
  commonSkills: string[]
  isActive: boolean
  createdAt: string
}

interface PlatformRole {
  id: number
  roleName: string
  category: string | null
  description: string | null
  suggestedDaily: number | null
  skillTags: string | null
}

const loading = ref(false)
const saving = ref(false)
const showCreateModal = ref(false)
const editingRole = ref<CustomRole | null>(null)

const customRoles = ref<CustomRole[]>([])
const platformRoles = ref<PlatformRole[]>([])
const skillTags = ref<{ name: string; category: string; hot: boolean }[]>([])

const roleForm = reactive({
  name: '',
  category: undefined as string | undefined,
  description: '',
  commonSkills: [] as string[],
})

// 分类选项
const categoryOptions = computed(() => {
  const categories = new Set<string>()
  platformRoles.value.forEach(r => r.category && categories.add(r.category))
  customRoles.value.forEach(r => r.category && categories.add(r.category))
  return Array.from(categories).map(c => ({ label: c, value: c }))
})

// 技能标签选项
const skillTagOptions = computed(() =>
  skillTags.value.map(t => ({ label: t.name, value: t.name }))
)

// 可添加的平台模板（排除已添加的）
const availableTemplates = computed(() => platformRoles.value)

// 检查角色是否已存在
function isRoleExist(roleName: string): boolean {
  return customRoles.value.some(r => r.name === roleName)
}

// 根据角色名称查找对应的自定义角色
function findCustomRoleByName(roleName: string): CustomRole | undefined {
  return customRoles.value.find(r => r.name === roleName)
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [rolesRes, platformRes, tagsRes] = await Promise.all([
      request.get('/custom-roles'),
      taskApi.getPlatformRoles(),
      taskApi.getSkillTags(),
    ])
    customRoles.value = (rolesRes as any) as CustomRole[]
    platformRoles.value = (platformRes as any) as PlatformRole[]
    skillTags.value = (tagsRes as any) as any[]
  } catch (err: any) {
    message.error(err?.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 从模板添加角色
async function addFromTemplate(template: PlatformRole) {
  if (isRoleExist(template.roleName)) {
    message.info('该角色已添加')
    return
  }

  saving.value = true
  try {
    const skills = template.skillTags
      ? template.skillTags.split(',').map(s => s.trim()).filter(Boolean)
      : []

    await request.post('/custom-roles', {
      name: template.roleName,
      category: template.category,
      description: template.description,
      commonSkills: skills,
    })
    message.success(`已添加角色: ${template.roleName}`)
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '添加失败')
  } finally {
    saving.value = false
  }
}

// 从模板区域移除已添加的角色
async function removeTemplateRole(roleName: string) {
  const role = findCustomRoleByName(roleName)
  if (!role) {
    message.warning('未找到对应的角色')
    return
  }

  try {
    await request.delete(`/custom-roles/${role.roleId}`)
    message.success(`已移除角色: ${roleName}`)
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '移除失败')
  }
}

// 编辑角色
function handleEdit(role: CustomRole) {
  editingRole.value = role
  roleForm.name = role.name
  roleForm.category = role.category || undefined
  roleForm.description = role.description || ''
  roleForm.commonSkills = role.commonSkills || []
  showCreateModal.value = true
}

// 保存角色
async function handleSave() {
  if (!roleForm.name.trim()) {
    message.warning('请输入角色名称')
    return
  }

  if (roleForm.commonSkills.length > 10) {
    message.warning('技能标签最多10个')
    return
  }

  saving.value = true
  try {
    const data = {
      name: roleForm.name.trim(),
      category: roleForm.category || undefined,
      description: roleForm.description.trim() || undefined,
      commonSkills: roleForm.commonSkills,
    }

    if (editingRole.value) {
      await request.patch(`/custom-roles/${editingRole.value.roleId}`, data)
      message.success('角色已更新')
    } else {
      await request.post('/custom-roles', data)
      message.success('角色已创建')
    }

    showCreateModal.value = false
    resetForm()
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 删除角色
async function handleDelete(roleId: number) {
  try {
    await request.delete(`/custom-roles/${roleId}`)
    message.success('角色已删除')
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '删除失败')
  }
}

// 重置表单
function resetForm() {
  editingRole.value = null
  roleForm.name = ''
  roleForm.category = undefined
  roleForm.description = ''
  roleForm.commonSkills = []
}

onMounted(loadData)
</script>

<style scoped>
.role-config-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  flex: 1;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 4px;
}

.page-desc {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 0;
}

/* 区块标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.title-icon {
  font-size: 18px;
}

.role-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-tertiary);
  margin-left: auto;
}

/* 模板区域 */
.template-section {
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.template-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 16px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.template-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.template-card:hover:not(.added) {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.template-card.added {
  cursor: default;
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.template-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
}

.template-category {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
}

.template-rate {
  font-size: 12px;
  color: var(--color-primary);
}

.template-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.template-added {
  font-size: 11px;
  color: var(--color-success);
}

.template-remove-btn {
  font-size: 12px;
  padding: 0 4px;
  height: 22px;
  opacity: 0;
  transition: opacity 0.2s;
}

.template-card.added:hover .template-remove-btn {
  opacity: 1;
}

.template-add {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  opacity: 0;
  transition: opacity 0.2s;
}

.template-card:hover:not(.added) .template-add {
  opacity: 1;
}

/* 已配置角色区域 */
.roles-section {
  background: var(--color-bg-container);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 20px;
}

.empty-roles {
  text-align: center;
  padding: 48px 24px;
  color: var(--color-text-tertiary);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.empty-hint {
  font-size: 12px;
  margin-top: 4px;
}

.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.role-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  padding: 16px;
  transition: box-shadow 0.2s;
}

.role-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.role-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.role-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.role-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.role-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}

.more-skills {
  font-size: 11px;
  color: var(--color-text-tertiary);
  padding: 2px 6px;
}

.role-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--color-border-light);
  padding-top: 12px;
  margin-top: 4px;
}

/* 表单 */
.role-form :deep(.ant-form-item) {
  margin-bottom: 16px;
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}
</style>
