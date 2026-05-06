/**
 * 未读消息轮询器
 *
 * 职责：
 * - 登录状态下每 30 秒调一次 GET /conversations，累加 unreadCount
 * - 给底部「消息」Tab（index=2）设置角标（showBadge / setTabBarBadge / removeTabBarBadge）
 * - 可被消息页在「打开会话/发送消息/返回列表」时主动调用 refresh() 同步
 * - App 切到后台自动停，切回前台自动恢复
 *
 * 使用：
 *   import { unreadPoller } from './utils/unread-poller'
 *   unreadPoller.start()   // 在 App onLaunch / useEffect 里调用一次
 *   unreadPoller.refresh() // 关键操作后手动同步
 *   unreadPoller.stop()    // 登出/后台时
 */
import Taro from '@tarojs/taro'
import { request } from '../api/request'

// 底部 Tab 中「消息」的索引（与 app.config.ts 中 tabBar.list 顺序一致）
const MESSAGE_TAB_INDEX = 2
const POLL_INTERVAL_MS = 30 * 1000

type State = {
  timer: any
  lastCount: number
  running: boolean
}

const state: State = {
  timer: null,
  lastCount: -1,
  running: false,
}

function isLoggedIn(): boolean {
  try {
    return !!Taro.getStorageSync('wc_token')
  } catch {
    return false
  }
}

async function fetchUnreadCount(): Promise<number> {
  // 会话未读
  let chatUnread = 0
  try {
    const res: any = await request({ url: '/conversations', method: 'GET', data: { page: 1, pageSize: 100 } })
    const list: any[] = Array.isArray(res) ? res
      : Array.isArray(res?.list) ? res.list
      : Array.isArray(res?.data?.list) ? res.data.list
      : []
    chatUnread = list.reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0)
  } catch {}

  // 通知未读
  let notifUnread = 0
  try {
    const res2: any = await request({ url: '/notifications/unread-count', method: 'GET' })
    notifUnread = res2?.count ?? res2?.data?.count ?? 0
  } catch {}

  return chatUnread + notifUnread
}

function applyBadge(count: number) {
  if (state.lastCount === count) return
  state.lastCount = count
  try {
    if (count > 0) {
      Taro.setTabBarBadge({
        index: MESSAGE_TAB_INDEX,
        text: count > 99 ? '99+' : String(count),
      }).catch(() => {})
    } else {
      Taro.removeTabBarBadge({ index: MESSAGE_TAB_INDEX }).catch(() => {})
    }
  } catch {
    // 非 TabBar 页面调用会 fail，忽略
  }
}

async function tick() {
  if (!isLoggedIn()) {
    applyBadge(0)
    return
  }
  try {
    const n = await fetchUnreadCount()
    applyBadge(n)
  } catch {
    // 静默失败；下次再试
  }
}

export const unreadPoller = {
  /** 启动轮询（幂等，重复调用只会保留一个 timer） */
  start() {
    if (state.running) return
    state.running = true
    // 启动时立即取一次
    tick()
    state.timer = setInterval(tick, POLL_INTERVAL_MS)
  },

  /** 停止轮询 */
  stop() {
    if (state.timer) {
      clearInterval(state.timer)
      state.timer = null
    }
    state.running = false
  },

  /** 手动触发一次（消息操作后立即同步） */
  refresh() {
    tick()
  },

  /** 登出时把角标清掉 */
  clear() {
    applyBadge(0)
  },
}
