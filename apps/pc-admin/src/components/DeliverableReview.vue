<template>
  <div class="deliverable-item" :class="`status-${deliverable.status}`">
    <div class="file-info">
      <a-typography-link :href="deliverable.fileUrl" target="_blank">
        <PaperClipOutlined />
        {{ deliverable.fileName }}
      </a-typography-link>
      <span class="version-badge">v{{ deliverable.version }}</span>
      <a-tag v-if="deliverable.status !== 'submitted'" :color="delivStatusColor[deliverable.status]">
        {{ delivStatusLabel[deliverable.status] }}
      </a-tag>
    </div>
    <div class="review-note" v-if="deliverable.reviewNote">
      退回原因：{{ deliverable.reviewNote }}
    </div>
    <!-- 只有 submitted 状态才显示操作按钮 -->
    <div class="actions" v-if="deliverable.status === 'submitted'">
      <a-button type="primary" size="small" @click="approve">验收通过</a-button>
      <a-button danger size="small" @click="showRejectModal = true">退回</a-button>
    </div>

    <!-- 退回理由弹窗 -->
    <a-modal v-model:open="showRejectModal" title="填写退回原因" @ok="confirmReject" :confirm-loading="rejecting">
      <a-textarea v-model:value="rejectNote" :rows="3" placeholder="请说明退回原因..." />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { PaperClipOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'

const props = defineProps<{ deliverable: any }>()
const emit = defineEmits<{ (e: 'review', result: 'approved' | 'rejected', note?: string): void }>()

const showRejectModal = ref(false)
const rejectNote = ref('')
const rejecting = ref(false)

const delivStatusColor: Record<string, string> = {
  submitted: 'blue', approved: 'green', rejected: 'red',
}
const delivStatusLabel: Record<string, string> = {
  submitted: '待验收', approved: '已通过', rejected: '已退回',
}

function approve() {
  emit('review', 'approved')
}

async function confirmReject() {
  if (!rejectNote.value.trim()) {
    message.warning('请填写退回原因')
    return
  }
  rejecting.value = true
  try {
    emit('review', 'rejected', rejectNote.value.trim())
    showRejectModal.value = false
    rejectNote.value = ''
  } finally {
    rejecting.value = false
  }
}
</script>

<style scoped>
.deliverable-item {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  margin-bottom: 8px;
}
.status-submitted { border-left: 3px solid var(--color-primary); }
.status-approved  { border-left: 3px solid var(--color-success); }
.status-rejected  { border-left: 3px solid var(--color-error); }
.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.version-badge {
  font-size: 11px;
  color: #999;
  background: var(--color-bg-page);
  padding: 1px 5px;
  border-radius: 4px;
}
.review-note {
  font-size: 12px;
  color: var(--color-error);
  margin-bottom: 4px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
