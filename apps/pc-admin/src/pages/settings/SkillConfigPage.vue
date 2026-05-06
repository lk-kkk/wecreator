<template>
  <div class="sk-config-page">
    <div class="sk-header">
      <div class="sk-header-left">
        <h1 class="sk-title">技能配置</h1>
        <span class="sk-count">{{ groupedCategories.length }} 个分类，共 {{ customSkills.length }} 个技能</span>
      </div>
      <a-button type="primary" @click="showTemplateModal">
        <plus-outlined /> 新建模板
      </a-button>
    </div>

    <div class="sk-hint">
      配置企业常用技能标签，发布任务时可快速选用。技能按分类管理，也可从平台模板批量添加。
    </div>

    <!-- 平台预置模板 -->
    <section class="sk-section">
      <div class="sk-section-title">
        <span>📋 从平台模板添加</span>
        <span class="sk-section-hint">点击模板快速添加到我的配置</span>
      </div>
      <div class="sk-preset-grid">
        <div
          v-for="preset in platformPresets"
          :key="preset.key"
          class="sk-preset-card"
          @click="addFromPreset(preset)"
        >
          <div class="sk-preset-icon">{{ preset.icon }}</div>
          <div class="sk-preset-name">{{ preset.label }}</div>
          <div class="sk-preset-desc">{{ preset.skills.length }} 个技能</div>
        </div>
      </div>
    </section>

    <!-- 我的技能配置（按标签分组） -->
    <section class="sk-section">
      <div class="sk-section-title">
        <span>⚙️ 我的技能配置</span>
        <span class="sk-section-hint">按分类管理，点击类别展开查看技能</span>
      </div>

      <div v-if="loading" class="sk-loading">
        <a-spin />
      </div>

      <div v-else-if="groupedCategories.length === 0" class="sk-empty">
        <div class="sk-empty-icon">🏷️</div>
        <p>还没有配置技能</p>
        <p class="sk-empty-hint">从上方平台模板添加，或点击右上角"新建模板"</p>
      </div>

      <div v-else class="sk-group-list">
        <div
          v-for="group in groupedCategories"
          :key="group.category"
          class="sk-group-card"
          :class="{ expanded: expandedCategories.has(group.category) }"
        >
          <!-- 分组头部 -->
          <div class="sk-group-header" @click="toggleCategory(group.category)">
            <div class="sk-group-header-left">
              <span class="sk-group-arrow" :class="{ expanded: expandedCategories.has(group.category) }">
                <right-outlined />
              </span>
              <span class="sk-group-icon">{{ group.icon }}</span>
              <span class="sk-group-name">{{ group.category }}</span>
              <a-tag color="blue" size="small">{{ group.items.length }} 个技能</a-tag>
            </div>
            <div class="sk-group-header-right">
              <a-button type="text" size="small" @click.stop="showAddSkillModal(group.category)">
                <plus-outlined /> 添加技能
              </a-button>
              <a-popconfirm
                :title="`确认删除「${group.category}」下所有 ${group.items.length} 个技能？`"
                @confirm.stop="deleteCategory(group.category)"
              >
                <a-button type="text" size="small" danger @click.stop>
                  <delete-outlined />
                </a-button>
              </a-popconfirm>
            </div>
          </div>

          <!-- 展开后的技能列表 -->
          <transition name="sk-expand">
            <div v-if="expandedCategories.has(group.category)" class="sk-group-body">
              <div
                v-for="skill in group.items"
                :key="skill.skillId"
                class="sk-item"
              >
                <div class="sk-item-body">
                  <span class="sk-item-name">{{ skill.name }}</span>
                  <span v-if="skill.description" class="sk-item-desc">{{ skill.description }}</span>
                  <a-tag v-if="skill.hot" color="red" size="small">🔥 热门</a-tag>
                </div>
                <div class="sk-item-actions">
                  <a-button type="text" size="small" @click="editSkill(skill)">
                    <edit-outlined />
                  </a-button>
                  <a-popconfirm title="确认删除该技能？" @confirm="deleteSkill(skill.skillId)">
                    <a-button type="text" size="small" danger>
                      <delete-outlined />
                    </a-button>
                  </a-popconfirm>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </section>

    <!-- 新建模板弹窗 -->
    <a-modal
      v-model:open="templateModalVisible"
      title="新建模板"
      :confirm-loading="saving"
      @ok="handleSaveTemplate"
      @cancel="resetTemplateForm"
    >
      <a-form layout="vertical">
        <a-form-item label="模板名称" required>
          <a-input
            v-model:value="templateForm.name"
            placeholder="如：运营类、设计类、开发类"
            :maxlength="30"
            show-count
          />
        </a-form-item>
        <a-form-item label="技能点选择">
          <a-select
            v-model:value="templateForm.skills"
            mode="multiple"
            placeholder="从技能库选择或输入自定义技能名称"
            :options="skillTagOptions"
            :filter-option="filterSkillOption"
            show-search
            allow-clear
          />
          <div class="sk-form-hint">从技能库中选择技能点，作为该模板的初始技能</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 添加技能弹窗 -->
    <a-modal
      v-model:open="skillModalVisible"
      :title="editingId ? '编辑技能' : `添加技能到「${skillForm.category}」`"
      :confirm-loading="saving"
      @ok="handleSaveSkill"
      @cancel="resetSkillForm"
    >
      <a-form layout="vertical">
        <a-form-item label="技能名称" required>
          <a-input
            v-model:value="skillForm.name"
            placeholder="如：Photoshop、React、品牌设计"
            :maxlength="50"
            show-count
          />
        </a-form-item>
        <a-form-item label="技能描述">
          <a-textarea
            v-model:value="skillForm.description"
            placeholder="简要描述该技能的用途或要求"
            :rows="3"
            :maxlength="200"
            show-count
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批量添加确认弹窗 -->
    <a-modal
      v-model:open="presetModalVisible"
      title="从模板添加技能"
      :confirm-loading="batchAdding"
      @ok="confirmAddPreset"
    >
      <p>将从「{{ selectedPreset?.label }}」模板添加以下 {{ selectedPreset?.skills.length }} 个技能：</p>
      <div class="sk-preset-tags">
        <a-tag
          v-for="sk in selectedPreset?.skills"
          :key="sk.name"
          :color="isSkillExist(sk.name) ? 'default' : 'blue'"
          size="small"
        >
          {{ sk.name }}
          <span v-if="isSkillExist(sk.name)" class="sk-tag-exists">已存在</span>
        </a-tag>
      </div>
      <a-alert v-if="hasConflict" type="warning" show-icon style="margin-top: 12px">
        <template #message>部分技能名称已存在，将跳过重复项</template>
      </a-alert>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import request from '@/api/request'
