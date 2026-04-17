import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../../../api/request'
import './index.scss'

interface Dimension {
  key: string
  label: string
  tip: string
}

const DIMS: Dimension[] = [
  { key: 'qualityScore',       label: '需求清晰度', tip: '需求说明是否清晰完整' },
  { key: 'communicationScore', label: '沟通配合',   tip: '与企业沟通是否顺畅' },
  { key: 'attitudeScore',      label: '尊重程度',   tip: '企业对零工的尊重与配合' },
  { key: 'deliveryScore',      label: '及时反馈',   tip: '企业反馈与验收是否及时' },
  { key: 'overallScore',       label: '整体满意',   tip: '整体合作体验' },
]

const QUICK_TAGS = [
  '需求明确', '沟通顺畅', '尊重创意', '反馈及时',
  '付款准时', '合作愉快', '专业高效', '值得推荐',
]

const starLabel = (v: number) =>
  v >= 5 ? '非常满意' : v >= 4 ? '满意' : v >= 3 ? '一般' : v >= 2 ? '不满意' : '很差'

export default function ReviewPage() {
  const params = Taro.getCurrentInstance().router?.params as any
  const assignmentId = Number(params?.assignmentId || 0)

  const [scores, setScores] = useState<Record<string, number>>({
    qualityScore: 5, communicationScore: 5,
    attitudeScore: 5, deliveryScore: 5, overallScore: 5,
  })
  const [comment,  setComment]  = useState('')
  const [tags,     setTags]     = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const setScore = (key: string, val: number) =>
    setScores(prev => ({ ...prev, [key]: val }))

  const toggleTag = (tag: string) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const computedOverall = (() => {
    const w: Record<string, number> = {
      qualityScore: 0.25, communicationScore: 0.2,
      attitudeScore: 0.2, deliveryScore: 0.2, overallScore: 0.15,
    }
    return Number(Object.entries(w).reduce((s, [k, wt]) => s + (scores[k] ?? 5) * wt, 0).toFixed(1))
  })()

  const renderStars = (key: string) => {
    const val = scores[key] ?? 5
    return (
      <View className='star-row'>
        {[1, 2, 3, 4, 5].map(n => (
          <Text
            key={n}
            className={`star ${n <= val ? 'filled' : ''}`}
            onClick={() => setScore(key, n)}
          >★</Text>
        ))}
        <Text className='star-label'>{starLabel(val)}</Text>
      </View>
    )
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const fullComment = [
        comment,
        tags.length ? `#${tags.join(' #')}` : '',
      ].filter(Boolean).join('\n')

      await request({
        url: `/reviews/${assignmentId}/v2`,
        method: 'POST',
        data: {
          ...scores,
          comment: fullComment || undefined,
        },
      })
      Taro.showToast({ title: '评价提交成功 🎉', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView className='page' scrollY>
      {/* 页头 */}
      <View className='page-header'>
        <Text className='header-title'>评价企业</Text>
        <Text className='header-sub'>您的评价将帮助更多零工了解该企业</Text>
      </View>

      {/* 综合评分预览 */}
      <View className='overall-card'>
        <Text className='overall-label'>综合评分</Text>
        <View className='overall-score-row'>
          <Text className='overall-num'>{computedOverall}</Text>
          <View className='overall-stars'>
            {[1, 2, 3, 4, 5].map(n => (
              <Text
                key={n}
                className={`big-star ${n <= Math.round(computedOverall) ? 'filled' : ''}`}
              >★</Text>
            ))}
          </View>
        </View>
      </View>

      {/* 5 维度评分 */}
      <View className='dims-card'>
        {DIMS.map(dim => (
          <View key={dim.key} className='dim-item'>
            <View className='dim-header'>
              <Text className='dim-label'>{dim.label}</Text>
              <Text className='dim-tip'>{dim.tip}</Text>
            </View>
            {renderStars(dim.key)}
          </View>
        ))}
      </View>

      {/* 快捷标签 */}
      <View className='section-card'>
        <Text className='section-title'>快速标签（选填）</Text>
        <View className='tag-wrap'>
          {QUICK_TAGS.map(tag => (
            <View
              key={tag}
              className={`tag-item ${tags.includes(tag) ? 'selected' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              <Text className='tag-text'>{tag}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 文字评价 */}
      <View className='section-card'>
        <Text className='section-title'>文字评价（选填）</Text>
        <textarea
          className='comment-input'
          placeholder='分享您的合作体验...'
          value={comment}
          onInput={(e: any) => setComment(e.detail.value)}
          maxLength={500}
        />
        <Text className='comment-count'>{comment.length}/500</Text>
      </View>

      {/* 提交 */}
      <View className='submit-area'>
        <View
          className={`submit-btn ${submitting ? 'disabled' : ''}`}
          onClick={submitting ? undefined : handleSubmit}
        >
          <Text className='submit-text'>{submitting ? '提交中...' : '提交评价'}</Text>
        </View>
      </View>
    </ScrollView>
  )
}
