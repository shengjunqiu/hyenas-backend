import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { useUserStore } from '@/stores/user'
import type { ApiResponse } from '@/types'

const service = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

service.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

const onFulfilled = (response: AxiosResponse) => {
  const payload = response.data as ApiResponse<unknown>
  if (payload.code !== 0) {
    ElMessage.error(payload.message || '请求失败')
    return Promise.reject(new Error(payload.message || '请求失败'))
  }
  return payload.data
}

service.interceptors.response.use(
  onFulfilled as unknown as (value: AxiosResponse) => AxiosResponse,
  async (error: AxiosError<ApiResponse<null>>) => {
    const userStore = useUserStore()
    const status = error.response?.status
    if (status === 401) {
      userStore.clearAuth()
      if (router.currentRoute.value.path !== '/login') {
        await router.replace('/login')
      }
      ElMessage.error('登录状态失效，请重新登录')
      return Promise.reject(error)
    }

    const message = error.response?.data?.message || error.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export const get = <T>(url: string, config?: AxiosRequestConfig) =>
  service.get<never, T>(url, config)

export const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  service.post<never, T>(url, data, config)

export const put = <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
  service.put<never, T>(url, data, config)

export const del = <T>(url: string, config?: AxiosRequestConfig) =>
  service.delete<never, T>(url, config)
