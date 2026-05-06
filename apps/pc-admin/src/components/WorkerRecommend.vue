<template>
  <div class="recommend-panel">
    <!-- 搜索栏 -->
    <div class="search-bar">
      <a-input-search
        v-model:value="keyword"
        placeholder="搜索零工姓名"
        style="width: 180px"
        @search="loadRecommend"
      />
      <a-input
        v-model:value="cityFilter"
        placeholder="城市"
        style="width: 100px"
        @change="loadRecommend"
      />
      <a-select
        v-model:value="minRating"
        placeholder="最低评分"
        style="width: 120px"
        allow-clear
        @change="loadRecommend"
      >
        <a-select-option :value="4">4星以上</a-select-option>
        <a-select-option :value="3">3星以上</a-select-option>
      </a-select>
      <a-button @click="loadRecommend" :loading="loading">🔍 筛选</a-button>
    </div>

    <a-spin :spinning="loading">
      <div v-if="workers.length === 0 && !loading" class="empty-state">
        <a-empty description="暂无推荐零工" />
      </div>

      <div class="worker-grid">
        <div
          v-for="w in workers"
          :key="w.workerId"
          class="worker-card"
          :class="{ 'top-score': w.score >= 80 }"
        >
          <!-- 评分徽章 -->
          <div class="score-badge" :class="scoreBadgeClass(w.score)">
            {{ w.score }}
          </div>

          <!-- 头像 + 基本信息 -->
          <div class="worker-header">
            <a-avatar
              :src="w.avatarUrl"
              :size="48"
              :style="{ background: 'var(--color-primary)' }"
            >
              {{ (w.realName || '?')[0] }}
            </a-avatar>
            <div class="worker-info">
              <div class="worker-name">{{ w.realName || '未填写' }}</div>
              <div class="worker-level">
                <a-tag :color="levelColor[w.level]" size="small">{{ levelLabel[w.level] }}</a-tag>
              </div>
            </div>
          </div>

          <!-- 统计指标 -->
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-val">{{ w.avgRating.toFixed(1) }}</span>
              <span class="stat-label">评分</span>
            </div>
            <div class="stat-divider" />
            <div class="stat-item">
              <span class="stat-val">{{ (w.completionRate * 100).toFixed(0) }}%</span>
              <span class="stat-label">完成率</span>
            </div>
            <div class="stat-divider" />
            <div class="stat-item">
              <span class="stat-val">{{ w.completedCount }}</span>
              <span class="stat-label">完成数</span>
            </div>
          </div>

          <!-- 雷达图（4维度得分可视化） -->
          <div class="radar-chart">
            <RadarChart :dimensions="w.dimensions" />
          </div>

          <!-- 技能标签 -->
          <div class="skill-tags">
            <a-tag
              v-for="tag in w.skillTags.slice(0, 4)"
              :key="tag"
              size="small"
              color="blue"
            >{{ tag }}</a-tag>
            <span v-if="w.skillTags.length > 4" class="more-tags">+{{ w.skillTags.length - 4 }}</span>
          </div>

          <!-- 操作按钮 -->
          <div class="card-actions">
            <a-button
              type="primary" block size="small"
              :loading="inviting === w.workerId"
              @click="$emit('invite', w)"
            >一键邀约</a-button>
            <a-button size="small" @click="viewProfile(w)">查看档案</a-button>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, h } from 'vue'
import { message } from 'ant-design-vue'
import { recommendApi } from '@/api/recommendation'

interface Props {
  roleId?: number
}
const props = defineProps<Props>()
const emit  = defineEmits<{ invite: [worker: any]; viewProfile: [worker: any] }>()

const workers    = ref<any[]>([])
const loading    = ref(false)
const inviting   = ref<number | null>(null)
const keyword    = ref('')
const cityFilter = ref('')
const minRating  = ref<number | undefined>()

const levelLabel: Record<string, string> = {
  unverified: '未认证', basic: '基础', skilled: '熟练',
  expert: '专家', master: '大师',
}
const levelColor: Record<string, string> = {
  unverified: 'default', basic: 'blue', skilled: 'cyan',
  expert: 'purple', master: 'gold',
}
const scoreBadgeClass = (s: number) =>
  s >= 80 ? 'badge-gold' : s >= 60 ? 'badge-blue' : 'badge-gray'

