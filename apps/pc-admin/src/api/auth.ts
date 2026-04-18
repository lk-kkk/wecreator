import request from './request'

// ================================================================
// 企业端 Auth API — 对齐 R1 后端接口
// ================================================================

// ── 请求参数 ──────────────────────────────────
export interface LoginParams {
  phone: string
  password: string
}

export interface RegisterParams {
  name: string
  creditCode: string
  adminName: string
  adminPhone: string
  password: string
  contactEmail?: string
  industryTag?: string
}

// ── 响应类型 ──────────────────────────────────
export interface UserInfo {
  userId: number
  name: string
  role: 'super_admin' | 'admin' | 'editor' | 'viewer'
  companyId: number
  companyName: string
  companyStatus: 'pending' | 'approved' | 'rejected' | 'suspended'
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  user: UserInfo
  warning?: string  // 企业审核中时有此字段
}

export interface RegisterResult {
  companyId: number
  status: string
  message: string
}

export interface ProfileResult {
  companyId: number
  name: string
  creditCode: string
  status: string
  logoUrl: string | null
  description: string | null
  contactEmail: string | null
  industryTag: string | null
  balance: number
  lockedBalance: number
  createdAt: string
}

export interface RefreshTokenResult {
  accessToken: string
  refreshToken: string
}

// ── API 调用 ──────────────────────────────────
export const authApi = {
  /** 企业登录 */
  login: (data: LoginParams) =>
    request.post<any, LoginResult>('/enterprise/login', data),

  /** 企业注册 */
  register: (data: RegisterParams) =>
    request.post<any, RegisterResult>('/enterprise/register', data),

  /** Token 续期 */
  refreshToken: (refreshToken: string) =>
    request.post<any, RefreshTokenResult>('/enterprise/refresh-token', { refreshToken }),

  /** 获取企业信息 */
  getProfile: () =>
    request.get<any, ProfileResult>('/enterprise/profile'),

  /** 更新企业信息 */
  updateProfile: (data: Partial<{
    name: string
    logoUrl: string
    description: string
    contactEmail: string
    industryTag: string
  }>) => request.put<any, any>('/enterprise/profile', data),
}
