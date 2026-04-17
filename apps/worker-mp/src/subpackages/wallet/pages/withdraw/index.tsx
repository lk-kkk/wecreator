import { useState, useEffect, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../../../api/request'
import './index.scss'

export default function WithdrawPage() {
  const [wallet, setWallet] = useState({ availableBalance: 0, frozenBalance: 0, totalEarned: 0 })
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res: any = await request({ url: '/worker/wallet', method: 'GET' })
        setWallet(res)
      } catch {}
    })()
  }, [])

  const handleWithdrawAll = useCallback(() => {
    setAmount(String(wallet.availableBalance || 0))
  }, [wallet])

  const handleSubmit = useCallback(async () => {
    const val = parseFloat(amount)
    if (!val || val < 1) {
      Taro.showToast({ title: '最低提现 ¥1', icon: 'none' })
      return
    }
    if (val > wallet.availableBalance) {
      Taro.showToast({ title: '余额不足', icon: 'none' })
      return
    }

    const { confirm } = await Taro.showModal({
      title: '确认提现',
      content: `确定提现 ¥${val.toFixed(2)} 到您的微信零钱？`,
      confirmText: '确认提现',
    })
    if (!confirm) return

    setSubmitting(true)
    try {
      await request({ url: '/worker/wallet/withdraw', method: 'POST', data: { amount: val } })
      Taro.showToast({ title: '提现申请已提交', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1500)
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '提现失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [amount, wallet, submitting])

  return (
    <View className='page'>
      {/* 余额展示 */}
      <View className='balance-card'>
        <Text className='balance-label'>可提现余额</Text>
        <Text className='balance-amount'>¥{(wallet.availableBalance || 0).toFixed(2)}</Text>
      </View>

      {/* 金额输入 */}
      <View className='input-card'>
        <Text className='input-label'>提现金额</Text>
        <View className='amount-row'>
          <Text className='yuan-sign'>¥</Text>
          <Input
            className='amount-input'
            type='digit'
            placeholder='0.00'
            value={amount}
            onInput={(e) => setAmount(e.detail.value)}
          />
        </View>
        <View className='input-footer'>
          <Text className='min-hint'>最低提现 ¥1.00</Text>
          <Text className='withdraw-all' onClick={handleWithdrawAll}>全部提现</Text>
        </View>
      </View>

      {/* 说明 */}
      <View className='notice-card'>
        <Text className='notice-title'>提现说明</Text>
        <Text className='notice-text'>• 提现将转入您绑定的微信零钱账户</Text>
        <Text className='notice-text'>• 提现申请提交后，预计1-3个工作日到账</Text>
        <Text className='notice-text'>• 冻结中的金额需等待任务结算后方可提现</Text>
      </View>

      {/* 提交按钮 */}
      <View className='submit-area'>
        <View className={`submit-btn ${submitting ? 'disabled' : ''}`} onClick={handleSubmit}>
          <Text className='submit-text'>{submitting ? '提交中...' : '确认提现'}</Text>
        </View>
      </View>
    </View>
  )
}
