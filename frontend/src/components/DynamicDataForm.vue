<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import type { DataTemplateField } from '@/types'

const props = withDefaults(
  defineProps<{
    fields: DataTemplateField[]
    disabled?: boolean
    columns?: number
    labelWidth?: string
  }>(),
  {
    disabled: false,
    columns: 2,
    labelWidth: '110px',
  },
)

const formModel = defineModel<Record<string, unknown>>({ required: true })
const formRef = ref<FormInstance>()

const columnSpan = computed(() => {
  const columnCount = Math.min(Math.max(props.columns, 1), 4)
  return Math.floor(24 / columnCount)
})

const parseOptions = (field: DataTemplateField) => {
  if (!Array.isArray(field.optionsJson)) {
    return []
  }

  return field.optionsJson
    .map((item) => {
      if (typeof item === 'string') {
        return { label: item, value: item }
      }
      if (
        typeof item === 'object' &&
        item !== null &&
        'label' in item &&
        'value' in item &&
        typeof (item as { label: unknown }).label === 'string' &&
        typeof (item as { value: unknown }).value === 'string'
      ) {
        return {
          label: (item as { label: string }).label,
          value: (item as { value: string }).value,
        }
      }
      if (
        typeof item === 'object' &&
        item !== null &&
        'value' in item &&
        typeof (item as { value: unknown }).value === 'string'
      ) {
        const value = (item as { value: string }).value
        return { label: value, value }
      }
      return null
    })
    .filter((item): item is { label: string; value: string } => !!item)
}

const normalizeFieldValue = (field: DataTemplateField, value: unknown) => {
  switch (field.fieldType) {
    case 'MULTI_SELECT':
      if (Array.isArray(value)) {
        return value.map((item) => String(item))
      }
      return value === undefined || value === null || value === '' ? [] : [String(value)]
    case 'BOOLEAN':
      if (typeof value === 'boolean') {
        return value
      }
      if (typeof value === 'string') {
        if (value === 'true') {
          return true
        }
        if (value === 'false') {
          return false
        }
      }
      return Boolean(value)
    case 'NUMBER':
      if (typeof value === 'number') {
        return Number.isNaN(value) ? undefined : value
      }
      if (value === undefined || value === null || value === '') {
        if (
          field.defaultValue === undefined ||
          field.defaultValue === null ||
          field.defaultValue === ''
        ) {
          return undefined
        }
        const defaultNumber = Number(field.defaultValue)
        return Number.isNaN(defaultNumber) ? undefined : defaultNumber
      }
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isNaN(parsed) ? undefined : parsed
      }
      return undefined
    case 'DATE':
    case 'SELECT':
    case 'TEXT':
    case 'TEXTAREA':
    default:
      if (value === undefined || value === null) {
        return field.defaultValue ?? ''
      }
      return String(value)
  }
}

const ensureDefaultValues = () => {
  const next = { ...formModel.value }
  let changed = false

  props.fields.forEach((field) => {
    const normalizedValue = normalizeFieldValue(field, next[field.fieldKey])
    if (JSON.stringify(next[field.fieldKey]) !== JSON.stringify(normalizedValue)) {
      changed = true
    }
    next[field.fieldKey] = normalizedValue
  })

  if (changed) {
    formModel.value = next
  }
}

const buildFieldRules = (field: DataTemplateField) => {
  if (!field.isRequired || field.fieldType === 'BOOLEAN') {
    return []
  }

  if (field.fieldType === 'MULTI_SELECT') {
    return [
      {
        validator: (_rule: unknown, value: unknown, callback: (error?: Error) => void) => {
          if (Array.isArray(value) && value.length > 0) {
            callback()
            return
          }
          callback(new Error(`请选择${field.fieldName}`))
        },
        trigger: 'change',
      },
    ]
  }

  const isSelectLike =
    field.fieldType === 'SELECT' || field.fieldType === 'DATE' || field.fieldType === 'NUMBER'
  return [
    {
      required: true,
      message: `${isSelectLike ? '请选择' : '请填写'}${field.fieldName}`,
      trigger: isSelectLike ? 'change' : 'blur',
    },
  ]
}

const rules = computed<FormRules>(() =>
  Object.fromEntries(props.fields.map((field) => [field.fieldKey, buildFieldRules(field)])),
)

const validate = async () => {
  ensureDefaultValues()
  const result = await formRef.value?.validate().catch(() => false)
  return !!result
}

const resetValidation = () => {
  formRef.value?.clearValidate()
}

const getNormalizedData = () =>
  Object.fromEntries(
    props.fields.map((field) => [
      field.fieldKey,
      normalizeFieldValue(field, formModel.value[field.fieldKey]),
    ]),
  )

watch(
  [() => props.fields, () => formModel.value],
  () => {
    ensureDefaultValues()
  },
  { immediate: true },
)

defineExpose({
  validate,
  resetValidation,
  getNormalizedData,
})
</script>

<template>
  <el-form ref="formRef" :model="formModel" :rules="rules" :label-width="labelWidth">
    <el-row :gutter="16">
      <el-col v-for="field in fields" :key="field.id" :span="columnSpan">
        <el-form-item :label="field.fieldName" :prop="field.fieldKey">
          <el-input
            v-if="field.fieldType === 'TEXT'"
            v-model="formModel[field.fieldKey] as string"
            :disabled="disabled"
          />
          <el-input
            v-else-if="field.fieldType === 'TEXTAREA'"
            v-model="formModel[field.fieldKey] as string"
            type="textarea"
            :rows="3"
            :disabled="disabled"
          />
          <el-input-number
            v-else-if="field.fieldType === 'NUMBER'"
            v-model="formModel[field.fieldKey] as number | undefined"
            style="width: 100%"
            :disabled="disabled"
          />
          <el-date-picker
            v-else-if="field.fieldType === 'DATE'"
            v-model="formModel[field.fieldKey] as string"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :disabled="disabled"
          />
          <el-select
            v-else-if="field.fieldType === 'SELECT'"
            v-model="formModel[field.fieldKey] as string"
            style="width: 100%"
            clearable
            :disabled="disabled"
          >
            <el-option
              v-for="option in parseOptions(field)"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-select
            v-else-if="field.fieldType === 'MULTI_SELECT'"
            v-model="formModel[field.fieldKey] as string[]"
            style="width: 100%"
            multiple
            collapse-tags
            collapse-tags-tooltip
            :disabled="disabled"
          >
            <el-option
              v-for="option in parseOptions(field)"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <el-switch
            v-else-if="field.fieldType === 'BOOLEAN'"
            v-model="formModel[field.fieldKey] as boolean"
            :disabled="disabled"
          />
          <el-input v-else v-model="formModel[field.fieldKey] as string" :disabled="disabled" />
        </el-form-item>
      </el-col>
    </el-row>
  </el-form>
</template>
