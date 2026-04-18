/**
 * WeCreator 小程序 — App 入口
 *
 * R7 · wc-mp-dev · Sprint 1 W1
 *
 * 生命周期：
 * - onLaunch: 检查登录状态 → 预加载个人档案
 */
import { useEffect, PropsWithChildren } from 'react'
import Taro from '@tarojs/taro'
import { isLoggedIn, fetchAndCacheProfile } from './utils/wx-login'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    // App 启动时：若已登录则预加载个人档案
    if (isLoggedIn()) {
      fetchAndCacheProfile()
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
  }, [])

  return children
}

export default App
