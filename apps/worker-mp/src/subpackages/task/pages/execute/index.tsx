import { useState, useEffect, useCallback } from 'react'
import { View, Text, Button, Slider, Input } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { request } from '../../../../api/request'
import './index.scss'

export default function TaskExecutePage() {
  const router = useRouter()
  const assignmentId = Number(router.params.id || 0)

  const [detail, setDetail] = useState<any>(null)
  const [progress, setProgress] = useState(0)
  const [progressNote, setProgressNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!assignmentId) return
    request<any>({ url: `/worker/assignments/${assignmentId}`, method: 'GET' })
      .then((res: any) => {
        const d = res.data ?? res
        setDetail(d)
        setProgress(d.progress ?? 0)
      })
      .catch(() => {})
  }, [assignmentId])

  // ──────────────────── 更新进度 ────────────────────
  const handleUpdateProgress = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await request({
        url: `/worker/tasks/${assignmentId}/progress`,
        method: 'POST',
        data: { progress, note: progressNote },
      })
      Taro.showToast({ title: '进度已更新', icon: 'success' })
      setProgressNote('')
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '更新失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [assignmentId, progress, progressNote, submitting])

  // ──────────────────── 上传交付物 ────────────────────
  const handleUploadDeliverable = useCallback(async () => {
    try {
      const chooseRes = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
      })
      const file = chooseRes.tempFiles[0]
      if (!file) return

      Taro.showLoading({ title: '上传中...' })

      // 获取预签名 URL
      const presignRes: any = await request({
        url: '/common/upload/presign',
        method: 'POST',
        data: {
          category: 'deliverable',
          originalName: file.name,
          fileSize: file.size,
        },
      })
      const presignData = presignRes.data ?? presignRes

      // 直传到 OSS（如未配置 OSS，使用 fileUrl 作为 mock）
      let finalUrl: string
      if (presignData.uploadUrl) {
        await Taro.request({
          url: presignData.uploadUrl,
          method: 'PUT',
          data: file.path,
          header: { 'Content-Type': file.type || 'application/octet-stream' },
        })
        finalUrl = presignData.fileUrl
      } else {
        // OSS 未配置时，使用本地路径作为占位
        finalUrl = file.path
      }

      // 提交交付物记录
      await request({
        url: `/worker/tasks/${assignmentId}/deliverables`,
        method: 'POST',
        data: {
          fileUrl: finalUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
      })

      Taro.hideLoading()
      Taro.showToast({ title: '交付物已提交', icon: 'success' })
    } catch (err: any) {
      Taro.hideLoading()
      Taro.showToast({ title: err?.message || '上传失败', icon: 'none' })
    }
  }, [assignmentId])

  return (
    <View className='page'>
      {/* 任务信息概览 */}
      <View className='card'>
        <Text className='card-title'>{detail?.taskTitle || '任务执行'}</Text>
        <View className='info-row'>
          <Text className='label'>角色</Text>
          <Text className='value'>{detail?.roleName || '—'}</Text>
        </View>
        <View className='info-row'>
          <Text className='label'>报酬</Text>
          <Text className='value red'>¥{detail?.budget || '—'}</Text>
        </View>
        <View className='info-row'>
          <Text className='label'>截止时间</Text>
          <Text className='value'>{detail?.endDate ? detail.endDate.slice(0, 10) : '—'}</Text>
        </View>
      </View>

      {/* 进度更新 */}
      <View className='card'>
        <Text className='card-title'>更新进度</Text>
        <View className='progress-row'>
          <Text className='progress-label'>当前进度: {progress}%</Text>
        </View>
        <Slider
          value={progress}
          min={detail?.progress ?? 0}
          max={100}
          step={5}
          onChange={(e: any) => setProgress(e.detail.value)}
          blockSize={18}
          activeColor='#0858F4'
        />
        <Input
          className='note-input'
          placeholder='进度备注（选填）'
          value={progressNote}
          onInput={(e: any) => setProgressNote(e.detail.value)}
        />
        <Button
          className='primary-btn'
          onClick={handleUpdateProgress}
          loading={submitting}
          disabled={submitting || progress <= (detail?.progress ?? 0)}
        >
          提交进度
        </Button>
      </View>

      {/* 提交交付物 */}
      <View className='card'>
        <Text className='card-title'>提交交付物</Text>
        <Text className='hint-text'>支持图片、压缩包、PDF 等文件格式</Text>
        <Button className='upload-btn' onClick={handleUploadDeliverable}>
          选择文件并上传
        </Button>
      </View>
    </View>
  )
}
