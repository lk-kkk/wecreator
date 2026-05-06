/**
 * WeCreator 小程序 — App 入口
 *
 * R7 · wc-mp-dev · Sprint 1 W1
 *
 * 生命周期：
 * - onLaunch: 检查登录状态 → 校验 token 有效性 → 预加载个人档案
 *   若 token 过期 或 对应 worker 已删除 (401/404),自动清除本地状态回到未登录界面
 * - onShow: 启动未读消息轮询（每 30 秒，用于更新底部消息 Tab 角标）
 * - onHide: 停止轮询，节省电量
 */
import { useEffect, PropsWithChildren } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { isLoggedIn, fetchAndCacheProfile } from './utils/wx-login'
import { clearUserData } from './stores/user'
import { unreadPoller } from './utils/unread-poller'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    // App 启动: 若 storage 里有 token → 校验有效性
    if (isLoggedIn()) {
      fetchAndCacheProfile().then((ok) => {
        if (!ok) {
          // profile 拉取失败 (token 失效 / worker 已删)
          // → 清除本地登录状态, 触发 emitChange 让首页 UI 重渲染为登录按钮
          clearUserData()
          unreadPoller.clear()
          unreadPoller.stop()
        }
      })
    }

    // 检查系统信息（用于适配安全区域等）
    try {
      const sysInfo = Taro.getSystemInfoSync()
      Taro.setStorageSync('wc_sys_info', JSON.stringify({
        statusBarHeight: sysInfo.statusBarHeight,
        screenWidth: sysInfo.screenWidth,
        screenHeight: sysInfo.screenHeight,
        platform: sysInfo.platform,
        SDKVersion: sysInfo.SDKVersion,
      }))
    } catch {
      // ignore
    }

    // 未登录时也允许先启动，内部会幂等守卫
    unreadPoller.start()

    return () => {
      unreadPoller.stop()
    }
  }, [])

  // 切回前台 → 恢复轮询并立即拉一次
  useDidShow(() => {
    unreadPoller.start()
    unreadPoller.refresh()
  })

  // 切到后台 → 停止轮询
  useDidHide(() => {
    unreadPoller.stop()
  })

  return children
}

export default App