import { taskApi } from '@/api/task'

interface CustomSkill {
  skillId: number
  name: string
  category: string | null
  description: string | null
  hot: boolean
  isActive: boolean
  createdAt: string
}

interface PresetTemplate {
  key: string
  icon: string
  label: string
  skills: Array<{ name: string; category: string; hot?: boolean }>
}

// 平台预置技能模板
const platformPresets: PresetTemplate[] = [
  {
    key: 'design',
    icon: '🎨',
    label: '设计类',
    skills: [
      { name: 'Photoshop', category: '设计类' },
      { name: 'Illustrator', category: '设计类' },
      { name: 'Figma', category: '设计类' },
      { name: 'Sketch', category: '设计类' },
      { name: 'UI设计', category: '设计类' },
      { name: '品牌设计', category: '设计类' },
      { name: '插画', category: '设计类' },
      { name: '3D建模', category: '设计类' },
    ],
  },
  {
    key: 'dev',
    icon: '💻',
    label: '开发类',
    skills: [
      { name: 'React', category: '开发类' },
      { name: 'Vue', category: '开发类' },
      { name: 'TypeScript', category: '开发类' },
      { name: 'Node.js', category: '开发类' },
      { name: 'Python', category: '开发类' },
      { name: 'Java', category: '开发类' },
      { name: '小程序开发', category: '开发类' },
      { name: 'Flutter', category: '开发类' },
    ],
  },
  {
    key: 'copy',
    icon: '✍️',
    label: '文案类',
    skills: [
      { name: '文案策划', category: '文案类' },
      { name: '内容运营', category: '文案类' },
      { name: 'SEO写作', category: '文案类' },
      { name: '新媒体运营', category: '文案类' },
      { name: '脚本撰写', category: '文案类' },
      { name: '翻译', category: '文案类' },
    ],
  },
  {
    key: 'photo',
    icon: '📷',
    label: '摄影摄像',
    skills: [
      { name: '商业摄影', category: '摄影摄像' },
      { name: '产品摄影', category: '摄影摄像' },
      { name: '视频拍摄', category: '摄影摄像' },
      { name: '视频剪辑', category: '摄影摄像' },
      { name: 'After Effects', category: '摄影摄像' },
      { name: 'Premiere', category: '摄影摄像' },
    ],
  },
  {
    key: 'data',
    icon: '📊',
    label: '数据分析',
    skills: [
      { name: 'Excel高级', category: '数据分析' },
      { name: 'SQL', category: '数据分析' },
      { name: 'Power BI', category: '数据分析' },
      { name: 'Tableau', category: '数据分析' },
      { name: '数据可视化', category: '数据分析' },
      { name: '爬虫', category: '数据分析' },
    ],
  },
  {
    key: 'marketing',
    icon: '📣',
    label: '营销推广',
    skills: [
      { name: '社交媒体运营', category: '营销推广' },
      { name: '信息流投放', category: '营销推广' },
      { name: 'SEM', category: '营销推广' },
      { name: '直播运营', category: '营销推广' },
      { name: '活动策划', category: '营销推广' },
    ],
  },
]

