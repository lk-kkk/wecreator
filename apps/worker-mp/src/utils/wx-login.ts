import Taro from '@tarojs/taro'
import { authApi } from '../api/auth'

/**
 * 微信登录完整流程：
 * 1. wx.login 获取 code
 * 2. 发送 code 到后端换取 JWT
 * 3. 存储 token 到本地
 */
export async function wxLogin(): Promise<{
  isNew: boolean
  isVerified: boolean
}> {
  // 1. 获取微信 code
  const loginRes = await Taro.login()
  if (!loginRes.code) {
    throw new Error('微信登录失败，未获取到code')
  }

  // 2. 后端换取 token
  const result = await authApi.login(loginRes.code)

  // 3. 存储 token
  Taro.setStorageSync('wc_token', result.accessToken)
  Taro.setStorageSync('wc_refresh_token', result.refreshToken)
  Taro.setStorageSync('wc_user', JSON.stringify(result.user))

  return {
    isNew: result.isNew,
    isVerified: result.user.isVerified,
  }
}

/**
 * 开发环境：使用指定 code 登录（跳过 wx.login）
 */
export async function devLogin(code: string): Promise<{
  isNew: boolean
  isVerified: boolean
}> {
  const result = await authApi.login(code)
  Taro.setStorageSync('wc_token', result.accessToken)
  Taro.setStorageSync('wc_refresh_token', result.refreshToken)
  Taro.setStorageSync('wc_user', JSON.stringify(result.user))
  return {
    isNew: result.isNew,
    isVerified: result.user.isVerified,
  }
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
  return !!Taro.getStorageSync('wc_token')
}

/**
 * 退出登录
 */
export function logout() {
  Taro.removeStorageSync('wc_token')
  Taro.removeStorageSync('wc_refresh_token')
  Taro.removeStorageSync('wc_user')
}

/**
 * 获取当前用户信息
 */
export function getCurrentUser() {
  const raw = Taro.getStorageSync('wc_user')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
