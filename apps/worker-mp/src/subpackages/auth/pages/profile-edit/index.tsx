import { useState, useEffect, useCallback } from 'react'
import { View, Text, Input, Textarea, Image, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { authApi } from '../../../../api/auth'
import './index.scss'

const CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京',
  '苏州', '重庆', '长沙', '西安', '厦门', '青岛', '大连', '其他',
]

export default function ProfileEditPage() {
  const [form, setForm] = useState({
    avatarUrl: '',
    city: '',
    bio: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cityIdx, setCityIdx] = useState(-1)

  // 加载已有资料
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res: any = await authApi.getProfile()
        const profile = res.data ?? res
        setForm({
          avatarUrl: profile.avatarUrl || '',
          city: profile.city || '',
          bio: profile.bio || '',
        })
        const idx = CITIES.indexOf(profile.city || '')
        if (idx >= 0) setCityIdx(idx)
      } catch {}
      setLoading(false)
    })()
  }, [])

  // 选择头像
  const handleChooseAvatar = useCallback(async () => {
    try {
      const res = await Taro.chooseImage({ count: 1, sourceType: ['album', 'camera'] })
      const tempPath = res.tempFilePaths[0]
      // 暂时使用临时路径作为头像预览；正式环境应上传到 OSS
      setForm(prev => ({ ...prev, avatarUrl: tempPath }))
      Taro.showToast({ title: '头像已选择', icon: 'success' })
    } catch {
      // 用户取消
    }
  }, [])

  // 城市选择
  const handleCityChange = useCallback((e: any) => {
    const idx = Number(e.detail.value)
    setCityIdx(idx)
    setForm(prev => ({ ...prev, city: CITIES[idx] }))
  }, [])

  // 保存
  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      await authApi.updateProfile({
        avatarUrl: form.avatarUrl || undefined,
        city: form.city || undefined,
        bio: form.bio || undefined,
      })
      // 更新本地存储
      try {
        const raw = Taro.getStorageSync('wc_user')
        if (raw) {
          const u = JSON.parse(raw)
          if (form.avatarUrl) u.avatarUrl = form.avatarUrl
          Taro.setStorageSync('wc_user', JSON.stringify(u))
        }
      } catch {}
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }, [form, saving])

  if (loading) {
    return (
      <View className='page'>
        <View className='loading-area'><Text className='loading-text'>加载中...</Text></View>
      </View>
    )
  }

  return (
    <View className='page'>
      {/* 头像 */}
      <View className='avatar-section' onClick={handleChooseAvatar}>
        {form.avatarUrl ? (
          <Image className='avatar-img' src={form.avatarUrl} mode='aspectFill' />
        ) : (
          <View className='avatar-placeholder'>
            <Text className='avatar-icon'>📷</Text>
          </View>
        )}
        <Text className='avatar-hint'>点击更换头像</Text>
      </View>

      {/* 表单 */}
      <View className='form-section'>
        <Text className='section-title'>基本信息</Text>

        <View className='form-item'>
          <Text className='label'>所在城市</Text>
          <Picker mode='selector' range={CITIES} value={cityIdx >= 0 ? cityIdx : 0} onChange={handleCityChange}>
            <View className='picker-trigger'>
              <Text className={`picker-text ${form.city ? '' : 'placeholder'}`}>
                {form.city || '请选择城市'}
              </Text>
              <Text className='picker-arrow'>›</Text>
            </View>
          </Picker>
        </View>

        <View className='form-item'>
          <Text className='label'>个人简介</Text>
          <Textarea
            className='textarea'
            placeholder='介绍一下自己的专业技能和经验（最多300字）...'
            maxlength={300}
            value={form.bio}
            onInput={(e) => setForm({ ...form, bio: e.detail.value })}
          />
          <Text className='char-count'>{form.bio.length}/300</Text>
        </View>
      </View>

      {/* 认证入口 */}
      <View className='form-section'>
        <View
          className='form-item clickable'
          onClick={() => Taro.navigateTo({ url: '/subpackages/auth/pages/verify/index' })}
        >
          <Text className='label'>实名认证</Text>
          <View className='link-area'>
            <Text className='link-text'>去认证 ›</Text>
          </View>
        </View>
      </View>

      {/* 保存按钮 */}
      <View className='save-area'>
        <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={handleSave}>
          <Text className='save-text'>{saving ? '保存中...' : '保存资料'}</Text>
        </View>
      </View>
    </View>
  )
}
