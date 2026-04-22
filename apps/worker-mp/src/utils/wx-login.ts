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
 * 开发环境：为保证同一设备始终映射到同一 worker,
 *   前端生成一次性 mockDeviceId 存 storage,每次登录拼入 code,
 *   后端按稳定 code → 稳定 openid 识别用户。
 *   清除小程序缓存 = 切换成新用户。
 */
import Taro from '@tarojs/taro'
import { authApi } from '../api/auth'
import { saveLoginData, clearUserData, saveProfile } from '../stores/user'

// ── 微信登录 ────────────────────────────────────────

export interface LoginOutcome {
  isNew: boolean
  isVerified: boolean
}

const MOCK_DEVICE_ID_KEY = 'wc_mock_device_id'

/**
 * 获取或生成稳定的 mock 设备 ID (仅 dev 环境使用)
 * 保证同一台设备/模拟器在清缓存前永远映射到同一个 worker
 */
function getOrCreateMockDeviceId(): string {
  let id = Taro.getStorageSync(MOCK_DEVICE_ID_KEY) as string
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
    Taro.setStorageSync(MOCK_DEVICE_ID_KEY, id)
  }
  return id
}

/**
 * 组合 code: dev 环境把稳定设备 ID 拼到真实 code 后面,
 * 使 `dev_openid_${code}` 在同设备重复登录时保持不变。
 * 生产环境: 直接用 Taro.login 返回的原始 code (真实微信 5min 一次性)。
 */
function buildLoginCode(realCode: string): string {
  if (process.env.NODE_ENV === 'production') {
    return realCode
  }
  return getOrCreateMockDeviceId()
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

  // 2. 后端换取 Token (dev 环境使用稳定 mockDeviceId 代替一次性 code)
  const result = await authApi.login(buildLoginCode(loginRes.code))

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
 * 注意: 保留 mock 设备 ID, 下次登录仍回到同一 worker
 */
export function logout() {
  clearUserData()
}

/**
 * 开发环境专用: 重置 mock 设备 ID
 * 下次登录会创建/映射到一个新 worker (等同于换账号)
 */
export function resetMockDeviceId() {
  if (process.env.NODE_ENV !== 'production') {
    Taro.removeStorageSync(MOCK_DEVICE_ID_KEY)
  }
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
