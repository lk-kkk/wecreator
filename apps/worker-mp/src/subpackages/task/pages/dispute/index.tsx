import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../../../api/request'
import { chooseAndUploadImage, chooseAndUploadFile, fileIcon } from '../../../../api/oss'
import './index.scss'

interface Dispute {
  disputeId:    number
  taskId:       number
  assignmentId: number
  reason:       string
  evidenceUrls: string[]
  status:       string
  resolution:   string | null
  createdAt:    string
}

const STATUS_LABEL: Record<string, string> = {
  pending:          '待受理',
  investigating:    '仲裁中',
  resolved_company: '企业胜诉',
  resolved_worker:  '零工胜诉',
  resolved_split:   '按比例分摊',
  cancelled:        '已取消',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#faad14', investigating: '#1677ff',
  resolved_company: '#ff4d4f', resolved_worker: '#52c41a',
  resolved_split: '#13c2c2', cancelled: '#d9d9d9',
}

export default function DisputePage() {
  const params = Taro.getCurrentInstance().router?.params as any
  const assignmentId = Number(params?.assignmentId || 0)
  const taskId       = Number(params?.taskId || 0)

  const [tab,      setTab]      = useState<'new' | 'history'>('new')
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading,  setLoading]  = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 发起争议 form
  const [reason,   setReason]   = useState('')
  const [evidence, setEvidence] = useState<Array<{ url: string; name: string }>>([])
  const [uploadPct, setUploadPct] = useState(0)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await request({ url: '/disputes', method: 'GET', data: { pageSize: 20 } })
      setDisputes(res.data?.list || [])
    } catch { Taro.showToast({ title: '加载失败', icon: 'none' }) }
    finally { setLoading(false) }
  }, [])

  const handleAddImage = async () => {
    try {
      Taro.showLoading({ title: '上传中...' })
      const result = await chooseAndUploadImage('deliverable', (p) => setUploadPct(p))
      setEvidence(prev => [...prev, { url: result.cdnUrl, name: `图片_${Date.now()}.jpg` }])
      Taro.hideLoading()
    } catch (e: any) {
      Taro.hideLoading()
      Taro.showToast({ title: e?.message || '上传失败', icon: 'none' })
    }
  }

  const handleAddFile = async () => {
    try {
      Taro.showLoading({ title: '上传中...' })
      const result = await chooseAndUploadFile((p) => setUploadPct(p))
      setEvidence(prev => [...prev, { url: result.cdnUrl, name: result.name }])
      Taro.hideLoading()
    } catch (e: any) {
      Taro.hideLoading()
      Taro.showToast({ title: e?.message || '上传失败', icon: 'none' })
    }
  }

  const handleSubmit = async () => {
    if (!reason.trim()) { Taro.showToast({ title: '请填写争议原因', icon: 'none' }); return }
    setSubmitting(true)
    try {
      await request({
        url: '/disputes', method: 'POST',
        data: {
          taskId, assignmentId,
          reason,
          evidenceUrls: evidence.map(e => e.url),
        },
      })
      Taro.showToast({ title: '争议已发起 ✅', icon: 'success' })
      setReason(''); setEvidence([])
      setTab('history')
      loadHistory()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '发起失败', icon: 'none' })
    } finally { setSubmitting(false) }
  }

  // 加载历史
  useState(() => { loadHistory() })

  return (
    <ScrollView className='page' scrollY>
      {/* Tab 切换 */}
      <View className='tabs'>
        <View className={`tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>
          <Text>发起争议</Text>
        </View>
        <View className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => { setTab('history'); loadHistory() }}>
          <Text>我的争议</Text>
        </View>
      </View>

      {/* 发起争议 */}
      {tab === 'new' && (
        <View className='form-section'>
          <View className='section-card'>
            <Text className='section-title'>任务信息</Text>
            <View className='info-row'>
              <Text className='info-label'>任务ID</Text>
              <Text className='info-val'>{taskId || '—'}</Text>
            </View>
            <View className='info-row'>
              <Text className='info-label'>分配ID</Text>
              <Text className='info-val'>{assignmentId || '—'}</Text>
            </View>
          </View>

          <View className='section-card'>
            <Text className='section-title'>争议原因 *</Text>
            <textarea
              className='reason-input'
              placeholder='请详细描述争议内容，如：交付物质量不符合要求、工时确认存在异议等...'
              value={reason}
              onInput={(e: any) => setReason(e.detail.value)}
              maxLength={500}
            />
            <Text className='char-count'>{reason.length}/500</Text>
          </View>

          <View className='section-card'>
            <Text className='section-title'>上传证据（选填，最多10个）</Text>
            <View className='evidence-actions'>
              <View className='ev-btn' onClick={handleAddImage}>
                <Text className='ev-btn-icon'>🖼️</Text>
                <Text className='ev-btn-text'>添加图片</Text>
              </View>
              <View className='ev-btn' onClick={handleAddFile}>
                <Text className='ev-btn-icon'>📎</Text>
                <Text className='ev-btn-text'>添加文件</Text>
              </View>
            </View>

            {evidence.map((ev, i) => (
              <View key={i} className='ev-item'>
                <Text className='ev-icon'>{fileIcon(ev.name)}</Text>
                <Text className='ev-name'>{ev.name.slice(0, 25)}{ev.name.length > 25 ? '...' : ''}</Text>
                <Text className='ev-remove' onClick={() => setEvidence(prev => prev.filter((_, j) => j !== i))}>✕</Text>
              </View>
            ))}
          </View>

          <View className='submit-area'>
            <View
              className={`submit-btn ${submitting ? 'disabled' : ''}`}
              onClick={submitting ? undefined : handleSubmit}
            >
              <Text className='submit-text'>{submitting ? '提交中...' : '⚖️ 发起争议申请'}</Text>
            </View>
            <Text className='submit-tip'>仲裁平均处理时间 1-3 个工作日</Text>
          </View>
        </View>
      )}

      {/* 我的争议列表 */}
      {tab === 'history' && (
        <View className='history-section'>
          {loading && <Text className='loading-text'>加载中...</Text>}
          {!loading && disputes.length === 0 && (
            <View className='empty-box'>
              <Text className='empty-icon'>⚖️</Text>
              <Text className='empty-text'>暂无争议记录</Text>
            </View>
          )}
          {disputes.map(d => (
            <View key={d.disputeId} className='dispute-card'>
              <View className='dc-header'>
                <Text className='dc-id'>争议 #{d.disputeId}</Text>
                <View className='dc-status' style={{ background: STATUS_COLOR[d.status] + '20', borderColor: STATUS_COLOR[d.status] }}>
                  <Text className='dc-status-text' style={{ color: STATUS_COLOR[d.status] }}>
                    {STATUS_LABEL[d.status]}
                  </Text>
                </View>
              </View>
              <Text className='dc-reason'>{d.reason.slice(0, 80)}{d.reason.length > 80 ? '...' : ''}</Text>
              {d.resolution && (
                <View className='dc-resolution'>
                  <Text className='dc-res-label'>裁决说明：</Text>
                  <Text className='dc-res-text'>{d.resolution}</Text>
                </View>
              )}
              <Text className='dc-time'>{new Date(d.createdAt).toLocaleDateString('zh-CN')}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
