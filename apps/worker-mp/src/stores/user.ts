/**
 * WeCreator 小程序端 — 全局用户状态管理
 *
 * R7 · wc-mp-dev · Sprint 1 W1
 *
 * 基于 Taro Storage + React hooks 的轻量状态管理
 * 支持登录/登出事件通知，多页面状态同步
 */
import { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import type { WorkerUser, WorkerProfile, WorkerLevel } from '../api/auth'

// ── Storage Keys ────────────────────────────────────
const STORAGE_TOKEN = 'wc_token'
const STORAGE_REFRESH = 'wc_refresh_token'
const STORAGE_USER = 'wc_user'
const STORAGE_PROFILE = 'wc_profile'

// ── 事件总线（简单发布/订阅）───────────────────────
type Listener = () => void
const listeners = new Set<Listener>()

function emitChange() {
  listeners.forEach((fn) => fn())
}

// ── 底层读写 ────────────────────────────────────────

function getToken(): string {
  return Taro.getStorageSync(STORAGE_TOKEN) || ''
}

function getRefreshToken(): string {
  return Taro.getStorageSync(STORAGE_REFRESH) || ''
}

function getStoredUser(): WorkerUser | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_USER)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getStoredProfile(): WorkerProfile | null {
  try {
    const raw = Taro.getStorageSync(STORAGE_PROFILE)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ── 公共写入方法（供 wx-login.ts 调用）────────────

/** 登录成功后保存 Token + 用户基本信息 */
export function saveLoginData(data: {
  accessToken: string
  refreshToken: string
  user: WorkerUser
}) {
  Taro.setStorageSync(STORAGE_TOKEN, data.accessToken)
  Taro.setStorageSync(STORAGE_REFRESH, data.refreshToken)
  Taro.setStorageSync(STORAGE_USER, JSON.stringify(data.user))
  emitChange()
}

/** 保存完整个人档案（从 /worker/profile 获取后） */
export function saveProfile(profile: WorkerProfile) {
  Taro.setStorageSync(STORAGE_PROFILE, JSON.stringify(profile))
  emitChange()
}

/** 退出登录 — 清除所有状态 */
export function clearUserData() {
  Taro.removeStorageSync(STORAGE_TOKEN)
  Taro.removeStorageSync(STORAGE_REFRESH)
  Taro.removeStorageSync(STORAGE_USER)
  Taro.removeStorageSync(STORAGE_PROFILE)
  emitChange()
}

// ── React Hook ──────────────────────────────────────

export interface UserStoreState {
  /** 是否已登录 */
  isLoggedIn: boolean
  /** JWT Access Token */
  token: string
  /** 用户基本信息（登录时返回） */
  user: WorkerUser | null
  /** 完整档案（含角色/作品，需主动拉取） */
  profile: WorkerProfile | null
  /** 便捷属性 */
  userId: number
  userType: 'worker'
  nickname: string
  avatarUrl: string
  level: WorkerLevel
  isVerified: boolean
  /** 头像首字母（无头像时使用） */
  avatarInitial: string
}

export function useUserStore(): UserStoreState {
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1)
    listeners.add(handler)
    return () => { listeners.delete(handler) }
  }, [])

  const token = getToken()
  const user = getStoredUser()
  const profile = getStoredProfile()

  const displayName = user?.realName || user?.nickname || ''

  return {
    isLoggedIn: !!token,
    token,
    user,
    profile,
    userId: user?.userId ?? 0,
    userType: 'worker',
    nickname: displayName,
    avatarUrl: user?.avatarUrl || '',
    level: (user?.level || 'unverified') as WorkerLevel,
    isVerified: user?.isVerified ?? false,
    avatarInitial: displayName ? displayName[0].toUpperCase() : '?',
  }
}
