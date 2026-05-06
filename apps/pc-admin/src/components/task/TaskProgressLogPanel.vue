<template>
  <div class="log-panel">
    <!-- 顶部筛选栏 -->
    <div class="log-toolbar">
      <span class="log-count">{{ filtered.length }} 条工作日志</span>
      <a-select
        v-model:value="filterRoleId"
        placeholder="全部角色"
        allow-clear
        style="width: 160px"
        size="small"
      >
        <a-select-option v-for="r in roleOptions" :key="r.taskRoleId" :value="r.taskRoleId">
          {{ r.roleName }}
        </a-select-option>
      </a-select>
    </div>

    <!-- 日志流 -->
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && filtered.length === 0" description="暂无工作日志" />

      <div v-else class="log-stream">
        <template v-for="(log, i) in filtered" :key="log.id">
          <!-- 日期分隔线：与上一条不同日期时显示 -->
          <div v-if="shouldShowDate(i)" class="date-divider">
            <span class="date-line" />
            <span class="date-label">{{ formatDateLabel(log.createdAt) }}</span>
            <span class="date-line" />
          </div>

          <!-- 单条日志（博客评论风格） -->
          <div class="comment">
            <!-- 左侧头像 + 时间线竖线 -->
            <div class="comment-left">
              <div class="comment-avatar" :style="{ background: avatarColor(log.workerName) }">
                {{ (log.workerName || '?')[0] }}
              </div>
              <div v-if="i < filtered.length - 1" class="timeline-line" />
            </div>

            <!-- 右侧内容 -->
            <div class="comment-body">
              <!-- 头部：名字 + 角色 + 时间 -->
              <div class="comment-header">
                <span class="comment-author">{{ log.workerName }}</span>
                <a-tag size="small" color="processing" :bordered="false">{{ log.roleName }}</a-tag>
                <span class="comment-progress">
                  {{ (log.prevProgress ?? 0) }}% → {{ log.progressPct }}%
                  <span v-if="log.progressPct > (log.prevProgress ?? 0)" class="progress-up">
                    +{{ log.progressPct - (log.prevProgress ?? 0) }}%
                  </span>
                </span>
                <span class="comment-time">{{ formatRelTime(log.createdAt) }}</span>
              </div>

              <!-- 日志正文 -->
              <div class="comment-content">
                <div v-if="log.dailySummary" class="content-block">
                  <div class="block-label">📌 今日完成</div>
                  <div class="block-text">{{ log.dailySummary }}</div>
                </div>
                <div v-else-if="log.content" class="content-block">
                  <div class="block-label">📝 工作内容</div>
                  <div class="block-text">{{ log.content }}</div>
                </div>
                <div v-if="log.tomorrowPlan" class="content-block">
                  <div class="block-label">🎯 明日计划</div>
                  <div class="block-text">{{ log.tomorrowPlan }}</div>
                </div>
                <div v-if="log.issues" class="content-block content-warn">
                  <div class="block-label">⚠️ 遇到问题</div>
                  <div class="block-text">{{ log.issues }}</div>
                </div>
              </div>

              <!-- 截图 -->
              <div v-if="log.screenshots?.length" class="comment-images">
                <img
                  v-for="s in log.screenshots"
                  :key="s" :src="s"
                  class="comment-thumb"
                  @click="previewImg(s)"
                />
              </div>
            </div>
          </div>
        </template>
      </div>
    </a-spin>

    <a-image
      v-model:visible="previewVisible"
      :src="previewSrc"
      :preview="{ visible: previewVisible, onVisibleChange: (v: boolean) => (previewVisible = v) }"
      style="display:none"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import { message } from 'ant-design-vue'
import request from '@/api/request'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface ProgressLog {
  id: number
  assignmentId: number
  roleName: string
  taskRoleId: number
  workerName: string
  workerId: number
  progressPct: number
  prevProgress?: number
  content?: string
  dailySummary?: string
  tomorrowPlan?: string
  issues?: string
  screenshots?: string[]
  createdAt: string
}

const props = defineProps<{ taskId: number; roles?: any[] }>()

const loading = ref(false)
const logs = ref<ProgressLog[]>([])
const filterRoleId = ref<number | null>(null)

const roleOptions = computed(() => props.roles || [])

const filtered = computed(() =>
  filterRoleId.value ? logs.value.filter((l) => l.taskRoleId === filterRoleId.value) : logs.value,
)

/** 是否显示日期分隔线 */
function shouldShowDate(i: number): boolean {
  if (i === 0) return true
  const cur = dayjs(filtered.value[i].createdAt).format('YYYY-MM-DD')
  const prev = dayjs(filtered.value[i - 1].createdAt).format('YYYY-MM-DD')
  return cur !== prev
}