async function loadRecommend() {
  loading.value = true
  try {
    if (props.roleId && !keyword.value && !cityFilter.value && !minRating.value) {
      // 基于角色推荐
      const res = await recommendApi.forRole(props.roleId)
      workers.value = res.data || []
    } else {
      // 搜索模式
      const res = await recommendApi.searchWorkers({
        keyword:   keyword.value || undefined,
        city:      cityFilter.value || undefined,
        minRating: minRating.value,
      })
      workers.value = res.data?.list || []
    }
  } catch { message.error('加载推荐失败') }
  finally { loading.value = false }
}

function viewProfile(w: any) { emit('viewProfile', w) }

onMounted(loadRecommend)

// ── 内联雷达图组件（简化版 SVG） ───────────────────────────────
const RadarChart = defineComponent({
  props: { dimensions: { type: Object, required: true } },
  setup(props) {
    return () => {
      const d = props.dimensions as any
      const dims = [
        { label: '评分', value: d.ratingScore },
        { label: '完成率', value: d.completionScore },
        { label: '经验', value: d.experienceScore },
        { label: '技能', value: d.skillMatchScore },
      ]
      const cx = 60, cy = 60, r = 45
      const angles = dims.map((_, i) => (i / dims.length) * 2 * Math.PI - Math.PI / 2)

      // 背景网格
      const gridLevels = [0.25, 0.5, 0.75, 1]
      const gridPaths = gridLevels.map(level => {
        const pts = angles.map(a => [
          cx + r * level * Math.cos(a),
          cy + r * level * Math.sin(a),
        ])
        return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z'
      })

      // 数据多边形
      const dataPoints = dims.map((d, i) => [
        cx + r * (d.value / 100) * Math.cos(angles[i]),
        cy + r * (d.value / 100) * Math.sin(angles[i]),
      ])
      const dataPath = dataPoints.map((p, i) =>
        `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`
      ).join(' ') + ' Z'

      return h('svg', { width: 120, height: 120 }, [
        // 网格
        ...gridPaths.map(d => h('path', { d, fill: 'none', stroke: '#e8e8e8', 'stroke-width': 1 })),
        // 轴线
        ...angles.map((a) =>
          h('line', {
            x1: cx, y1: cy,
            x2: (cx + r * Math.cos(a)).toFixed(1),
            y2: (cy + r * Math.sin(a)).toFixed(1),
            stroke: '#e8e8e8', 'stroke-width': 1,
          })
        ),
        // 数据面
        h('path', { d: dataPath, fill: 'rgba(91,76,219,0.2)', stroke: 'var(--color-primary)', 'stroke-width': 1.5 }),
        // 标签
        ...dims.map((dim, i) => {
          const lx = cx + (r + 12) * Math.cos(angles[i])
          const ly = cy + (r + 12) * Math.sin(angles[i])
          return h('text', {
            x: lx.toFixed(1), y: ly.toFixed(1),
            'text-anchor': 'middle', 'dominant-baseline': 'middle',
            style: 'font-size: 9px; fill: #666;',
          }, dim.label)
        }),
      ])
    }
  },
})
</script>

<style scoped>
.recommend-panel { padding: 16px 0; }
.search-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }

.worker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.worker-card {
  position: relative;
  background: #fff;
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: box-shadow .2s;
}
.worker-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); }
.worker-card.top-score { border-color: var(--color-warning); }

.score-badge {
  position: absolute; top: 12px; right: 12px;
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
}
.badge-gold { background: var(--color-warning-bg); color: var(--color-warning); border: 1px solid var(--color-warning); }
.badge-blue { background: var(--color-primary-bg-soft); color: var(--color-primary); border: 1px solid var(--color-primary-border); }
.badge-gray { background: var(--color-bg-page); color: #999; border: 1px solid var(--color-border); }

.worker-header { display: flex; align-items: center; gap: 10px; }
.worker-name  { font-weight: 600; font-size: 12px; color: #333; }
.worker-level { margin-top: 2px; }

.stats-row   { display: flex; align-items: center; gap: 4px; }
.stat-item   { flex: 1; text-align: center; }
.stat-val    { display: block; font-size: 16px; font-weight: 700; color: #333; }
.stat-label  { display: block; font-size: 11px; color: #aaa; }
.stat-divider { width: 1px; height: 32px; background: var(--color-border-light); }

.radar-chart { display: flex; justify-content: center; }

.skill-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.more-tags  { font-size: 11px; color: #aaa; }

.card-actions { display: flex; gap: 6px; }

.empty-state { padding: 40px; }
</style>
