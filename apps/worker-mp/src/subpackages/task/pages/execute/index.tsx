import { useState, useEffect, useCallback } from 'react'
import { View, Text, Button, Slider, Input, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { request } from '../../../../api/request'
import { taskApi } from '../../../../api/task'
import './index.scss'

export default function TaskExecutePage() {
  const router = useRouter()
  const assignmentId = Number(router.params.id || 0)
  const taskId = Number(router.params.taskId || 0)

  const [detail, setDetail] = useState<any>(null)
  const [progress, setProgress] = useState(0)
  const [progressNote, setProgressNote] = useState('')
  // V3.7: 结构化日报字段
  const [dailySummary, setDailySummary] = useState('')
  const [tomorrowPlan, setTomorrowPlan] = useState('')
  const [issues, setIssues] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [acceptanceRequesting, setAcceptanceRequesting] = useState(false)

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

  // 更新进度 + V3.7 结构化日报
  const handleUpdateProgress = useCallback(async () => {
    if (submitting) return
    // if (dailySummary && (dailySummary.length < 50 || dailySummary.length > 500)) {
    //   Taro.showToast({ title: '今日摘要需 50-500 字', icon: 'none' })
    //   return
    // }
    setSubmitting(true)
    try {
      await taskApi.updateProgress(assignmentId, {
        progress,
        note: progressNote,
        dailySummary: dailySummary || undefined,
        tomorrowPlan: tomorrowPlan || undefined,
        issues: issues || undefined,
      })
      Taro.showToast({ title: '进度已更新', icon: 'success' })
      setProgressNote('')
      setDailySummary('')
      setTomorrowPlan('')
      setIssues('')
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '更新失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [assignmentId, progress, progressNote, dailySummary, tomorrowPlan, issues, submitting])

  // V3.9: 发起验收申请
  const handleRequestAcceptance = useCallback(async () => {
    if (acceptanceRequesting) return
    const { confirm } = await Taro.showModal({
      title: '发起验收申请',
      content: '确认已完成所有工作并发起验收申请？企业将收到验收通知。',
      confirmText: '确认发起',
      confirmColor: '#52c41a',
    })
    if (!confirm) return
    setAcceptanceRequesting(true)
    try {
      await taskApi.requestAcceptance(assignmentId)
      Taro.showToast({ title: '验收申请已发送 ✅', icon: 'success' })
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '申请失败', icon: 'none' })
    } finally {
      setAcceptanceRequesting(false)
    }
  }, [assignmentId, acceptanceRequesting])

  // 上传交付物
  const handleUploadDeliverable = useCallback(async () => {
    try {
      const chooseRes = await Taro.chooseMessageFile({
        count: 1,
        type: 'file',
      })
      const file = chooseRes.tempFiles[0]
      if (!file) return

      Taro.showLoading({ title: '上传中...' })

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
        finalUrl = file.path
      }

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

      {/* 进度更新 + V3.7 结构化日报 */}
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

        <Text className='card-title' style={{ marginTop: 16 }}>📌 今日工作摘要</Text>
        <Textarea
          className='note-input'
          placeholder='摘要今日完成的主要工作'
          value={dailySummary}
          maxlength={500}
          onInput={(e: any) => setDailySummary(e.detail.value)}
          style={{ minHeight: '80px', padding: '8px', width: '100%' }}
        />

        <Text className='card-title' style={{ marginTop: 12 }}>🎯 明日计划</Text>
        <Textarea
          className='note-input'
          placeholder='明日准备做的工作（选填）'
          value={tomorrowPlan}
          maxlength={500}
          onInput={(e: any) => setTomorrowPlan(e.detail.value)}
          style={{ minHeight: '60px', padding: '8px', width: '100%' }}
        />

        <Text className='card-title' style={{ marginTop: 12 }}>⚠️ 遇到的问题</Text>
        <Textarea
          className='note-input'
          placeholder='有阻塞或困难请填写（选填）'
          value={issues}
          maxlength={500}
          onInput={(e: any) => setIssues(e.detail.value)}
          style={{ minHeight: '60px', padding: '8px', width: '100%' }}
        />

        <Button
          className='primary-btn'
          onClick={handleUpdateProgress}
          loading={submitting}
          disabled={submitting || progress <= (detail?.progress ?? 0)}
        >
          提交日报
        </Button>
      </View>

      {/* V3.7: 任务级功能入口 */}
      {taskId > 0 && (
        <View className='card'>
          <Text className='card-title'>关联功能</Text>
          <View style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            <Button
              className='upload-btn'
              onClick={() => Taro.navigateTo({ url: `/subpackages/task/pages/checkpoint-submit/index?taskId=${taskId}` })}
            >📋 提交检查点</Button>
            <Button
              className='upload-btn'
              onClick={() => Taro.navigateTo({ url: `/subpackages/task/pages/issue-report/index?taskId=${taskId}` })}
            >⚠️ 上报问题</Button>
            <Button
              className='upload-btn'
              onClick={() => Taro.navigateTo({ url: `/subpackages/task/pages/comments/index?taskId=${taskId}` })}
            >💬 任务讨论</Button>
          </View>
        </View>
      )}

      {/* 提交交付物 */}
      <View className='card'>
        <Text className='card-title'>提交交付物</Text>
        <Text className='hint-text'>支持图片、压缩包、PDF 等文件格式</Text>
        <Button className='upload-btn' onClick={handleUploadDeliverable}>
          选择文件并上传
        </Button>
      </View>

      {/* V3.9: 发起验收申请（进度 100% 时显示） */}
      {progress >= 100 && (
        <View className='card' style={{ borderColor: '#52c41a', borderWidth: 1, borderStyle: 'solid' }}>
          <Text className='card-title'>✅ 任务已完成</Text>
          <Text className='hint-text'>工作已全部完成，可以发起验收申请，通知企业进行验收确认</Text>
          <Button
            className='primary-btn'
            style={{ backgroundColor: '#52c41a', marginTop: 12 }}
            onClick={handleRequestAcceptance}
            loading={acceptanceRequesting}
            disabled={acceptanceRequesting}
          >
            📩 发起验收申请
          </Button>
        </View>
      )}
    </View>
  )
}
