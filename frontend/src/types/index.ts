export type AdminRole = 'SUPER' | 'NORMAL'

export interface UserInfo {
  id: number
  username: string
  name: string
  role: AdminRole
  status?: 'ENABLED' | 'DISABLED'
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
