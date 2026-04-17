import { useState, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { authApi } from '../../../../api/auth'
import './index.scss'

export default function VerifyPage() {
  const [realName, setRealName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = useCallback(async () => {
    if (!realName.trim()) {
      Taro.showToast({ title: '请输入真实姓名', icon: 'none' }); return
    }
    if (!/^\d{17}[\dXx]$/.test(idCard)) {
      Taro.showToast({ title: '身份证号格式不正确', icon: 'none' }); return
    }
    if (loading) return

    setLoading(true)
    try {
      await authApi.verify(realName, idCard)
      Taro.showToast({ title: '认证成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err: any) {
      Taro.showToast({ title: err.message || '认证失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [realName, idCard, loading])

  return (
    <View className='page'>
      <View className='verify-card'>
        <Text className='card-title'>实名认证</Text>
        <Text className='card-desc'>认证后可接受任务邀约</Text>

        <View className='form-item'>
          <Text className='label'>真实姓名</Text>
          <Input
            className='input'
            placeholder='请输入身份证上的姓名'
            value={realName}
            onInput={(e) => setRealName(e.detail.value)}
          />
        </View>

        <View className='form-item'>
          <Text className='label'>身份证号</Text>
          <Input
            className='input'
            placeholder='18位身份证号码'
            maxlength={18}
            value={idCard}
            onInput={(e) => setIdCard(e.detail.value)}
          />
        </View>

        <View className='verify-notice'>
          <Text className='notice-text'>
            您的身份信息将加密存储，仅用于平台合规结算，不会泄露给第三方。
          </Text>
        </View>
      </View>

      <View className='action-btn' onClick={handleVerify}>
        <Text className='action-btn-text'>{loading ? '认证中...' : '提交认证'}</Text>
      </View>
    </View>
  )
}
