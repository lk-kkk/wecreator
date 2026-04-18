import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { wxLogin, devLogin, isLoggedIn } from '../../utils/wx-login'
import { request } from '../../api/request'
import './index.scss'

const STATUS_TABS = [
  { key: 'invited',    label: '待响应' },
  { key: 'accepted',   label: '进行中' },
  { key: 'completed',  label: '已完成' },
] as const

const statusBadge: Record<string, { label: string; color: string }> = {
  invited:   { label: '待接单', color: '#faad14' },
  accepted:  { label: '执行中', color: '#1677ff' },
  rejected:  { label: '已拒绝', color: '#ff4d4f' },
  expired:   { label: '已过期', color: '#d9d9d9' },
  completed: { label: '已完成', color: '#52c41a' },
}

const modeLabel: Record<string, string> = {
  task_package: '任务包',
  daily_rate: '人天制',
}

export default function IndexPage() {
  const [loading, setLoading] = useState(false)
  const [logged, setLogged] = useState(isLoggedIn())
  const [activeTab, setActiveTab] = useState<string>('invited')
  const [tasks, setTasks] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const handleLogin = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const result = await wxLogin()
      setLogged(true)
      if (result.isNew || !result.isVerified) {
        Taro.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateTo({ url: '/subpackages/auth/pages/profile-edit/index' })
        }, 1500)
      } else {
        Taro.showToast({ title: '欢迎回来', icon: 'success' })
      }
    } catch (err: any) {
      Taro.showToast({ title: err.message || '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [loading])

  // 加载任务列表
  const loadTasks = useCallback(async (status: string) => {
    setRefreshing(true)
    try {
      const res: any = await request({ url: '/worker/tasks', method: 'GET', data: { status } })
      setTasks(res || [])
    } catch {
      // 忽略
    } finally {
      setRefreshing(false)
    }
  }, [])

  // 切换 Tab
  const switchTab = useCallback((key: string) => {
    setActiveTab(key)
    loadTasks(key)
  }, [loadTasks])

  // 首次加载 & 页面切回时刷新
  useEffect(() => {
    if (logged) loadTasks(activeTab)
  }, [logged])

  useDidShow(() => {
    if (logged) loadTasks(activeTab)
  })

  // 跳转任务
  const goTask = (item: any) => {
    if (item.status === 'invited') {
      Taro.navigateTo({ url: `/subpackages/task/pages/detail/index?id=${item.assignmentId}` })
    } else {
      Taro.navigateTo({ url: `/subpackages/task/pages/execute/index?id=${item.assignmentId}` })
    }
  }

  // 开发环境调试登录
  const handleDevLogin = useCallback(async () => {
    const { content, confirm } = await (Taro.showModal as any)({
      title: '🔧 开发调试登录',
      editable: true,
      placeholderText: '输入 code（如 demo_worker_2026）',
      confirmText: '登录',
    })
    if (!confirm || !content?.trim()) return
    setLoading(true)
    try {
      const result = await devLogin(content.trim())
      setLogged(true)
      Taro.showToast({ title: `调试登录成功`, icon: 'success' })
    } catch (err: any) {
      Taro.showToast({ title: err.message || '登录失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [loading])

  // ───────── 未登录 ─────────
  if (!logged) {
    return (
      <View className='login-page'>
        <View className='login-brand'>
          <Text className='brand-name' onLongPress={handleDevLogin}>WeCreator</Text>
          <Text className='brand-desc'>连接企业与创意零工的协作平台</Text>
        </View>
        {/* 开发调试快捷入口 */}
        <View className='dev-entry' onClick={handleDevLogin}>
          <Text className='dev-entry-text'>🔧 开发调试登录</Text>
        </View>
        <View className='login-features'>
          <View className='feature-item'>
            <Text className='feature-icon'>💼</Text>
            <Text className='feature-text'>海量创意项目</Text>
          </View>
          <View className='feature-item'>
            <Text className='feature-icon'>💰</Text>
            <Text className='feature-text'>合规结算保障</Text>
          </View>
          <View className='feature-item'>
            <Text className='feature-icon'>⭐</Text>
            <Text className='feature-text'>积累个人品牌</Text>
          </View>
        </View>
        <View className='login-actions'>
          <View className={`login-btn ${loading ? 'loading' : ''}`} onClick={handleLogin}>
            <Text className='login-btn-text'>{loading ? '登录中...' : '微信一键登录'}</Text>
          </View>
          <Text className='login-agreement'>登录即表示同意《用户协议》和《隐私政策》</Text>
        </View>
      </View>
    )
  }

  // ───────── 已登录：任务列表 ─────────
  return (
    <View className='page'>
      <View className='task-header'>
        <Text className='task-title'>我的任务</Text>
        <Text className='recommend-link' onClick={() => Taro.navigateTo({ url: '/pages/home/recommend' })}>
          发现推荐 →
        </Text>
      </View>

      {/* Tab 栏 */}
      <View className='task-tabs'>
        {STATUS_TABS.map(t => (
          <View
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => switchTab(t.key)}
          >
            <Text className='tab-text'>{t.label}</Text>
            {activeTab === t.key && <View className='tab-bar' />}
          </View>
        ))}
      </View>

      {/* 任务列表 */}
      <ScrollView
        className='task-list'
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={() => loadTasks(activeTab)}
      >
        {tasks.length === 0 ? (
          <View className='empty-state'>
            <Text className='empty-icon'>{activeTab === 'invited' ? '📩' : activeTab === 'accepted' ? '🚀' : '✅'}</Text>
            <Text className='empty-text'>
              {activeTab === 'invited' ? '暂无待响应任务' : activeTab === 'accepted' ? '暂无进行中任务' : '暂无已完成任务'}
            </Text>
            <Text className='empty-hint'>
              {activeTab === 'invited' ? '完善个人资料，提高被邀约概率' : ''}
            </Text>
          </View>
        ) : (
          tasks.map((item: any) => (
            <View key={item.assignmentId} className='task-card' onClick={() => goTask(item)}>
              <View className='card-top'>
                <Text className='card-title'>{item.task?.title || '未命名任务'}</Text>
                <View className='status-tag' style={{ background: statusBadge[item.status]?.color || '#ccc' }}>
                  <Text className='status-text'>{statusBadge[item.status]?.label || item.status}</Text>
                </View>
              </View>

              <View className='card-info'>
                <View className='info-item'>
                  <Text className='info-label'>角色</Text>
                  <Text className='info-value'>{item.role?.roleName || '—'}</Text>
                </View>
                <View className='info-item'>
                  <Text className='info-label'>报酬</Text>
                  <Text className='info-value price'>¥{(item.role?.budget || 0).toLocaleString()}</Text>
                </View>
                <View className='info-item'>
                  <Text className='info-label'>模式</Text>
                  <Text className='info-value'>{modeLabel[item.task?.taskMode] || '—'}</Text>
                </View>
              </View>

              {item.status === 'accepted' && (
                <View className='progress-row'>
                  <View className='progress-bg'>
                    <View className='progress-fill' style={{ width: `${item.progress || 0}%` }} />
                  </View>
                  <Text className='progress-text'>{item.progress || 0}%</Text>
                </View>
              )}

              {item.status === 'invited' && (
                <View className='card-footer'>
                  <Text className='invite-hint'>⏰ 请尽快响应邀约</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
