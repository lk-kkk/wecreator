import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { request } from '../../api/request'
import { useUserStore } from '../../stores/user'
import { unreadPoller } from '../../utils/unread-poller'
import './index.scss'

/* ── 工具函数 ── */

function toArray(res: any): any[] {
  if (!res) return []
  if (Array.isArray(res)) return res
  if (Array.isArray(res.list)) return res.list
  if (Array.isArray(res.data?.list)) return res.data.list
  if (Array.isArray(res.data)) return res.data
  return []
}

/** 完整时间：今天只显示 HH:mm，昨天显示"昨天 HH:mm"，再早显示 M/D HH:mm */
function formatFullTime(ts: any) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === now.toDateString()) return hhmm
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hhmm}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hhmm}`
}

/** 会话列表简短时间 */
function formatShortTime(ts: any) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 判断两条消息间是否需要显示时间戳（间隔 > 5 分钟） */
function shouldShowTime(prev: any, curr: any): boolean {
  if (!prev) return true
  const t1 = new Date(prev.createdAt).getTime()
  const t2 = new Date(curr.createdAt).getTime()
  return Math.abs(t2 - t1) > 5 * 60 * 1000
}

// 通知类型配置
const NOTIF_MAP: Record<string, { icon: string; color: string }> = {
  task_invite:            { icon: '📩', color: '#1890ff' },
  task_accepted:          { icon: '✅', color: '#52c41a' },
  task_rejected:          { icon: '❌', color: '#ff4d4f' },
  deliverable_submitted:  { icon: '📦', color: '#722ed1' },
  review_result:          { icon: '📋', color: '#13c2c2' },
  settlement_completed:   { icon: '💰', color: '#faad14' },
  withdraw_completed:     { icon: '🏦', color: '#52c41a' },
  system:                 { icon: '🔔', color: '#999' },
}

/** 任务状态映射 */
const TASK_STATUS_LABEL: Record<string, string> = {
  draft: '草稿', pending_review: '待审核', published: '招募中',
  in_progress: '进行中', reviewing: '验收中',
  pending_payment: '待付款', completed: '已完成', closed: '已关闭',
}

/** 任务模式映射 */
const TASK_MODE_LABEL: Record<string, string> = {
  task_package: '任务包', fixed_price: '固定价格',
  hourly: '按时计费', milestone: '里程碑',
  bidding: '竞标', recruitment: '招募',
}

function formatDateRange(start: any, end: any) {
  const fmt = (d: any) => {
    if (!d) return ''
    const dt = new Date(d)
    return `${dt.getMonth() + 1}/${dt.getDate()}`
  }
  if (start && end) return `${fmt(start)} - ${fmt(end)}`
  if (start) return `${fmt(start)} 开始`
  if (end) return `截止 ${fmt(end)}`
  return '时间待定'
}

/* ══════════════════════════════════════════════════════════════ */

export default function MessagePage() {
  const userStore = useUserStore()
  const [tab, setTab] = useState<'notifications' | 'chat'>('notifications')

  // ── 通知 ──
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifUnread, setNotifUnread] = useState(0)
  const [expandedNotifId, setExpandedNotifId] = useState<number | null>(null)

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const res: any = await request({ url: '/notifications', method: 'GET', data: { page: 1, pageSize: 50 } })
      setNotifications(toArray(res))
      const countRes: any = await request({ url: '/notifications/unread-count', method: 'GET' })
      setNotifUnread(countRes?.count ?? countRes?.data?.count ?? 0)
    } catch {} finally { setNotifLoading(false) }
  }, [])

  const markNotifRead = useCallback(async (id: number) => {
    try {
      await request({ url: `/notifications/${id}/read`, method: 'PUT' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setNotifUnread(prev => Math.max(0, prev - 1))
    } catch {}
  }, [])

  const markAllNotifRead = useCallback(async () => {
    try {
      await request({ url: '/notifications/read-all', method: 'PUT' })
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setNotifUnread(0)
    } catch {}
  }, [])

  const handleNotifClick = useCallback((notif: any) => {
    if (!notif.isRead) markNotifRead(notif.id)
    // 切换展开/折叠
    setExpandedNotifId(prev => prev === notif.id ? null : notif.id)
  }, [markNotifRead])

  // 点击任务卡片 → 跳转任务详情
  const goToTask = useCallback((taskId: number) => {
    Taro.navigateTo({ url: `/subpackages/task/pages/detail/index?taskId=${taskId}` })
  }, [])

  // ── 聊天 ──
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputText, setInputText] = useState('')
  const [loadingList, setLoadingList] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [sending, setSending] = useState(false)
  const scrollToView = useRef('')
  const pollTimer = useRef<any>(null)

  const loadConversations = useCallback(async () => {
    setLoadingList(true)
    try {
      const res: any = await request({ url: '/conversations', method: 'GET', data: { page: 1, pageSize: 50 } })
      setConversations(toArray(res))
    } catch {} finally { setLoadingList(false) }
  }, [])

  const scrollToBottom = useCallback(() => {
    scrollToView.current = `msg-anchor-${Date.now()}`
  }, [])

  const loadHistory = useCallback(async (convId: number) => {
    setLoadingMsg(true)
    try {
      const res: any = await request({ url: `/conversations/${convId}/messages`, method: 'GET', data: { page: 1, pageSize: 50 } })
      setMessages(toArray(res).slice().reverse())
      setTimeout(scrollToBottom, 100)
    } catch { setMessages([]) } finally { setLoadingMsg(false) }
  }, [scrollToBottom])

  const startPoll = useCallback((convId: number) => {
    stopPoll()
    pollTimer.current = setInterval(async () => {
      try {
        const res: any = await request({ url: `/conversations/${convId}/messages`, method: 'GET', data: { page: 1, pageSize: 50 } })
        const list = toArray(res).slice().reverse()
        setMessages(prev => {
          if (list.length !== prev.length) { setTimeout(scrollToBottom, 50); return list }
          return list
        })
      } catch {}
    }, 5000)
  }, [scrollToBottom])

  function stopPoll() {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
  }

  useEffect(() => {
    loadNotifications()
    loadConversations()
    return () => stopPoll()
  }, [loadNotifications, loadConversations])

  useDidShow(() => {
    if (activeConv) loadHistory(activeConv.id)
    else { if (tab === 'notifications') loadNotifications(); else loadConversations() }
  })

  const openConversation = useCallback(async (conv: any) => {
    setActiveConv(conv)
    setMessages([])
    await loadHistory(conv.id)
    startPoll(conv.id)
    unreadPoller.refresh()
  }, [loadHistory, startPoll])

  const closeConversation = useCallback(() => {
    stopPoll()
    setActiveConv(null)
    setMessages([])
    loadConversations()
    unreadPoller.refresh()
  }, [loadConversations])

  const sendMessage = useCallback(async () => {
    const text = inputText.trim()
    if (!text || !activeConv || sending) return
    const tempId = `t${Date.now()}`
    setMessages(prev => [...prev, {
      tempId, senderId: userStore.userId, senderType: 'worker',
      content: text, createdAt: new Date().toISOString(),
    }])
    setInputText('')
    setSending(true)
    setTimeout(scrollToBottom, 50)
    try {
      const res: any = await request({ url: `/conversations/${activeConv.id}/messages`, method: 'POST', data: { content: text, type: 'text' } })
      if (res) setMessages(prev => prev.map(m => m.tempId === tempId ? res : m))
      unreadPoller.refresh()
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.tempId !== tempId))
      Taro.showToast({ title: err?.message || '发送失败', icon: 'none' })
    } finally { setSending(false) }
  }, [inputText, activeConv, sending, userStore.userId, scrollToBottom])

  /* ═══════════════════════════════════════════════
   *  微信风格聊天界面
   * ═══════════════════════════════════════════════ */
  if (activeConv) {
    const myId = userStore.userId
    return (
      <View className='wechat-chat'>
        {/* 导航栏 */}
        <View className='wc-navbar'>
          <View className='wc-navbar-back' onClick={closeConversation}>
            <Text className='wc-navbar-arrow'>‹</Text>
          </View>
          <Text className='wc-navbar-title'>任务#{activeConv.taskId}</Text>
          <View className='wc-navbar-right' />
        </View>

        {/* 消息列表 */}
        <ScrollView
          className='wc-msg-list'
          scrollY
          scrollIntoView={scrollToView.current}
          scrollWithAnimation
          enhanced
          showScrollbar={false}
        >
          {loadingMsg && messages.length === 0 && (
            <View className='wc-loading'><Text className='wc-loading-text'>加载中...</Text></View>
          )}

          {messages.map((msg, i) => {
            const isSelf = msg.senderType === 'worker'
              ? (msg.senderId === myId || !!msg.tempId) : false
            const showTime = shouldShowTime(messages[i - 1], msg)

            return (
              <View key={msg.id || msg._id || msg.tempId || i}>
                {/* 时间胶囊 */}
                {showTime && (
                  <View className='wc-time-capsule'>
                    <Text className='wc-time-text'>{formatFullTime(msg.createdAt)}</Text>
                  </View>
                )}

                {/* 消息行 */}
                <View className={`wc-msg-row ${isSelf ? 'wc-msg-self' : 'wc-msg-other'}`}>
                  {/* 对方头像 */}
                  {!isSelf && (
                    <View className='wc-avatar wc-avatar-other'>
                      <Text className='wc-avatar-text'>企</Text>
                    </View>
                  )}

                  {/* 气泡 */}
                  <View className={`wc-bubble ${isSelf ? 'wc-bubble-green' : 'wc-bubble-white'}`}>
                    {/* 尖角 */}
                    <View className={`wc-arrow ${isSelf ? 'wc-arrow-right' : 'wc-arrow-left'}`} />
                    <Text className={`wc-bubble-text ${isSelf ? 'wc-text-dark' : 'wc-text-dark'}`}>{msg.content}</Text>
                  </View>

                  {/* 自己头像 */}
                  {isSelf && (
                    <View className='wc-avatar wc-avatar-self'>
                      <Text className='wc-avatar-text'>{(userStore.nickname || '我')[0]}</Text>
                    </View>
                  )}
                </View>
              </View>
            )
          })}

          <View id={scrollToView.current} style={{ height: '1rpx' }} />
        </ScrollView>

        {/* 底部输入栏 */}
        <View className='wc-input-bar'>
          <View className='wc-input-wrap'>
            <Input
              className='wc-input'
              value={inputText}
              placeholder='输入消息...'
              placeholderClass='wc-input-placeholder'
              onInput={(e: any) => setInputText(e.detail.value)}
              onConfirm={sendMessage}
              confirmType='send'
              adjustPosition
              cursorSpacing={12}
            />
          </View>
          {inputText.trim() ? (
            <View className='wc-send-btn' onClick={sendMessage}>
              <Text className='wc-send-text'>{sending ? '...' : '发送'}</Text>
            </View>
          ) : (
            <View className='wc-plus-btn'>
              <Text className='wc-plus-icon'>+</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  /* ═══════════════════════════════════════════════
   *  列表页（通知 / 聊天 Tab）
   * ═══════════════════════════════════════════════ */
  return (
    <View className='page'>
      {/* Tab 切换 */}
      <View className='msg-tabs'>
        <View
          className={`msg-tab ${tab === 'notifications' ? 'msg-tab-active' : ''}`}
          onClick={() => { setTab('notifications'); loadNotifications() }}
        >
          <Text className='msg-tab-text'>通知</Text>
          {notifUnread > 0 && (
            <View className='tab-badge'><Text className='tab-badge-text'>{notifUnread > 99 ? '99+' : notifUnread}</Text></View>
          )}
        </View>
        <View
          className={`msg-tab ${tab === 'chat' ? 'msg-tab-active' : ''}`}
          onClick={() => { setTab('chat'); loadConversations() }}
        >
          <Text className='msg-tab-text'>聊天</Text>
        </View>
      </View>

      {/* ── 通知列表 ── */}
      {tab === 'notifications' && (
        <ScrollView className='notif-scroll' scrollY>
          {notifUnread > 0 && (
            <View className='notif-read-all' onClick={markAllNotifRead}>
              <Text className='notif-read-all-text'>全部已读</Text>
            </View>
          )}
          {notifications.length === 0 && !notifLoading && (
            <View className='empty'><Text className='empty-text'>暂无通知</Text></View>
          )}
          {notifLoading && notifications.length === 0 && (
            <View className='empty'><Text className='empty-text'>加载中…</Text></View>
          )}
          {notifications.map(notif => {
            const cfg = NOTIF_MAP[notif.type] || NOTIF_MAP.system
            const isExpanded = expandedNotifId === notif.id
            const task = notif.task
            return (
              <View key={notif.id} className='notif-card'>
                <View
                  className={`notif-item ${notif.isRead ? '' : 'notif-unread'}`}
                  onClick={() => handleNotifClick(notif)}
                >
                  <View className='notif-icon-wrap'>
                    <Text className='notif-icon-emoji'>{cfg.icon}</Text>
                  </View>
                  <View className='notif-body'>
                    <View className='notif-header'>
                      <Text className='notif-title'>{notif.title}</Text>
                      <Text className='notif-time'>{formatShortTime(notif.createdAt)}</Text>
                    </View>
                    <Text className='notif-content'>{notif.content}</Text>
                  </View>
                  {!notif.isRead && <View className='notif-red-dot' />}
                  {task && (
                    <View className='notif-expand-icon'>
                      <Text className={`expand-arrow ${isExpanded ? 'expand-arrow-up' : ''}`}>›</Text>
                    </View>
                  )}
                </View>

                {/* 展开的任务简要信息卡片 */}
                {isExpanded && task && (
                  <View className='notif-task-card' onClick={() => goToTask(task.taskId)}>
                    <View className='task-card-header'>
                      <Text className='task-card-title'>{task.title}</Text>
                      <View className='task-card-status'>
                        <Text className='task-card-status-text'>{TASK_STATUS_LABEL[task.status] || task.status}</Text>
                      </View>
                    </View>
                    <View className='task-card-info'>
                      <View className='task-info-row'>
                        <Text className='task-info-icon'>📅</Text>
                        <Text className='task-info-label'>任务时间</Text>
                        <Text className='task-info-value'>{formatDateRange(task.startDate, task.endDate)}</Text>
                      </View>
                      <View className='task-info-row'>
                        <Text className='task-info-icon'>💰</Text>
                        <Text className='task-info-label'>任务报酬</Text>
                        <Text className='task-info-value task-info-price'>¥{Number(task.totalBudget).toLocaleString()}</Text>
                      </View>
                      <View className='task-info-row'>
                        <Text className='task-info-icon'>💼</Text>
                        <Text className='task-info-label'>任务模式</Text>
                        <Text className='task-info-value'>{TASK_MODE_LABEL[task.taskMode] || task.taskMode}</Text>
                      </View>
                    </View>
                    <View className='task-card-footer'>
                      <Text className='task-card-link'>查看任务详情 ›</Text>
                    </View>
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* ── 聊天会话列表（微信风格） ── */}
      {tab === 'chat' && (
        <ScrollView className='conv-scroll' scrollY>
          {conversations.length === 0 && !loadingList && (
            <View className='empty'><Text className='empty-text'>暂无会话</Text></View>
          )}
          {conversations.map(conv => (
            <View key={conv.id} className='conv-item' onClick={() => openConversation(conv)}>
              <View className='conv-avatar'>
                <Text className='conv-avatar-text'>企</Text>
              </View>
              <View className='conv-body'>
                <View className='conv-top'>
                  <Text className='conv-name'>任务#{conv.taskId}</Text>
                  <Text className='conv-time'>{formatShortTime(conv.lastMessage?.createdAt || conv.lastMsgAt)}</Text>
                </View>
                <View className='conv-bottom'>
                  <Text className='conv-snippet'>{conv.lastMessage?.content || '暂无消息'}</Text>
                  {conv.unreadCount > 0 && (
                    <View className='conv-badge'>
                      <Text className='conv-badge-text'>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
