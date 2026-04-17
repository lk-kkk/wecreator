import { defineStore } from 'pinia'
import { ref } from 'vue'
import { platformApi } from '@/api/platform'

export const useUserStore = defineStore('user', () => {
  const admin = ref<any>(null)
  const token = ref(localStorage.getItem('platform_token') || '')

  async function login(username: string, password: string) {
    const res = await platformApi.login({ username, password })
    token.value = res.accessToken
    admin.value = res.admin
    localStorage.setItem('platform_token', res.accessToken)
    localStorage.setItem('platform_refresh_token', res.refreshToken)
    localStorage.setItem('platform_admin', JSON.stringify(res.admin))
  }

  function logout() {
    token.value = ''
    admin.value = null
    localStorage.removeItem('platform_token')
    localStorage.removeItem('platform_refresh_token')
    localStorage.removeItem('platform_admin')
  }

  function init() {
    const saved = localStorage.getItem('platform_admin')
    if (saved) admin.value = JSON.parse(saved)
  }

  init()

  return { admin, token, login, logout }
})