// 分类图标映射
const categoryIconMap: Record<string, string> = {
  '设计类': '🎨',
  '开发类': '💻',
  '文案类': '✍️',
  '摄影摄像': '📷',
  '数据分析': '📊',
  '营销推广': '📣',
}

// 数据
const loading = ref(false)
const customSkills = ref<CustomSkill[]>([])
const skillTags = ref<{ id: number; name: string; category: string | null; hot: boolean }[]>([])
const expandedCategories = ref(new Set<string>())

interface CategoryGroup {
  category: string
  icon: string
  items: CustomSkill[]
}

const groupedCategories = computed<CategoryGroup[]>(() => {
  const map = new Map<string, CustomSkill[]>()
  for (const sk of customSkills.value) {
    const cat = sk.category || '未分类'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(sk)
  }
  const groups: CategoryGroup[] = []
  for (const [category, items] of map) {
    // 热门排前面，其余按名称排序
    items.sort((a, b) => {
      if (a.hot !== b.hot) return a.hot ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    groups.push({
      category,
      icon: categoryIconMap[category] || '🏷️',
      items,
    })
  }
  return groups
})

function toggleCategory(category: string) {
  const s = new Set(expandedCategories.value)
  if (s.has(category)) s.delete(category)
  else s.add(category)
  expandedCategories.value = s
}

function isSkillExist(name: string): boolean {
  return customSkills.value.some(s => s.name === name)
}

async function deleteCategory(category: string) {
  const items = customSkills.value.filter(s => (s.category || '未分类') === category)
  try {
    for (const sk of items) {
      await request.delete(`/custom-skills/${sk.skillId}`)
    }
    message.success(`已删除「${category}」下 ${items.length} 个技能`)
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '删除失败')
  }
}

// ── 新建模板弹窗 ──
const templateModalVisible = ref(false)
const saving = ref(false)
const templateForm = ref({
  name: '',
  skills: [] as string[],
})

function showTemplateModal() {
  templateForm.value = { name: '', skills: [] }
  templateModalVisible.value = true
}

function filterSkillOption(input: string, option: any) {
  const label = (option.label || option.value || '').toLowerCase()
  return label.includes(input.toLowerCase())
}

function resetTemplateForm() {
  templateForm.value = { name: '', skills: [] }
}

async function handleSaveTemplate() {
  const categoryName = templateForm.value.name.trim()
  if (!categoryName) {
    message.warning('请输入模板名称')
    return
  }

  saving.value = true
  try {
    const skillNames = templateForm.value.skills
      .map(s => s.trim())
      .filter(Boolean)

    if (skillNames.length === 0) {
      // 只创建分类，添加一个占位技能（分类名本身）
      await request.post('/custom-skills', {
        name: categoryName,
        category: categoryName,
      })
    } else {
      // 批量创建技能，都归到这个分类下
      const skills = skillNames.map(name => ({
        name,
        category: categoryName,
      }))
      await request.post('/custom-skills/batch', { skills })
    }

    message.success(`模板「${categoryName}」创建成功`)
    templateModalVisible.value = false
    await loadData()

    // 自动展开新创建的分类
    const s = new Set(expandedCategories.value)
    s.add(categoryName)
    expandedCategories.value = s
  } catch (err: any) {
    message.error(err?.response?.data?.message || '创建失败')
  } finally {
    saving.value = false
  }
}

// ── 添加/编辑技能弹窗 ──
const skillModalVisible = ref(false)
const editingId = ref<number | null>(null)
const skillForm = ref({
  name: '',
  description: '',
  category: '',
})

function showAddSkillModal(category: string) {
  editingId.value = null
  skillForm.value = { name: '', description: '', category }
  skillModalVisible.value = true
}

function editSkill(sk: CustomSkill) {
  editingId.value = sk.skillId
  skillForm.value = {
    name: sk.name,
    description: sk.description || '',
    category: sk.category || '',
  }
  skillModalVisible.value = true
}

function resetSkillForm() {
  editingId.value = null
  skillForm.value = { name: '', description: '', category: '' }
}

async function handleSaveSkill() {
  if (!skillForm.value.name.trim()) {
    message.warning('请输入技能名称')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: skillForm.value.name.trim(),
      category: skillForm.value.category,
      description: skillForm.value.description.trim() || undefined,
    }

    if (editingId.value) {
      await request.patch(`/custom-skills/${editingId.value}`, payload)
      message.success('修改成功')
    } else {
      await request.post('/custom-skills', payload)
      message.success('创建成功')
    }

    skillModalVisible.value = false
    resetSkillForm()
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

// 删除
async function deleteSkill(id: number) {
  try {
    await request.delete(`/custom-skills/${id}`)
    message.success('已删除')
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '删除失败')
  }
}

// ── 平台预置模板弹窗 ──
const presetModalVisible = ref(false)
const selectedPreset = ref<PresetTemplate | null>(null)
const batchAdding = ref(false)

const hasConflict = computed(() => {
  if (!selectedPreset.value) return false
  return selectedPreset.value.skills.some(s => isSkillExist(s.name))
})

function addFromPreset(preset: PresetTemplate) {
  selectedPreset.value = preset
  presetModalVisible.value = true
}

async function confirmAddPreset() {
  if (!selectedPreset.value) return
  batchAdding.value = true
  try {
    const toAdd = selectedPreset.value.skills.filter(s => !isSkillExist(s.name))

    if (toAdd.length === 0) {
      message.warning('所有技能已存在，无需添加')
      presetModalVisible.value = false
      return
    }

    await request.post('/custom-skills/batch', { skills: toAdd })
    message.success(`成功添加 ${toAdd.length} 个技能`)
    presetModalVisible.value = false
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '添加失败')
  } finally {
    batchAdding.value = false
  }
}

