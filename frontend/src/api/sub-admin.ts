import { get, post, put } from '@/utils/request'
import type { Admin, AdminStatus, PageResult } from '@/types'

export interface QuerySubAdminParams {
  keyword?: string
  status?: AdminStatus
  page?: number
  pageSize?: number
}

export interface CreateSubAdminPayload {
  username: string
  password: string
  name: string
  phone?: string
}

export interface UpdateSubAdminPayload {
  name?: string
  phone?: string
}

export const getSubAdminsApi = (params: QuerySubAdminParams) =>
  get<PageResult<Admin>>('/sub-admins', { params })

export const createSubAdminApi = (payload: CreateSubAdminPayload) =>
  post<Admin>('/sub-admins', payload)

export const updateSubAdminApi = (id: number, payload: UpdateSubAdminPayload) =>
  put<Admin>(`/sub-admins/${id}`, payload)

export const updateSubAdminStatusApi = (id: number, status: AdminStatus) =>
  put<Admin>(`/sub-admins/${id}/status`, { status })

export const resetSubAdminPasswordApi = (id: number, newPassword: string) =>
  post<null>(`/sub-admins/${id}/reset-password`, { newPassword })
