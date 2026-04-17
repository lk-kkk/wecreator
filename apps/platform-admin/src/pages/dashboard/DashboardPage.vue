<template>
  <div>
    <h2 style="margin-bottom: 16px">数据看板</h2>

    <!-- 告警条 -->
    <div v-if="alerts.length" style="margin-bottom: 16px">
      <a-alert v-for="(a, i) in alerts" :key="i" :type="a.level === 'error' ? 'error' : 'warning'" :message="a.message" show-icon closable style="margin-bottom: 8px" />
    </div>

    <!-- 8项核心指标 -->
    <a-row :gutter="16" style="margin-bottom: 24px">
      <a-col :span="6" v-for="card in statCards" :key="card.label">
        <a-card size="small" hoverable @click="card.link && $router.push(card.link)">
          <a-statistic :title="card.label" :value="card.value" :prefix="card.prefix" :value-style="{ color: card.color || '#333' }" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 趋势图 -->
    <a-row :gutter="16">
      <a-col :span="8">
        <a-card title="📊 每日任务发布" size="small">
          <div ref="taskChartRef" style="height: 240px"></div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="💰 每日结算金额" size="small">
          <div ref="settleChartRef" style="height: 240px"></div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="👥 每日新增用户" size="small">
          <div ref="userChartRef" style="height: 240px"></div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { platformApi } from '@/api/platform'
import * as echarts from 'echarts'

const dashboard = ref<any>({})
const trends = ref<any>({})
const alerts = ref<any[]>([])
const taskChartRef = ref<HTMLElement>()
const settleChartRef = ref<HTMLElement>()
const userChartRef = ref<HTMLElement>()

const statCards = computed(() => [
  { label: '注册企业', value: dashboard.value.companyTotal || 0, prefix: '🏢', link: '/company' },
  { label: '注册零工', value: dashboard.value.workerTotal || 0, prefix: '👷', link: '/worker' },
  { label: '本月新增', value: dashboard.value.newUsersThisMonth || 0, prefix: '📈', color: '#52c41a' },
  { label: '活跃任务', value: dashboard.value.activeTasks || 0, prefix: '📋', link: '/task' },
  { label: '本月GMV', value: dashboard.value.gmvThisMonth || 0, prefix: '¥', color: '#1890ff' },
  { label: '本月结算', value: dashboard.value.settleThisMonth || 0, prefix: '¥' },
  { label: '服务费收入', value: dashboard.value.platformFeeIncome || 0, prefix: '¥', color: '#722ed1' },
  { label: '待处理工单', value: dashboard.value.pendingTodos || 0, prefix: '⚡', color: dashboard.value.pendingTodos > 0 ? '#f5222d' : '#333' },
])

function renderChart(el: HTMLElement | undefined, data: any[], title: string, areaColor: string) {
  if (!el || !data?.length) return
  const chart = echarts.init(el)
  chart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { top: 10, right: 10, bottom: 30, left: 50 },
    xAxis: { type: 'category', data: data.map(d => d.date.slice(5)), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [{ type: 'line', data: data.map(d => d.value), smooth: true, areaStyle: { color: areaColor }, lineStyle: { color: areaColor } }],
  })
}

onMounted(async () => {
  const [d, t, a] = await Promise.all([
    platformApi.getDashboard(),
    platformApi.getTrends(),
    platformApi.getAlerts(),
  ])
  dashboard.value = d
  trends.value = t
  alerts.value = a

  renderChart(taskChartRef.value, t.taskTrend, '任务', 'rgba(24,144,255,0.3)')
  renderChart(settleChartRef.value, t.settleTrend, '结算', 'rgba(82,196,26,0.3)')
  renderChart(userChartRef.value, t.userTrend, '用户', 'rgba(114,46,209,0.3)')
})
</script>
