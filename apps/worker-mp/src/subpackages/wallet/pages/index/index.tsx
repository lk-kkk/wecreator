import { useState, useEffect, useCallback } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../../../api/request'
import './index.scss'

function formatAmount(v: number) {
  return v.toFixed(2)
}
function formatTime(ts: string) {
  const d = new Date(ts)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

const typeLabel: Record<string, string> = {
  settlement: '任务结算', withdraw: '提现', refund: '退款',
}

export default function WalletPage() {
  const [wallet, setWallet] = useState({ availableBalance: 0, frozenBalance: 0, totalEarned: 0 })
  const [transactions, setTransactions] = useState<any[]>([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  const loadWallet = useCallback(async () => {
    try {
      const res: any = await request({ url: '/worker/wallet', method: 'GET' })
      setWallet(res.data ?? res)
    } catch {}
  }, [])

  const loadTx = useCallback(async () => {
    try {
      const res: any = await request({ url: '/worker/wallet/transactions', method: 'GET' })
      const data = res.data ?? res
      setTransactions(data.list ?? data)
    } catch {}
  }, [])

  useEffect(() => {
    loadWallet()
    loadTx()
  }, [])

  const handleWithdraw = useCallback(async () => {
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount < 1) {
      Taro.showToast({ title: '最低提现 ¥1', icon: 'none' })
      return
    }
    if (amount > wallet.availableBalance) {
      Taro.showToast({ title: '超出可用余额', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await request({ url: '/worker/wallet/withdraw', method: 'POST', data: { amount } })
      Taro.showToast({ title: '提现申请已提交', icon: 'success' })
      setWithdrawAmount('')
      setShowWithdraw(false)
      setTimeout(() => { loadWallet(); loadTx() }, 2500)
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '提现失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [withdrawAmount, wallet.availableBalance])

  return (
    <ScrollView className='page' scrollY>
      {/* 余额卡片 */}
      <View className='balance-card'>
        <Text className='card-label'>可用余额</Text>
        <Text className='balance-main'>¥{formatAmount(wallet.availableBalance)}</Text>
        <View className='balance-row'>
          <View className='balance-item'>
            <Text className='item-label'>冻结中</Text>
            <Text className='item-value'>¥{formatAmount(wallet.frozenBalance)}</Text>
          </View>
          <View className='balance-item'>
            <Text className='item-label'>累计收入</Text>
            <Text className='item-value green'>¥{formatAmount(wallet.totalEarned)}</Text>
          </View>
        </View>
        <View className='withdraw-btn' onClick={() => setShowWithdraw(true)}>
          <Text className='withdraw-text'>申请提现</Text>
        </View>
      </View>

      {/* 提现表单 */}
      {showWithdraw && (
        <View className='withdraw-form'>
          <Text className='form-title'>提现金额</Text>
          <Input
            className='amount-input'
            type='digit'
            value={withdrawAmount}
            placeholder={`最高 ¥${formatAmount(wallet.availableBalance)}`}
            onInput={(e: any) => setWithdrawAmount(e.detail.value)}
          />
          <View className='form-actions'>
            <View className='cancel-btn' onClick={() => setShowWithdraw(false)}>
              <Text className='cancel-text'>取消</Text>
            </View>
            <View className='confirm-btn' onClick={handleWithdraw}>
              <Text className='confirm-text'>{submitting ? '提交中...' : '确认提现'}</Text>
            </View>
          </View>
        </View>
      )}

      {/* 流水列表 */}
      <View className='section-title'>
        <Text className='section-text'>收支明细</Text>
      </View>
      {transactions.length === 0 && (
        <View className='empty'><Text className='empty-text'>暂无流水记录</Text></View>
      )}
      {transactions.map((t, i) => (
        <View key={t.transactionNo || i} className='tx-item'>
          <View className='tx-left'>
            <Text className='tx-type'>{typeLabel[t.type] || t.type}</Text>
            <Text className='tx-time'>{formatTime(t.createdAt)}</Text>
          </View>
          <Text className={`tx-amount ${t.direction === 'in' ? 'in' : 'out'}`}>
            {t.direction === 'in' ? '+' : '-'}¥{formatAmount(t.amount)}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}
