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
export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
export type ProjectMemberRole = 'PROJECT_ADMIN' | 'PROJECT_MEMBER'

export interface UserInfo {
  id: number
  username: string
  name: string
  role: AdminRole
  status?: AdminStatus
  parentAdminId?: number | null
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
  parentAdminId?: number | null
  parentAdmin?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
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
  supervisionAgency?: string | null
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

export interface DataTemplateField {
  id: number
  templateId: number
  fieldKey: string
  fieldName: string
  fieldType: FieldType
  isRequired: boolean
  isPrimaryKey: boolean
  isListed: boolean
  isSearchable: boolean
  defaultValue?: string | null
  optionsJson?: unknown
  sort: number
  remark?: string | null
  createdAt: string
  updatedAt: string
}

export interface DataTemplate {
  id: number
  name: string
  code: string
  description?: string | null
  status: TemplateStatus
  isEnabled: boolean
  copiedFromId?: number | null
  createdBy?: number
  createdAt: string
  updatedAt: string
  fieldCount?: number
  copiedFrom?: Pick<DataTemplate, 'id' | 'name' | 'code'> | null
  creator?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
  fields?: DataTemplateField[]
}

export interface DatabaseRecord {
  id: number
  templateId: number
  primaryKeyValue: string
  dataJson: Record<string, unknown>
  sourceType: 'MANUAL' | 'EXCEL' | 'PROJECT_IMPORT'
  sourceName?: string | null
  createdBy: number
  updatedBy?: number | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  template?: Pick<DataTemplate, 'id' | 'name' | 'code'> & {
    fields?: DataTemplateField[]
  }
  creator?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
  updater?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
}

export interface DatabaseImportLog {
  id: number
  templateId: number
  fileName: string
  totalCount: number
  createdCount: number
  updatedCount: number
  failedCount: number
  failureDetailsJson?: unknown
  operatorId: number
  createdAt: string
  template?: Pick<DataTemplate, 'id' | 'name' | 'code'> | null
  operator?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
}

export interface ProjectMember {
  id: number
  projectId: number
  adminId: number
  role: ProjectMemberRole
  assignedBy: number
  createdAt: string
  admin?: Admin
  assigner?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
}

export interface Project {
  id: number
  name: string
  code: string
  templateId: number
  description?: string | null
  status: ProjectStatus
  projectAdminId?: number | null
  startDate?: string | null
  endDate?: string | null
  createdBy: number
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  template?: Pick<DataTemplate, 'id' | 'name' | 'code'> & {
    isEnabled?: boolean
    status?: TemplateStatus
    fields?: DataTemplateField[]
  }
  projectAdmin?: Pick<Admin, 'id' | 'username' | 'name' | 'phone'> | null
  creator?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
  members?: ProjectMember[]
  memberCount?: number
  recordCount?: number
}

export interface ProjectRecord {
  id: number
  projectId: number
  templateId: number
  sourceRecordId: number
  sourcePrimaryKeyValue: string
  dataJson: Record<string, unknown>
  importedBy: number
  createdBy: number
  updatedBy?: number | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
  template?: Pick<DataTemplate, 'id' | 'name' | 'code'> & {
    fields?: DataTemplateField[]
  }
  sourceRecord?: Pick<
    DatabaseRecord,
    'id' | 'primaryKeyValue' | 'sourceType' | 'sourceName' | 'deletedAt' | 'dataJson'
  > | null
  importer?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
  creator?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
  updater?: Pick<UserInfo, 'id' | 'username' | 'name'> | null
}

export interface ProjectImportResult {
  totalCount: number
  createdCount: number
  skippedCount: number
}
