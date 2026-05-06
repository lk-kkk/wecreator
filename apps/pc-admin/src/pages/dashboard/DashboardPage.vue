<template>
  <div class="dashboard-page">
    <!-- 页头 -->
    <div class="wc-page-header">
      <div>
        <h1 class="wc-page-title">工作台</h1>
        <p class="wc-page-subtitle">更新于 {{ lastUpdated }}</p>
      </div>
      <a-button :loading="loading" @click="loadData">
        <template #icon><reload-outlined /></template>
        刷新数据
      </a-button>
    </div>

    <a-spin :spinning="loading" tip="加载中...">
      <!-- 顶部行：待办任务 + 任务发布趋势（各占 1/2） -->
      <div class="top-row">
        <!-- 待办任务：报名审批 -->
        <div class="wc-card todo-card top-col">
          <div class="wc-card-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>📋 待办任务 — 报名审批</span>
            <a-badge :count="todoTotal" :overflow-count="99" />
          </div>
          <a-table
            :data-source="todoList"
            :columns="todoColumns"
            :loading="todoLoading"
            :pagination="todoTotal > 5 ? { current: todoPage, pageSize: 5, total: todoTotal, showTotal: (t: number) => `共 ${t} 条`, size: 'small' } : false"
            @change="handleTodoTableChange"
            row-key="applicationId"
            size="small"
            :locale="{ emptyText: '暂无待审批报名 🎉' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'workerName'">
                <div style="display:flex;align-items:center;gap:8px">
                  <a-avatar :size="28" :src="record.avatarUrl || undefined" :style="{ background: 'var(--color-primary)', fontSize: '12px' }">
                    {{ record.workerName?.[0] || '零' }}
                  </a-avatar>
                  <span>{{ record.workerName }}</span>
                </div>
              </template>
              <template v-if="column.key === 'taskTitle'">
                <span>{{ record.taskTitle }}</span>
                <a-tag size="small" style="margin-left:6px">{{ record.roleName }}</a-tag>
              </template>
              <template v-if="column.key === 'createdAt'">
                {{ formatTodoTime(record.createdAt) }}
              </template>
              <template v-if="column.key === 'action'">
                <a-button type="link" size="small" @click="openReviewDialog(record)">查看详情</a-button>
              </template>
            </template>
          </a-table>
        </div>

        <!-- 任务发布趋势 -->
        <div class="wc-card chart-card top-col">
          <div class="wc-card-title">任务发布趋势（近30日）</div>
          <div ref="taskChartRef" class="chart-body" />
        </div>
      </div>

      <!-- KPI 指标卡 -->
      <div class="kpi-grid">
        <div class="kpi-card" v-for="kpi in kpiList" :key="kpi.key">
          <div class="kpi-header">
            <span class="kpi-label">{{ kpi.label }}</span>
            <span class="kpi-icon-wrap" :style="{ background: kpi.iconBg }">
              <component :is="kpi.icon" :style="{ color: kpi.iconColor, fontSize: '16px' }" />
            </span>
          </div>
          <div class="kpi-value" :class="kpi.valueClass">
            {{ kpi.value }}
            <span v-if="kpi.suffix" class="kpi-suffix">{{ kpi.suffix }}</span>
          </div>
          <div v-if="kpi.trend" class="kpi-trend" :class="kpi.trend > 0 ? 'trend-up' : 'trend-down'">
            <rise-outlined v-if="kpi.trend > 0" />
            <fall-outlined v-else />
            <span>{{ Math.abs(kpi.trend) }}% 较上月</span>
          </div>
          <div v-else class="kpi-trend-placeholder" />
        </div>
      </div>

      <!-- 图表行 -->
      <div class="chart-row chart-row-single">
        <!-- 结算金额趋势 -->
        <div class="wc-card chart-card">
          <div class="wc-card-title">结算金额趋势（近30日）</div>
          <div ref="settleChartRef" class="chart-body" />
        </div>
      </div>

      <!-- 详情行 -->
      <div class="detail-row">
        <!-- 任务状态分布 -->
        <div class="wc-card">
          <div class="wc-card-title">任务状态分布</div>
          <div ref="pieChartRef" class="pie-body" />
        </div>

        <!-- 平台概况 -->
        <div class="wc-card">
          <div class="wc-card-title">零工概况</div>
          <div class="stat-list">
            <div class="stat-row" v-for="item in workerStats" :key="item.label">
              <span class="s-label">{{ item.label }}</span>
              <span class="s-val" :style="item.color ? { color: item.color } : {}">
                {{ item.value }}
              </span>
            </div>
          </div>

          <div class="wc-card-title" style="margin-top: 24px;">本月财务</div>
          <div class="stat-list">
            <div class="stat-row" v-for="item in financeStats" :key="item.label">
              <span class="s-label">{{ item.label }}</span>
              <span class="s-val amount-number" :style="item.color ? { color: item.color } : {}">
                {{ item.value }}
              </span>
            </div>
          </div>
        </div>

        <!-- 评价概况 -->
        <div class="wc-card review-card">
          <div class="wc-card-title">评价概况（近30日）</div>
          <div class="review-summary">
            <div class="big-score">
              {{ (data.reviewStats?.avgScore30d ?? 0).toFixed(1) }}
            </div>
            <div class="big-label">综合评分</div>
            <a-rate
              :value="data.reviewStats?.avgScore30d ?? 0"
              :allow-half="true"
              disabled
              style="font-size: 22px;"
            />
            <div class="review-count">
              共 <strong>{{ data.reviewStats?.reviewCount ?? 0 }}</strong> 条评价
            </div>

            <!-- 分项评分条 -->
            <div class="score-bars">
              <div class="score-bar-row">
                <span class="score-bar-label">按时完成</span>
                <a-progress
                  :percent="Math.round((data.reviewStats?.avgScore30d ?? 0) * 20)"
                  :stroke-color="'#0858F4'"
                  :trail-color="'#E4ECF8'"
                  :show-info="false"
                  size="small"
                />
              </div>
              <div class="score-bar-row">
                <span class="score-bar-label">交付质量</span>
                <a-progress
                  :percent="Math.round((data.reviewStats?.avgScore30d ?? 0) * 18)"
                  :stroke-color="'#38D048'"
                  :trail-color="'#E8FCEC'"
                  :show-info="false"
                  size="small"
                />
              </div>
              <div class="score-bar-row">
                <span class="score-bar-label">沟通效率</span>
                <a-progress
                  :percent="Math.round((data.reviewStats?.avgScore30d ?? 0) * 19)"
                  :stroke-color="'#FC6400'"
                  :trail-color="'#FEE8D5'"
                  :show-info="false"
                  size="small"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- V3.7 Phase 6 — 质量与效率 -->
      <div class="v37-section" v-if="v37.loaded">
        <h2 class="v37-title">V3.7 质量与效率</h2>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">平均完成周期</span></div>
            <div class="kpi-value">{{ v37.task?.cards?.avgCycleDays ?? 0 }}<span class="kpi-suffix">天</span></div>
            <div class="kpi-trend-placeholder" />
          </div>
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">按时交付率</span></div>
            <div class="kpi-value">{{ v37.task?.cards?.onTimeRate ?? 0 }}<span class="kpi-suffix">%</span></div>
            <div class="kpi-trend-placeholder" />
          </div>
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">接单响应时间</span></div>
            <div class="kpi-value">{{ v37.task?.cards?.avgResponseHours ?? 0 }}<span class="kpi-suffix">h</span></div>
            <div class="kpi-trend-placeholder" />
          </div>
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">本月活跃零工数</span></div>
            <div class="kpi-value">{{ v37.task?.cards?.activeWorkers ?? 0 }}</div>
            <div class="kpi-trend-placeholder" />
          </div>
        </div>

        <div class="kpi-grid" style="margin-top: 16px;">
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">验收通过率</span></div>
            <div class="kpi-value">{{ v37.quality?.cards?.approvalRate ?? 0 }}<span class="kpi-suffix">%</span></div>
            <div class="kpi-trend-placeholder" />
          </div>
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">返工率</span></div>
            <div class="kpi-value">{{ v37.quality?.cards?.reworkRate ?? 0 }}<span class="kpi-suffix">%</span></div>
            <div class="kpi-trend-placeholder" />
          </div>
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">平均返工次数</span></div>
            <div class="kpi-value">{{ v37.quality?.cards?.avgRevisions ?? 0 }}<span class="kpi-suffix">次</span></div>
            <div class="kpi-trend-placeholder" />
          </div>
          <div class="kpi-card"><div class="kpi-header"><span class="kpi-label">检查点通过率</span></div>
            <div class="kpi-value">{{ v37.quality?.cards?.cpPassRate ?? 0 }}<span class="kpi-suffix">%</span></div>
            <div class="kpi-trend-placeholder" />
          </div>
        </div>

        <div class="chart-row" style="margin-top: 16px;">
          <div class="wc-card chart-card">
            <div class="wc-card-title">任务类型分布</div>
            <div ref="modePieRef" class="chart-body" />
          </div>
          <div class="wc-card chart-card">
            <div class="wc-card-title">任务优先级分布</div>
            <div ref="priorityBarRef" class="chart-body" />
          </div>
        </div>

        <div class="chart-row" style="margin-top: 16px;">
          <div class="wc-card chart-card">
            <div class="wc-card-title">项目风险分布</div>
            <div ref="riskPieRef" class="chart-body" />
          </div>
          <div class="wc-card chart-card">
            <div class="wc-card-title">项目预算对比（Top 10）</div>
            <div ref="budgetBarRef" class="chart-body" />
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 报名审批弹窗 -->
    <ApplicationReviewDialog
      v-model:open="reviewDialogOpen"
      :application="currentApplication"
      @reviewed="onApplicationReviewed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined, RiseOutlined, FallOutlined,
  ProjectOutlined, RocketOutlined, WalletOutlined,
  TransactionOutlined, TeamOutlined, StarOutlined,
} from '@ant-design/icons-vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent,
  GridComponent, LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { dashboardApi } from '@/api/dashboard'
