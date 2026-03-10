<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { FormRules } from 'element-plus'
import {
  createDatabaseRecordApi,
  getDatabaseRecordDetailApi,
  updateDatabaseRecordApi,
} from '@/api/database-record'
import { getTemplateDetailApi, getTemplatesApi } from '@/api/template'
import DynamicDataForm from '@/components/DynamicDataForm.vue'
import type { DataTemplate } from '@/types'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id || 0))
const isEdit = computed(() => !!id.value)

const loading = ref(false)
const submitting = ref(false)
const templatesLoading = ref(false)
const formRef = ref()
const dynamicFormRef = ref<InstanceType<typeof DynamicDataForm> | null>(null)
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
  await nextTick()
  dynamicFormRef.value?.resetValidation()
}

const buildPayload = () => ({
  templateId: form.templateId,
  sourceName: form.sourceName || undefined,
  dataJson: dynamicFormRef.value?.getNormalizedData() || form.dataJson,
})

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  const dynamicValid = templateFields.value.length ? await dynamicFormRef.value?.validate() : true
  if (!valid || !dynamicValid || !form.templateId) {
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

        <DynamicDataForm
          v-else
          ref="dynamicFormRef"
          v-model="form.dataJson"
          :fields="templateFields"
        />
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
