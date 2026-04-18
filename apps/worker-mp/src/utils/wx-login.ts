/**
 * WeCreator 小程序端 — 微信登录工具
 *
 * R7 · wc-mp-dev · Sprint 1 W1
 *
 * 完整流程：
 * 1. wx.login() 获取临时 code
 * 2. POST /worker/login 发送 code 到后端
 * 3. 后端用 code 调用微信 jscode2session 换取 openid
 * 4. 后端返回 JWT 双 Token（access 2h + refresh 7d）
 * 5. 本地持久化 Token + 用户信息
 *
 * 开发环境：code 直接当 openid 用（后端 mock）
 */
import Taro from '@tarojs/taro'
import { authApi } from '../api/auth'
import { saveLoginData, clearUserData, saveProfile } from '../stores/user'

// ── 微信登录 ────────────────────────────────────────

export interface LoginOutcome {
  isNew: boolean
  isVerified: boolean
}

/**
 * 正式微信登录流程
 * @returns { isNew: boolean; isVerified: boolean }
 */
export async function wxLogin(): Promise<LoginOutcome> {
  // 1. 获取微信 code
  const loginRes = await Taro.login()
  if (!loginRes.code) {
    throw new Error('微信登录失败，未获取到 code')
  }

  // 2. 后端换取 Token
  const result = await authApi.login(loginRes.code)

  // 3. 持久化
  saveLoginData({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  })

  return {
    isNew: result.isNew,
    isVerified: result.user.isVerified,
  }
}

/**
 * 开发环境调试登录（跳过 wx.login，直接用指定 code）
 */
export async function devLogin(code: string): Promise<LoginOutcome> {
  const result = await authApi.login(code)

  saveLoginData({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  })

  return {
    isNew: result.isNew,
    isVerified: result.user.isVerified,
  }
}

// ── 状态查询 ────────────────────────────────────────

/**
 * 检查是否已登录（有 Token）
 */
export function isLoggedIn(): boolean {
  return !!Taro.getStorageSync('wc_token')
}

/**
 * 退出登录 — 清除 Token + 用户信息
 */
export function logout() {
  clearUserData()
}

/**
 * 获取当前用户基本信息（从 Storage 读取）
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

// ── 主动拉取档案 ────────────────────────────────────

/**
 * 获取完整个人档案并缓存
 * 通常在登录成功后或进入"我的"页面时调用
 */
export async function fetchAndCacheProfile(): Promise<void> {
  try {
    const profile = await authApi.getProfile()
    saveProfile(profile)
  } catch {
    // 静默失败，下次进入页面会重试
  }
}
