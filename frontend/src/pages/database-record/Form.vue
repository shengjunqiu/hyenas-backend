<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { FormRules } from 'element-plus'
import {
  createDatabaseRecordApi,
  getDatabaseRecordDetailApi,
  updateDatabaseRecordApi,
} from '@/api/database-record'
import { getTemplateDetailApi, getTemplatesApi } from '@/api/template'
import type { DataTemplate, DataTemplateField } from '@/types'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id || 0))
const isEdit = computed(() => !!id.value)

const loading = ref(false)
const submitting = ref(false)
const templatesLoading = ref(false)
const formRef = ref()
const templates = ref<DataTemplate[]>([])
const selectedTemplate = ref<DataTemplate | null>(null)

const form = reactive({
  templateId: undefined as number | undefined,
  sourceName: '',
  dataJson: {} as Record<string, unknown>,
})

const enabledTemplates = computed(() => templates.value.filter((item) => item.isEnabled))
const templateFields = computed(() => selectedTemplate.value?.fields || [])

const rules: FormRules = {
  templateId: [{ required: true, message: '请选择模板', trigger: 'change' }],
}

const parseOptions = (field: DataTemplateField) => {
  if (!Array.isArray(field.optionsJson)) {
    return []
  }
  return field.optionsJson.map((item) => ({
    label: String(item),
    value: String(item),
  }))
}

const fieldRules = (field: DataTemplateField) => {
  if (!field.isRequired) {
    return []
  }
  return [{ required: true, message: `请填写${field.fieldName}`, trigger: 'change' }]
}

const ensureTemplateDefaults = () => {
  for (const field of templateFields.value) {
    if (form.dataJson[field.fieldKey] !== undefined) {
      continue
    }

    if (field.fieldType === 'MULTI_SELECT') {
      form.dataJson[field.fieldKey] = []
      continue
    }
    if (field.fieldType === 'BOOLEAN') {
      form.dataJson[field.fieldKey] = false
      continue
    }
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      form.dataJson[field.fieldKey] = field.defaultValue
      continue
    }
    form.dataJson[field.fieldKey] = ''
  }
}

const fetchTemplates = async () => {
  templatesLoading.value = true
  try {
    templates.value = await getTemplatesApi()
  } finally {
    templatesLoading.value = false
  }
}

const fetchTemplateDetail = async (templateId: number) => {
  selectedTemplate.value = await getTemplateDetailApi(templateId)
  ensureTemplateDefaults()
}

const fetchDetail = async () => {
  if (!isEdit.value) {
    return
  }

  const detail = await getDatabaseRecordDetailApi(id.value)
  form.templateId = detail.templateId
  form.sourceName = detail.sourceName || ''
  form.dataJson = { ...(detail.dataJson || {}) }
  await fetchTemplateDetail(detail.templateId)
}

const onTemplateChange = async (templateId?: number) => {
  form.dataJson = {}
  selectedTemplate.value = null
  if (!templateId) {
    return
  }
  await fetchTemplateDetail(templateId)
}

const buildPayload = () => ({
  templateId: form.templateId,
  sourceName: form.sourceName || undefined,
  dataJson: Object.fromEntries(
    Object.entries(form.dataJson).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value]
      }
      return [key, value]
    }),
  ),
})

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !form.templateId) {
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateDatabaseRecordApi(id.value, {
        sourceName: form.sourceName || undefined,
        dataJson: buildPayload().dataJson,
      })
      ElMessage.success('数据库数据更新成功')
    } else {
      await createDatabaseRecordApi({
        templateId: form.templateId,
        sourceName: form.sourceName || undefined,
        dataJson: buildPayload().dataJson,
      })
      ElMessage.success('数据库数据创建成功')
    }
    await router.push({
      path: '/database-records',
      query: {
        templateId: form.templateId,
      },
    })
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchTemplates()
    if (isEdit.value) {
      await fetchDetail()
    } else {
      const initialTemplateId = Number(route.query.templateId || 0)
      if (initialTemplateId) {
        form.templateId = initialTemplateId
        await fetchTemplateDetail(initialTemplateId)
      }
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-block" v-loading="loading">
    <el-page-header :content="isEdit ? '编辑数据库数据' : '新增数据库数据'" @back="router.back()" />

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="110px"
      class="database-record-form"
    >
      <el-card shadow="never">
        <template #header>基础信息</template>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="模板选择" prop="templateId">
              <el-select
                v-model="form.templateId"
                placeholder="请选择模板"
                style="width: 100%"
                :loading="templatesLoading"
                :disabled="isEdit"
                @change="(value) => onTemplateChange(value as number | undefined)"
              >
                <el-option
                  v-for="item in enabledTemplates"
                  :key="item.id"
                  :label="`${item.name}（${item.code}）`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="来源名称">
              <el-input v-model="form.sourceName" placeholder="可选，记录来源文件或批次名称" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <el-card shadow="never">
        <template #header>数据内容</template>

        <el-empty v-if="!templateFields.length" description="请先选择模板" />

        <el-row v-else :gutter="16">
          <el-col v-for="field in templateFields" :key="field.id" :span="12">
            <el-form-item
              :label="field.fieldName"
              :prop="`dataJson.${field.fieldKey}`"
              :rules="fieldRules(field)"
            >
              <el-input
                v-if="field.fieldType === 'TEXT'"
                v-model="form.dataJson[field.fieldKey] as string"
              />
              <el-input
                v-else-if="field.fieldType === 'TEXTAREA'"
                v-model="form.dataJson[field.fieldKey] as string"
                type="textarea"
                :rows="3"
              />
              <el-input-number
                v-else-if="field.fieldType === 'NUMBER'"
                v-model="form.dataJson[field.fieldKey] as number"
                style="width: 100%"
              />
              <el-date-picker
                v-else-if="field.fieldType === 'DATE'"
                v-model="form.dataJson[field.fieldKey] as string"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
              <el-select
                v-else-if="field.fieldType === 'SELECT'"
                v-model="form.dataJson[field.fieldKey] as string"
                style="width: 100%"
                clearable
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
                v-model="form.dataJson[field.fieldKey] as string[]"
                multiple
                collapse-tags
                collapse-tags-tooltip
                style="width: 100%"
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
                v-model="form.dataJson[field.fieldKey] as boolean"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <div class="database-record-form__footer">
        <el-button @click="router.back()">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">
          {{ isEdit ? '保存修改' : '创建数据' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.database-record-form {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.database-record-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
