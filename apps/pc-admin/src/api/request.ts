import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

const request: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
})

// 请求拦截：自动附加 JWT Token
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

// 响应拦截：解包后端统一响应格式 { code, data, message, timestamp }
request.interceptors.response.use(
  (response) => {
    const body = response.data
    // 后端 ResponseInterceptor 包裹：{ code: 0, data: <业务数据>, message, timestamp }
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code !== 0) {
        // 业务错误（code !== 0）
        return Promise.reject(new Error(body.message || '请求失败'))
      }
      return body.data // ← 关键：解包返回业务数据
    }
    return body
  },
  (error) => {
    const status = error.response?.status
    const msg = error.response?.data?.message || '网络错误'

    if (status === 401) {
      localStorage.removeItem('wc_token')
      localStorage.removeItem('wc_refresh_token')
      // 使用 replace 避免 history 堆积，只在非登录页时跳转
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login')
      }
    }

    console.error(`[API Error] ${status}: ${msg}`)
    return Promise.reject(error)
  },
)

export default request
