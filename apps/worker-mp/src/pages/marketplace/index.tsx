import { useState, useCallback } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { isLoggedIn } from '../../utils/wx-login'
import { marketplaceApi, type MarketplaceTask, type CompanyGroup } from '../../api/marketplace'
import './index.scss'

const modeLabel: Record<string, string> = { task_package: '📦任务包', daily_rate: '📅人天' }

const formatBudget = (v: number) =>
  v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString()}`

const scoreColor = (s: number | null) =>
  s === null ? '#ccc' : s >= 70 ? '#52c41a' : s >= 50 ? '#faad14' : '#aaa'

const timeAgo = (d: string | null) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

const roles = ['全部', '摄影师', '平面设计师', '视频剪辑', '文案策划', '产品经理', '插画师', '模特', '化妆师', 'UI设计师']
const cities = ['全部', '北京', '上海', '广州', '深圳', '杭州', '成都', '远程']
const modes = ['全部', '任务包', '人天计费']
const sorts = [
  { label: '最新发布', value: 'latest' },
  { label: '匹配度', value: 'match' },
  { label: '预算高', value: 'budget' },
]

export default function MarketplacePage() {
  const [tasks, setTasks] = useState<MarketplaceTask[]>([])
  const [groups, setGroups] = useState<CompanyGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filters, setFilters] = useState({ roleName: '', city: '', taskMode: '', sort: 'latest' })
  const [showFilter, setShowFilter] = useState('')

  const loadTasks = useCallback(async (p = 1, append = false) => {
    if (loading || !isLoggedIn()) return
    setLoading(true)
    try {
      const params: any = { page: p, pageSize: 10, sort: filters.sort }
      if (filters.roleName && filters.roleName !== '全部') params.roleName = filters.roleName
      if (filters.city && filters.city !== '全部') params.city = filters.city
      if (filters.taskMode === '任务包') params.taskMode = 'task_package'
      else if (filters.taskMode === '人天计费') params.taskMode = 'daily_rate'
      if (keyword) params.keyword = keyword

      const res = await marketplaceApi.list(params)
      setTasks(prev => append ? [...prev, ...res.list] : res.list)
      setTotal(res.total)
      setPage(p)
    } catch {}
    setLoading(false)
  }, [filters, keyword, loading])

  const loadGroups = useCallback(async () => {
    if (!isLoggedIn()) return
    try {
      const res = await marketplaceApi.listByCompany()
      setGroups(res.groups ?? [])
    } catch {}
  }, [])

  useDidShow(() => {
    loadTasks(1)
    loadGroups()
  })

  const onSearch = () => loadTasks(1)

  const selectFilter = (key: string, val: string) => {
    setFilters(prev => ({ ...prev, [key]: val }))
    setShowFilter('')
    setTimeout(() => loadTasks(1), 50)
  }

  const goDetail = (taskId: number) =>
    Taro.navigateTo({ url: `/subpackages/marketplace/pages/detail/index?id=${taskId}` })

  if (!isLoggedIn()) {
    return (
      <View className='mp-page'>
        <View className='login-hint'>
          <Text>请先登录后浏览服务广场</Text>
          <View className='login-btn' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
            <Text className='login-btn-text'>去登录</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className='mp-page'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input-wrap'>
          <Text className='search-icon'>🔍</Text>
          <Input
            className='search-input'
            placeholder='搜索任务/角色/技能...'
            value={keyword}
            onInput={e => setKeyword(e.detail.value)}
            onConfirm={onSearch}
          />
        </View>
      </View>

      {/* 筛选条 */}
      <View className='filter-bar'>
        {[
          { key: 'roleName', label: filters.roleName || '角色', options: roles },
          { key: 'city', label: filters.city || '城市', options: cities },
          { key: 'taskMode', label: filters.taskMode || '模式', options: modes },
        ].map(f => (
          <View key={f.key} className={`filter-item ${showFilter === f.key ? 'active' : ''}`}
            onClick={() => setShowFilter(showFilter === f.key ? '' : f.key)}>
            <Text className='filter-text'>{f.label}</Text>
            <Text className='filter-arrow'>▼</Text>
            {showFilter === f.key && (
              <View className='filter-dropdown'>
                {f.options.map(opt => (
                  <View key={opt} className={`filter-option ${(filters as any)[f.key] === opt ? 'selected' : ''}`}
                    onClick={(e) => { e.stopPropagation(); selectFilter(f.key, opt) }}>
                    <Text>{opt}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        <View className='filter-item' onClick={() => {
          const idx = sorts.findIndex(s => s.value === filters.sort)
          const next = sorts[(idx + 1) % sorts.length]
          setFilters(prev => ({ ...prev, sort: next.value }))
          setTimeout(() => loadTasks(1), 50)
        }}>
          <Text className='filter-text'>{sorts.find(s => s.value === filters.sort)?.label}</Text>
          <Text className='filter-arrow'>↕</Text>
        </View>
      </View>

      <ScrollView className='content-scroll' scrollY
        onScrollToLower={() => { if (page * 10 < total) loadTasks(page + 1, true) }}>

        {/* 上半区：待招募任务 */}
        <View className='section-header'>
          <Text className='section-title'>📌 待招募中 ({total})</Text>
        </View>

        {tasks.map(t => (
          <View key={t.taskId} className='task-card' onClick={() => goDetail(t.taskId)}>
            <View className='task-top'>
              <Text className='task-title'>{t.title}</Text>
              <Text className='task-budget'>{formatBudget(t.totalBudget)}</Text>
            </View>
            <View className='task-meta'>
              <Text className='meta-company'>🏢 {t.company.name}</Text>
              <Text className='meta-location'>📍{t.address || '远程'}</Text>
              <Text className='meta-mode'>{modeLabel[t.taskMode] || t.taskMode}</Text>
            </View>
            <View className='task-roles'>
              <Text className='roles-text'>需: {t.roles.map(r => `${r.roleName}×${r.headcount}`).join('  ')}</Text>
            </View>
            <View className='task-bottom'>
              <Text className='meta-time'>⏰ {timeAgo(t.publishedAt)}</Text>
              {t.matchScore !== null && (
                <View className='match-badge' style={{ backgroundColor: scoreColor(t.matchScore) }}>
                  <Text className='match-text'>匹配 {t.matchScore}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        {loading && <View className='loading-more'><Text>加载中...</Text></View>}
        {!loading && tasks.length === 0 && <View className='empty'><Text>暂无招募中的任务</Text></View>}

        {/* 下半区：按企业浏览 */}
        {groups.length > 0 && (
          <>
            <View className='section-divider'>
              <View className='divider-line' />
              <Text className='divider-text'>按企业浏览</Text>
              <View className='divider-line' />
            </View>
            {groups.map((g, gi) => (
              <View key={gi} className='company-group'>
                <View className='company-header'>
                  <Text className='company-name'>🏢 {g.company.name}</Text>
                  <Text className='company-count'>{g.tasks.length}个任务 →</Text>
                </View>
                <ScrollView className='company-tasks' scrollX>
                  {g.tasks.map(t => (
                    <View key={t.taskId} className='mini-task-card' onClick={() => goDetail(t.taskId)}>
                      <Text className='mini-title'>{t.title}</Text>
                      <Text className='mini-budget'>{formatBudget(t.totalBudget)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ))}
          </>
        )}

        <View className='bottom-padding' />
      </ScrollView>
    </View>
  )
}
