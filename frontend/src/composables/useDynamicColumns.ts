import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { DataTemplateField } from '@/types'

export const buildDynamicColumns = (fields?: DataTemplateField[]) =>
  (fields || []).filter((field) => field.isPrimaryKey || field.isListed)

export const formatDynamicFieldValue = (
  dataJson: Record<string, unknown> | undefined,
  fieldKey: string,
) => {
  const value = dataJson?.[fieldKey]
  if (Array.isArray(value)) {
    return value.join('、')
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  return value ?? '-'
}

export const useDynamicColumns = (fields: MaybeRefOrGetter<DataTemplateField[] | undefined>) =>
  computed(() => buildDynamicColumns(toValue(fields)))
