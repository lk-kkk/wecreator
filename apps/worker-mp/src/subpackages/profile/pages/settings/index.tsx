/**
 * V3.3 设置页 — 从「我的」右上角 ⚙️ 进入
 * 分组菜单：个人管理 / 财务 / 成长 / 系统
 */
import { useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getCurrentUser, logout } from '../../../../utils/wx-login'
import './index.scss'

interface MenuItem {
  icon: string
  label: string
  action: () => void
  badge?: string
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)

  useDidShow(() => { setUser(getCurrentUser()) })

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出', content: '退出后需要重新登录', confirmColor: '#ff4d4f',
    }).then(({ confirm }) => {
      if (confirm) { logout(); Taro.reLaunch({ url: '/pages/index/index' }) }
    })
  }

  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: '个人管理',
      items: [
        { icon: '✏️', label: '编辑资料', action: () => Taro.navigateTo({ url: '/subpackages/auth/pages/profile-edit/index' }) },
        {
          icon: '🔐', label: '实名认证',
          action: () => {
            if (user?.isVerified) Taro.showToast({ title: '已完成实名认证', icon: 'none' })
            else Taro.navigateTo({ url: '/subpackages/auth/pages/verify/index' })
          },
          badge: user?.isVerified ? '✅' : '待认证',
        },
        { icon: '🎯', label: '角色档案管理', action: () => Taro.navigateTo({ url: '/subpackages/auth/pages/profile-edit/index' }) },
        { icon: '📝', label: '我的申请', action: () => Taro.navigateTo({ url: '/subpackages/profile/pages/applications/index' }) },
      ],
    },
    {
      title: '财务',
      items: [
        { icon: '💰', label: '我的钱包', action: () => Taro.navigateTo({ url: '/subpackages/wallet/pages/index/index' }) },
        { icon: '📄', label: '电子合同', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
      ],
    },
    {
      title: '成长',
      items: [
        { icon: '🏆', label: '等级说明', action: () => Taro.navigateTo({ url: '/pages/profile/level' }) },
        { icon: '📇', label: '服务名片', action: () => Taro.navigateTo({ url: '/pages/profile/card' }) },
      ],
    },
    {
      title: '系统',
      items: [
        { icon: '🔔', label: '通知设置', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
        { icon: '📋', label: '用户协议', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
        { icon: '🔒', label: '隐私政策', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
        { icon: '❓', label: '帮助与反馈', action: () => Taro.showToast({ title: '功能开发中', icon: 'none' }) },
      ],
    },
  ]

  return (
    <View className='settings-page'>
      {groups.map((g, gi) => (
        <View key={gi} className='menu-group'>
          <Text className='group-title'>{g.title}</Text>
          {g.items.map((item, mi) => (
            <View key={mi} className='menu-item' onClick={item.action}>
              <Text className='menu-icon'>{item.icon}</Text>
              <Text className='menu-label'>{item.label}</Text>
              <View className='menu-right'>
                {item.badge && <Text className={`menu-badge ${item.badge === '✅' ? 'done' : 'pending'}`}>{item.badge}</Text>}
                <Text className='menu-arrow'>›</Text>
              </View>
            </View>
          ))}
        </View>
      ))}

      <View className='logout-area'>
        <View className='logout-btn' onClick={handleLogout}>
          <Text className='logout-text'>退出登录</Text>
        </View>
        <Text className='version-text'>WeCreator v1.0.0</Text>
      </View>
    </View>
  )
}
