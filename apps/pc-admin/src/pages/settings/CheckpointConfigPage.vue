<template>
  <div class="cp-config-page">
    <div class="cp-header">
      <div class="cp-header-left">
        <h1 class="cp-title">检查点配置</h1>
        <span class="cp-count">{{ groupedCategories.length }} 个分类，共 {{ checkpointTemplates.length }} 个检查点</span>
      </div>
      <a-button type="primary" @click="showCreateModal">
        <plus-outlined /> 新建检查点
      </a-button>
    </div>

    <div class="cp-hint">
      配置常用检查点模板，发布任务时可快速选用。检查点用于里程碑验收，零工需上传阶段交付物供企业审核。
    </div>

    <!-- 平台预置模板 -->
    <section class="cp-section">
      <div class="cp-section-title">
        <span>📋 从平台模板添加</span>
        <span class="cp-section-hint">点击模板快速添加到我的配置</span>
      </div>
      <div class="cp-preset-grid">
        <div
          v-for="preset in platformPresets"
          :key="preset.key"
          class="cp-preset-card"
          @click="addFromPreset(preset)"
        >
          <div class="cp-preset-icon">{{ preset.icon }}</div>
          <div class="cp-preset-name">{{ preset.label }}</div>
          <div class="cp-preset-desc">{{ preset.checkpoints.length }} 个检查点</div>
        </div>
      </div>
    </section>

    <!-- 我的检查点配置（按标签分组） -->
    <section class="cp-section">
      <div class="cp-section-title">
        <span>⚙️ 我的检查点配置</span>
        <span class="cp-section-hint">按标签分类管理，点击类别展开查看检查点</span>
      </div>

      <div v-if="loading" class="cp-loading">
        <a-spin />
      </div>

      <div v-else-if="groupedCategories.length === 0" class="cp-empty">
        <div class="cp-empty-icon">📌</div>
        <p>还没有配置检查点</p>
        <p class="cp-empty-hint">从上方平台模板添加，或点击右上角"新建检查点"</p>
      </div>

      <div v-else class="cp-group-list">
        <div
          v-for="group in groupedCategories"
          :key="group.category"
          class="cp-group-card"
          :class="{ expanded: expandedCategories.has(group.category) }"
        >
          <!-- 分组头部：点击展开/收起 -->
          <div class="cp-group-header" @click="toggleCategory(group.category)">
            <div class="cp-group-header-left">
              <span class="cp-group-arrow" :class="{ expanded: expandedCategories.has(group.category) }">
                <right-outlined />
              </span>
              <span class="cp-group-icon">{{ group.icon }}</span>
              <span class="cp-group-name">{{ group.category }}</span>
              <a-tag color="blue" size="small">{{ group.items.length }} 个检查点</a-tag>
            </div>
            <div class="cp-group-header-right">
              <span class="cp-group-progress-bar">
                <span
                  v-for="cp in group.items"
                  :key="cp.templateId"
                  class="cp-group-progress-dot"
                  :style="{ background: progressColor(cp.progress) }"
                  :title="`${cp.name} ${cp.progress}%`"
                ></span>
              </span>
              <a-popconfirm :title="`确认删除「${group.category}」下所有 ${group.items.length} 个检查点？`" @confirm.stop="deleteCategory(group.category)">
                <a-button type="text" size="small" danger @click.stop>
                  <delete-outlined />
                </a-button>
              </a-popconfirm>
            </div>
          </div>

          <!-- 展开后的检查点列表 -->
          <transition name="cp-expand">
            <div v-if="expandedCategories.has(group.category)" class="cp-group-body">
              <div
                v-for="cp in group.items"
                :key="cp.templateId"
                class="cp-item"
              >
                <div class="cp-item-drag">
                  <holder-outlined />
                </div>
                <div class="cp-item-progress" :style="{ background: progressColor(cp.progress) }">
                  {{ cp.progress }}%
                </div>
                <div class="cp-item-body">
                  <div class="cp-item-name">{{ cp.name }}</div>
                  <div v-if="cp.deliverableDesc" class="cp-item-desc">{{ cp.deliverableDesc }}</div>
                  <div v-if="cp.allowedFormats?.length > 0" class="cp-item-formats">
                    <a-tag v-for="fmt in cp.allowedFormats" :key="fmt" size="small">{{ formatLabel(fmt) }}</a-tag>
                  </div>
                </div>
                <div class="cp-item-actions">
                  <a-button type="text" size="small" @click="editCheckpoint(cp)">
                    <edit-outlined />
                  </a-button>
                  <a-popconfirm title="确认删除该检查点？" @confirm="deleteCheckpoint(cp.templateId)">
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

    <!-- 新建/编辑弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingId ? '编辑检查点' : '新建检查点'"
      :confirm-loading="saving"
      @ok="handleSave"
    >
      <a-form layout="vertical">
        <a-form-item label="检查点名称" required>
          <a-input v-model:value="formData.name" placeholder="如：完成初稿、测试通过" :maxlength="50" />
        </a-form-item>
        <a-form-item label="进度百分比">
          <a-slider v-model:value="formData.progress" :min="5" :max="95" :step="5" :marks="{ 5: '5%', 50: '50%', 95: '95%' }" />
        </a-form-item>
        <a-form-item label="交付物描述">
          <a-textarea v-model:value="formData.deliverableDesc" placeholder="描述该阶段需要提交的交付物" :rows="2" :maxlength="300" />
        </a-form-item>
        <a-form-item label="允许的文件格式">
          <a-select
            v-model:value="formData.allowedFormats"
            mode="multiple"
            placeholder="不限则留空"
            :options="formatOptions"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="所属标签" required>
          <a-auto-complete
            v-model:value="formData.category"
            :options="categoryOptions"
            placeholder="输入或选择标签，如：设计类、开发类"
            allow-clear
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批量添加确认弹窗 -->
    <a-modal
      v-model:open="presetModalVisible"
      title="从模板添加检查点"
      :confirm-loading="batchAdding"
      @ok="confirmAddPreset"
    >
      <p>将从「{{ selectedPreset?.label }}」模板添加以下 {{ selectedPreset?.checkpoints.length }} 个检查点：</p>
      <ul class="cp-preset-list">
        <li v-for="cp in selectedPreset?.checkpoints" :key="cp.name">
          <span class="cp-preset-pct">{{ cp.progress }}%</span>
          <span>{{ cp.name }}</span>
        </li>
      </ul>
      <a-alert v-if="hasConflict" type="warning" show-icon style="margin-top: 12px">
        <template #message>部分检查点名称已存在，将跳过重复项</template>
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
  HolderOutlined,
  RightOutlined,
} from '@ant-design/icons-vue'
import request from '@/api/request'