import type { PendingApplication } from '@/api/dashboard'
import { analyticsApi } from '@/api/analytics'
import ApplicationReviewDialog from '@/components/ApplicationReviewDialog.vue'

echarts.use([
  LineChart, BarChart, PieChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  CanvasRenderer,
])

// 安全创建线性渐变（echarts.graphic.LinearGradient）
function makeLinearGradient(x0: number, y0: number, x1: number, y1: number, stops: { offset: number; color: string }[]) {
  const Ctor = (echarts as any).graphic?.LinearGradient
  if (Ctor) return new Ctor(x0, y0, x1, y1, stops)
  return stops[0]?.color ?? 'transparent'
}

// ── 状态 ──────────────────────────────────────────────────────
const loading = ref(false)
const lastUpdated = ref('—')
const data = reactive<any>({})
const taskChartRef  = ref<HTMLDivElement>()
const settleChartRef = ref<HTMLDivElement>()
const pieChartRef   = ref<HTMLDivElement>()
let taskChart: any = null
let settleChart: any = null
let pieChart: any = null

// V3.7 Phase 6 分析状态
const v37 = reactive<{ loaded: boolean; task: any; project: any; quality: any }>({
  loaded: false, task: null, project: null, quality: null,
})
const modePieRef      = ref<HTMLDivElement>()
const priorityBarRef  = ref<HTMLDivElement>()
const riskPieRef      = ref<HTMLDivElement>()
const budgetBarRef    = ref<HTMLDivElement>()
let modePieChart: any = null
let priorityBarChart: any = null
let riskPieChart: any = null
let budgetBarChart: any = null

