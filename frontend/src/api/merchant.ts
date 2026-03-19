import { del, get, post, put } from '@/utils/request'
import type {
  Admin,
  Merchant,
  MerchantDetail,
  MerchantPermissionScope,
  MerchantStatusLog,
  PageResult,
} from '@/types'

export interface QueryMerchantParams {
  name?: string
  contactName?: string
  contactPhone?: string
  statusId?: number
  businessType?: string
  supervisionAgency?: string
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
  supervisionAgency?: string
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

export interface BatchAssignAdminsPayload {
  merchantIds: number[]
  adminIds: number[]
}

export interface BatchAssignAdminsResult {
  merchantCount: number
  adminCount: number
  totalPairs: number
  createdCount: number
  skippedCount: number
}

export interface BatchDeleteMerchantsPayload {
  merchantIds: number[]
}

export interface BatchDeleteMerchantsResult {
  count: number
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

export interface MerchantSubAdminRelation {
  id: number
  merchantId: number
  subAdminId: number
  parentAdminId: number
  assignedBy: number
  permissionScope: MerchantPermissionScope
  createdAt: string
  subAdmin: Admin
}

export interface SubAdminMerchantItem {
  assignedAt: string
  permissionScope: MerchantPermissionScope
  merchant: Merchant
}

export interface MerchantImportErrorItem {
  rowNumber: number
  merchantName?: string
  reason: string
}

export type MerchantImportAction = '新增' | '补全' | '覆盖更新' | '无变更' | '失败'

export interface MerchantImportRecordItem {
  rowNumber: number
  merchantName?: string
  action: MerchantImportAction
  reason?: string
}

export interface MerchantImportDebugRow {
  rowNumber: number
  merchantName?: string
  normalizedRowKeys: string[]
  parsedValues: {
    name?: string
    contactName?: string
    contactPhone?: string
    businessType?: string
    status?: string
  }
  overwriteExisting: boolean
  hasExplicitStatus: boolean
  existingMerchant?: {
    id: number
    contactName?: string | null
    contactPhone?: string | null
    businessType?: string | null
    statusId: number
  }
  mergeFields?: string[]
  action?: MerchantImportAction
  reason?: string
}

export interface MerchantImportDebugInfo {
  sheetName: string
  headerRowNumber: number
  rawHeaders: string[]
  normalizedHeaders: string[]
  sheetCandidates: Array<{
    sheetName: string
    headerRowNumber: number
    matchedHeaderCount: number
    rawHeaders: string[]
  }>
  sampleCells: Array<{
    address: string
    value?: string
    formula?: string
    display?: string
  }>
  rows: MerchantImportDebugRow[]
}

export interface MerchantImportResult {
  total: number
  successCount: number
  failureCount: number
  errors: MerchantImportErrorItem[]
  records: MerchantImportRecordItem[]
  debug?: MerchantImportDebugInfo
}

export interface ImportMerchantsOptions {
  overwriteExisting?: boolean
  debug?: boolean
}

export const getMerchantsApi = (params: QueryMerchantParams) =>
  get<PageResult<Merchant>>('/merchants', { params })

export const getMerchantDetailApi = (id: number) => get<MerchantDetail>(`/merchants/${id}`)

export const createMerchantApi = (payload: MerchantPayload) => post<Merchant>('/merchants', payload)

export const importMerchantsApi = (file: File, options?: ImportMerchantsOptions) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('overwriteExisting', String(!!options?.overwriteExisting))
  formData.append('debug', String(!!options?.debug))
  return post<MerchantImportResult>('/merchants/import', formData)
}

export const updateMerchantApi = (id: number, payload: MerchantPayload) =>
  put<Merchant>(`/merchants/${id}`, payload)

export const deleteMerchantApi = (id: number) => del<null>(`/merchants/${id}`)

export const batchDeleteMerchantsApi = (payload: BatchDeleteMerchantsPayload) =>
  post<BatchDeleteMerchantsResult>('/merchants/batch-delete', payload)

export const clearAllMerchantsApi = () => del<BatchDeleteMerchantsResult>('/merchants')

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

export const batchAssignMerchantAdminsApi = (payload: BatchAssignAdminsPayload) =>
  post<BatchAssignAdminsResult>('/merchants/batch-assign-admins', payload)

export const batchAssignMerchantSubAdminsApi = (payload: BatchAssignAdminsPayload) =>
  post<BatchAssignAdminsResult>('/merchants/batch-assign-sub-admins', payload)

export const unassignMerchantAdminApi = (id: number, adminId: number) =>
  del<null>(`/merchants/${id}/admins/${adminId}`)

export const getAdminMerchantsApi = (id: number) =>
  get<AdminMerchantItem[]>(`/admins/${id}/merchants`)

export const getMerchantSubAdminsApi = (id: number) =>
  get<MerchantSubAdminRelation[]>(`/merchants/${id}/sub-admins`)

export const assignMerchantSubAdminsApi = (id: number, payload: AssignAdminsPayload) =>
  post<MerchantSubAdminRelation[]>(`/merchants/${id}/assign-sub-admins`, payload)

export const unassignMerchantSubAdminApi = (id: number, subAdminId: number) =>
  del<null>(`/merchants/${id}/sub-admins/${subAdminId}`)

export const getSubAdminMerchantsApi = (id: number) =>
  get<SubAdminMerchantItem[]>(`/sub-admins/${id}/merchants`)
