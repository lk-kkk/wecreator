/**
 * V3.3 服务广场 — 任务详情 + 报名
 */
import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { marketplaceApi, type MarketplaceDetail } from '../../../../api/marketplace'
import './index.scss'

const modeLabel: Record<string, string> = { task_package: '📦 任务包', daily_rate: '📅 人天计费' }
const formatBudget = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString()}`
const scoreColor = (s: number | null) => s === null ? '#ccc' : s >= 70 ? '#52c41a' : s >= 50 ? '#faad14' : '#aaa'

export default function MarketplaceDetailPage() {
  const [task, setTask] = useState<MarketplaceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)
  const [applyRoleId, setApplyRoleId] = useState(0)
  const [applyRoleName, setApplyRoleName] = useState('')
  const [intro, setIntro] = useState('')
  const [expectPay, setExpectPay] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    const params = Taro.getCurrentInstance().router?.params
    const id = Number(params?.id)
    if (!id) return
    try {
      const res = await marketplaceApi.detail(id)
      setTask(res)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [])

  const openApply = (roleId: number, roleName: string) => {
    setApplyRoleId(roleId)
    setApplyRoleName(roleName)
    setIntro('')
    setExpectPay('')
    setShowApply(true)
  }

  const submitApply = async () => {
    if (intro.length < 20) {
      Taro.showToast({ title: '自我介绍至少20字', icon: 'none' }); return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      await marketplaceApi.apply(task!.taskId, applyRoleId, {
        intro,
        expectPay: expectPay ? Number(expectPay) : undefined,
      })
      Taro.showToast({ title: '报名成功！', icon: 'success' })
      setShowApply(false)
      load() // 刷新状态
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '报名失败', icon: 'none' })
    }
    setSubmitting(false)
  }

  if (loading) return <View className='detail-page loading'><Text>加载中...</Text></View>
  if (!task) return <View className='detail-page'><Text className='error'>任务不存在</Text></View>

  return (
    <View className='detail-page'>
      <ScrollView className='scroll' scrollY>
        {/* 标题区 */}
        <View className='title-area'>
          <Text className='title'>{task.title}</Text>
          <View className='company-row'>
            <Text className='company'>🏢 {task.company.name}</Text>
          </View>
        </View>

        {/* 任务信息 */}
        <View className='info-card'>
          <Text className='card-title'>━ 任务信息 ━</Text>
          <View className='info-row'><Text className='info-label'>任务模式</Text><Text className='info-val'>{modeLabel[task.taskMode] || task.taskMode}</Text></View>
          <View className='info-row'><Text className='info-label'>总预算</Text><Text className='info-val budget'>¥{Number(task.totalBudget).toLocaleString()}</Text></View>
          <View className='info-row'><Text className='info-label'>工作地点</Text><Text className='info-val'>📍 {task.address || '远程'}</Text></View>
          {task.startDate && <View className='info-row'><Text className='info-label'>项目周期</Text><Text className='info-val'>{task.startDate?.slice(0,10)} ~ {task.endDate?.slice(0,10)}</Text></View>}
        </View>

        {/* 任务描述 */}
        {task.description && (
          <View className='info-card'>
            <Text className='card-title'>━ 任务描述 ━</Text>
            <Text className='desc-text'>{task.description}</Text>
          </View>
        )}

        {/* 招募角色 */}
        <View className='info-card'>
          <Text className='card-title'>━ 招募角色 ━</Text>
          {task.roles.map(r => (
            <View key={r.roleId} className='role-item'>
              <View className='role-top'>
                <View className='role-info'>
                  <Text className='role-name'>🎯 {r.roleName} ×{r.headcount}</Text>
                  <Text className='role-budget'>{formatBudget(r.budget)}/人</Text>
                </View>
                {r.myApplicationStatus === 'pending' ? (
                  <View className='apply-badge pending'><Text>审核中</Text></View>
                ) : r.myApplicationStatus === 'approved' ? (
                  <View className='apply-badge approved'><Text>已通过</Text></View>
                ) : (
                  <View className='apply-btn' onClick={() => openApply(r.roleId, r.roleName)}>
                    <Text className='apply-btn-text'>报名</Text>
                  </View>
                )}
              </View>
              {r.skillTags && <Text className='role-skills'>技能：{r.skillTags}</Text>}
              {r.description && <Text className='role-desc'>{r.description}</Text>}
              <Text className='role-fill'>已招 {r.filledCount}/{r.headcount}</Text>
            </View>
          ))}
        </View>

        {/* 匹配度 */}
        {task.matchScore !== null && (
          <View className='match-area'>
            <Text className='match-label'>匹配度</Text>
            <View className='match-score' style={{ backgroundColor: scoreColor(task.matchScore) }}>
              <Text className='match-num'>{task.matchScore}</Text>
            </View>
            {task.dimensions && (
              <Text className='match-dims'>
                技能{task.dimensions.skillMatch} 城市{task.dimensions.cityMatch} 预算{task.dimensions.budgetFit}
              </Text>
            )}
          </View>
        )}

        <View className='bottom-safe' />
      </ScrollView>

      {/* 报名弹窗 */}
      {showApply && (
        <View className='apply-mask' onClick={() => setShowApply(false)}>
          <View className='apply-modal' onClick={e => e.stopPropagation()}>
            <Text className='modal-title'>报名 · {applyRoleName}</Text>
            <View className='form-group'>
              <Text className='form-label'>一句话介绍（必填，20-200字）</Text>
              <Textarea className='form-textarea' maxlength={200} placeholder='向企业展示你的优势...'
                value={intro} onInput={e => setIntro(e.detail.value)} />
              <Text className='char-count'>{intro.length}/200</Text>
            </View>
            <View className='form-group'>
              <Text className='form-label'>期望报酬（选填）</Text>
              <Input className='form-input' type='digit' placeholder='¥' value={expectPay}
                onInput={e => setExpectPay(e.detail.value)} />
            </View>
            <View className='modal-actions'>
              <View className='action-cancel' onClick={() => setShowApply(false)}>
                <Text>取消</Text>
              </View>
              <View className={`action-submit ${submitting ? 'disabled' : ''}`} onClick={submitApply}>
                <Text className='submit-text'>{submitting ? '提交中...' : '提交报名'}</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