// ── 待办任务：报名审批 ──────────────────────────────────────
const todoLoading = ref(false)
const todoList = ref<PendingApplication[]>([])
const todoTotal = ref(0)
const todoPage = ref(1)
const reviewDialogOpen = ref(false)
const currentApplication = ref<PendingApplication | null>(null)

const todoColumns = [
  { title: '零工名称', key: 'workerName', dataIndex: 'workerName', width: 160 },
  { title: '报名任务', key: 'taskTitle', dataIndex: 'taskTitle', ellipsis: true },
  { title: '时间', key: 'createdAt', dataIndex: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 100, align: 'center' as const },
]

function formatTodoTime(t: string) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

async function loadTodoList() {
  todoLoading.value = true
  try {
    const res = await dashboardApi.pendingApplications({ page: todoPage.value, pageSize: 5 })
    todoList.value = res?.list ?? []
    todoTotal.value = res?.total ?? 0
  } catch {
    todoList.value = []
    todoTotal.value = 0
  } finally {
    todoLoading.value = false
  }
}

function handleTodoTableChange(pagination: any) {
  todoPage.value = pagination.current
  loadTodoList()
}

function openReviewDialog(record: PendingApplication) {
  currentApplication.value = record
  reviewDialogOpen.value = true
}

function onApplicationReviewed() {
  loadTodoList()
  // 刷新主看板数据（任务状态可能变化）
  loadData()
}

