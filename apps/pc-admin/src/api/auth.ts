import request from './request'

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

export interface LoginResult {
  accessToken: string
  refreshToken: string
  user: {
    userId: number
    name: string
    role: string
    companyId: number
    companyName: string
    companyStatus: string
  }
}

export const authApi = {
  login: (data: LoginParams) =>
    request.post<any, LoginResult>('/enterprise/login', data),

  register: (data: RegisterParams) =>
    request.post<any, any>('/enterprise/register', data),

  refreshToken: (refreshToken: string) =>
    request.post<any, { accessToken: string; refreshToken: string }>(
      '/enterprise/refresh-token',
      { refreshToken },
    ),

  getProfile: () => request.get<any, any>('/enterprise/profile'),

  updateProfile: (data: Record<string, any>) =>
    request.put<any, any>('/enterprise/profile', data),
}
