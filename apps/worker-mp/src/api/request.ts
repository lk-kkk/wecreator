/**
 * WeCreator 小程序端 — HTTP 请求封装
 *
 * R7 · wc-mp-dev · Sprint 1 W1
 *
 * 功能：
 * - 自动注入 Bearer Token
 * - 401 自动刷新 Token（队列机制，防并发刷新）
 * - 统一错误处理（业务错误 code !== 0）
 * - 网络异常友好提示
 */
import Taro from '@tarojs/taro'

const BASE_URL = process.env.TARO_APP_API_BASE || 'http://localhost:3001/api/v1'

// ── Token 刷新队列 ─────────────────────────────────
let isRefreshing = false
let refreshQueue: Array<{
  resolve: (token: string) => void
  reject: (err: Error) => void
}> = []

function processRefreshQueue(error: Error | null, token?: string) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  refreshQueue = []
}

async function refreshToken(): Promise<string> {
  const refreshTk = Taro.getStorageSync('wc_refresh_token')
  if (!refreshTk) {
    throw new Error('无 Refresh Token')
  }

  const res = await Taro.request({
    url: `${BASE_URL}/worker/refresh-token`,
    method: 'POST',
    data: { refreshToken: refreshTk },
    header: { 'Content-Type': 'application/json' },
  })

  if (res.statusCode === 200 && res.data?.code === 0) {
    const newAccess = res.data.data.accessToken
    const newRefresh = res.data.data.refreshToken
    Taro.setStorageSync('wc_token', newAccess)
    if (newRefresh) {
      Taro.setStorageSync('wc_refresh_token', newRefresh)
    }
    return newAccess
  }

  throw new Error('Token 刷新失败')
}

async function getValidToken(): Promise<string> {
  if (isRefreshing) {
    // 正在刷新中 → 排队等待
    return new Promise((resolve, reject) => {
      refreshQueue.push({ resolve, reject })
    })
  }

  isRefreshing = true
  try {
    const token = await refreshToken()
    processRefreshQueue(null, token)
    return token
  } catch (err: any) {
    processRefreshQueue(err)
    throw err
  } finally {
    isRefreshing = false
  }
}

// ── 强制退出登录 ────────────────────────────────────
function forceLogout() {
  Taro.removeStorageSync('wc_token')
  Taro.removeStorageSync('wc_refresh_token')
  Taro.removeStorageSync('wc_user')
  // 跳转首页（Tab页用switchTab）
  Taro.switchTab({ url: '/pages/index/index' })
}

// ── 统一请求接口 ────────────────────────────────────

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  needAuth?: boolean
  /** 内部重试标记 */
  _isRetry?: boolean
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, needAuth = true, _isRetry = false } = options

  const header: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (needAuth) {
    const token = Taro.getStorageSync('wc_token')
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
  }

  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header,
    })

    // ── 401: Token 过期 → 尝试刷新 ──
    if (res.statusCode === 401 && !_isRetry) {
      try {
        const newToken = await getValidToken()
        // 用新 Token 重试原请求
        return request<T>({ ...options, _isRetry: true })
      } catch {
        forceLogout()
        throw new Error('登录已过期，请重新登录')
      }
    }

    // ── 401 重试后仍失败 ──
    if (res.statusCode === 401) {
      forceLogout()
      throw new Error('登录已过期，请重新登录')
    }

    // ── 429: 限流 ──
    if (res.statusCode === 429) {
      throw new Error('操作过于频繁，请稍后再试')
    }

    // ── 5xx: 服务端错误 ──
    if (res.statusCode >= 500) {
      throw new Error('服务器开小差了，请稍后再试')
    }

    // ── 业务层错误 ──
    const body = res.data
    if (body.code !== 0) {
      throw new Error(body.message || '请求失败')
    }

    return body.data as T
  } catch (err: any) {
    // 已经是业务错误，直接抛出
    if (err.message && !err.errMsg) {
      throw err
    }
    // 网络层错误（断网、超时等）
    throw new Error('网络连接异常，请检查网络后重试')
  }
}