interface CheckpointTemplate {
  templateId: number
  name: string
  progress: number
  deliverableDesc: string | null
  allowedFormats: string[]
  category: string | null
  sortOrder: number
}

interface PresetTemplate {
  key: string
  icon: string
  label: string
  checkpoints: Array<{
    name: string
    progress: number
    deliverableDesc: string
    allowedFormats: string[]
  }>
}

// 平台预置模板（与TaskCreatePage中的一致）
const platformPresets: PresetTemplate[] = [
  {
    key: 'data',
    icon: '📊',
    label: '数据分析',
    checkpoints: [
      { name: '完成数据收集', progress: 20, deliverableDesc: '原始数据文件（Excel/CSV）', allowedFormats: ['xlsx', 'zip'] },
      { name: '完成数据清洗', progress: 50, deliverableDesc: '清洗后结构化数据 + 清洗说明报告', allowedFormats: ['xlsx', 'pdf'] },
      { name: '完成分析报告初稿', progress: 80, deliverableDesc: '数据分析报告（含可视化图表）', allowedFormats: ['pptx', 'pdf'] },
    ],
  },
  {
    key: 'design',
    icon: '🎨',
    label: '设计类',
    checkpoints: [
      { name: '概念方案确认', progress: 25, deliverableDesc: '2-3 个设计方向草图/参考板', allowedFormats: ['image', 'pdf'] },
      { name: '初稿交付', progress: 60, deliverableDesc: '设计初稿（高保真稿）', allowedFormats: ['image', 'design', 'pdf'] },
      { name: '修改稿确认', progress: 85, deliverableDesc: '修改定稿 + 标注规范', allowedFormats: ['design', 'pdf'] },
    ],
  },
  {
    key: 'photo',
    icon: '📷',
    label: '摄影类',
    checkpoints: [
      { name: '拍摄完成', progress: 40, deliverableDesc: '原始 RAW 文件压缩包', allowedFormats: ['zip'] },
      { name: '精修初稿', progress: 75, deliverableDesc: '精修后 JPG 文件（低分辨率预览）', allowedFormats: ['zip', 'image'] },
    ],
  },
  {
    key: 'dev',
    icon: '💻',
    label: '开发类',
    checkpoints: [
      { name: '需求评审通过', progress: 15, deliverableDesc: '需求分析文档 + 技术方案', allowedFormats: ['docx', 'pdf'] },
      { name: '前端/功能完成', progress: 55, deliverableDesc: '功能演示视频 + 代码仓库链接', allowedFormats: ['mp4', 'zip'] },
      { name: '测试通过', progress: 85, deliverableDesc: '测试报告 + Bug 修复清单', allowedFormats: ['pdf', 'docx'] },
    ],
  },
  {
    key: 'copy',
    icon: '✍️',
    label: '文案类',
    checkpoints: [
      { name: '大纲确认', progress: 20, deliverableDesc: '内容大纲/脚本框架（Word）', allowedFormats: ['docx'] },
      { name: '初稿交付', progress: 60, deliverableDesc: '文案初稿（Word）', allowedFormats: ['docx'] },
    ],
  },
]

