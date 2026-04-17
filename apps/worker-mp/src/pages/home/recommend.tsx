import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../api/request'
import './recommend.scss'

interface TaskRec {
  taskId:      number
  title:       string
  companyName: string
  taskMode:    string
  budget:      number
  startDate:   string | null
  endDate:     string | null
  address:     string | null
  roles:       string[]
  score:       number
  dimensions: {
    skillMatch:  number
    cityMatch:   number
    budgetFit:   number
    freshness:   number
  }
}

const formatBudget = (v: number) =>
  v >= 10000 ? `¥${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString()}`

const scoreColor = (s: number) =>
  s >= 70 ? '#52c41a' : s >= 50 ? '#faad14' : '#aaa'

const modeLabel: Record<string, string> = { task_package: '任务包', daily_rate: '人天计费' }

export default function RecommendedTasksPage() {
  const [tasks,   setTasks]   = useState<TaskRec[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const loadTasks = useCallback(async (p = 1, append = false) => {
    if (loading) return
    setLoading(true)
    try {
      const res: any = await request({
        url:    '/recommendations/tasks',
        method: 'GET',
        data:   { page: p, limit: 10 },
      })
      const newList: TaskRec[] = res.data?.list || []
      const newTotal: number   = res.data?.total || 0

      setTasks(prev => append ? [...prev, ...newList] : newList)
      setTotal(newTotal)
      setHasMore(p * 10 < newTotal)
      setPage(p)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [loading])

  // 初始加载
  useState(() => { loadTasks(1) })

  const handleLoadMore = () => {
    if (hasMore && !loading) loadTasks(page + 1, true)
  }

  const handleAccept = async (task: TaskRec) => {
    Taro.navigateTo({ url: `/subpackages/task/pages/detail/index?taskId=${task.taskId}` })
  }

  return (
    <ScrollView
      className='page'
      scrollY
      onScrollToLower={handleLoadMore}
    >
      {/* 页头 */}
      <View className='page-header'>
        <Text className='header-title'>为你推荐</Text>
        <Text className='header-sub'>共 {total} 个匹配任务</Text>
      </View>

      {/* 任务卡片列表 */}
      <View className='task-list'>
        {tasks.map((task) => (
          <View key={task.taskId} className='task-card' onClick={() => handleAccept(task)}>
            {/* 匹配度徽章 */}
            <View className='match-badge' style={{ background: scoreColor(task.score) + '20', borderColor: scoreColor(task.score) }}>
              <Text className='match-score' style={{ color: scoreColor(task.score) }}>
                {task.score}%匹配
              </Text>
            </View>

            {/* 标题 + 公司 */}
            <Text className='task-title'>{task.title}</Text>
            <Text className='task-company'>{task.companyName}</Text>

            {/* 标签行 */}
            <View className='tag-row'>
              <View className='tag mode-tag'>
                <Text className='tag-text'>{modeLabel[task.taskMode] || task.taskMode}</Text>
              </View>
              <View className='tag budget-tag'>
                <Text className='tag-text'>{formatBudget(task.budget)}</Text>
              </View>
              {task.address && (
                <View className='tag addr-tag'>
                  <Text className='tag-text'>📍{task.address.slice(0, 5)}</Text>
                </View>
              )}
            </View>

            {/* 角色需求 */}
            {task.roles.length > 0 && (
              <View className='role-row'>
                {task.roles.slice(0, 3).map((r, i) => (
                  <View key={i} className='role-chip'>
                    <Text className='role-text'>{r}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 匹配维度 */}
            <View className='dim-row'>
              <DimBar label='技能' value={task.dimensions.skillMatch} />
              <DimBar label='城市' value={task.dimensions.cityMatch} />
              <DimBar label='预算' value={task.dimensions.budgetFit} />
              <DimBar label='新鲜' value={task.dimensions.freshness} />
            </View>

            {/* 时间 */}
            {(task.startDate || task.endDate) && (
              <Text className='task-dates'>
                {task.startDate ? new Date(task.startDate).toLocaleDateString('zh-CN') : ''}
                {' ~ '}
                {task.endDate ? new Date(task.endDate).toLocaleDateString('zh-CN') : '长期'}
              </Text>
            )}
          </View>
        ))}
      </View>

      {loading && (
        <View className='loading-row'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      )}
      {!hasMore && tasks.length > 0 && (
        <View className='end-row'>
          <Text className='end-text'>— 已显示全部推荐 —</Text>
        </View>
      )}
      {!loading && tasks.length === 0 && (
        <View className='empty-box'>
          <Text className='empty-icon'>🔍</Text>
          <Text className='empty-text'>暂无匹配任务</Text>
          <Text className='empty-sub'>完善个人档案可提升匹配度</Text>
        </View>
      )}
    </ScrollView>
  )
}

// ── 维度进度条子组件 ──────────────────────────────────────────────
function DimBar({ label, value }: { label: string; value: number }) {
  return (
    <View className='dim-item'>
      <Text className='dim-label'>{label}</Text>
      <View className='dim-track'>
        <View
          className='dim-fill'
          style={{ width: `${value}%`, background: value >= 70 ? '#52c41a' : value >= 40 ? '#faad14' : '#d9d9d9' }}
        />
      </View>
      <Text className='dim-val'>{value}</Text>
    </View>
  )
}
