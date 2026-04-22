<template>
  <div class="comments-panel">
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && topComments.length === 0" description="还没有人发言，开始讨论吧" />
      <div v-for="c in topComments" :key="c.id" class="comment-item" :class="{ 'is-important': c.isImportant }">
        <div class="comment-line1">
          <a-avatar size="small" :style="{ background: avatarColor(c.authorType) }">
            {{ authorInitial(c) }}
          </a-avatar>
          <span class="author-name">{{ authorName(c) }}</span>
          <a-tag v-if="c.authorType === 'company_user'" size="small" color="blue">企业</a-tag>
          <a-tag v-else size="small" color="green">零工</a-tag>
          <a-tag v-if="c.isImportant" size="small" color="orange">⭐ 重要</a-tag>
          <span class="comment-time">{{ formatTime(c.createdAt) }}</span>
          <a-button
            v-if="canDelete(c)"
            type="link"
            size="small"
            danger
            style="margin-left:auto"
            @click="handleDelete(c.id)"
          >删除</a-button>
        </div>
        <div class="comment-content">{{ c.content }}</div>
        <div v-if="c.attachments?.length" class="comment-attachments">
          <a v-for="url in c.attachments" :key="url" :href="url" target="_blank" class="attach-link">📎 附件</a>
        </div>

        <!-- 回复 -->
        <div v-if="repliesOf(c.id).length" class="replies">
          <div v-for="r in repliesOf(c.id)" :key="r.id" class="comment-item reply">
            <div class="comment-line1">
              <a-avatar size="small" :style="{ background: avatarColor(r.authorType) }">
                {{ authorInitial(r) }}
              </a-avatar>
              <span class="author-name">{{ authorName(r) }}</span>
              <a-tag v-if="r.authorType === 'company_user'" size="small" color="blue">企业</a-tag>
              <a-tag v-else size="small" color="green">零工</a-tag>
              <span class="comment-time">{{ formatTime(r.createdAt) }}</span>
            </div>
            <div class="comment-content">{{ r.content }}</div>
          </div>
        </div>

        <a-button type="link" size="small" @click="replyTo = c.id" style="padding:0">回复</a-button>
      </div>
    </a-spin>

    <div class="composer">
      <div v-if="replyTo" class="reply-hint">
        回复中...
        <a-button type="link" size="small" @click="replyTo = null">取消</a-button>
      </div>
      <a-textarea
        v-model:value="newContent"
        :rows="3"
        placeholder="输入评论（最多 1000 字），支持 @成员"
        :maxlength="1000"
        show-count
      />
      <div class="composer-actions">
        <a-checkbox v-model:checked="newImportant">标记为重要</a-checkbox>
        <a-button type="primary" :loading="submitting" @click="handleSubmit">发送</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { commentApi, type TaskComment } from '@/api/comment'

const props = defineProps<{ taskId: number; currentUserId?: number }>()

const loading = ref(false)
const all = ref<TaskComment[]>([])
const topComments = computed(() => all.value.filter((c) => !c.parentId))
const repliesOf = (pid: number) => all.value.filter((c) => c.parentId === pid)

const newContent = ref('')
const newImportant = ref(false)
const replyTo = ref<number | null>(null)
const submitting = ref(false)

async function load() {
  loading.value = true
  try {
    const r = await commentApi.list(props.taskId, { page: 1, pageSize: 200 })
    all.value = r.items || []
  } catch (e: any) {
    message.error(e?.message || '加载评论失败')
  } finally {
    loading.value = false
  }
}
watch(() => props.taskId, load)

async function handleSubmit() {
  if (!newContent.value.trim()) {
    message.warning('请输入评论内容')
    return
  }
  submitting.value = true
  try {
    await commentApi.create(props.taskId, {
      content: newContent.value.trim(),
      parentId: replyTo.value || undefined,
      isImportant: newImportant.value,
    })
    newContent.value = ''
    newImportant.value = false
    replyTo.value = null
    message.success('已发送')
    load()
  } catch (e: any) {
    message.error(e?.message || '发送失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await commentApi.remove(props.taskId, id)
    message.success('已删除')
    load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

// UI
const authorName = (c: TaskComment) => c.author?.name || (c.authorType === 'company_user' ? `企业#${c.authorId}` : `零工#${c.authorId}`)
const authorInitial = (c: TaskComment) => (authorName(c) || '?')[0]
const avatarColor = (t: string) => (t === 'company_user' ? '#1677ff' : '#52c41a')
const formatTime = (d: string) => dayjs(d).format('MM-DD HH:mm')
const canDelete = (c: TaskComment) =>
  props.currentUserId && c.authorType === 'company_user' && c.authorId === props.currentUserId

onMounted(load)
defineExpose({ reload: load })
</script>

<style scoped>
.comments-panel { padding: 8px 0; }
.comment-item {
  padding: 10px 12px; border-left: 2px solid #f0f0f0;
  margin-bottom: 8px; background: #fafafa; border-radius: 0 4px 4px 0;
}
.comment-item.is-important { border-left-color: #faad14; background: #fffbe6; }
.comment-item.reply { margin-left: 32px; background: #fff; border-left-color: #e6e6e6; }
.comment-line1 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.author-name { font-weight: 600; font-size: 13px; }
.comment-time { color: #999; font-size: 12px; margin-left: 4px; }
.comment-content { margin-top: 6px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
.comment-attachments { margin-top: 6px; }
.attach-link { margin-right: 8px; font-size: 12px; }
.replies { margin-top: 8px; }
.composer { margin-top: 12px; padding: 12px; background: #fff; border: 1px solid #f0f0f0; border-radius: 6px; }
.composer-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.reply-hint { color: #faad14; font-size: 12px; margin-bottom: 6px; }
</style>
