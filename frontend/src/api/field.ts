import { get, post, put } from '@/utils/request'
import type { FieldType, MerchantFieldDef } from '@/types'

export const getFieldsApi = () => get<MerchantFieldDef[]>('/merchant-fields')

export interface FieldPayload {
  fieldKey?: string
  fieldName: string
  fieldType?: FieldType
  isRequired?: boolean
  isSearchable?: boolean
  defaultValue?: string
  optionsJson?: string[]
  sort?: number
  remark?: string
}

export const createFieldApi = (payload: FieldPayload) =>
  post<MerchantFieldDef>('/merchant-fields', payload)

export const updateFieldApi = (id: number, payload: FieldPayload) =>
  put<MerchantFieldDef>(`/merchant-fields/${id}`, payload)

export const toggleFieldApi = (id: number, isEnabled: boolean) =>
  put<MerchantFieldDef>(`/merchant-fields/${id}/toggle`, { isEnabled })
