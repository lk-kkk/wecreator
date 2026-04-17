<template>
  <a-modal
    v-model:open="visible"
    title="评价零工"
    width="560px"
    @ok="handleSubmit"
    ok-text="提交评价"
    :confirm-loading="submitting"
    @cancel="handleCancel"
  >
    <div class="review-form">
      <div class="worker-info" v-if="workerName">
        <a-avatar :size="40" :style="{ background: 'var(--color-primary)' }">
          {{ workerName[0] }}
        </a-avatar>
        <div>
          <div class="worker-name">{{ workerName }}</div>
          <div class="task-name">{{ taskTitle }}</div>
        </div>
      </div>

      <a-divider />

      <!-- 5 维度评分 -->
      <div class="dimension-list">
        <div
          v-for="dim in dimensions"
          :key="dim.key"
          class="dimension-item"
        >
          <div class="dimension-header">
            <span class="dim-label">{{ dim.label }}</span>
            <span class="dim-tip">{{ dim.tip }}</span>
            <span class="dim-score" :class="scoreClass(form[dim.key])">
              {{ scoreLabel(form[dim.key]) }}
            </span>
          </div>
          <a-rate
            v-model:value="form[dim.key]"
            :count="5"
            allow-half
            class="dim-rate"
          />
        </div>
      </div>

      <a-divider />

      <!-- 综合评分预览 -->
      <div class="overall-preview">
        <span class="overall-label">综合评分：</span>
        <a-rate :value="computedOverall" disabled allow-half />
        <span class="overall-num">{{ computedOverall.toFixed(1) }}</span>
      </div>

      <!-- 文字评价 -->
      <div class="comment-area">
        <a-textarea
          v-model:value="form.comment"
          placeholder="分享您的合作体验（选填）"
          :rows="3"
          :maxlength="500"
          show-count
        />
      </div>

      <!-- 快捷标签 -->
      <div class="quick-tags">
        <span class="tag-label">快速标签：</span>
        <a-checkable-tag
          v-for="tag in quickTags"
          :key="tag"
          v-model:checked="selectedTags[tag]"
        >{{ tag }}</a-checkable-tag>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { message } from 'ant-design-vue'
import { reviewApi } from '@/api/review'

interface Props {
  assignmentId: number
  workerName?: string
  taskTitle?: string
  workerId?: number
}

const props = defineProps<Props>()
const emit  = defineEmits<{ submitted: []; cancelled: [] }>()

const visible   = defineModel<boolean>('open', { default: false })
const submitting = ref(false)

const form = reactive({
  qualityScore:       5,
  communicationScore: 5,
  attitudeScore:      5,
  deliveryScore:      5,
  overallScore:       5,
  comment: '',
})

const selectedTags = reactive<Record<string, boolean>>({})

const quickTags = [
  '专业能力强', '沟通顺畅', '按时交付', '创意出色',
  '负责任', '高效率', '质量上乘', '态度积极',
]

const dimensions = [
  { key: 'qualityScore',       label: '专业能力', tip: '作品质量与专业水准' },
  { key: 'communicationScore', label: '沟通配合', tip: '沟通响应速度与配合度' },
  { key: 'attitudeScore',      label: '工作态度', tip: '责任心与积极性' },
  { key: 'deliveryScore',      label: '按时交付', tip: '是否按期完成任务' },
  { key: 'overallScore',       label: '整体满意', tip: '综合合作体验' },
] as const

const weights = { qualityScore: 0.25, communicationScore: 0.2, attitudeScore: 0.2, deliveryScore: 0.2, overallScore: 0.15 }
const computedOverall = computed(() =>
  Number(
    (Object.entries(weights) as [keyof typeof form, number][])
      .reduce((s, [k, w]) => s + (form[k] as number) * w, 0)
      .toFixed(1),
  ),
)

const scoreLabel = (v: number) =>
  v >= 5 ? '非常满意' : v >= 4 ? '满意' : v >= 3 ? '一般' : v >= 2 ? '不满意' : '很差'

const scoreClass = (v: number) =>
  v >= 4 ? 'score-good' : v >= 3 ? 'score-ok' : 'score-bad'

async function handleSubmit() {
  submitting.value = true
  try {
    const tags = Object.keys(selectedTags).filter(t => selectedTags[t])
    const comment = [form.comment, tags.length ? `#${tags.join(' #')}` : '']
      .filter(Boolean).join('\n')

    await reviewApi.createV2(props.assignmentId, {
      ...form,
      comment: comment || undefined,
    })
    message.success('评价提交成功 🎉')
    emit('submitted')
    visible.value = false
  } catch (e: any) {
    message.error(e?.response?.data?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  emit('cancelled')
  visible.value = false
}
</script>

<style scoped>
.review-form { padding: 8px 0; }
.worker-info { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.worker-name { font-size: 16px; font-weight: 600; }
.task-name   { font-size: 12px; color: #999; }

.dimension-list { display: flex; flex-direction: column; gap: 16px; }
.dimension-item {}
.dimension-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
}
.dim-label { font-weight: 600; font-size: 14px; min-width: 64px; }
.dim-tip   { font-size: 12px; color: #999; flex: 1; }
.dim-score { font-size: 12px; font-weight: 600; }
.score-good { color: var(--color-success); }
.score-ok   { color: var(--color-warning); }
.score-bad  { color: var(--color-error); }
.dim-rate {}

.overall-preview {
  display: flex; align-items: center; gap: 8px;
  background: var(--color-bg-hover); border-radius: 8px; padding: 12px 16px;
}
.overall-label { font-weight: 600; }
.overall-num   { font-size: 20px; font-weight: 700; color: var(--color-primary); }

.comment-area { margin-top: 16px; }
.quick-tags   { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag-label    { font-size: 13px; color: #666; margin-right: 4px; }
</style>
