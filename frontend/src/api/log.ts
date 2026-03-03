import { get } from '@/utils/request'
import type { OperationLog, PageResult } from '@/types'

export interface QueryLogParams {
  module?: string
  action?: string
  operatorId?: number
  targetType?: string
  createdAtStart?: string
  createdAtEnd?: string
  page?: number
  pageSize?: number
}

export const getOperationLogsApi = (params: QueryLogParams) =>
  get<PageResult<OperationLog>>('/operation-logs', { params })

export const getOperationLogDetailApi = (id: number) => get<OperationLog>(`/operation-logs/${id}`)
