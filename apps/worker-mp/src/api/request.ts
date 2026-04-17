import Taro from '@tarojs/taro'

const BASE_URL = process.env.TARO_APP_API_BASE || 'http://localhost:3000/api/v1'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  needAuth?: boolean
}

export async function request<T = any>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, needAuth = true } = options

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

    if (res.statusCode === 401) {
      Taro.removeStorageSync('wc_token')
      Taro.removeStorageSync('wc_refresh_token')
      Taro.redirectTo({ url: '/pages/index/index' })
      throw new Error('登录已过期')
    }

    const body = res.data
    if (body.code !== 0) {
      throw new Error(body.message || '请求失败')
    }

    return body.data as T
  } catch (err: any) {
    Taro.showToast({ title: err.message || '网络错误', icon: 'none' })
    throw err
  }
}