/** 头像颜色（根据名字hash） */
const COLORS = ['#1677ff', '#52c41a', '#722ed1', '#fa541c', '#13c2c2', '#eb2f96', '#faad14', '#2f54eb']
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

/** 相对时间：3分钟前、2小时前、昨天 14:30、4/25 09:15 */
function formatRelTime(d: string): string {
  const m = dayjs(d)
  const diff = dayjs().diff(m, 'hour')
  if (diff < 24) return m.fromNow()
  if (diff < 48) return `昨天 ${m.format('HH:mm')}`
  return m.format('M/D HH:mm')
}

/** 日期分隔标签 */
function formatDateLabel(d: string): string {
  const day = dayjs(d)
  const today = dayjs().startOf('day')
  const fmt = day.format('M月D日')
  if (day.isSame(today, 'day')) return `${fmt} · 今天`
  if (day.isSame(today.subtract(1, 'day'), 'day')) return `${fmt} · 昨天`
  if (day.year() === today.year()) return fmt
  return day.format('YYYY年M月D日')
}

async function load() {
  loading.value = true
  try {
    try {
      const data: any = await request.get(`/tasks/${props.taskId}/progress-logs`)
      logs.value = data.items || data || []
    } catch {
      const full: any = await request.get(`/tasks/${props.taskId}/full`)
      const raw = full?.data ?? full
      const all: ProgressLog[] = []
      for (const role of raw.roles || []) {
        for (const a of role.assignments || []) {
          for (const p of a.progressUpdates || []) {
            all.push({
              id: p.id,
              assignmentId: a.assignmentId,
              roleName: role.roleName,
              taskRoleId: role.taskRoleId,
              workerName: a.workerName || `零工#${a.workerId}`,
              workerId: a.workerId,
              progressPct: p.progressPct,
              content: p.content,
              dailySummary: p.dailySummary,
              tomorrowPlan: p.tomorrowPlan,
              issues: p.issues,
              screenshots: p.screenshots,
              createdAt: p.createdAt,
            })
          }
        }
      }
      all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      for (let i = 0; i < all.length; i++) {
        const nextSame = all.slice(i + 1).find((x) => x.assignmentId === all[i].assignmentId)
        all[i].prevProgress = nextSame?.progressPct ?? 0
      }
      logs.value = all
    }
  } catch (e: any) {
    message.error(e?.message || '加载日报失败')
  } finally {
    loading.value = false
  }
}

watch(() => props.taskId, load)

const previewVisible = ref(false)
const previewSrc = ref('')
function previewImg(s: string) {
  previewSrc.value = s
  previewVisible.value = true
}

onMounted(load)
defineExpose({ reload: load })
</script>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── 顶部工具栏 ── */
.log-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px 16px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
}
.log-count {
  font-size: 12px;
  color: #8c8c8c;
}

/* ── 日志流容器 ── */
.log-stream {
  max-height: 600px;
  overflow-y: auto;
  padding: 0 4px 16px;
}
.log-stream::-webkit-scrollbar {
  width: 4px;
}
.log-stream::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 2px;
}
.log-stream::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* ── 日期分隔线 ── */
.date-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 16px;
}
.date-divider:first-child {
  margin-top: 0;
}
.date-line {
  flex: 1;
  height: 1px;
  background: #f0f0f0;
}
.date-label {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 500;
  white-space: nowrap;
}

/* ── 单条评论（博客评论风格） ── */
.comment {
  display: flex;
  gap: 12px;
  padding-bottom: 0;
}

/* 左侧：头像 + 时间线 */
.comment-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 36px;
}
.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.timeline-line {
  width: 2px;
  flex: 1;
  background: #f0f0f0;
  margin: 6px 0 0;
  min-height: 20px;
}

/* 右侧：评论内容 */
.comment-body {
  flex: 1;
  min-width: 0;
  padding-bottom: 20px;
}

/* 头部 */
.comment-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.comment-author {
  font-size: 12px;
  font-weight: 600;
  color: #262626;
}
.comment-progress {
  font-size: 12px;
  color: #8c8c8c;
  margin-left: 4px;
}
.progress-up {
  color: #52c41a;
  font-weight: 600;
}
.comment-time {
  font-size: 12px;
  color: #bfbfbf;
  margin-left: auto;
}

/* 正文块 */
.comment-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.content-block {
  background: #fafafa;
  border-radius: 8px;
  padding: 10px 14px;
}
.content-warn {
  background: #fff7e6;
  border-left: 3px solid #fa8c16;
}
.block-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 4px;
  font-weight: 500;
}
.block-text {
  font-size: 12px;
  line-height: 1.7;
  color: #434343;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 截图 */
.comment-images {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.comment-thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  cursor: zoom-in;
  border: 1px solid #f0f0f0;
  transition: transform 0.15s, box-shadow 0.15s;
}
.comment-thumb:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
</style>