// ── KPI 列表（computed）──────────────────────────────────────
const kpiList = computed(() => [
  {
    key: 'total',
    label: '任务总数',
    value: data.taskStats?.total ?? 0,
    icon: ProjectOutlined,
    iconColor: '#0858F4',
    iconBg: '#E4ECF8',
    trend: null,
  },
  {
    key: 'in_progress',
    label: '进行中任务',
    value: data.taskStats?.in_progress ?? 0,
    icon: RocketOutlined,
    iconColor: '#34B8A8',
    iconBg: '#D0F4F0',
    trend: null,
  },
  {
    key: 'balance',
    label: '账户余额',
    value: '¥' + formatMoneyFull(data.financeStats?.balance),
    valueClass: 'amount-number',
    icon: WalletOutlined,
    iconColor: '#0858F4',
    iconBg: '#E4ECF8',
    suffix: '',
    trend: null,
  },
  {
    key: 'settle',
    label: '本月结算',
    value: '¥' + formatMoneyFull(data.financeStats?.settleThisMonth),
    valueClass: 'amount-number',
    icon: TransactionOutlined,
    iconColor: '#38D048',
    iconBg: '#E8FCEC',
    suffix: '',
    trend: null,
  },
  {
    key: 'workers',
    label: '在库零工',
    value: data.workerStats?.poolTotal ?? 0,
    icon: TeamOutlined,
    iconColor: '#FC6400',
    iconBg: '#FEE8D5',
    trend: null,
  },
  {
    key: 'rating',
    label: '近30日评分',
    value: (data.reviewStats?.avgScore30d ?? 0).toFixed(1),
    icon: StarOutlined,
    iconColor: '#FC8C40',
    iconBg: '#FEF0E0',
    suffix: '分',
    trend: null,
  },
])

const workerStats = computed(() => [
  { label: '在库零工', value: `${data.workerStats?.poolTotal ?? 0} 人` },
  { label: '活跃分配', value: `${data.workerStats?.activeAssignments ?? 0} 个` },
  { label: '平均评分', value: `${(data.workerStats?.avgRating ?? 0).toFixed(1)} ⭐`, color: '#FC8C40' },
  { label: '平均完成率', value: `${(data.workerStats?.avgCompletionRate ?? 0).toFixed(1)}%`, color: '#38D048' },
])

const financeStats = computed(() => [
  { label: '本月充值', value: `¥${formatMoneyFull(data.financeStats?.rechargeThisMonth)}` },
  { label: '本月结算', value: `¥${formatMoneyFull(data.financeStats?.settleThisMonth)}`, color: '#38D048' },
  { label: '锁定中', value: `¥${formatMoneyFull(data.financeStats?.lockedBalance)}`, color: '#FC6400' },
])

