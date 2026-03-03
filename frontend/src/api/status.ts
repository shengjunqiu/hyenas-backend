import { get } from '@/utils/request'
import type { MerchantStatus } from '@/types'

export const getStatusesApi = () => get<MerchantStatus[]>('/merchant-statuses')
