<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { CreateTemplateFieldPayload } from '@/api/template'
import type { FieldType } from '@/types'

type TemplateFieldFormItem = Omit<CreateTemplateFieldPayload, 'optionsJson'> & {
  fieldKey: string
  fieldName: string
  fieldType: string
  optionsJson: string[]
}

const props = defineProps<{
  modelValue: TemplateFieldFormItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: TemplateFieldFormItem[]): void
}>()

const fieldTypeOptions: Array<{ label: string; value: FieldType }> = [
  { label: '单行文本', value: 'TEXT' },
  { label: '多行文本', value: 'TEXTAREA' },
  { label: '数字', value: 'NUMBER' },
  { label: '日期', value: 'DATE' },
  { label: '单选', value: 'SELECT' },
  { label: '多选', value: 'MULTI_SELECT' },
  { label: '布尔值', value: 'BOOLEAN' },
]

const createEmptyField = (): TemplateFieldFormItem => ({
  fieldName: '',
  fieldKey: '',
  fieldType: 'TEXT',
  isRequired: false,
  isPrimaryKey: false,
  isListed: true,
  isSearchable: false,
  defaultValue: '',
  optionsJson: [],
  sort: 0,
  remark: '',
})

const fields = computed({
  get: () => props.modelValue,
  set: (value: TemplateFieldFormItem[]) => emit('update:modelValue', value),
})

const cloneFields = (): TemplateFieldFormItem[] =>
  fields.value.map((item) => ({ ...item, optionsJson: [...(item.optionsJson || [])] }))

const updateField = (index: number, patch: Partial<TemplateFieldFormItem>) => {
  const next = cloneFields()
  next[index] = {
    ...next[index]!,
    ...patch,
  } as TemplateFieldFormItem
  fields.value = next
}

const addField = () => {
  fields.value = [...cloneFields(), createEmptyField()]
}

const removeField = (index: number) => {
  const next = cloneFields()
  next.splice(index, 1)
  fields.value = next
}

const onPrimaryChange = (index: number, value: boolean) => {
  const next = cloneFields().map((item, itemIndex) => ({
    ...item,
    isPrimaryKey: value ? itemIndex === index : itemIndex === index ? false : item.isPrimaryKey,
  }))
  fields.value = next
}

const onFieldTypeChange = (index: number, value: FieldType) => {
  const patch: Partial<TemplateFieldFormItem> = {
    fieldType: value,
  }
  if (value !== 'SELECT' && value !== 'MULTI_SELECT') {
    patch.optionsJson = []
  }
  updateField(index, patch)
}

const addOption = (index: number, rawValue: string) => {
  const value = rawValue.trim()
  if (!value) {
    return
  }

  const next = cloneFields()
  const options = [...next[index]!.optionsJson]
  if (options.includes(value)) {
    ElMessage.warning('选项已存在')
    return
  }
  options.push(value)
  next[index]!.optionsJson = options
  fields.value = next
}

const removeOption = (index: number, optionIndex: number) => {
  const next = cloneFields()
  next[index]!.optionsJson = [...next[index]!.optionsJson]
  next[index]!.optionsJson.splice(optionIndex, 1)
  fields.value = next
}

const validateFields = () => {
  if (!fields.value.length) {
    ElMessage.warning('至少需要配置一个字段')
    return false
  }

  const fieldKeys = new Set<string>()
  let primaryCount = 0

  for (const item of fields.value) {
    if (!item.fieldName.trim()) {
      ElMessage.warning('请填写字段名称')
      return false
    }
    if (!item.fieldKey.trim()) {
      ElMessage.warning('请填写字段编码')
      return false
    }
    if (fieldKeys.has(item.fieldKey.trim())) {
      ElMessage.warning(`字段编码重复：${item.fieldKey}`)
      return false
    }
    fieldKeys.add(item.fieldKey.trim())

    if (item.isPrimaryKey) {
      primaryCount += 1
    }

    if (
      (item.fieldType === 'SELECT' || item.fieldType === 'MULTI_SELECT') &&
      !(item.optionsJson || []).length
    ) {
      ElMessage.warning(`字段 ${item.fieldName || item.fieldKey} 需要至少一个选项`)
      return false
    }
  }

  if (primaryCount !== 1) {
    ElMessage.warning('模板必须且只能有一个主键字段')
    return false
  }

  return true
}