const formatOptions = [
  { label: 'PDF', value: 'pdf' },
  { label: 'Word', value: 'docx' },
  { label: 'Excel', value: 'xlsx' },
  { label: 'PPT', value: 'pptx' },
  { label: '图片 (jpg/png)', value: 'image' },
  { label: '设计源文件', value: 'design' },
  { label: '视频 (mp4)', value: 'mp4' },
  { label: '压缩包', value: 'zip' },
]

const formatLabelMap: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  xlsx: 'Excel',
  pptx: 'PPT',
  image: '图片',
  design: '设计稿',
  mp4: '视频',
  zip: '压缩包',
}

function formatLabel(fmt: string) {
  return formatLabelMap[fmt] || fmt
}

function progressColor(p: number) {
  if (p <= 30) return '#1677ff'
  if (p <= 65) return '#fa8c16'
  return '#52c41a'
}

// 数据
const loading = ref(false)
const checkpointTemplates = ref<CheckpointTemplate[]>([])

// 按标签分组展示
const expandedCategories = ref(new Set<string>())

// 标签图标映射
const categoryIconMap: Record<string, string> = {
  '数据分析': '📊',
  '设计类': '🎨',
  '摄影类': '📷',
  '开发类': '💻',
  '文案类': '✍️',
}

interface CategoryGroup {
  category: string
  icon: string
  items: CheckpointTemplate[]
}

const groupedCategories = computed<CategoryGroup[]>(() => {
  const map = new Map<string, CheckpointTemplate[]>()
  for (const cp of checkpointTemplates.value) {
    const cat = cp.category || '未分类'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(cp)
  }
  const groups: CategoryGroup[] = []
  for (const [category, items] of map) {
    // 按 progress 升序排列组内检查点
    items.sort((a, b) => a.progress - b.progress)
    groups.push({
      category,
      icon: categoryIconMap[category] || '📌',
      items,
    })
  }
  return groups
})

