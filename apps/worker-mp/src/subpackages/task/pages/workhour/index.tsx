import { useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../../../api/request'
import './index.scss'

interface CheckinRecord {
  checkinId: number
  checkinDate: string
  checkinTime: string | null
  checkoutTime: string | null
  status: 'pending' | 'confirmed' | 'auto_confirmed' | 'rejected'
  workLog: string | null
}

export default function WorkHourStatusPage() {
  const params = Taro.getCurrentInstance().router?.params as any
  const assignmentId = Number(params?.assignmentId || 0)

  const [records, setRecords] = useState<CheckinRecord[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)

  const statusLabel: Record<string, string> = {
    pending: '待确认', confirmed: '已确认',
    auto_confirmed: '自动确认', rejected: '已驳回',
  }
  const statusColor: Record<string, string> = {
    pending: '#faad14', confirmed: '#52c41a',
    auto_confirmed: '#8c8c8c', rejected: '#ff4d4f',
  }
  const statusIcon: Record<string, string> = {
    pending: '⏳', confirmed: '✅', auto_confirmed: '🔄', rejected: '❌',
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await request({
        url: `/worker/tasks/${assignmentId}/checkins`,
        method: 'GET',
        data: { pageSize: 50 },
      })
      setRecords(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useState(() => { load() })

  const confirmed = records.filter(r => r.status === 'confirmed' || r.status === 'auto_confirmed').length
  const pending   = records.filter(r => r.status === 'pending').length
  const rejected  = records.filter(r => r.status === 'rejected').length

  const formatDate = (d: string) => {
    const date = new Date(d)
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }
  const formatWeekday = (d: string) => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[new Date(d).getDay()]
  }
  const formatTime = (d: string | null) =>
    d ? new Date(d).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '—'

  if (loading) {
    return (
      <View className='page loading'>
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <ScrollView className='page' scrollY>
      {/* 汇总统计 */}
      <View className='summary-card'>
        <View className='summary-item'>
          <Text className='summary-num'>{total}</Text>
          <Text className='summary-label'>总出勤</Text>
        </View>
        <View className='summary-divider' />
        <View className='summary-item'>
          <Text className='summary-num confirmed'>{confirmed}</Text>
          <Text className='summary-label'>已确认</Text>
        </View>
        <View className='summary-divider' />
        <View className='summary-item'>
          <Text className='summary-num pending'>{pending}</Text>
          <Text className='summary-label'>待确认</Text>
        </View>
        <View className='summary-divider' />
        <View className='summary-item'>
          <Text className='summary-num rejected'>{rejected}</Text>
          <Text className='summary-label'>已驳回</Text>
        </View>
      </View>

      {/* 时间轴 */}
      <View className='timeline-section'>
        <Text className='section-title'>打卡时间轴</Text>
        {records.length === 0 && (
          <View className='empty-box'>
            <Text className='empty-text'>暂无打卡记录</Text>
          </View>
        )}
        {records.map((r, idx) => (
          <View key={r.checkinId} className='timeline-item'>
            {/* 竖线 */}
            {idx < records.length - 1 && <View className='timeline-line' />}

            {/* 节点圆圈 */}
            <View
              className='timeline-dot'
              style={{ borderColor: statusColor[r.status] }}
            >
              <Text className='dot-icon'>{statusIcon[r.status]}</Text>
            </View>

            {/* 内容卡片 */}
            <View className='timeline-card'>
              <View className='card-header'>
                <View className='date-info'>
                  <Text className='date-main'>{formatDate(r.checkinDate)}</Text>
                  <Text className='date-week'>{formatWeekday(r.checkinDate)}</Text>
                </View>
                <View
                  className='status-badge'
                  style={{ background: statusColor[r.status] + '20', borderColor: statusColor[r.status] }}
                >
                  <Text className='status-text' style={{ color: statusColor[r.status] }}>
                    {statusLabel[r.status]}
                  </Text>
                </View>
              </View>

              <View className='time-row'>
                <View className='time-item'>
                  <Text className='time-label'>上班</Text>
                  <Text className='time-val'>{formatTime(r.checkinTime)}</Text>
                </View>
                {r.checkoutTime && (
                  <View className='time-item'>
                    <Text className='time-label'>下班</Text>
                    <Text className='time-val'>{formatTime(r.checkoutTime)}</Text>
                  </View>
                )}
              </View>

              {r.workLog && (
                <Text className='work-log'>{r.workLog.slice(0, 80)}{r.workLog.length > 80 ? '...' : ''}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}
