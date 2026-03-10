import { del, get, post, put } from '@/utils/request'
import type { DatabaseImportLog, DatabaseRecord, PageResult } from '@/types'

export interface QueryDatabaseRecordParams {
  templateId?: number
  keyword?: string
  primaryKeyValue?: string
  createdAtStart?: string
  createdAtEnd?: string
  page?: number
  pageSize?: number
}

export interface DatabaseRecordPayload {
  templateId?: number
  dataJson?: Record<string, unknown>
  sourceName?: string
}

export interface QueryDatabaseImportLogParams {
  templateId?: number
  createdAtStart?: string
  createdAtEnd?: string
  page?: number
  pageSize?: number
}

export interface ImportDatabaseRecordsPayload {
  templateId: number
  file: File
}

export const getDatabaseRecordsApi = (params: QueryDatabaseRecordParams) =>
  get<PageResult<DatabaseRecord>>('/database-records', { params })

export const getDatabaseRecordDetailApi = (id: number) =>
  get<DatabaseRecord>(`/database-records/${id}`)

export const createDatabaseRecordApi = (
  payload: Required<Pick<DatabaseRecordPayload, 'templateId' | 'dataJson'>> & DatabaseRecordPayload,
) => post<DatabaseRecord>('/database-records', payload)

export const updateDatabaseRecordApi = (id: number, payload: DatabaseRecordPayload) =>
  put<DatabaseRecord>(`/database-records/${id}`, payload)

export const deleteDatabaseRecordApi = (id: number) => del<null>(`/database-records/${id}`)

export const importDatabaseRecordsByExcelApi = (payload: ImportDatabaseRecordsPayload) => {
  const formData = new FormData()
  formData.append('templateId', String(payload.templateId))
  formData.append('file', payload.file)

  return post<{
    logId: number
    totalCount: number
    createdCount: number
    updatedCount: number
    failedCount: number
    failures: Array<{ row: number; primaryKeyValue?: string; reason: string }>
  }>('/database-records/import-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

export const getDatabaseImportLogsApi = (params: QueryDatabaseImportLogParams) =>
  get<PageResult<DatabaseImportLog>>('/database-records/import-logs', { params })

export const getDatabaseImportLogDetailApi = (id: number) =>
  get<DatabaseImportLog>(`/database-records/import-logs/${id}`)
