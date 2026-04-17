import { request } from './request'

export interface LoginResult {
  accessToken: string
  refreshToken: string
  isNew: boolean
  user: {
    userId: number
    realName: string | null
    avatarUrl: string | null
    isVerified: boolean
    level: string
  }
}

export const authApi = {
  /** 微信登录 */
  login: (code: string) =>
    request<LoginResult>({ url: '/worker/login', method: 'POST', data: { code }, needAuth: false }),

  /** 绑定手机号 */
  bindPhone: (phone: string) =>
    request({ url: '/worker/bind-phone', method: 'POST', data: { phone } }),

  /** 实名认证 */
  verify: (realName: string, idCard: string) =>
    request({ url: '/worker/verify', method: 'POST', data: { realName, idCard } }),

  /** 获取个人信息 */
  getProfile: () =>
    request({ url: '/worker/profile' }),

  /** 更新个人信息 */
  updateProfile: (data: { avatarUrl?: string; city?: string; bio?: string }) =>
    request({ url: '/worker/profile', method: 'PUT', data }),
}
