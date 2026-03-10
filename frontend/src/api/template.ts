import { del, get, post, put } from '@/utils/request'
import type { DataTemplate } from '@/types'

export interface CreateTemplateFieldPayload {
  fieldKey: string
  fieldName: string
  fieldType: string
  isRequired?: boolean
  isPrimaryKey?: boolean
  isListed?: boolean
  isSearchable?: boolean
  defaultValue?: string
  optionsJson?: string[]
  sort?: number
  remark?: string
}

export interface CreateTemplatePayload {
  name: string
  code: string
  description?: string
  fields: CreateTemplateFieldPayload[]
}

export interface CopyTemplatePayload {
  name: string
  code: string
  description?: string
}

export interface UpdateTemplatePayload {
  name?: string
  code?: string
  description?: string
}

export interface ToggleTemplatePayload {
  isEnabled: boolean
}

export const getTemplatesApi = () => get<DataTemplate[]>('/templates')

export const getTemplateDetailApi = (id: number) => get<DataTemplate>(`/templates/${id}`)

export const createTemplateApi = (payload: CreateTemplatePayload) =>
  post<DataTemplate>('/templates', payload)

export const copyTemplateApi = (id: number, payload: CopyTemplatePayload) =>
  post<DataTemplate>(`/templates/${id}/copy`, payload)

export const updateTemplateApi = (id: number, payload: UpdateTemplatePayload) =>
  put<DataTemplate>(`/templates/${id}`, payload)

export const toggleTemplateApi = (id: number, payload: ToggleTemplatePayload) =>
  put<DataTemplate>(`/templates/${id}/status`, payload)

export const deleteTemplateApi = (id: number) => del<null>(`/templates/${id}`)

export const deleteTemplateFieldApi = (id: number, fieldId: number) =>
  del<null>(`/templates/${id}/fields/${fieldId}`)
