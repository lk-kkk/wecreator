import { useState, useEffect } from 'react'
import { View, Text, Button, Textarea } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { request } from '../../../../api/request'

interface Checkpoint {
  id: number
  name: string
  type: string
  plannedDate: string
  status: string
  description?: string
  revisionCount: number
}

export default function CheckpointSubmitPage() {
  const router = useRouter()
  const taskId = Number(router.params.taskId || 0)

  const [list, setList] = useState<Checkpoint[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCp, setActiveCp] = useState<Checkpoint | null>(null)
  const [submitContent, setSubmitContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const res: any = await request({ url: `/tasks/${taskId}/checkpoints`, method: 'GET' })
      setList(res.data ?? res ?? [])
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [taskId])

  const handleSubmit = async () => {
    if (!activeCp) return
    if (!submitContent.trim()) {
      Taro.showToast({ title: '请填写检查内容', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await request({
        url: `/tasks/${taskId}/checkpoints/${activeCp.id}/submit`,
        method: 'POST',
        data: { submitContent },
      })
      Taro.showToast({ title: '已提交', icon: 'success' })
      setActiveCp(null)
      setSubmitContent('')
      fetchList()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const statusText = (s: string) =>
    ({ pending: '⭕ 待检查', submitted: '📤 已提交', passed: '✅ 已通过', rejected: '❌ 不通过', overdue: '⏰ 已逾期' } as any)[s] || s
  const statusColor = (s: string) =>
    ({ pending: '#999', submitted: '#1890ff', passed: '#52c41a', rejected: '#ff4d4f', overdue: '#fa541c' } as any)[s] || '#999'
  const typeText = (t: string) => (t === 'progress_check' ? '进度检查' : '质量卡点')

  return (
    <View style={{ padding: '12px', minHeight: '100vh', background: '#f5f5f5' }}>
      {activeCp ? (
        <View style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
          <Text style={{ fontSize: '16px', fontWeight: 'bold' }}>{activeCp.name}</Text>
          <View style={{ marginTop: '8px', color: '#666', fontSize: '13px' }}>
            <Text>{typeText(activeCp.type)} · 计划: {activeCp.plannedDate?.slice(0, 10)}</Text>
          </View>
          {activeCp.description && (
            <View style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontSize: '13px' }}>
              <Text>📝 {activeCp.description}</Text>
            </View>
          )}
          <Text style={{ display: 'block', marginTop: '16px', fontWeight: 'bold' }}>提交内容</Text>
          <Textarea
            placeholder='填写本次检查点完成情况'
            value={submitContent}
            maxlength={2000}
            onInput={(e: any) => setSubmitContent(e.detail.value)}
            style={{ width: '100%', minHeight: '120px', padding: '8px', marginTop: '8px', border: '1px solid #e8e8e8', borderRadius: '4px' }}
          />
          <View style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <Button style={{ flex: 1 }} onClick={() => setActiveCp(null)}>取消</Button>
            <Button type='primary' style={{ flex: 1 }} loading={submitting} onClick={handleSubmit}>提交</Button>
          </View>
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: '14px', color: '#666', padding: '8px 4px' }}>
            共 {list.length} 个检查点
          </Text>
          {list.length === 0 && !loading && (
            <View style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
              <Text>暂无检查点</Text>
            </View>
          )}
          {list.map((cp) => (
            <View
              key={cp.id}
              style={{
                background: '#fff',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '8px',
                borderLeft: `3px solid ${statusColor(cp.status)}`,
              }}
              onClick={() => cp.status === 'pending' || cp.status === 'rejected' ? setActiveCp(cp) : null}
            >
              <Text style={{ fontSize: '15px', fontWeight: 'bold' }}>{cp.name}</Text>
              <View style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
                <Text>{typeText(cp.type)} · {cp.plannedDate?.slice(0, 10)}</Text>
              </View>
              <View style={{ marginTop: '4px' }}>
                <Text style={{ fontSize: '12px', color: statusColor(cp.status) }}>{statusText(cp.status)}</Text>
                {cp.revisionCount > 0 && <Text style={{ fontSize: '12px', color: '#faad14', marginLeft: '8px' }}>第 {cp.revisionCount + 1} 次</Text>}
              </View>
              {(cp.status === 'pending' || cp.status === 'rejected') && (
                <Text style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: '#1890ff' }}>
                  点击提交 →
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
