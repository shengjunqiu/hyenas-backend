import { get } from '@/utils/request'
import type { MerchantFieldDef } from '@/types'

export const getFieldsApi = () => get<MerchantFieldDef[]>('/merchant-fields')
