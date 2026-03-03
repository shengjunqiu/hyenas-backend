export type AdminRole = 'SUPER' | 'NORMAL'
export type AdminStatus = 'ENABLED' | 'DISABLED'
export type FieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'BOOLEAN'

export interface UserInfo {
  id: number
  username: string
  name: string
  role: AdminRole
  status?: AdminStatus
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface PageParams {
  page?: number
  pageSize?: number
}

export interface PaginationResult {
  page: number
  pageSize: number
  total: number
}

export interface PageResult<T> {
  list: T[]
  pagination: PaginationResult
}

export interface LoginResult {
  accessToken: string
  refreshToken: string
  user: UserInfo
}

export interface Admin {
  id: number
  username: string
  name: string
  phone?: string | null
  role: AdminRole
  status: AdminStatus
  createdAt: string
  updatedAt?: string
  merchantCount?: number
}

export interface MerchantStatus {
  id: number
  name: string
  code: string
  color?: string | null
  sort: number
  isEnabled: boolean
  remark?: string | null
}

export interface MerchantFieldDef {
  id: number
  fieldKey: string
  fieldName: string
  fieldType: FieldType
  isRequired: boolean
  isEnabled: boolean
  isSearchable: boolean
  defaultValue?: string | null
  optionsJson?: unknown
  sort: number
  remark?: string | null
}

export interface Merchant {
  id: number
  name: string
  creditCode?: string | null
  contactName?: string | null
  contactPhone?: string | null
  address?: string | null
  licenseNo?: string | null
  businessType?: string | null
  statusId: number
  remark?: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  status?: MerchantStatus
  admins?: Array<{ admin: Admin }>
}

export interface MerchantDetail extends Merchant {
  customFields?: Record<string, unknown>
  statusLogs?: MerchantStatusLog[]
}

export interface MerchantStatusLog {
  id: number
  merchantId: number
  fromStatusId?: number | null
  toStatusId: number
  changedBy: number
  remark?: string | null
  createdAt: string
  fromStatus?: MerchantStatus | null
  toStatus?: MerchantStatus
  changer?: UserInfo
}

export interface OperationLog {
  id: number
  module: string
  action: string
  targetType: string
  targetId?: number | null
  targetName?: string | null
  operatorId: number
  operatorName: string
  beforeData?: unknown
  afterData?: unknown
  ip?: string | null
  createdAt: string
}
