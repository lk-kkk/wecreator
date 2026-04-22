<template>
  <div class="log-panel">
    <div class="log-header">
      <span>共 {{ logs.length }} 条日报</span>
      <a-select
        v-model:value="filterRoleId"
        placeholder="按角色筛选"
        allow-clear
        style="width: 180px"
        size="small"
      >
        <a-select-option v-for="r in roleOptions" :key="r.taskRoleId" :value="r.taskRoleId">
          {{ r.roleName }}
        </a-select-option>
      </a-select>
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!loading && filtered.length === 0" description="暂无日报" />
      <div v-for="(group, date) in groupedByDate" :key="date" class="log-group">
        <div class="log-date">{{ formatDateLabel(date) }}</div>
        <div v-for="log in group" :key="log.id" class="log-item">
          <div class="log-line1">
            <a-avatar size="small" :style="{ background: '#52c41a' }">{{ (log.workerName || '?')[0] }}</a-avatar>
            <span class="worker-name">{{ log.workerName }}</span>
            <a-tag size="small" color="cyan">{{ log.roleName }}</a-tag>
            <span class="progress-delta">
              进度: {{ (log.prevProgress ?? 0) }}% → {{ log.progressPct }}%
              <span v-if="log.progressPct > (log.prevProgress ?? 0)" style="color:#52c41a">(+{{ log.progressPct - (log.prevProgress ?? 0) }}%)</span>
            </span>
            <span class="log-time">{{ formatTime(log.createdAt) }}</span>
          </div>
          <div v-if="log.dailySummary" class="log-section">
            <strong>📌 今日完成：</strong>{{ log.dailySummary }}
          </div>
          <div v-else-if="log.content" class="log-section">
            <strong>📝 工作内容：</strong>{{ log.content }}
          </div>
          <div v-if="log.issues" class="log-section warn">
            <strong>⚠️ 遇到问题：</strong>{{ log.issues }}
          </div>
          <div v-if="log.tomorrowPlan" class="log-section">
            <strong>🎯 明日计划：</strong>{{ log.tomorrowPlan }}
          </div>
          <div v-if="log.screenshots?.length" class="log-screenshots">
            <img v-for="s in log.screenshots" :key="s" :src="s" class="log-thumb" @click="previewImg(s)" />
          </div>
        </div>
      </div>
    </a-spin>

    <a-image v-model:visible="previewVisible" :src="previewSrc" :preview="{ visible: previewVisible, onVisibleChange: (v: boolean) => (previewVisible = v) }" style="display:none" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import request from '@/api/request'

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

const groupedByDate = computed(() => {
  const g: Record<string, ProgressLog[]> = {}
  for (const l of filtered.value) {
    const d = dayjs(l.createdAt).format('YYYY-MM-DD')
    if (!g[d]) g[d] = []
    g[d].push(l)
  }
  return g
})

async function load() {
  loading.value = true
  try {
    // 尝试调用专用接口，降级为从 detailFull 里读
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
      // 按时间倒序 + 计算 prevProgress
      all.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      // 相同 assignmentId 内，下一条作为 prevProgress
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

const formatTime = (d: string) => dayjs(d).format('HH:mm')
const formatDateLabel = (d: string) => {
  const day = dayjs(d)
  const today = dayjs().startOf('day')
  if (day.isSame(today, 'day')) return `${d} · 今日`
  if (day.isSame(today.subtract(1, 'day'), 'day')) return `${d} · 昨日`
  return d
}

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
.log-panel { padding: 8px 0; }
.log-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 8px 12px; border-bottom: 1px solid #f0f0f0;
  color: #666; font-size: 13px;
}
.log-group { margin-bottom: 16px; }
.log-date {
  font-size: 12px; color: #999; font-weight: 600;
  padding: 8px 12px; background: #f5f5f5; border-radius: 4px;
  margin-bottom: 8px;
}
.log-item {
  padding: 10px 12px; margin-bottom: 8px; background: #fafafa;
  border-left: 2px solid #52c41a; border-radius: 0 4px 4px 0;
}
.log-line1 {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.worker-name { font-weight: 600; font-size: 13px; }
.progress-delta { color: #666; font-size: 12px; }
.log-time { color: #999; font-size: 12px; margin-left: auto; }
.log-section { margin-top: 6px; font-size: 13px; line-height: 1.6; color: #333; }
.log-section.warn { color: #fa541c; }
.log-section strong { color: #555; margin-right: 4px; }
.log-screenshots { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
.log-thumb {
  width: 72px; height: 72px; object-fit: cover;
  border-radius: 4px; cursor: zoom-in;
  border: 1px solid #e8e8e8;
}
</style>
