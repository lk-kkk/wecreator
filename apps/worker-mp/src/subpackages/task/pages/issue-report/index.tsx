import { useState, useEffect } from 'react'
import { View, Text, Button, Input, Textarea, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { request } from '../../../../api/request'

interface TaskIssue {
  id: number
  title: string
  type: string
  description: string
  status: string
  response?: string
  createdAt: string
}

const ISSUE_TYPES = [
  { value: 'requirement_unclear', label: '需求不明确' },
  { value: 'technical_block', label: '技术障碍' },
  { value: 'resource_missing', label: '资源缺失' },
  { value: 'other', label: '其他' },
]

export default function IssueReportPage() {
  const router = useRouter()
  const taskId = Number(router.params.taskId || 0)

  const [list, setList] = useState<TaskIssue[]>([])
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [typeIdx, setTypeIdx] = useState(0)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = async () => {
    if (!taskId) return
    try {
      const res: any = await request({ url: `/tasks/${taskId}/issues`, method: 'GET' })
      setList(res.data ?? res ?? [])
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '加载失败', icon: 'none' })
    }
  }

  useEffect(() => {
    fetchList()
  }, [taskId])

  const handleSubmit = async () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请填写标题', icon: 'none' })
      return
    }
    if (description.length < 50) {
      Taro.showToast({ title: '描述至少 50 字', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await request({
        url: `/tasks/${taskId}/issues`,
        method: 'POST',
        data: {
          title: title.trim(),
          type: ISSUE_TYPES[typeIdx].value,
          description: description.trim(),
        },
      })
      Taro.showToast({ title: '已上报', icon: 'success' })
      setTitle('')
      setDescription('')
      setTypeIdx(0)
      setShowForm(false)
      fetchList()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '上报失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const statusText = (s: string) =>
    ({ open: '🔴 待响应', in_progress: '🟡 处理中', resolved: '✅ 已解决', closed: '⚪ 已关闭' } as any)[s] || s
  const typeText = (t: string) => ISSUE_TYPES.find((x) => x.value === t)?.label || t

  return (
    <View style={{ padding: '12px', minHeight: '100vh', background: '#f5f5f5' }}>
      {showForm ? (
        <View style={{ background: '#fff', padding: '16px', borderRadius: '8px' }}>
          <Text style={{ fontSize: '16px', fontWeight: 'bold' }}>上报阻塞问题</Text>

          <Text style={{ display: 'block', marginTop: '12px', fontSize: '13px', color: '#666' }}>问题标题</Text>
          <Input
            placeholder='简要描述遇到的问题'
            value={title}
            maxlength={100}
            onInput={(e: any) => setTitle(e.detail.value)}
            style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #e8e8e8', borderRadius: '4px' }}
          />

          <Text style={{ display: 'block', marginTop: '12px', fontSize: '13px', color: '#666' }}>问题类型</Text>
          <Picker mode='selector' range={ISSUE_TYPES.map((x) => x.label)} value={typeIdx} onChange={(e: any) => setTypeIdx(Number(e.detail.value))}>
            <View style={{ padding: '10px', marginTop: '4px', border: '1px solid #e8e8e8', borderRadius: '4px' }}>
              <Text>{ISSUE_TYPES[typeIdx].label}</Text>
            </View>
          </Picker>

          <Text style={{ display: 'block', marginTop: '12px', fontSize: '13px', color: '#666' }}>详细描述（50-500字）</Text>
          <Textarea
            placeholder='详细描述问题和遇到的阻塞'
            value={description}
            maxlength={500}
            onInput={(e: any) => setDescription(e.detail.value)}
            style={{ width: '100%', minHeight: '120px', padding: '8px', marginTop: '4px', border: '1px solid #e8e8e8', borderRadius: '4px' }}
          />
          <Text style={{ fontSize: '12px', color: '#999' }}>{description.length}/500</Text>

          <View style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <Button style={{ flex: 1 }} onClick={() => setShowForm(false)}>取消</Button>
            <Button type='primary' style={{ flex: 1 }} loading={submitting} onClick={handleSubmit}>上报</Button>
          </View>
        </View>
      ) : (
        <View>
          <Button type='primary' onClick={() => setShowForm(true)} style={{ marginBottom: '12px' }}>+ 上报新问题</Button>

          <Text style={{ display: 'block', fontSize: '14px', color: '#666', padding: '8px 4px' }}>
            历史问题 ({list.length})
          </Text>

          {list.length === 0 && (
            <View style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
              <Text>暂无问题</Text>
            </View>
          )}

          {list.map((i) => (
            <View key={i.id} style={{ background: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
              <Text style={{ fontSize: '14px', fontWeight: 'bold' }}>{i.title}</Text>
              <View style={{ marginTop: '4px' }}>
                <Text style={{ fontSize: '12px', color: '#1890ff' }}>{typeText(i.type)}</Text>
                <Text style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>{i.createdAt?.slice(5, 16).replace('T', ' ')}</Text>
              </View>
              <Text style={{ display: 'block', marginTop: '6px', fontSize: '13px', color: '#333' }}>{i.description}</Text>
              <View style={{ marginTop: '6px' }}>
                <Text style={{ fontSize: '13px' }}>{statusText(i.status)}</Text>
              </View>
              {i.response && (
                <View style={{ marginTop: '8px', padding: '6px 8px', background: '#f5f5f5', borderRadius: '4px' }}>
                  <Text style={{ fontSize: '12px', color: '#666' }}>💬 企业回复：</Text>
                  <Text style={{ fontSize: '13px' }}>{i.response}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
