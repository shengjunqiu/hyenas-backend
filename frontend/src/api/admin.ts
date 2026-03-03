import { get } from '@/utils/request'
import type { Admin, PageResult } from '@/types'

export interface QueryAdminParams {
  keyword?: string
  status?: 'ENABLED' | 'DISABLED'
  page?: number
  pageSize?: number
}

export const getAdminsApi = (params: QueryAdminParams) =>
  get<PageResult<Admin>>('/admins', { params })
