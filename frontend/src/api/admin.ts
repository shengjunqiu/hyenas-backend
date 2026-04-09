import { download, get, post, put } from '@/utils/request'
import type {
  Admin,
  AdminRole,
  AdminStatus,
  MerchantStatusStatistics,
  PageResult,
} from '@/types'

export interface QueryAdminParams {
  keyword?: string
  status?: 'ENABLED' | 'DISABLED'
  page?: number
  pageSize?: number
}

export const getAdminsApi = (params: QueryAdminParams) =>
  get<PageResult<Admin>>('/admins', { params })

export interface CreateAdminPayload {
  username: string
  password: string
  name: string
  phone?: string
  role: AdminRole
}

export interface UpdateAdminPayload {
  name?: string
  phone?: string
  role?: AdminRole
}

export const createAdminApi = (payload: CreateAdminPayload) => post<Admin>('/admins', payload)

export const updateAdminApi = (id: number, payload: UpdateAdminPayload) =>
  put<Admin>(`/admins/${id}`, payload)

export const updateAdminStatusApi = (id: number, status: AdminStatus) =>
  put<Admin>(`/admins/${id}/status`, { status })

export const resetAdminPasswordApi = (id: number, newPassword: string) =>
  post<null>(`/admins/${id}/reset-password`, { newPassword })

export const getMerchantStatusStatisticsApi = () =>
  get<MerchantStatusStatistics>('/admins/statistics/merchant-status')

export const exportAdminGroupStatisticsApi = () =>
  download('/admins/statistics/merchant-status/export')

export const exportSingleAdminGroupStatisticsApi = (id: number) =>
  download(`/admins/${id}/statistics/merchant-status/export`)
