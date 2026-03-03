import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import router from '@/router'
import { loginApi, logoutApi, profileApi } from '@/api'
import type { UserInfo } from '@/types'

const TOKEN_KEY = 'hyenas_token'
const REFRESH_TOKEN_KEY = 'hyenas_refresh_token'
const USER_KEY = 'hyenas_user'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) ?? '')
  const refreshToken = ref(localStorage.getItem(REFRESH_TOKEN_KEY) ?? '')
  const user = ref<UserInfo | null>(
    localStorage.getItem(USER_KEY)
      ? (JSON.parse(localStorage.getItem(USER_KEY) as string) as UserInfo)
      : null,
  )

  const isSuper = computed(() => user.value?.role === 'SUPER')
  const isLoggedIn = computed(() => !!token.value)

  const setAuth = (payload: { accessToken: string; refreshToken: string; user: UserInfo }) => {
    token.value = payload.accessToken
    refreshToken.value = payload.refreshToken
    user.value = payload.user

    localStorage.setItem(TOKEN_KEY, payload.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
  }

  const clearAuth = () => {
    token.value = ''
    refreshToken.value = ''
    user.value = null

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  const login = async (username: string, password: string) => {
    const result = await loginApi({ username, password })
    setAuth(result)
    return result
  }

  const fetchProfile = async () => {
    if (!token.value) {
      return null
    }
    const profile = await profileApi()
    user.value = profile
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
    return profile
  }

  const logout = async () => {
    try {
      if (token.value) {
        await logoutApi()
      }
    } finally {
      clearAuth()
      if (router.currentRoute.value.path !== '/login') {
        await router.replace('/login')
      }
    }
  }

  return {
    token,
    refreshToken,
    user,
    isSuper,
    isLoggedIn,
    login,
    fetchProfile,
    logout,
    clearAuth,
  }
})
