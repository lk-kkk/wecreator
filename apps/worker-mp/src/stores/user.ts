/**
 * worker-mp 全局用户状态
 * 使用 Taro storage 持久化，通过 React hook 使用
 */
import Taro from '@tarojs/taro'

function parseJwtPayload(token: string) {
  try {
    const base64 = token.split('.')[1]
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function getStoredUser() {
  try {
    const raw = Taro.getStorageSync('wc_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function useUserStore() {
  const token: string = Taro.getStorageSync('wc_token') || ''
  const payload = parseJwtPayload(token)
  const stored = getStoredUser()

  return {
    userId: payload?.sub ?? 0,
    userType: (payload?.userType ?? 'worker') as 'worker' | 'company',
    isLoggedIn: !!token,
    profile: stored,
  }
}