// 标签自动补全选项：合并已有标签 + 预置模板标签
const categoryOptions = computed(() => {
  const existing = new Set(checkpointTemplates.value.map(c => c.category).filter(Boolean) as string[])
  for (const p of platformPresets) existing.add(p.label)
  return Array.from(existing).map(v => ({ value: v }))
})

function toggleCategory(category: string) {
  const s = new Set(expandedCategories.value)
  if (s.has(category)) s.delete(category)
  else s.add(category)
  expandedCategories.value = s
}

async function deleteCategory(category: string) {
  const items = checkpointTemplates.value.filter(c => (c.category || '未分类') === category)
  try {
    for (const cp of items) {
      await request.delete(`/checkpoint-templates/${cp.templateId}`)
    }
    message.success(`已删除「${category}」下 ${items.length} 个检查点`)
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '删除失败')
  }
}

// 弹窗状态
const modalVisible = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const formData = ref({
  name: '',
  progress: 50,
  deliverableDesc: '',
  allowedFormats: [] as string[],
  category: '',
})

// 预置模板弹窗
const presetModalVisible = ref(false)
const selectedPreset = ref<PresetTemplate | null>(null)
const batchAdding = ref(false)

const hasConflict = computed(() => {
  if (!selectedPreset.value) return false
  const existingNames = new Set(checkpointTemplates.value.map(c => c.name))
  return selectedPreset.value.checkpoints.some(c => existingNames.has(c.name))
})

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await request.get('/checkpoint-templates')
    checkpointTemplates.value = (res as any) as CheckpointTemplate[]
  } catch (err: any) {
    message.error(err?.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

// 新建
function showCreateModal() {
  editingId.value = null
  formData.value = {
    name: '',
    progress: 50,
    deliverableDesc: '',
    allowedFormats: [],
    category: '',
  }
  modalVisible.value = true
}

// 编辑
function editCheckpoint(cp: CheckpointTemplate) {
  editingId.value = cp.templateId
  formData.value = {
    name: cp.name,
    progress: cp.progress,
    deliverableDesc: cp.deliverableDesc || '',
    allowedFormats: cp.allowedFormats || [],
    category: cp.category || '',
  }
  modalVisible.value = true
}

// 保存
async function handleSave() {
  if (!formData.value.name.trim()) {
    message.warning('请输入检查点名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: formData.value.name.trim(),
      progress: formData.value.progress,
      deliverableDesc: formData.value.deliverableDesc || undefined,
      allowedFormats: formData.value.allowedFormats.length > 0 ? formData.value.allowedFormats : undefined,
      category: formData.value.category || undefined,
    }
    if (editingId.value) {
      await request.patch(`/checkpoint-templates/${editingId.value}`, payload)
      message.success('修改成功')
    } else {
      await request.post('/checkpoint-templates', payload)
      message.success('创建成功')
    }
    modalVisible.value = false
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '操作失败')
  } finally {
    saving.value = false
  }
}

// 删除
async function deleteCheckpoint(id: number) {
  try {
    await request.delete(`/checkpoint-templates/${id}`)
    message.success('已删除')
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '删除失败')
  }
}

// 从预置模板添加
function addFromPreset(preset: PresetTemplate) {
  selectedPreset.value = preset
  presetModalVisible.value = true
}

