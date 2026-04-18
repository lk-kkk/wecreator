import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useUserStore } from '../../stores/user'
import './level.scss'

interface LevelConfig {
  level:       string
  label:       string
  badge:       string
  color:       string
  bgColor:     string
  minTasks:    number
  minRating:   number
  minRate:     number
  perks:       string[]
}

const LEVELS: LevelConfig[] = [
  {
    level: 'basic', label: '基础达人', badge: '🌱',
    color: '#52c41a', bgColor: '#f6ffed',
    minTasks: 0, minRating: 0, minRate: 0,
    perks: ['可接受任务邀约', '基础档案展示', '参与平台活动'],
  },
  {
    level: 'skilled', label: '熟练工', badge: '⚡',
    color: '#0858F4', bgColor: '#E4ECF8',
    minTasks: 10, minRating: 4.0, minRate: 80,
    perks: ['优先展示在推荐列表', '解锁批量接单', '获得技能认证标签'],
  },
  {
    level: 'expert', label: '行业专家', badge: '🏆',
    color: '#9254de', bgColor: '#f9f0ff',
    minTasks: 50, minRating: 4.5, minRate: 90,
    perks: ['专属"专家"徽章', '接单佣金减免1%', '优先客服通道', '参与专家活动'],
  },
  {
    level: 'master', label: '大师级别', badge: '👑',
    color: '#faad14', bgColor: '#fffbe6',
    minTasks: 200, minRating: 4.8, minRate: 95,
    perks: ['专属"大师"金色徽章', '接单佣金减免2%', '专属推荐流量', '参与平台运营决策'],
  },
]

const LEVEL_ORDER = ['basic', 'skilled', 'expert', 'master']

export default function LevelPage() {
  const userStore    = useUserStore()
  const worker       = userStore.profile
  const currentLevel = worker?.level ?? 'basic'

  const curIdx  = LEVEL_ORDER.indexOf(currentLevel)
  const curCfg  = LEVELS[curIdx] ?? LEVELS[0]
  const nextCfg = LEVELS[curIdx + 1]

  const completedCount   = worker?.completedCount ?? 0
  const avgRating        = Number(worker?.avgRating ?? 0)
  const completionRate   = Math.round(Number(worker?.completionRate ?? 0) * 100)

  // 升级进度（取三项指标最小进度）
  const nextLevelProgress = nextCfg ? Math.min(
    Math.round((completedCount / nextCfg.minTasks) * 100),
    nextCfg.minRating > 0 ? Math.round((avgRating / nextCfg.minRating) * 100) : 100,
    nextCfg.minRate   > 0 ? Math.round((completionRate / nextCfg.minRate) * 100) : 100,
    100,
  ) : 100

  return (
    <ScrollView className='level-page' scrollY>
      {/* 当前等级卡 */}
      <View className='current-card' style={{ background: curCfg.bgColor, borderColor: curCfg.color }}>
        <View className='cc-badge' style={{ background: curCfg.color }}>
          <Text className='cc-badge-icon'>{curCfg.badge}</Text>
        </View>
        <View className='cc-info'>
          <Text className='cc-level-text' style={{ color: curCfg.color }}>{curCfg.label}</Text>
          <Text className='cc-desc'>当前等级</Text>
        </View>
        <View className='cc-stats'>
          <Text className='cc-stat'>{completedCount} 单</Text>
          <Text className='cc-stat'>{avgRating.toFixed(1)} ⭐</Text>
          <Text className='cc-stat'>{completionRate}%</Text>
        </View>
      </View>

      {/* 升级进度 */}
      {nextCfg && (
        <View className='progress-card'>
          <Text className='prog-title'>升级 {nextCfg.label} 进度</Text>

          <View className='prog-bar-wrap'>
            <View className='prog-bar'>
              <View className='prog-fill' style={{ width: `${nextLevelProgress}%`, background: nextCfg.color }} />
            </View>
            <Text className='prog-pct' style={{ color: nextCfg.color }}>{nextLevelProgress}%</Text>
          </View>

          <View className='req-list'>
            {[
              { label: '完成任务', current: completedCount, target: nextCfg.minTasks, unit: '单' },
              { label: '综合评分', current: avgRating,      target: nextCfg.minRating, unit: '分', isFloat: true },
              { label: '完成率',   current: completionRate, target: nextCfg.minRate,  unit: '%' },
            ].filter(r => r.target > 0).map(req => {
              const done = req.isFloat ? req.current >= req.target : req.current >= req.target
              return (
                <View key={req.label} className={`req-row ${done ? 'done' : ''}`}>
                  <Text className='req-label'>{req.label}</Text>
                  <View className='req-progress'>
                    <View className='req-bar-bg'>
                      <View
                        className='req-bar-fill'
                        style={{
                          width: `${Math.min((req.current / req.target) * 100, 100)}%`,
                          background: done ? '#52c41a' : nextCfg.color,
                        }}
                      />
                    </View>
                  </View>
                  <Text className='req-val'>
                    {req.isFloat ? req.current.toFixed(1) : req.current}{req.unit} / {req.isFloat ? req.target.toFixed(1) : req.target}{req.unit}
                  </Text>
                  <Text className='req-done'>{done ? '✅' : '⬜'}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* 等级权益 */}
      <View className='perks-card'>
        <Text className='perks-title'>当前等级权益</Text>
        {curCfg.perks.map((perk, i) => (
          <View key={i} className='perk-row'>
            <Text className='perk-dot' style={{ color: curCfg.color }}>●</Text>
            <Text className='perk-text'>{perk}</Text>
          </View>
        ))}
      </View>

      {/* 等级体系全览 */}
      <View className='levels-overview'>
        <Text className='ov-title'>等级体系</Text>
        <View className='levels-timeline'>
          {LEVELS.map((lv, i) => {
            const isUnlocked  = LEVEL_ORDER.indexOf(currentLevel) >= i
            const isCurrent   = lv.level === currentLevel
            return (
              <View key={lv.level} className={`tl-item ${isCurrent ? 'current' : ''} ${isUnlocked ? 'unlocked' : ''}`}>
                <View className='tl-badge' style={{ background: isUnlocked ? lv.color : '#f0f0f0' }}>
                  <Text className='tl-badge-icon'>{lv.badge}</Text>
                </View>
                {i < LEVELS.length - 1 && (
                  <View className='tl-line' style={{ background: isUnlocked ? lv.color : '#f0f0f0' }} />
                )}
                <Text className='tl-label' style={{ color: isUnlocked ? lv.color : '#ccc' }}>{lv.label}</Text>
                {lv.minTasks > 0 && (
                  <Text className='tl-req'>{lv.minTasks}单+</Text>
                )}
              </View>
            )
          })}
        </View>
      </View>
    </ScrollView>
  )
}
