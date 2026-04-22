import { useState, useEffect } from 'react'
import { View, Text, Button, Textarea, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { request } from '../../../../api/request'

interface Comment {
  id: number
  parentId?: number | null
  authorType: 'company_user' | 'worker'
  authorId: number
  author?: { name?: string }
  content: string
  isImportant: boolean
  createdAt: string
}

export default function CommentsPage() {
  const router = useRouter()
  const taskId = Number(router.params.taskId || 0)

  const [all, setAll] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = async () => {
    if (!taskId) return
    setLoading(true)
    try {
      const res: any = await request({
        url: `/tasks/${taskId}/comments`,
        method: 'GET',
        data: { page: 1, pageSize: 200 },
      })
      const payload = res.data ?? res
      // 后端 CommentService.list 返回 { list, total }；兵容其他 shape
      setAll(payload.list || payload.items || payload || [])
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
    if (!content.trim()) {
      Taro.showToast({ title: '请输入评论', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await request({
        url: `/tasks/${taskId}/comments`,
        method: 'POST',
        data: { content: content.trim() },
      })
      setContent('')
      fetchList()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '发送失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const topComments = all.filter((c) => !c.parentId)
  const repliesOf = (pid: number) => all.filter((c) => c.parentId === pid)
  const formatTime = (t: string) => t?.slice(5, 16).replace('T', ' ') || ''

  return (
    <View style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <ScrollView scrollY style={{ flex: 1, padding: '12px' }}>
        {topComments.length === 0 && !loading && (
          <View style={{ padding: '40px 0', textAlign: 'center', color: '#999' }}>
            <Text>还没有人发言，开始讨论吧</Text>
          </View>
        )}

        {topComments.map((c) => (
          <View
            key={c.id}
            style={{
              background: c.isImportant ? '#fffbe6' : '#fff',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '8px',
              borderLeft: c.isImportant ? '3px solid #faad14' : '2px solid #f0f0f0',
            }}
          >
            <View style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Text style={{ fontSize: '13px', fontWeight: 'bold' }}>
                {c.author?.name || (c.authorType === 'company_user' ? `企业#${c.authorId}` : `零工#${c.authorId}`)}
              </Text>
              <Text style={{ fontSize: '11px', color: '#1890ff' }}>
                {c.authorType === 'company_user' ? '[企业]' : '[零工]'}
              </Text>
              {c.isImportant && <Text style={{ fontSize: '11px', color: '#faad14' }}>⭐ 重要</Text>}
              <Text style={{ fontSize: '11px', color: '#999', marginLeft: 'auto' }}>{formatTime(c.createdAt)}</Text>
            </View>
            <Text style={{ display: 'block', marginTop: '6px', fontSize: '13px', lineHeight: '1.6' }}>{c.content}</Text>

            {repliesOf(c.id).map((r) => (
              <View
                key={r.id}
                style={{ marginTop: '8px', marginLeft: '16px', padding: '8px', background: '#f9f9f9', borderRadius: '4px' }}
              >
                <Text style={{ fontSize: '12px', fontWeight: 'bold' }}>
                  {r.author?.name || (r.authorType === 'company_user' ? '企业' : '零工')}:
                </Text>
                <Text style={{ display: 'block', fontSize: '12px', marginTop: '2px' }}>{r.content}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={{ padding: '8px', background: '#fff', borderTop: '1px solid #e8e8e8' }}>
        <Textarea
          placeholder='发表评论...'
          value={content}
          maxlength={1000}
          onInput={(e: any) => setContent(e.detail.value)}
          style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #e8e8e8', borderRadius: '4px' }}
        />
        <View style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <Button type='primary' size='mini' loading={submitting} onClick={handleSubmit}>
            发送
          </Button>
        </View>
      </View>
    </View>
  )
}