// 技能库选项（按分类分组）
const skillTagOptions = computed(() => {
  const grouped = new Map<string, string[]>()
  for (const t of skillTags.value) {
    const cat = t.category || '其他'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(t.name)
  }
  const options: { label: string; options: { label: string; value: string }[] }[] = []
  for (const [cat, names] of grouped) {
    options.push({
      label: cat,
      options: names.map(n => ({ label: n, value: n })),
    })
  }
  return options
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [skillsRes, tagsRes] = await Promise.all([
      request.get('/custom-skills'),
      taskApi.getSkillTags(),
    ])
    customSkills.value = (skillsRes as any) as CustomSkill[]
    skillTags.value = (tagsRes as any) as any[]
  } catch (err: any) {
    message.error(err?.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.sk-config-page {
  padding: 24px 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.sk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.sk-header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.sk-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.sk-count {
  font-size: 12px;
  color: #8c8e9e;
}

.sk-hint {
  font-size: 12px;
  color: #8c8e9e;
  margin-bottom: 24px;
  line-height: 1.6;
}

.sk-section {
  background: #faf9ff;
  border: 1px solid #e0e2ed;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 20px;
}

.sk-section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 16px;
}

.sk-section-hint {
  font-size: 12px;
  color: #b0b2c0;
  font-weight: 400;
}

/* 预置模板网格 */
.sk-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.sk-preset-card {
  background: #fff;
  border: 1px solid #e0e2ed;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all .2s;
}

.sk-preset-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.sk-preset-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.sk-preset-name {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.sk-preset-desc {
  font-size: 12px;
  color: #8c8e9e;
}

/* 技能分组卡片 */
.sk-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sk-group-card {
  background: #fff;
  border: 1px solid #e0e2ed;
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow .2s;
}

.sk-group-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.sk-group-card.expanded {
  border-color: #c5cee8;
}

.sk-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;
  transition: background .15s;
}

.sk-group-header:hover {
  background: #f8f9ff;
}

.sk-group-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sk-group-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;
  color: #8c8e9e;
  transition: transform .25s ease;
}

.sk-group-arrow.expanded {
  transform: rotate(90deg);
}

.sk-group-icon {
  font-size: 22px;
  line-height: 1;
}

.sk-group-name {
  font-size: 12px;
  font-weight: 700;
  color: #1a1a2e;
}

.sk-group-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 展开动画 */
.sk-expand-enter-active {
  transition: all .25s ease;
  overflow: hidden;
}
.sk-expand-leave-active {
  transition: all .2s ease;
  overflow: hidden;
}
.sk-expand-enter-from,
.sk-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.sk-expand-enter-to,
.sk-expand-leave-from {
  opacity: 1;
  max-height: 800px;
}

.sk-group-body {
  border-top: 1px solid #f0f1f7;
  padding: 12px 20px 16px;
  background: #fafaff;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* 技能单项 — 紧凑标签样式 */
.sk-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e0e2ed;
  border-radius: 8px;
  padding: 8px 12px;
  transition: box-shadow .15s;
}

.sk-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.sk-item-body {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sk-item-name {
  font-size: 12px;
  font-weight: 500;
  color: #1a1a2e;
}

.sk-item-desc {
  font-size: 12px;
  color: #8c8e9e;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sk-item-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

/* 加载/空状态 */
.sk-loading {
  text-align: center;
  padding: 40px;
}

.sk-empty {
  text-align: center;
  padding: 40px 20px;
  color: #8c8e9e;
}

.sk-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.sk-empty-hint {
  font-size: 12px;
  color: #b0b2c0;
  margin-top: 8px;
}

/* 表单 */
.sk-form-hint {
  font-size: 12px;
  color: #8c8e9e;
  margin-top: 4px;
}

/* 预置模板确认弹窗 */
.sk-preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.sk-tag-exists {
  font-size: 10px;
  color: #b0b2c0;
  margin-left: 4px;
}
</style>
