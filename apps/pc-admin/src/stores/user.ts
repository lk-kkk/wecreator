import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { LoginParams, RegisterParams, UserInfo, ProfileResult } from '@/api/auth'

// ================================================================
// User Store — 认证状态 + 用户信息 + 企业 Profile
// ================================================================

// localStorage key 常量
const STORAGE_KEYS = {
  TOKEN: 'wc_token',
  REFRESH: 'wc_refresh_token',
  USER: 'wc_user',
} as const

function loadStoredUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', () => {
  // ── 状态 ──────────────────────────────────
  const token = ref(localStorage.getItem(STORAGE_KEYS.TOKEN) || '')
  const refreshTokenValue = ref(localStorage.getItem(STORAGE_KEYS.REFRESH) || '')
  const userInfo = ref<UserInfo | null>(loadStoredUser())
  const companyProfile = ref<ProfileResult | null>(null)
  const loginWarning = ref('')  // 企业审核中的警告信息

  // ── 计算属性 ──────────────────────────────
  const isLoggedIn = computed(() => !!token.value)
  const companyName = computed(() => userInfo.value?.companyName || '')
  const companyId = computed(() => userInfo.value?.companyId ?? 0)
  const userId = computed(() => userInfo.value?.userId ?? 0)
  const userName = computed(() => userInfo.value?.name || '')
  const userRole = computed(() => userInfo.value?.role || '')
  const companyStatus = computed(() => userInfo.value?.companyStatus || '')
  const isSuperAdmin = computed(() => userInfo.value?.role === 'super_admin')
  const isPending = computed(() => userInfo.value?.companyStatus === 'pending')

  // ── Actions ───────────────────────────────

  /** 企业登录 */
  async function login(params: LoginParams) {
    const res = await authApi.login(params)
    // 保存 Token
    token.value = res.accessToken
    refreshTokenValue.value = res.refreshToken
    localStorage.setItem(STORAGE_KEYS.TOKEN, res.accessToken)
    localStorage.setItem(STORAGE_KEYS.REFRESH, res.refreshToken)
    // 保存用户信息
    userInfo.value = res.user
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user))
    // 保存审核警告
    loginWarning.value = res.warning || ''
    return res
  }

  /** 企业注册 */
  async function register(params: RegisterParams) {
    return authApi.register(params)
  }

  /** 获取企业 Profile（需登录后） */
  async function fetchProfile() {
    try {
      const res = await authApi.getProfile()
      companyProfile.value = res
      // 同步更新核心信息
      if (userInfo.value) {
        userInfo.value.companyName = res.name
        userInfo.value.companyStatus = res.status as UserInfo['companyStatus']
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userInfo.value))
      }
      return res
    } catch {
      // profile 获取失败不应阻塞页面
      console.warn('[UserStore] fetchProfile failed')
      return null
    }
  }

  /** 更新企业 Profile */
  async function updateProfile(data: Parameters<typeof authApi.updateProfile>[0]) {
    const res = await authApi.updateProfile(data)
    // 自动刷新 profile
    await fetchProfile()
    return res
  }

  /** 登出 */
  function logout() {
    token.value = ''
    refreshTokenValue.value = ''
    userInfo.value = null
    companyProfile.value = null
    loginWarning.value = ''
    localStorage.removeItem(STORAGE_KEYS.TOKEN)
    localStorage.removeItem(STORAGE_KEYS.REFRESH)
    localStorage.removeItem(STORAGE_KEYS.USER)
  }

  /** 用于 MainLayout 头像首字母 */
  const avatarInitial = computed(() => {
    const name = userInfo.value?.name || companyName.value || 'U'
    return name.charAt(0).toUpperCase()
  })

  return {
    // state
    token,
    refreshToken: refreshTokenValue,
    userInfo,
    companyProfile,
    loginWarning,
    // computed
    isLoggedIn,
    companyName,
    companyId,
    userId,
    userName,
    userRole,
    companyStatus,
    isSuperAdmin,
    isPending,
    avatarInitial,
    // actions
    login,
    register,
    fetchProfile,
    updateProfile,
    logout,
  }
})