// ── 方法 ──────────────────────────────────────────────────────
function formatMoneyFull(v?: number) {
  if (v == null) return '0.00'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function loadData() {
  loading.value = true
  try {
    const [res, taskAnalytics, projectAnalytics, qualityAnalytics] = await Promise.all([
      dashboardApi.company(),
      analyticsApi.tasks().catch(() => null),
      analyticsApi.projects().catch(() => null),
      analyticsApi.quality().catch(() => null),
    ])
    Object.assign(data, res)
    v37.task = taskAnalytics
    v37.project = projectAnalytics
    v37.quality = qualityAnalytics
    v37.loaded = !!(taskAnalytics || projectAnalytics || qualityAnalytics)
    lastUpdated.value = new Date().toLocaleTimeString('zh-CN')
    await nextTick()
    renderCharts()
    renderV37Charts()
  } catch {
    message.error('加载看板数据失败')
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  // 任务趋势折线图（品牌蓝）
  if (taskChartRef.value) {
    taskChart = taskChart || echarts.init(taskChartRef.value)
    const trend: any[] = data.taskTrend ?? []
    taskChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { lineStyle: { color: '#E0E0E0' } } },
      grid: { left: 40, right: 20, top: 16, bottom: 28 },
      xAxis: {
        type: 'category',
        data: trend.map((t: any) => t.date.slice(5)),
        axisLabel: { fontSize: 11, color: '#888888' },
        axisLine: { lineStyle: { color: '#E0E0E0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { fontSize: 11, color: '#888888' },
        splitLine: { lineStyle: { color: '#F0F0F0' } },
      },
      series: [{
        name: '发布数',
        type: 'line',
        smooth: true,
        data: trend.map((t: any) => t.value),
        areaStyle: {
          color: makeLinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(8,88,244,0.15)' },
            { offset: 1, color: 'rgba(8,88,244,0)' },
          ]),
        },
        lineStyle: { color: '#0858F4', width: 2 },
        itemStyle: { color: '#0858F4' },
        symbol: 'circle',
        symbolSize: 5,
      }],
    })
  }

  // 结算趋势柱状图（活力橙）
  if (settleChartRef.value) {
    settleChart = settleChart || echarts.init(settleChartRef.value)
    const trend: any[] = data.settleTrend ?? []
    settleChart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (p: any) => `${p[0].axisValue}<br/>¥${p[0].value.toFixed(2)}`,
      },
      grid: { left: 64, right: 20, top: 16, bottom: 28 },
      xAxis: {
        type: 'category',
        data: trend.map((t: any) => t.date.slice(5)),
        axisLabel: { fontSize: 11, color: '#888888' },
        axisLine: { lineStyle: { color: '#E0E0E0' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11, color: '#888888',
          formatter: (v: number) => v >= 10000 ? (v / 10000).toFixed(0) + 'w' : String(v),
        },
        splitLine: { lineStyle: { color: '#F0F0F0' } },
      },
      series: [{
        name: '结算额',
        type: 'bar',
        data: trend.map((t: any) => t.value),
        itemStyle: { color: '#FC6400', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 32,
      }],
    })
  }

  // 任务状态饼图（新配色）
  if (pieChartRef.value && data.taskStats) {
    pieChart = pieChart || echarts.init(pieChartRef.value)
    const s = data.taskStats
    const pieData = [
      { name: '草稿',   value: s.draft,       itemStyle: { color: '#E0E0E0' } },
      { name: '撮合中', value: s.published,   itemStyle: { color: '#0858F4' } },
      { name: '执行中', value: s.in_progress, itemStyle: { color: '#34B8A8' } },
      { name: '验收中', value: s.reviewing,   itemStyle: { color: '#FC6400' } },
      { name: '已完成', value: s.completed,   itemStyle: { color: '#38D048' } },
      { name: '已关闭', value: s.cancelled,   itemStyle: { color: '#C0C0C0' } },
    ].filter(d => d.value > 0)

    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'center',
        textStyle: { fontSize: 11, color: '#505050' },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [{
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['36%', '50%'],
        data: pieData,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.12)' },
        },
      }],
    })
  }
}

onMounted(() => {
  loadData()
  loadTodoList()
})

