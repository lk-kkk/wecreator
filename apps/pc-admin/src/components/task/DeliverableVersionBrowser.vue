<template>
  <div class="dv-panel">
    <a-empty v-if="grouped.length === 0" description="暂无交付物" />
    <div v-for="grp in grouped" :key="grp.roleName" class="dv-group">
      <div class="dv-role">📦 {{ grp.roleName }} · {{ grp.workerName }}</div>
      <div v-for="(d, idx) in grp.deliverables" :key="d.deliverableId" class="dv-version"
        :class="{ 'dv-current': idx === 0 }">
        <div class="dv-line1">
          <span class="dv-tag">V{{ d.version || ((grp.deliverables as any[]).length - Number(idx)) }}.0</span>
          <span v-if="idx === 0" class="dv-badge-current">当前版本</span>
          <a-tag :color="statusColor(d.status)">{{ statusLabel(d.status) }}</a-tag>
          <span class="dv-time">{{ formatTime(d.submittedAt || d.createdAt) }}</span>
        </div>
        <div v-if="d.note" class="dv-note">
          <strong>📝 提交说明：</strong>{{ d.note }}
        </div>
        <div class="dv-files">
          <div v-for="f in d.files || []" :key="f.fileUrl" class="dv-file">
            <span class="file-icon">{{ fileIcon(f.fileName) }}</span>
            <a :href="f.fileUrl" target="_blank" class="file-link" :title="f.fileName">{{ f.fileName }}</a>
            <span class="file-size">{{ formatSize(f.fileSize) }}</span>
          </div>
        </div>
        <div v-if="d.reviewNote" class="dv-review" :class="d.status === 'rejected' ? 'is-reject' : 'is-pass'">
          <strong>{{ d.status === 'rejected' ? '❌ 退回原因' : '✅ 验收意见' }}：</strong>{{ d.reviewNote }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{ deliverables: any[]; roles: any[] }>()

const grouped = computed(() => {
  const map = new Map<string, any>()
  for (const r of props.roles || []) {
    for (const a of r.assignments || []) {
      const dels = (props.deliverables || [])
        .filter((d) => d.assignmentId === a.assignmentId)
        .sort((x, y) => (y.version || 0) - (x.version || 0))
      if (dels.length === 0) continue
      const key = `${r.taskRoleId}-${a.assignmentId}`
      map.set(key, {
        roleName: r.roleName,
        workerName: a.workerName || `零工#${a.workerId}`,
        deliverables: dels,
      })
    }
  }
  return Array.from(map.values())
})

const statusLabel = (s: string) =>
  ({ pending: '待审', submitted: '待验收', approved: '已通过', rejected: '已退回' } as any)[s] || s
const statusColor = (s: string) =>
  ({ pending: 'default', submitted: 'blue', approved: 'green', rejected: 'red' } as any)[s] || 'default'

function fileIcon(name: string) {
  const ext = (name || '').split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️'
  if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬'
  if (['pdf'].includes(ext)) return '📄'
  if (['psd', 'ai', 'sketch', 'fig', 'xd'].includes(ext)) return '🎨'
  if (['zip', 'rar', '7z'].includes(ext)) return '📦'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  return '📎'
}

function formatSize(b: number) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(d: string) {
  return d ? dayjs(d).format('MM-DD HH:mm') : '—'
}
</script>

<style scoped>
.dv-panel { padding: 8px 0; }
.dv-group { margin-bottom: 16px; }
.dv-role {
  font-weight: 600; padding: 8px 12px; background: #f5f5f5;
  border-radius: 4px; margin-bottom: 8px; font-size: 13px;
}
.dv-version {
  padding: 10px 12px; border-left: 3px solid #d9d9d9;
  background: #fafafa; margin-bottom: 8px; border-radius: 0 4px 4px 0;
}
.dv-current { border-left-color: #1890ff; background: #e6f7ff; }
.dv-line1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dv-tag {
  font-family: monospace; font-weight: 600; color: #1890ff;
  background: #fff; padding: 2px 8px; border-radius: 4px;
  border: 1px solid #91caff;
}
.dv-badge-current {
  font-size: 12px; color: #fff; background: #1890ff;
  padding: 2px 6px; border-radius: 4px;
}
.dv-time { color: #999; font-size: 12px; margin-left: auto; }
.dv-note { font-size: 13px; margin-top: 6px; line-height: 1.6; color: #333; }
.dv-files { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.dv-file {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; background: #fff;
  border-radius: 4px; font-size: 12px;
}
.file-icon { font-size: 14px; }
.file-link { flex: 1; color: #1890ff; text-decoration: none; }
.file-link:hover { text-decoration: underline; }
.file-size { color: #999; }
.dv-review {
  margin-top: 6px; padding: 6px 8px; border-radius: 4px; font-size: 12px;
  line-height: 1.6;
}
.dv-review.is-pass { background: #f6ffed; color: #389e0d; }
.dv-review.is-reject { background: #fff1f0; color: #cf1322; }
</style>
