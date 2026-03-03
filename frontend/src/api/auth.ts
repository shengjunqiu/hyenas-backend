import type { LoginResult, UserInfo } from '@/types'
import { get, post } from '@/utils/request'

interface LoginPayload {
  username: string
  password: string
}

interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
}

export const loginApi = (payload: LoginPayload) => post<LoginResult>('/auth/login', payload)

export const logoutApi = () => post<null>('/auth/logout')

export const profileApi = () => get<UserInfo>('/auth/profile')

export const changePasswordApi = (payload: ChangePasswordPayload) =>
  post<null>('/auth/change-password', payload)