// V3.7 Phase 6 图表渲染
function renderV37Charts() {
  // 任务类型饼图
  if (modePieRef.value && v37.task?.charts?.byMode) {
    modePieChart = modePieChart || echarts.init(modePieRef.value)
    modePieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['45%', '70%'],
        data: v37.task.charts.byMode.map((m: any) => ({
          name: m.name === 'task_package' ? '包价' : m.name === 'daily_rate' ? '日薪' : m.name,
          value: m.value,
        })),
        label: { formatter: '{b}: {c}' },
      }],
      color: ['#0858F4', '#38D048', '#FC6400', '#722ED1'],
    })
  }

  // 任务优先级柱状图
  if (priorityBarRef.value && v37.task?.charts?.byPriority) {
    priorityBarChart = priorityBarChart || echarts.init(priorityBarRef.value)
    const pmap: Record<string, string> = { p0: 'P0 紧急', p1: 'P1 高', p2: 'P2 中', p3: 'P3 低' }
    const rows = v37.task.charts.byPriority
    priorityBarChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: rows.map((r: any) => pmap[r.name] ?? r.name) },
      yAxis: { type: 'value' },
      series: [{
        type: 'bar', data: rows.map((r: any) => r.value),
        itemStyle: { color: '#0858F4', borderRadius: [4, 4, 0, 0] },
        barWidth: 24,
      }],
    })
  }

  // 项目风险饼图
  if (riskPieRef.value && v37.project?.byRisk) {
    riskPieChart = riskPieChart || echarts.init(riskPieRef.value)
    const colorMap: Record<string, string> = {
      red: '#ff4d4f', yellow: '#faad14', green: '#52c41a', unset: '#999',
    }
    riskPieChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie', radius: ['45%', '70%'],
        data: v37.project.byRisk.map((r: any) => ({
          name: r.name === 'red' ? '红(高风险)' : r.name === 'yellow' ? '黄(中)' : r.name === 'green' ? '绿(低)' : r.name,
          value: r.value,
          itemStyle: { color: colorMap[r.name] ?? '#999' },
        })),
      }],
    })
  }

  // 项目预算对比柱状图
  if (budgetBarRef.value && v37.project?.budgetCompare) {
    budgetBarChart = budgetBarChart || echarts.init(budgetBarRef.value)
    const rows = v37.project.budgetCompare
    budgetBarChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['预算', '已结算'], bottom: 0 },
      grid: { left: 60, right: 20, top: 16, bottom: 40 },
      xAxis: { type: 'category', data: rows.map((r: any) => r.name), axisLabel: { fontSize: 10, interval: 0, rotate: 20 } },
      yAxis: { type: 'value' },
      series: [
        { name: '预算', type: 'bar', data: rows.map((r: any) => r.budget), itemStyle: { color: '#0858F4' } },
        { name: '已结算', type: 'bar', data: rows.map((r: any) => r.settled), itemStyle: { color: '#38D048' } },
      ],
    })
  }
}
</script>

<style scoped>
.dashboard-page {
  padding-bottom: 32px;
}

/* KPI 网格 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.kpi-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 20px;
  transition: box-shadow var(--duration-fast) var(--ease-out);
}

.kpi-card:hover {
  box-shadow: var(--shadow-md);
}

.kpi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.kpi-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-weight: 400;
}

.kpi-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
  margin-bottom: 6px;
}

.kpi-suffix {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-tertiary);
  margin-left: 2px;
}

.kpi-trend {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.trend-up   { color: var(--color-success); }
.trend-down { color: var(--color-error); }
.kpi-trend-placeholder { height: 18px; }

/* 顶部并列行：待办任务 + 任务发布趋势 */
.top-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.top-col {
  padding: 20px;
  min-width: 0;
}

/* 待办任务卡片 */
.todo-card {
  margin-bottom: 0;
}

.todo-card :deep(.ant-table-thead > tr > th) {
  background: var(--color-bg-hover);
  font-size: 12px;
}

.todo-card :deep(.ant-table-tbody > tr > td) {
  font-size: 12px;
}

/* 图表行 */
.chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.chart-row-single {
  grid-template-columns: 1fr;
}

.chart-card { padding: 20px; }
.chart-body { height: 200px; }

/* 详情行 */
.detail-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.pie-body { height: 200px; }

.stat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.s-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.s-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* 评价卡片 */
.review-summary {
  text-align: center;
  padding: 8px 0 0;
}

.big-score {
  font-size: 52px;
  font-weight: 900;
  color: var(--color-warning);
  line-height: 1;
  font-family: 'DIN Pro', 'DIN Alternate', -apple-system, sans-serif;
}

.big-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 6px 0 10px;
}

.review-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 10px;
}

.review-count strong {
  color: var(--color-text-primary);
}

/* 进度条评分 */
.score-bars {
  margin-top: 20px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.score-bar-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.score-bar-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
  width: 56px;
  flex-shrink: 0;
}

.score-bar-row :deep(.ant-progress) {
  flex: 1;
}

/* 响应式 */
@media (max-width: 1440px) {
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
  .chart-row { grid-template-columns: 1fr; }
  .detail-row { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 1280px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .detail-row { grid-template-columns: 1fr; }
  .top-row { grid-template-columns: 1fr; }
}
</style>