async function confirmAddPreset() {
  if (!selectedPreset.value) return
  batchAdding.value = true
  try {
    const existingNames = new Set(checkpointTemplates.value.map(c => c.name))
    const toAdd = selectedPreset.value.checkpoints.filter(c => !existingNames.has(c.name))
    
    if (toAdd.length === 0) {
      message.warning('所有检查点已存在，无需添加')
      presetModalVisible.value = false
      return
    }

    // 批量创建
    for (const cp of toAdd) {
      await request.post('/checkpoint-templates', {
        name: cp.name,
        progress: cp.progress,
        deliverableDesc: cp.deliverableDesc,
        allowedFormats: cp.allowedFormats,
        category: selectedPreset.value.label,
      })
    }
    message.success(`成功添加 ${toAdd.length} 个检查点`)
    presetModalVisible.value = false
    await loadData()
  } catch (err: any) {
    message.error(err?.response?.data?.message || '添加失败')
  } finally {
    batchAdding.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.cp-config-page {
  padding: 24px 32px;
  max-width: 1000px;
  margin: 0 auto;
}

.cp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.cp-header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.cp-title {
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.cp-count {
  font-size: 12px;
  color: #8c8e9e;
}

.cp-hint {
  font-size: 12px;
  color: #8c8e9e;
  margin-bottom: 24px;
  line-height: 1.6;
}

.cp-section {
  background: #faf9ff;
  border: 1px solid #e0e2ed;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 20px;
}

.cp-section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 16px;
}

.cp-section-hint {
  font-size: 12px;
  color: #b0b2c0;
  font-weight: 400;
}

/* 预置模板网格 */
.cp-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.cp-preset-card {
  background: #fff;
  border: 1px solid #e0e2ed;
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all .2s;
}

.cp-preset-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.cp-preset-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.cp-preset-name {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.cp-preset-desc {
  font-size: 12px;
  color: #8c8e9e;
}

/* 检查点分组卡片 */
.cp-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-group-card {
  background: #fff;
  border: 1px solid #e0e2ed;
  border-radius: 12px;
  overflow: hidden;
  transition: box-shadow .2s;
}

.cp-group-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.cp-group-card.expanded {
  border-color: #c5cee8;
}

.cp-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  cursor: pointer;
  user-select: none;
  transition: background .15s;
}

.cp-group-header:hover {
  background: #f8f9ff;
}

.cp-group-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cp-group-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;
  color: #8c8e9e;
  transition: transform .25s ease;
}

.cp-group-arrow.expanded {
  transform: rotate(90deg);
}

.cp-group-icon {
  font-size: 22px;
  line-height: 1;
}

.cp-group-name {
  font-size: 12px;
  font-weight: 700;
  color: #1a1a2e;
}

.cp-group-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cp-group-progress-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cp-group-progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* 展开动画 */
.cp-expand-enter-active {
  transition: all .25s ease;
  overflow: hidden;
}
.cp-expand-leave-active {
  transition: all .2s ease;
  overflow: hidden;
}
.cp-expand-enter-from,
.cp-expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.cp-expand-enter-to,
.cp-expand-leave-from {
  opacity: 1;
  max-height: 800px;
}

.cp-group-body {
  border-top: 1px solid #f0f1f7;
  padding: 12px 20px 16px;
  background: #fafaff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 检查点单项（复用原有样式） */
.cp-loading {
  text-align: center;
  padding: 40px;
}

.cp-empty {
  text-align: center;
  padding: 40px 20px;
  color: #8c8e9e;
}

.cp-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.6;
}

.cp-empty-hint {
  font-size: 12px;
  color: #b0b2c0;
  margin-top: 8px;
}

.cp-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e0e2ed;
  border-radius: 10px;
  padding: 14px 16px;
  transition: box-shadow .15s;
}

.cp-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.cp-item-drag {
  color: #b0b2c0;
  cursor: grab;
  font-size: 16px;
}

.cp-item-progress {
  min-width: 48px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-align: center;
}

.cp-item-body {
  flex: 1;
  min-width: 0;
}

.cp-item-name {
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.cp-item-desc {
  font-size: 12px;
  color: #8c8e9e;
  margin-bottom: 6px;
  line-height: 1.4;
}

.cp-item-formats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cp-item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* 预置模板确认弹窗 */
.cp-preset-list {
  margin: 12px 0;
  padding-left: 20px;
}

.cp-preset-list li {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-preset-pct {
  display: inline-block;
  min-width: 40px;
  padding: 2px 8px;
  background: #e6f0ff;
  color: #1677ff;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
}
</style>
