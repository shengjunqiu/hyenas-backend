import { get } from '@/utils/request'
import type { MerchantStatus } from '@/types'
import { post, put } from '@/utils/request'

export const getStatusesApi = () => get<MerchantStatus[]>('/merchant-statuses')

export interface StatusPayload {
  name: string
  code?: string
  color?: string
  sort?: number
  remark?: string
}

export const createStatusApi = (payload: StatusPayload) =>
  post<MerchantStatus>('/merchant-statuses', payload)

export const updateStatusApi = (id: number, payload: Omit<StatusPayload, 'code'>) =>
  put<MerchantStatus>(`/merchant-statuses/${id}`, payload)

export const toggleStatusApi = (id: number, isEnabled: boolean) =>
  put<MerchantStatus>(`/merchant-statuses/${id}/toggle`, { isEnabled })
