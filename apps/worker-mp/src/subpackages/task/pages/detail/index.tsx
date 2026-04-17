import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { request } from '../../../../api/request'
import './index.scss'

const modeLabel: Record<string, string> = { task_package: '📦 任务包', daily_rate: '📅 人天制' }

export default function TaskDetailPage() {
  const router = useRouter()
  const assignmentId = Number(router.params.id || 0)
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  // 加载任务详情
  const loadDetail = useCallback(async () => {
    if (!assignmentId) return
    setLoading(true)
    try {
      // 获取该 assignment 关联的任务信息
      const tasks: any[] = await request({ url: '/worker/tasks', method: 'GET' })
      const found = tasks.find((t: any) => t.assignmentId === assignmentId)
      if (found) {
        setDetail(found)
      }
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => { loadDetail() }, [])

  const handleAccept = useCallback(async () => {
    if (acting) return
    setActing(true)
    try {
      await request({ url: `/worker/tasks/${assignmentId}/accept`, method: 'POST' })
      Taro.showToast({ title: '🎉 接单成功！', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
    } finally {
      setActing(false)
    }
  }, [assignmentId, acting])

  const handleReject = useCallback(async () => {
    if (acting) return
    const { confirm } = await Taro.showModal({
      title: '确认婉拒',
      content: '婉拒后该邀约将关闭，确定吗？',
      confirmText: '确认婉拒',
      confirmColor: '#ff4d4f',
    })
    if (!confirm) return

    setActing(true)
    try {
      await request({ url: `/worker/tasks/${assignmentId}/reject`, method: 'POST' })
      Taro.showToast({ title: '已婉拒', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '操作失败', icon: 'none' })
    } finally {
      setActing(false)
    }
  }, [assignmentId, acting])

  if (loading) {
    return (
      <View className='page loading-page'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    )
  }

  if (!detail) {
    return (
      <View className='page loading-page'>
        <Text className='loading-text'>未找到任务信息</Text>
      </View>
    )
  }

  const isInvited = detail.status === 'invited'

  return (
    <View className='page'>
      <ScrollView className='scroll-area' scrollY>
        {/* 顶部标题区 */}
        <View className='header-card'>
          <View className='invite-badge'>
            <Text className='invite-badge-text'>{isInvited ? '📩 任务邀约' : '📋 任务详情'}</Text>
          </View>
          <Text className='task-name'>{detail.task?.title || '未命名任务'}</Text>
          {isInvited && (
            <Text className='invite-tip'>您收到了一个新的任务邀约，请尽快响应</Text>
          )}
        </View>

        {/* 任务信息卡片 */}
        <View className='info-card'>
          <View className='info-row'>
            <Text className='info-icon'>🎭</Text>
            <View className='info-content'>
              <Text className='info-label'>角色岗位</Text>
              <Text className='info-value'>{detail.role?.roleName || '—'}</Text>
            </View>
          </View>

          <View className='info-row'>
            <Text className='info-icon'>💰</Text>
            <View className='info-content'>
              <Text className='info-label'>项目报酬</Text>
              <Text className='info-value price'>¥{(detail.role?.budget || 0).toLocaleString()}</Text>
            </View>
          </View>

          <View className='info-row'>
            <Text className='info-icon'>📂</Text>
            <View className='info-content'>
              <Text className='info-label'>任务模式</Text>
              <Text className='info-value'>{modeLabel[detail.task?.taskMode] || '—'}</Text>
            </View>
          </View>

          <View className='info-row'>
            <Text className='info-icon'>📊</Text>
            <View className='info-content'>
              <Text className='info-label'>任务状态</Text>
              <Text className='info-value'>{detail.task?.status || '—'}</Text>
            </View>
          </View>

          {detail.invitedAt && (
            <View className='info-row'>
              <Text className='info-icon'>📅</Text>
              <View className='info-content'>
                <Text className='info-label'>邀约时间</Text>
                <Text className='info-value'>{new Date(detail.invitedAt).toLocaleString('zh-CN')}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 注意事项 */}
        {isInvited && (
          <View className='notice-card'>
            <Text className='notice-title'>📌 接单须知</Text>
            <Text className='notice-text'>• 接单后请在规定时间内完成任务交付</Text>
            <Text className='notice-text'>• 任务过程中可随时与企业沟通</Text>
            <Text className='notice-text'>• 交付物经企业验收后将自动结算到钱包</Text>
            <Text className='notice-text'>• 如有争议可通过仲裁机制解决</Text>
          </View>
        )}

        {/* 非邀约状态：显示进度 */}
        {detail.status === 'accepted' && (
          <View className='progress-card'>
            <Text className='progress-label'>当前进度</Text>
            <View className='progress-bar-bg'>
              <View className='progress-bar-fill' style={{ width: `${detail.progress || 0}%` }} />
            </View>
            <Text className='progress-pct'>{detail.progress || 0}%</Text>
            <View
              className='go-execute-btn'
              onClick={() => Taro.redirectTo({ url: `/subpackages/task/pages/execute/index?id=${assignmentId}` })}
            >
              <Text className='go-execute-text'>进入执行 →</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 底部操作栏（仅邀约状态显示） */}
      {isInvited && (
        <View className='action-bar'>
          <View className='reject-btn' onClick={handleReject}>
            <Text className='reject-btn-text'>婉拒</Text>
          </View>
          <View className={`accept-btn ${acting ? 'disabled' : ''}`} onClick={handleAccept}>
            <Text className='accept-btn-text'>{acting ? '处理中...' : '✅ 接受邀约'}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
