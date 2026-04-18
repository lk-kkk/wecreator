/**
 * WeCreator 小程序端 — 零工认证 API
 *
 * R7 · wc-mp-dev · Sprint 1 W1
 * 对齐后端 R1: /api/v1/worker/* 完整接口
 */
import { request } from './request'

// ── 类型定义 ────────────────────────────────────────

export type WorkerLevel = 'unverified' | 'basic' | 'skilled' | 'expert' | 'master'

export interface WorkerUser {
  userId: number
  nickname: string | null
  realName: string | null
  avatarUrl: string | null
  phone: string | null       // '已绑定' | null
  isVerified: boolean
  level: WorkerLevel
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  isNew: boolean
  user: WorkerUser
}

export interface WorkerRole {
  id: number
  roleName: string
  yearsExp: number
  skillTags: string | null
  certUrl: string | null
}

export interface Portfolio {
  id: number
  title: string
  description: string | null
  mediaUrl: string
  mediaType: 'image' | 'video' | 'link'
  sortOrder: number
}

export interface WorkerProfile {
  id: number
  openid: string
  nickname: string | null
  realName: string | null
  avatarUrl: string | null
  phone: string | null
  city: string | null
  bio: string | null
  isVerified: boolean
  level: WorkerLevel
  avgRating: number
  completedCount: number
  completionRate: number
  roles: WorkerRole[]
  portfolios: Portfolio[]
}

// ── API 接口 ────────────────────────────────────────

export const authApi = {
  /**
   * 微信登录（wx.login code → JWT 双 Token）
   * 后端自动创建新用户 + 钱包
   */
  login: (code: string) =>
    request<LoginResult>({
      url: '/worker/login',
      method: 'POST',
      data: { code },
      needAuth: false,
    }),

  /**
   * Token 续期
   */
  refreshToken: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken?: string }>({
      url: '/worker/refresh-token',
      method: 'POST',
      data: { refreshToken },
      needAuth: false,
    }),

  /**
   * 绑定手机号（实名认证前置步骤）
   */
  bindPhone: (phone: string, smsCode?: string) =>
    request<{ message: string }>({
      url: '/worker/bind-phone',
      method: 'POST',
      data: { phone, smsCode },
    }),

  /**
   * 实名认证（真实姓名 + 身份证号）
   * 后端调用三要素验证接口（开发环境 mock pass）
   */
  verify: (realName: string, idCard: string) =>
    request<{ message: string; isVerified: boolean }>({
      url: '/worker/verify',
      method: 'POST',
      data: { realName, idCard },
    }),

  /**
   * 获取个人档案（含角色列表 + 作品集）
   */
  getProfile: () =>
    request<WorkerProfile>({ url: '/worker/profile' }),

  /**
   * 更新基本信息（头像 / 城市 / 简介）
   */
  updateProfile: (data: {
    avatarUrl?: string
    city?: string
    bio?: string
    nickname?: string
  }) =>
    request<WorkerProfile>({
      url: '/worker/profile',
      method: 'PUT',
      data,
    }),

  /**
   * 添加角色档案（如：摄影师 5年 / 平面设计 3年）
   */
  addRole: (data: {
    roleName: string
    yearsExp: number
    skillTags?: string
    certUrl?: string
  }) =>
    request<WorkerRole>({
      url: '/worker/roles',
      method: 'POST',
      data,
    }),

  /**
   * 删除角色档案
   */
  removeRole: (roleId: number) =>
    request({ url: `/worker/roles/${roleId}`, method: 'DELETE' }),

  /**
   * 上传作品集
   */
  addPortfolio: (data: {
    title: string
    description?: string
    mediaUrl: string
    mediaType?: 'image' | 'video' | 'link'
  }) =>
    request<Portfolio>({
      url: '/worker/portfolios',
      method: 'POST',
      data,
    }),

  /**
   * 删除作品
   */
  removePortfolio: (portfolioId: number) =>
    request({ url: `/worker/portfolios/${portfolioId}`, method: 'DELETE' }),
}
