import { del, get, post, put } from '@/utils/request'
import type {
  PageResult,
  Project,
  ProjectImportResult,
  ProjectMember,
  ProjectRecord,
} from '@/types'

export interface QueryProjectParams {
  keyword?: string
  templateId?: number
  status?: string
  startDateStart?: string
  startDateEnd?: string
  page?: number
  pageSize?: number
}

export interface CreateProjectPayload {
  name: string
  code: string
  templateId: number
  description?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface UpdateProjectPayload {
  name?: string
  code?: string
  description?: string
  status?: string
  startDate?: string | null
  endDate?: string | null
}

export interface AssignProjectAdminPayload {
  adminId: number
}

export interface AddProjectMemberPayload {
  adminId: number
}

export interface QueryProjectRecordParams {
  keyword?: string
  sourcePrimaryKeyValue?: string
  createdAtStart?: string
  createdAtEnd?: string
  page?: number
  pageSize?: number
}

export interface UpdateProjectRecordPayload {
  dataJson?: Record<string, unknown>
}

export interface ImportProjectRecordsPayload {
  recordIds: number[]
}

export const getProjectsApi = (params: QueryProjectParams) =>
  get<PageResult<Project>>('/projects', { params })

export const getProjectDetailApi = (id: number) => get<Project>(`/projects/${id}`)

export const createProjectApi = (payload: CreateProjectPayload) =>
  post<Project>('/projects', payload)

export const updateProjectApi = (id: number, payload: UpdateProjectPayload) =>
  put<Project>(`/projects/${id}`, payload)

export const deleteProjectApi = (id: number) => del<null>(`/projects/${id}`)

export const assignProjectAdminApi = (id: number, payload: AssignProjectAdminPayload) =>
  post<Project>(`/projects/${id}/assign-admin`, payload)

export const getProjectMembersApi = (id: number) => get<ProjectMember[]>(`/projects/${id}/members`)

export const addProjectMemberApi = (id: number, payload: AddProjectMemberPayload) =>
  post<ProjectMember>(`/projects/${id}/members`, payload)

export const removeProjectMemberApi = (id: number, memberId: number) =>
  del<null>(`/projects/${id}/members/${memberId}`)

export const getProjectRecordsApi = (id: number, params: QueryProjectRecordParams) =>
  get<PageResult<ProjectRecord> & { template: Project['template'] }>(`/projects/${id}/records`, {
    params,
  })

export const getProjectRecordDetailApi = (id: number, recordId: number) =>
  get<ProjectRecord>(`/projects/${id}/records/${recordId}`)

export const updateProjectRecordApi = (
  id: number,
  recordId: number,
  payload: UpdateProjectRecordPayload,
) => put<ProjectRecord>(`/projects/${id}/records/${recordId}`, payload)

export const deleteProjectRecordApi = (id: number, recordId: number) =>
  del<null>(`/projects/${id}/records/${recordId}`)

export const importProjectRecordsApi = (id: number, payload: ImportProjectRecordsPayload) =>
  post<ProjectImportResult>(`/projects/${id}/import-records`, payload)
