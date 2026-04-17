import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { LoginParams, RegisterParams } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('wc_token') || '')
  const refreshToken = ref(localStorage.getItem('wc_refresh_token') || '')
  const userInfo = ref<Record<string, any>>({})

  const isLoggedIn = computed(() => !!token.value)
  const companyName = computed(() => userInfo.value?.companyName || '')
  const userId = computed(() => userInfo.value?.id ?? 0)

  async function login(params: LoginParams) {
    const res = await authApi.login(params)
    token.value = res.accessToken
    refreshToken.value = res.refreshToken
    userInfo.value = res.user
    localStorage.setItem('wc_token', res.accessToken)
    localStorage.setItem('wc_refresh_token', res.refreshToken)
    return res
  }

  async function register(params: RegisterParams) {
    return authApi.register(params)
  }

  async function fetchProfile() {
    const res = await authApi.getProfile()
    userInfo.value = { ...userInfo.value, ...res }
    return res
  }

  function logout() {
    token.value = ''
    refreshToken.value = ''
    userInfo.value = {}
    localStorage.removeItem('wc_token')
    localStorage.removeItem('wc_refresh_token')
  }

  return {
    token,
    refreshToken,
    userInfo,
    isLoggedIn,
    companyName,
    userId,
    login,
    register,
    fetchProfile,
    logout,
  }
})
