import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import { message as antMessage } from 'ant-design-vue'

// ================================================================
// WeCreator API 请求层
// 功能：JWT 自动注入 · Token 过期自动续期 · 队列排队 · 统一错误处理
// ================================================================

const request: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
})

// ── Token 续期锁 ──────────────────────────────
let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: any) => void
}> = []

function processPendingQueue(token: string | null, error?: any) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(error)
  })
  pendingQueue = []
}

// ── 请求拦截：自动附加 JWT Token ──────────────
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('wc_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// ── 响应拦截：解包 + 自动续期 ─────────────────
request.interceptors.response.use(
  (response) => {
    const body = response.data
    // 后端 ResponseInterceptor 统一格式: { code: 0, data, message, timestamp }
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== 0) {
        const errMsg = body.message || '请求失败'
        return Promise.reject(new Error(errMsg))
      }
      return body.data // 解包返回业务数据
    }
    return body
  },
  async (error: AxiosError) => {
    const status = error.response?.status
    const originalConfig = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const responseData = error.response?.data as any

    // ── 401: 尝试自动续期 Token ───────────────
    if (status === 401 && originalConfig && !originalConfig._retry) {
      // 排除登录/注册/刷新接口本身
      const url = originalConfig.url || ''
      const noRetryPaths = ['/enterprise/login', '/enterprise/register', '/enterprise/refresh-token']
      if (noRetryPaths.some((p) => url.includes(p))) {
        forceLogout()
        return Promise.reject(error)
      }

      // 如果正在刷新，排队等待
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({
            resolve: (newToken: string) => {
              originalConfig.headers!.Authorization = `Bearer ${newToken}`
              resolve(request(originalConfig))
            },
            reject,
          })
        })
      }

      // 尝试刷新
      originalConfig._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('wc_refresh_token')
      if (!refreshToken) {
        isRefreshing = false
        processPendingQueue(null, error)
        forceLogout()
        return Promise.reject(error)
      }

      try {
        // 直接用 axios（不走拦截器）刷新 Token
        const { data: res } = await axios.post('/api/v1/enterprise/refresh-token', {
          refreshToken,
        })

        if (res?.code === 0 && res.data?.accessToken) {
          const newToken = res.data.accessToken
          const newRefresh = res.data.refreshToken

          localStorage.setItem('wc_token', newToken)
          if (newRefresh) localStorage.setItem('wc_refresh_token', newRefresh)

          // 处理排队的请求
          processPendingQueue(newToken)

          // 重试原始请求
          originalConfig.headers!.Authorization = `Bearer ${newToken}`
          return request(originalConfig)
        } else {
          processPendingQueue(null, error)
          forceLogout()
          return Promise.reject(error)
        }
      } catch (refreshErr) {
        processPendingQueue(null, refreshErr)
        forceLogout()
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    // ── 其他错误：提取 message ─────────────────
    const msg = responseData?.message || '网络请求失败'

    if (status === 403) {
      antMessage.error('权限不足')
    } else if (status === 429) {
      antMessage.warning('操作过于频繁，请稍后再试')
    } else if (status && status >= 500) {
      antMessage.error('服务暂时不可用，请稍后重试')
    }

    console.error(`[API Error] ${status}: ${msg}`)
    return Promise.reject(error)
  },
)

function forceLogout() {
  localStorage.removeItem('wc_token')
  localStorage.removeItem('wc_refresh_token')
  localStorage.removeItem('wc_user')
  if (!window.location.pathname.startsWith('/login')) {
    window.location.replace('/login')
  }
}

export default request
