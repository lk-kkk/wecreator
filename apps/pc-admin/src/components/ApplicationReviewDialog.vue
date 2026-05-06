<!--
  ApplicationReviewDialog — 工作台待办：零工报名审批弹窗
  显示：任务信息、报名优势（自我介绍）、期望薪酬
  操作：通过 / 驳回
-->
<template>
  <a-modal
    v-model:open="visible"
    title="报名详情"
    width="560px"
    :footer="null"
    @cancel="handleClose"
  >
    <div class="app-review-body" v-if="app">
      <!-- 零工信息 -->
      <div class="worker-header">
        <a-avatar :size="48" :src="app.avatarUrl || undefined" :style="{ background: 'var(--color-primary)' }">
          {{ app.workerName?.[0] || '零' }}
        </a-avatar>
        <div class="worker-meta">
          <div class="worker-name">
            {{ app.workerName }}
            <a-tag v-if="app.verified" color="green" size="small">已认证</a-tag>
            <a-tag v-if="app.level" size="small">{{ app.level }}</a-tag>
          </div>
          <div class="worker-sub">
            <span v-if="app.city">📍 {{ app.city }}</span>
            <span v-if="app.avgRating">⭐ {{ app.avgRating.toFixed(1) }}</span>
            <span>已完成 {{ app.completedCount }} 单</span>
          </div>
        </div>
      </div>

      <!-- 技能标签 -->
      <div class="skill-tags" v-if="app.skills?.length">
        <a-tag v-for="tag in app.skills" :key="tag" color="blue">{{ tag }}</a-tag>
      </div>

      <a-divider style="margin: 16px 0" />

      <!-- 任务信息 -->
      <div class="info-section">
        <div class="section-title">📋 任务信息</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">任务名称</span>
            <span class="info-value">{{ app.taskTitle }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">报名角色</span>
            <span class="info-value">{{ app.roleName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">任务类型</span>
            <span class="info-value">{{ app.taskMode === 'daily_rate' ? '日薪' : '包价' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">角色预算</span>
            <span class="info-value amount-number">¥{{ formatMoney(app.roleBudget) }}</span>
          </div>
        </div>
      </div>

      <a-divider style="margin: 16px 0" />

      <!-- 报名优势 -->
      <div class="info-section">
        <div class="section-title">💡 报名优势</div>
        <div class="intro-text">{{ app.introduction }}</div>
      </div>

      <!-- 期望薪酬 -->
      <div class="info-section" v-if="app.expectPay != null">
        <div class="section-title">💰 期望薪酬</div>
        <div class="expect-pay amount-number">¥{{ formatMoney(app.expectPay) }}</div>
      </div>

      <a-divider style="margin: 16px 0" />

      <!-- 驳回原因 -->
      <div class="reject-area" v-if="showRejectInput">
        <a-textarea
          v-model:value="rejectReason"
          placeholder="请输入驳回原因（必填）"
          :rows="3"
          :maxlength="200"
          show-count
        />
      </div>

      <!-- 操作按钮 -->
      <div class="action-bar">
        <template v-if="!showRejectInput">
          <a-button
            type="primary"
            :loading="submitting"
            @click="handleApprove"
          >
            ✅ 通过
          </a-button>
          <a-button
            danger
            :loading="submitting"
            @click="showRejectInput = true"
          >
            ❌ 驳回
          </a-button>
        </template>
        <template v-else>
          <a-button @click="showRejectInput = false; rejectReason = ''">取消</a-button>
          <a-button
            danger
            :loading="submitting"
            :disabled="!rejectReason.trim()"
            @click="handleReject"
          >
            确认驳回
          </a-button>
        </template>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import type { PendingApplication } from '@/api/dashboard'
import request from '@/api/request'

interface Props {
  application: PendingApplication | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ reviewed: [] }>()

const visible = defineModel<boolean>('open', { default: false })
const app = ref<PendingApplication | null>(null)
const submitting = ref(false)
const showRejectInput = ref(false)
const rejectReason = ref('')

watch(() => props.application, (val) => {
  app.value = val
  showRejectInput.value = false
  rejectReason.value = ''
})

function formatMoney(v?: number) {
  if (v == null) return '0.00'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function handleApprove() {
  if (!app.value) return
  submitting.value = true
  try {
    await request.post(`/tasks/${app.value.taskId}/applications/${app.value.applicationId}/review`, {
      action: 'approved',
    })
    message.success('已通过，零工已进入执行状态')
    emit('reviewed')
    visible.value = false
  } catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleReject() {
  if (!app.value || !rejectReason.value.trim()) return
  submitting.value = true
  try {
    await request.post(`/tasks/${app.value.taskId}/applications/${app.value.applicationId}/review`, {
      action: 'rejected',
      rejectReason: rejectReason.value.trim(),
    })
    message.success('已驳回')
    emit('reviewed')
    visible.value = false
  } catch (e: any) {
    message.error(e?.response?.data?.message || e?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  showRejectInput.value = false
  rejectReason.value = ''
}
</script>

<style scoped>
.app-review-body {
  padding: 4px 0;
}

.worker-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.worker-meta {
  flex: 1;
}

.worker-name {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.worker-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
  display: flex;
  gap: 12px;
}

.skill-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.info-section {
  margin-bottom: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--color-text-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.info-value {
  font-size: 12px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.intro-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  background: var(--color-bg-hover);
  border-radius: 8px;
  padding: 12px 16px;
  white-space: pre-wrap;
}

.expect-pay {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.reject-area {
  margin-bottom: 16px;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}
</style>
