import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { authApi } from '../../api/auth'
import './index.scss'

const levelLabel: Record<string, string> = {
  unverified: '未认证', verified: '已认证', silver: '白银', gold: '黄金', platinum: '白金',
}
const levelColor: Record<string, string> = {
  unverified: '#ccc', verified: '#52c41a', silver: '#8c8c8c', gold: '#f5a623', platinum: '#b37feb',
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res: any = await authApi.getProfile()
      setProfile(res.data ?? res)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  const goEditProfile = () =>
    Taro.navigateTo({ url: '/subpackages/auth/pages/profile-edit/index' })

  const goPortfolio = () =>
    Taro.navigateTo({ url: '/subpackages/profile/pages/portfolio/index' })

  if (loading) {
    return (
      <View className='page loading'>
        <Text className='loading-text'>加载中...</Text>
      </View>
    )
  }

  if (!profile) {
    return (
      <View className='page'>
        <Text className='error-text'>请先登录</Text>
      </View>
    )
  }

  return (
    <ScrollView className='page' scrollY>
      {/* ── 顶部封面 + 头像 ── */}
      <View className='cover-area'>
        <View className='cover-bg' />
        <View className='avatar-wrap'>
          {profile.avatarUrl
            ? <Image className='avatar' src={profile.avatarUrl} mode='aspectFill' />
            : <View className='avatar avatar-placeholder'>
                <Text className='avatar-initial'>{(profile.realName || '?')[0]}</Text>
              </View>
          }
          <View
            className='level-badge'
            style={{ background: levelColor[profile.level] || '#ccc' }}
          >
            <Text className='level-text'>{levelLabel[profile.level] || profile.level}</Text>
          </View>
        </View>
      </View>

      {/* ── 基本信息 ── */}
      <View className='info-card'>
        <View className='name-row'>
          <Text className='real-name'>{profile.realName || '未填写姓名'}</Text>
          {profile.isVerified && (
            <View className='verified-badge'><Text className='verified-text'>已实名</Text></View>
          )}
        </View>
        <Text className='city-text'>{profile.city || '未填写城市'}</Text>
        <Text className='bio-text'>{profile.bio || '暂无简介'}</Text>

        <View className='stats-row'>
          <View className='stat-item'>
            <Text className='stat-num'>{profile.completedCount ?? 0}</Text>
            <Text className='stat-label'>完成任务</Text>
          </View>
          <View className='stat-divider' />
          <View className='stat-item'>
            <Text className='stat-num'>{Number(profile.avgRating ?? 0).toFixed(1)}</Text>
            <Text className='stat-label'>平均评分</Text>
          </View>
          <View className='stat-divider' />
          <View className='stat-item'>
            <Text className='stat-num'>{Math.round((Number(profile.completionRate ?? 0)) * 100)}%</Text>
            <Text className='stat-label'>完成率</Text>
          </View>
        </View>

        <View className='action-row'>
          <View className='action-btn' onClick={goEditProfile}>
            <Text className='action-text'>编辑资料</Text>
          </View>
          <View className='action-btn secondary' onClick={goPortfolio}>
            <Text className='action-text-sec'>作品集</Text>
          </View>
        </View>
      </View>

      {/* ── 技能标签 ── */}
      {profile.roles?.length > 0 && (
        <View className='section-card'>
          <Text className='section-title'>专业技能</Text>
          {(profile.roles as any[]).map((role: any) => (
            <View key={role.id} className='role-item'>
              <View className='role-header'>
                <Text className='role-name'>{role.roleName}</Text>
                <Text className='role-exp'>{role.yearsExp ?? 0}年经验</Text>
              </View>
              {role.skillTags && (
                <View className='tag-wrap'>
                  {role.skillTags.split(',').map((tag: string) => (
                    <View key={tag} className='skill-tag'>
                      <Text className='tag-text'>{tag.trim()}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {/* ── 作品集预览 ── */}
      {profile.portfolios?.length > 0 && (
        <View className='section-card'>
          <View className='section-header'>
            <Text className='section-title'>作品集</Text>
            <Text className='section-more' onClick={goPortfolio}>查看全部</Text>
          </View>
          <View className='portfolio-grid'>
            {(profile.portfolios as any[]).slice(0, 4).map((p: any) => (
              <View key={p.id} className='portfolio-item'>
                {p.mediaUrl
                  ? <Image className='portfolio-img' src={p.mediaUrl} mode='aspectFill' />
                  : <View className='portfolio-placeholder'>
                      <Text className='portfolio-title'>{p.title}</Text>
                    </View>
                }
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── 底部占位 ── */}
      <View className='bottom-space' />
    </ScrollView>
  )
}
