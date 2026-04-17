import { useState, useCallback } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useUserStore } from '../../stores/user'
import './card.scss'

const CARD_STYLES = [
  { id: 'modern',   label: '简约',   bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'warm',     label: '温暖',   bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'business', label: '商务',   bg: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' },
]

const LEVEL_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  unverified: { label: '未认证', color: '#d9d9d9', badge: '⬜' },
  basic:      { label: '基础达人', color: '#52c41a', badge: '🌱' },
  skilled:    { label: '熟练工',   color: '#1677ff', badge: '⚡' },
  expert:     { label: '行业专家', color: '#9254de', badge: '🏆' },
  master:     { label: '大师级别', color: '#faad14', badge: '👑' },
}

export default function ServiceCardPage() {
  const userStore     = useUserStore()
  const worker        = userStore.profile
  const [style, setStyle] = useState('modern')

  const currentStyle = CARD_STYLES.find(s => s.id === style) ?? CARD_STYLES[0]
  const levelCfg     = LEVEL_CONFIG[worker?.level ?? 'basic']

  // 生成分享内容
  const handleShare = useCallback(() => {
    Taro.showShareMenu({ withShareTicket: true })
  }, [])

  // 分享到朋友圈
  const handleSaveImage = useCallback(() => {
    Taro.showToast({ title: '长按卡片可保存图片', icon: 'none', duration: 2000 })
  }, [])

  // 复制联系方式
  const handleCopyContact = useCallback(() => {
    if (worker?.phone) {
      Taro.setClipboardData({ data: worker.phone }).then(() => {
        Taro.showToast({ title: '手机号已复制', icon: 'success' })
      })
    }
  }, [worker])

  const roles  = worker?.roles?.map((r: any) => r.roleName).join(' / ') ?? '—'
  const skills = worker?.roles?.flatMap((r: any) => (r.skillTags ?? '').split(',').filter(Boolean)).slice(0, 6) ?? []

  return (
    <ScrollView className='page' scrollY>
      {/* 风格选择 */}
      <View className='style-picker'>
        <Text className='picker-label'>卡片风格</Text>
        <View className='style-list'>
          {CARD_STYLES.map(s => (
            <View
              key={s.id}
              className={`style-item ${style === s.id ? 'active' : ''}`}
              onClick={() => setStyle(s.id)}
            >
              <View className='style-preview' style={{ background: s.bg }} />
              <Text className='style-name'>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 名片卡 */}
      <View className='card-container'>
        <View className='service-card' style={{ background: currentStyle.bg }}>
          {/* 头部：头像 + 姓名 */}
          <View className='card-header'>
            <View className='avatar-wrap'>
              {worker?.avatarUrl
                ? <Image className='avatar' src={worker.avatarUrl} mode='aspectFill' />
                : <View className='avatar-placeholder'><Text className='ap-text'>{(worker?.realName ?? '?')[0]}</Text></View>
              }
              <View className='level-badge'>
                <Text className='lb-text'>{levelCfg.badge}</Text>
              </View>
            </View>
            <View className='header-info'>
              <Text className='worker-name'>{worker?.realName ?? '—'}</Text>
              <Text className='worker-level'>{levelCfg.label}</Text>
              <Text className='worker-roles'>{roles}</Text>
            </View>
          </View>

          {/* 统计数据 */}
          <View className='stats-row'>
            <View className='stat-item'>
              <Text className='stat-num'>{worker?.completedCount ?? 0}</Text>
              <Text className='stat-label'>完成任务</Text>
            </View>
            <View className='stat-divider' />
            <View className='stat-item'>
              <Text className='stat-num'>{Number(worker?.avgRating ?? 0).toFixed(1)}</Text>
              <Text className='stat-label'>综合评分</Text>
            </View>
            <View className='stat-divider' />
            <View className='stat-item'>
              <Text className='stat-num'>{Math.round(Number(worker?.completionRate ?? 0) * 100)}%</Text>
              <Text className='stat-label'>完成率</Text>
            </View>
          </View>

          {/* 技能标签 */}
          {skills.length > 0 && (
            <View className='skill-row'>
              {skills.map((sk: string, i: number) => (
                <View key={i} className='skill-chip'>
                  <Text className='skill-text'>{sk}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 城市 */}
          {worker?.city && (
            <View className='city-row'>
              <Text className='city-icon'>📍</Text>
              <Text className='city-text'>{worker.city}</Text>
            </View>
          )}

          {/* 品牌水印 */}
          <View className='watermark'>
            <Text className='wm-text'>WeCreator · 零工平台</Text>
          </View>
        </View>
      </View>

      {/* 操作按钮 */}
      <View className='action-area'>
        <View className='action-btn share-btn' onClick={handleShare}>
          <Text className='ab-icon'>📤</Text>
          <Text className='ab-text'>分享给好友</Text>
        </View>
        <View className='action-btn save-btn' onClick={handleSaveImage}>
          <Text className='ab-icon'>🖼️</Text>
          <Text className='ab-text'>保存图片</Text>
        </View>
        <View className='action-btn copy-btn' onClick={handleCopyContact}>
          <Text className='ab-icon'>📋</Text>
          <Text className='ab-text'>复制联系方式</Text>
        </View>
      </View>

      {/* 分享提示 */}
      <View className='share-tip'>
        <Text className='tip-text'>💡 分享名片，让更多企业找到你</Text>
      </View>
    </ScrollView>
  )
}
