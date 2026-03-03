import { del, get, post, put } from '@/utils/request'
import type { Merchant, MerchantDetail, MerchantStatusLog, PageResult, Admin } from '@/types'

export interface QueryMerchantParams {
  name?: string
  contactName?: string
  contactPhone?: string
  statusId?: number
  businessType?: string
  adminId?: number
  createdAtStart?: string
  createdAtEnd?: string
  page?: number
  pageSize?: number
}

export interface MerchantPayload {
  name?: string
  creditCode?: string
  contactName?: string
  contactPhone?: string
  address?: string
  licenseNo?: string
  businessType?: string
  statusId?: number
  remark?: string
  customFields?: Record<string, unknown>
}

export interface MerchantCustomFieldItem {
  id: number
  fieldKey: string
  fieldName: string
  fieldType: string
  isRequired: boolean
  isEnabled: boolean
  isSearchable: boolean
  defaultValue?: string | null
  optionsJson?: unknown
  sort: number
  remark?: string | null
  value: unknown
}

export interface AssignAdminsPayload {
  adminIds: number[]
}

export interface MerchantAdminRelation {
  id: number
  merchantId: number
  adminId: number
  assignedBy: number
  createdAt: string
  admin: Admin
}

export interface AdminMerchantItem {
  assignedAt: string
  merchant: Merchant
}

export const getMerchantsApi = (params: QueryMerchantParams) =>
  get<PageResult<Merchant>>('/merchants', { params })

export const getMerchantDetailApi = (id: number) => get<MerchantDetail>(`/merchants/${id}`)

export const createMerchantApi = (payload: MerchantPayload) => post<Merchant>('/merchants', payload)

export const updateMerchantApi = (id: number, payload: MerchantPayload) =>
  put<Merchant>(`/merchants/${id}`, payload)

export const deleteMerchantApi = (id: number) => del<null>(`/merchants/${id}`)

export const getMerchantCustomFieldsApi = (id: number) =>
  get<MerchantCustomFieldItem[]>(`/merchants/${id}/custom-fields`)

export const updateMerchantCustomFieldsApi = (id: number, values: Record<string, unknown>) =>
  put<null>(`/merchants/${id}/custom-fields`, { values })

export const changeMerchantStatusApi = (id: number, statusId: number, remark?: string) =>
  put<null>(`/merchants/${id}/change-status`, { statusId, remark })

export const getMerchantStatusLogsApi = (id: number) =>
  get<MerchantStatusLog[]>(`/merchants/${id}/status-logs`)

export const getMerchantAdminsApi = (id: number) =>
  get<MerchantAdminRelation[]>(`/merchants/${id}/admins`)

export const assignMerchantAdminsApi = (id: number, payload: AssignAdminsPayload) =>
  post<MerchantAdminRelation[]>(`/merchants/${id}/assign-admins`, payload)

export const unassignMerchantAdminApi = (id: number, adminId: number) =>
  del<null>(`/merchants/${id}/admins/${adminId}`)

export const getAdminMerchantsApi = (id: number) =>
  get<AdminMerchantItem[]>(`/admins/${id}/merchants`)
