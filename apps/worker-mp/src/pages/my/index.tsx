/**
 * V3.3 「我的」页 — 仿抖音风格
 * 封面背景图 + 头像信息 + 能力标签 + 数据面板 + 财务面板 + 作品集 + 分享按钮
 * 右上角 ⚙️ 设置入口
 */
import { useState, useCallback } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { isLoggedIn, getCurrentUser } from '../../utils/wx-login'
import { authApi } from '../../api/auth'
import { request } from '../../api/request'
import { workerStatsApi, type WorkerStats, type CreditDetail } from '../../api/marketplace'
import './index.scss'

const levelLabel: Record<string, string> = {
  unverified: '未认证', verified: '已认证', silver: '白银', gold: '黄金', platinum: '白金',
}

const COVER_TEMPLATES: Record<string, string> = {
  simple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  creative: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  business: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  warm: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  tech: 'linear-gradient(135deg, #0c0c1d 0%, #1a1a3e 100%)',
  photo: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
}

export default function MyPage() {
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<WorkerStats | null>(null)
  const [wallet, setWallet] = useState<any>(null)
  const [creditDetail, setCreditDetail] = useState<CreditDetail | null>(null)
  const [showCredit, setShowCredit] = useState(false)

  const loadData = useCallback(async () => {
    if (!isLoggedIn()) return
    try {
      const [p, s, w] = await Promise.all([
        authApi.getProfile().catch(() => null),
        workerStatsApi.getStats().catch(() => null),
        request({ url: '/worker/wallet' }).catch(() => null),
      ])
      if (p) setProfile((p as any).data ?? p)
      if (s) setStats(s)
      if (w) setWallet(w)
    } catch {}
  }, [])

  useDidShow(() => { loadData() })

  const showCreditDetail = async () => {
    try {
      const d = await workerStatsApi.getCreditScore()
      setCreditDetail(d)
      setShowCredit(true)
    } catch {}
  }

  const goSettings = () => Taro.navigateTo({ url: '/subpackages/profile/pages/settings/index' })
  const goWallet = () => Taro.navigateTo({ url: '/subpackages/wallet/pages/index/index' })
  const goPortfolio = () => Taro.navigateTo({ url: '/subpackages/profile/pages/portfolio/index' })
  const goShareCard = () => Taro.navigateTo({ url: '/pages/profile/card' })
  const goTaskList = (status?: string) => {
    Taro.switchTab({ url: '/pages/index/index' })
  }

  if (!isLoggedIn()) {
    return (
      <View className='my-page'>
        <View className='login-prompt'>
          <Text className='prompt-text'>请先登录</Text>
          <View className='prompt-btn' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
            <Text className='prompt-btn-text'>去登录</Text>
          </View>
        </View>
      </View>
    )
  }

  const coverBg = stats?.coverImage
    ? undefined
    : COVER_TEMPLATES[stats?.coverTemplate ?? 'simple']

  return (
    <View className='my-page'>
      <ScrollView className='scroll-area' scrollY>
        {/* ── 设置按钮 ── */}
        <View className='settings-btn' onClick={goSettings}>
          <Text className='settings-icon'>⚙️</Text>
        </View>

        {/* ── 封面区域 ── */}
        <View className='cover-area' style={coverBg ? { background: coverBg } : undefined}>
          {stats?.coverImage && (
            <Image className='cover-img' src={stats.coverImage} mode='aspectFill' />
          )}
          <View className='profile-info'>
            <View className='avatar-wrap'>
              {profile?.avatarUrl
                ? <Image className='avatar' src={profile.avatarUrl} mode='aspectFill' />
                : <View className='avatar avatar-placeholder'>
                    <Text className='avatar-letter'>{(profile?.realName || '?')[0]}</Text>
                  </View>
              }
            </View>
            <View className='name-area'>
              <Text className='name'>{profile?.realName || '未填写姓名'}</Text>
              <View className='badges'>
                {profile?.avgRating > 0 && <Text className='badge'>⭐ {Number(profile.avgRating).toFixed(1)}</Text>}
                {profile?.isVerified && <Text className='badge badge-green'>✅ 已实名</Text>}
                {profile?.level && profile.level !== 'unverified' && (
                  <Text className='badge badge-gold'>🏅 {levelLabel[profile.level] || profile.level}</Text>
                )}
              </View>
              <Text className='sub-info'>📍 {profile?.city || '未设置'} · 响应 &lt;1小时</Text>
            </View>
          </View>
        </View>

        {/* ── 能力标签 ── */}
        {profile?.workerRoles?.length > 0 && (
          <View className='skill-tags-area'>
            {profile.workerRoles.map((r: any, i: number) => (
              <View key={i} className='skill-tag'>
                <Text className='tag-text'>🎯 {r.roleName}{r.yearsExp ? `(${r.yearsExp}年)` : ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 数据面板 ── */}
        <View className='stats-panel'>
          <View className='stat-item' onClick={() => goTaskList()}>
            <Text className='stat-number'>{stats?.servedCompanies ?? 0}</Text>
            <Text className='stat-label'>服务企业</Text>
          </View>
          <View className='stat-item' onClick={() => goTaskList('accepted')}>
            <Text className='stat-number'>{stats?.acceptedTasks ?? 0}</Text>
            <Text className='stat-label'>已承接</Text>
          </View>
          <View className='stat-item' onClick={() => goTaskList('in_progress')}>
            <Text className='stat-number'>{stats?.inProgressTasks ?? 0}</Text>
            <Text className='stat-label'>执行中</Text>
          </View>
          <View className='stat-item' onClick={() => goTaskList('completed')}>
            <Text className='stat-number'>{stats?.completedTasks ?? 0}</Text>
            <Text className='stat-label'>已完成</Text>
          </View>
          <View className='stat-item' onClick={showCreditDetail}>
            <Text className='stat-number' style={{ color: stats?.creditLevel?.color || '#1677ff' }}>
              {stats?.creditScore ?? 80}
            </Text>
            <Text className='stat-label'>信用分</Text>
          </View>
        </View>

        {/* ── 财务面板 ── */}
        <View className='finance-panel' onClick={goWallet}>
          <View className='fin-item'>
            <Text className='fin-amount' style={{ color: '#5B4CDB' }}>
              ¥{(wallet?.availableBalance ?? 0).toFixed(2)}
            </Text>
            <Text className='fin-label'>可用金额</Text>
          </View>
          <View className='fin-divider' />
          <View className='fin-item'>
            <Text className='fin-amount' style={{ color: '#faad14' }}>
              ¥{(wallet?.frozenBalance ?? 0).toFixed(2)}
            </Text>
            <Text className='fin-label'>冻结金额</Text>
          </View>
          <View className='fin-divider' />
          <View className='fin-item'>
            <Text className='fin-amount' style={{ color: '#52c41a' }}>
              ¥{(wallet?.totalEarned ?? 0).toFixed(2)}
            </Text>
            <Text className='fin-label'>累计收入</Text>
          </View>
        </View>

        {/* ── 精选作品 ── */}
        <View className='portfolio-section'>
          <View className='section-header'>
            <Text className='section-title'>精选作品</Text>
            <Text className='section-more' onClick={goPortfolio}>查看全部 →</Text>
          </View>
          <View className='portfolio-grid'>
            {(profile?.portfolios ?? []).slice(0, 4).map((p: any, i: number) => (
              <View key={i} className='portfolio-item' onClick={goPortfolio}>
                <Image className='portfolio-img' src={p.fileUrl} mode='aspectFill' />
                <Text className='portfolio-name'>{p.title}</Text>
              </View>
            ))}
            {(!profile?.portfolios || profile.portfolios.length === 0) && (
              <View className='portfolio-empty' onClick={goPortfolio}>
                <Text className='empty-text'>📷 添加作品展示实力</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── 分享名片 ── */}
        <View className='share-btn' onClick={goShareCard}>
          <Text className='share-text'>📤 分享我的服务名片</Text>
        </View>

        <View className='bottom-safe' />
      </ScrollView>

      {/* ── 信用分弹窗 ── */}
      {showCredit && creditDetail && (
        <View className='credit-mask' onClick={() => setShowCredit(false)}>
          <View className='credit-modal' onClick={e => e.stopPropagation()}>
            <Text className='credit-title'>信用分明细</Text>
            <View className='credit-score-big'>
              <Text className='score-num' style={{ color: creditDetail.color }}>{creditDetail.total}</Text>
              <Text className='score-level'>{creditDetail.level}</Text>
            </View>
            {Object.entries(creditDetail.dimensions).map(([key, dim]) => (
              <View key={key} className='credit-dim'>
                <Text className='dim-label'>
                  {key === 'rating' ? '平均评分' : key === 'completion' ? '完成率' : key === 'onTime' ? '按时交付' : '无争议'}
                </Text>
                <View className='dim-bar-wrap'>
                  <View className='dim-bar' style={{ width: `${dim.score}%` }} />
                </View>
                <Text className='dim-score'>{dim.score}</Text>
                <Text className='dim-weight'>{dim.weight}</Text>
              </View>
            ))}
            <View className='credit-close' onClick={() => setShowCredit(false)}>
              <Text className='close-text'>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
