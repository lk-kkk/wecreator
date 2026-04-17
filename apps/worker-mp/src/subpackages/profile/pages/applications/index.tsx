/**
 * V3.4 — 我的申请记录
 */
import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { workerApplicationApi, type WorkerApplication } from '../../../../api/marketplace'
import './index.scss'

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: '#faad14' },
  approved: { label: '已通过', color: '#52c41a' },
  rejected: { label: '已婉拒', color: '#ff4d4f' },
}

const modeLabel: Record<string, string> = { task_package: '任务包', daily_rate: '人天' }

const TABS = [
  { key: '', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已婉拒' },
]

export default function ApplicationsPage() {
  const [activeTab, setActiveTab] = useState('')
  const [list, setList] = useState<WorkerApplication[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async (status = '') => {
    setLoading(true)
    try {
      const res = await workerApplicationApi.list(status || undefined)
      setList(res.list ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useDidShow(() => loadData(activeTab))

  const switchTab = (key: string) => {
    setActiveTab(key)
    loadData(key)
  }

  const handleReapply = async (app: WorkerApplication) => {
    Taro.navigateTo({
      url: `/subpackages/marketplace/pages/detail/index?id=${app.task.taskId}`,
    })
  }

  return (
    <View className='applications-page'>
      {/* Tab 切换 */}
      <View className='app-tabs'>
        {TABS.map(t => (
          <View key={t.key}
            className={`app-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => switchTab(t.key)}>
            <Text className='app-tab-text'>{t.label}</Text>
            {activeTab === t.key && <View className='tab-indicator' />}
          </View>
        ))}
      </View>

      {/* 列表 */}
      {loading && <View className='loading-text'><Text>加载中...</Text></View>}

      {!loading && list.length === 0 && (
        <View className='empty-state'>
          <Text className='empty-icon'>📋</Text>
          <Text className='empty-text'>暂无申请记录</Text>
        </View>
      )}

      {!loading && list.map(app => {
        const st = statusMap[app.status] || { label: app.status, color: '#999' }
        return (
          <View key={app.applicationId} className='app-card'>
            <View className='app-header'>
              <Text className='app-task-title'>{app.task.title}</Text>
              <View className='app-status-badge' style={{ backgroundColor: st.color }}>
                <Text className='app-status-text'>{st.label}</Text>
              </View>
            </View>
            <View className='app-meta'>
              <Text className='app-company'>🏢 {app.task.company.name}</Text>
              <Text className='app-role'>· {app.role.roleName}</Text>
              <Text className='app-mode'>· {modeLabel[app.task.taskMode] || app.task.taskMode}</Text>
            </View>
            <View className='app-content'>
              <Text className='app-intro'>"{app.intro}"</Text>
              {app.expectPay && <Text className='app-pay'>期望: ¥{app.expectPay.toLocaleString()}</Text>}
            </View>
            <View className='app-footer'>
              <Text className='app-time'>
                申请于 {new Date(app.createdAt).toLocaleDateString()}
                {app.reviewedAt && ` · 审核于 ${new Date(app.reviewedAt).toLocaleDateString()}`}
              </Text>
            </View>

            {/* 婉拒原因 + 重新申请按钮 */}
            {app.status === 'rejected' && (
              <View className='reject-section'>
                {app.rejectReason && (
                  <View className='reject-reason'>
                    <Text className='reject-label'>婉拒原因：</Text>
                    <Text className='reject-text'>{app.rejectReason}</Text>
                  </View>
                )}
                <View className='reapply-btn' onClick={() => handleReapply(app)}>
                  <Text className='reapply-text'>重新申请</Text>
                </View>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}