defineExpose({
  validateFields,
})
</script>

<template>
  <div class="template-field-builder">
    <div class="template-field-builder__toolbar">
      <div class="template-field-builder__title">字段配置</div>
      <el-button type="primary" plain @click="addField">新增字段</el-button>
    </div>

    <div v-if="!fields.length" class="template-field-builder__empty">
      <el-empty description="暂无字段，请先新增字段" />
    </div>

    <div v-for="(field, index) in fields" :key="index" class="template-field-builder__item">
      <el-card shadow="never">
        <template #header>
          <div class="template-field-builder__item-header">
            <span>字段 {{ index + 1 }}</span>
            <el-button link type="danger" @click="removeField(index)">删除</el-button>
          </div>
        </template>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item :label="`字段名称 ${index + 1}`" required>
              <el-input
                :model-value="field.fieldName"
                placeholder="例如：企业名称"
                @update:model-value="(value) => updateField(index, { fieldName: value })"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="`字段编码 ${index + 1}`" required>
              <el-input
                :model-value="field.fieldKey"
                placeholder="例如：companyName"
                @update:model-value="(value) => updateField(index, { fieldKey: value })"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="字段类型" required>
              <el-select
                :model-value="field.fieldType"
                style="width: 100%"
                @update:model-value="(value) => onFieldTypeChange(index, value as FieldType)"
              >
                <el-option
                  v-for="item in fieldTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="是否必填">
              <el-switch
                :model-value="field.isRequired"
                @update:model-value="(value) => updateField(index, { isRequired: !!value })"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="是否主键">
              <el-switch
                :model-value="field.isPrimaryKey"
                @update:model-value="(value) => onPrimaryChange(index, !!value)"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="列表展示">
              <el-switch
                :model-value="field.isListed"
                @update:model-value="(value) => updateField(index, { isListed: !!value })"
              />
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="可搜索">
              <el-switch
                :model-value="field.isSearchable"
                @update:model-value="(value) => updateField(index, { isSearchable: !!value })"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="默认值">
              <el-input
                :model-value="field.defaultValue"
                @update:model-value="(value) => updateField(index, { defaultValue: value })"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="排序值">
              <el-input-number
                :model-value="field.sort"
                :min="0"
                :max="9999"
                style="width: 100%"
                @update:model-value="(value) => updateField(index, { sort: Number(value || 0) })"
              />
            </el-form-item>
          </el-col>

          <el-col
            v-if="field.fieldType === 'SELECT' || field.fieldType === 'MULTI_SELECT'"
            :span="24"
          >
            <el-form-item label="选项配置" required>
              <div class="template-field-builder__options">
                <el-space wrap>
                  <el-tag
                    v-for="(option, optionIndex) in field.optionsJson || []"
                    :key="`${option}-${optionIndex}`"
                    closable
                    @close="removeOption(index, optionIndex)"
                  >
                    {{ option }}
                  </el-tag>
                </el-space>
                <div class="template-field-builder__option-input">
                  <el-input
                    placeholder="录入选项内容"
                    @keyup.enter="
                      (event: KeyboardEvent) =>
                        addOption(index, (event.target as HTMLInputElement).value)
                    "
                  />
                  <el-button
                    @click="
                      ($event) =>
                        addOption(
                          index,
                          (
                            ($event.currentTarget as HTMLElement)
                              .previousElementSibling as HTMLInputElement | null
                          )?.value || '',
                        )
                    "
                  >
                    添加
                  </el-button>
                </div>
              </div>
            </el-form-item>
          </el-col>

          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                :model-value="field.remark"
                type="textarea"
                :rows="2"
                @update:model-value="(value) => updateField(index, { remark: value })"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-field-builder {
  display: grid;
  gap: 16px;
}

.template-field-builder__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.template-field-builder__title {
  font-size: 16px;
  font-weight: 600;
}

.template-field-builder__empty,
.template-field-builder__item {
  width: 100%;
}

.template-field-builder__item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.template-field-builder__options {
  width: 100%;
  display: grid;
  gap: 10px;
}

.template-field-builder__option-input {
  display: flex;
  gap: 8px;
}
</style>
