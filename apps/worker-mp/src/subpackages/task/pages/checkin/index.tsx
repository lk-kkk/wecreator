import { useState, useCallback } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../../../api/request'
import './index.scss'

const today = () => new Date().toISOString().slice(0, 10)
const formatTime = (d: Date) =>
  d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

interface CheckinRecord {
  checkinId: number
  checkinDate: string
  checkinTime: string | null
  checkoutTime: string | null
  status: string
  screenshotUrl: string | null
  workLog: string | null
  gpsLat: number | null
  gpsLng: number | null
}

interface Props {
  assignmentId: number
}

export default function DailyCheckinPage() {
  const params = Taro.getCurrentInstance().router?.params as any
  const assignmentId = Number(params?.assignmentId || 0)

  const [loading, setLoading] = useState(false)
  const [record, setRecord]   = useState<CheckinRecord | null>(null)
  const [workLog, setWorkLog] = useState('')
  const [screenshot, setScreenshot] = useState<string>('')
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)

  const statusLabel: Record<string, string> = {
    pending: '待企业确认', confirmed: '已确认',
    auto_confirmed: '自动确认', rejected: '已驳回',
  }
  const statusColor: Record<string, string> = {
    pending: '#faad14', confirmed: '#52c41a',
    auto_confirmed: '#8c8c8c', rejected: '#ff4d4f',
  }

  // ── 获取当日打卡记录 ──
  const loadRecord = useCallback(async () => {
    try {
      const res: any = await request({
        url: `/worker/tasks/${assignmentId}/checkins`,
        method: 'GET',
      })
      const list: CheckinRecord[] = (res.data?.list || [])
      const todayRecord = list.find(r => r.checkinDate.startsWith(today()))
      setRecord(todayRecord ?? null)
    } catch { /* ignore */ }
  }, [assignmentId])

  useState(() => { loadRecord() })

  // ── 获取 GPS ──
  const getLocation = () => {
    return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      Taro.getLocation({
        type: 'gcj02',
        success: (res) => resolve({ lat: res.latitude, lng: res.longitude }),
        fail:    () => reject(new Error('获取位置失败')),
      })
    })
  }

  // ── 选取截图 ──
  const chooseScreenshot = async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sourceType: ['camera', 'album'] })
      const path = res.tempFilePaths[0]
      setScreenshot(path)
    } catch {
      Taro.showToast({ title: '选择图片失败', icon: 'none' })
    }
  }

  // ── 上班打卡 ──
  const handleCheckin = async () => {
    setLoading(true)
    try {
      let loc: { lat: number; lng: number } | null = null
      try { loc = await getLocation() } catch { /* GPS optional */ }
      setGps(loc)

      const res: any = await request({
        url: `/worker/tasks/${assignmentId}/checkin`,
        method: 'POST',
        data: {
          checkinDate:   today(),
          gpsLat:        loc?.lat,
          gpsLng:        loc?.lng,
          screenshotUrl: screenshot || undefined,
          workLog:       workLog || undefined,
        },
      })
      Taro.showToast({ title: '上班打卡成功 ✅', icon: 'success' })
      await loadRecord()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '打卡失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // ── 下班签退 ──
  const handleCheckout = async () => {
    setLoading(true)
    try {
      await request({
        url: `/worker/tasks/${assignmentId}/checkout`,
        method: 'POST',
        data: {
          checkinDate:   today(),
          screenshotUrl: screenshot || undefined,
          workLog:       workLog || undefined,
        },
      })
      Taro.showToast({ title: '下班签退成功 ✅', icon: 'success' })
      await loadRecord()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '签退失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const hasCheckin  = !!record?.checkinTime
  const hasCheckout = !!record?.checkoutTime

  return (
    <ScrollView className='page' scrollY>
      {/* 日期标题 */}
      <View className='date-header'>
        <Text className='date-text'>{today()}</Text>
        <Text className='date-sub'>每日打卡</Text>
      </View>

      {/* 今日状态 */}
      {record && (
        <View className='status-card'>
          <View className='status-row'>
            <View
              className='status-dot'
              style={{ background: statusColor[record.status] }}
            />
            <Text className='status-text'>{statusLabel[record.status]}</Text>
          </View>
          <View className='time-row'>
            {record.checkinTime && (
              <View className='time-item'>
                <Text className='time-label'>上班</Text>
                <Text className='time-value'>{formatTime(new Date(record.checkinTime))}</Text>
              </View>
            )}
            {record.checkoutTime && (
              <View className='time-item'>
                <Text className='time-label'>下班</Text>
                <Text className='time-value'>{formatTime(new Date(record.checkoutTime))}</Text>
              </View>
            )}
          </View>
          {record.status === 'rejected' && (
            <Text className='reject-tip'>
              {record.workLog?.includes('[驳回原因]') ? record.workLog.split('\n')[0] : '打卡被驳回'}
            </Text>
          )}
        </View>
      )}

      {/* 截图上传 */}
      <View className='section-card'>
        <Text className='section-title'>工作截图</Text>
        <View className='screenshot-area' onClick={chooseScreenshot}>
          {screenshot ? (
            <Image className='screenshot-preview' src={screenshot} mode='aspectFill' />
          ) : (
            <View className='screenshot-placeholder'>
              <Text className='screenshot-icon'>📷</Text>
              <Text className='screenshot-tip'>点击上传截图</Text>
            </View>
          )}
        </View>
      </View>

      {/* 工作日志 */}
      <View className='section-card'>
        <Text className='section-title'>工作日志（选填）</Text>
        <textarea
          className='log-input'
          placeholder='今日完成了哪些工作？'
          value={workLog}
          onInput={(e: any) => setWorkLog(e.detail.value)}
          maxLength={500}
        />
        <Text className='log-count'>{workLog.length}/500</Text>
      </View>

      {/* GPS 状态 */}
      {gps && (
        <View className='gps-tip'>
          <Text>📍 GPS: {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</Text>
        </View>
      )}

      {/* 操作按钮 */}
      <View className='action-area'>
        {!hasCheckin && (
          <View
            className={`action-btn primary ${loading ? 'disabled' : ''}`}
            onClick={loading ? undefined : handleCheckin}
          >
            <Text className='btn-text'>{loading ? '打卡中...' : '📍 上班打卡'}</Text>
          </View>
        )}
        {hasCheckin && !hasCheckout && (
          <View
            className={`action-btn secondary ${loading ? 'disabled' : ''}`}
            onClick={loading ? undefined : handleCheckout}
          >
            <Text className='btn-text'>{loading ? '签退中...' : '🏁 下班签退'}</Text>
          </View>
        )}
        {hasCheckout && (
          <View className='completed-msg'>
            <Text className='completed-text'>✅ 今日打卡完成</Text>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
