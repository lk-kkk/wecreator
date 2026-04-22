import { useState, useEffect, useCallback, useRef } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { request } from '../../api/request'
import { useUserStore } from '../../stores/user'
import './index.scss'

function formatTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function MessagePage() {
  const userStore = useUserStore()
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConv, setActiveConv] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [inputText, setInputText] = useState('')
  const wsRef = useRef<any>(null)
  const msgScrollId = useRef(`scroll-${Date.now()}`)

  // 加载会话列表
  const loadConversations = useCallback(async () => {
    try {
      const res: any = await request({ url: '/conversations', method: 'GET' })
      setConversations(res.data ?? res)
    } catch {}
  }, [])

  // 加载聊天记录
  const loadHistory = useCallback(async (convId: number) => {
    try {
      const res: any = await request({ url: `/conversations/${convId}/messages`, method: 'GET' })
      setMessages(res.data ?? res)
    } catch {}
  }, [])

  // WebSocket 连接
  const connectWs = useCallback(() => {
    const token = Taro.getStorageSync('wc_token')
    if (!token) return
    const apiBase = (process.env.TARO_APP_API_BASE as string || 'http://localhost:3000/api/v1')
    const wsBase = apiBase.replace('/api/v1', '').replace('http', 'ws')
    const wsTask = Taro.connectSocket({
      url: `${wsBase}/chat?token=${token}`,
      protocols: [],
    })
    wsRef.current = wsTask
    ;(wsTask as any).onMessage?.((msgEvent: any) => {
      try {
        const data = JSON.parse(msgEvent.data as string)
        if (data.event === 'new_message') {
          const msg = data.data
          setMessages(prev => [...prev, msg])
          // 更新会话列表最后消息
          setConversations(prev => prev.map(c =>
            c.id === msg.conversationId ? { ...c, lastMsgAt: msg.createdAt } : c
          ))
        }
      } catch {}
    })
  }, [])

  useEffect(() => {
    loadConversations()
    connectWs()
    return () => wsRef.current?.close?.()
  }, [])

  const openConversation = useCallback(async (conv: any) => {
    setActiveConv(conv)
    setMessages([])
    await loadHistory(conv.id)
  }, [loadHistory])

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !wsRef.current || !activeConv) return
    const payload = {
      event: 'send_message',
      data: {
        conversationId: activeConv.id,
        receiverId: activeConv.companyUserId,
        content: inputText.trim(),
        taskId: activeConv.taskId,
      },
    }
    wsRef.current.send({ data: JSON.stringify(payload) })
    // 乐观更新
    setMessages(prev => [...prev, {
      tempId: `t${Date.now()}`,
      senderId: userStore.userId,
      senderType: 'worker',
      content: inputText.trim(),
      createdAt: new Date().toISOString(),
    }])
    setInputText('')
  }, [inputText, activeConv, userStore.userId])

  // 会话列表视图
  if (!activeConv) {
    return (
      <View className='page'>
        <View className='top-bar'>
          <Text className='page-title'>消息</Text>
        </View>
        {conversations.length === 0 && (
          <View className='empty'>
            <Text className='empty-text'>暂无会话</Text>
          </View>
        )}
        {conversations.map(conv => (
          <View key={conv.id} className='conv-item' onClick={() => openConversation(conv)}>
            <View className='conv-avatar'>
              <Text className='avatar-text'>企</Text>
            </View>
            <View className='conv-info'>
              <Text className='conv-title'>任务#{conv.taskId}</Text>
              <Text className='conv-last-msg'>{conv.lastMsg || '暂无消息'}</Text>
            </View>
            <Text className='conv-time'>{conv.lastMsgAt ? formatTime(conv.lastMsgAt) : ''}</Text>
          </View>
        ))}
      </View>
    )
  }

  // 聊天视图
  const myId = userStore.userId
  return (
    <View className='page chat-page'>
      <View className='chat-header'>
        <Text className='back-btn' onClick={() => setActiveConv(null)}>‹ 返回</Text>
        <Text className='chat-title'>任务#{activeConv.taskId}</Text>
      </View>
      <ScrollView
        className='msg-scroll'
        scrollY
        scrollIntoView={msgScrollId.current}
        scrollWithAnimation
      >
        {messages.map((msg, i) => {
          const isSelf = msg.senderId === myId && msg.senderType === 'worker'
          return (
            <View key={msg._id || msg.tempId || i} className={`msg-row ${isSelf ? 'self' : 'other'}`}>
              <View className={`bubble ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
                <Text className='bubble-text'>{msg.content}</Text>
              </View>
              <Text className='msg-time'>{formatTime(msg.createdAt)}</Text>
            </View>
          )
        })}
        <View id={msgScrollId.current} />
      </ScrollView>
      <View className='input-bar'>
        <Input
          className='msg-input'
          value={inputText}
          placeholder='说点什么...'
          onInput={(e: any) => setInputText(e.detail.value)}
          onConfirm={sendMessage}
          confirmType='send'
        />
        <View className='send-btn' onClick={sendMessage}>
          <Text className='send-text'>发送</Text>
        </View>
      </View>
    </View>
  )
}
