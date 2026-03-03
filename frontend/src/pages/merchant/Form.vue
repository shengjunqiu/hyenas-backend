<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import type { MerchantFieldDef, MerchantStatus } from '@/types'
import {
  createMerchantApi,
  getMerchantCustomFieldsApi,
  getMerchantDetailApi,
  updateMerchantApi,
} from '@/api/merchant'
import { getFieldsApi } from '@/api/field'
import { getStatusesApi } from '@/api/status'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id || 0))
const isEdit = computed(() => !!id.value)

const loading = ref(false)
const submitting = ref(false)
const formRef = ref()
const statuses = ref<MerchantStatus[]>([])
const fields = ref<MerchantFieldDef[]>([])

const form = reactive({
  name: '',
  creditCode: '',
  contactName: '',
  contactPhone: '',
  address: '',
  licenseNo: '',
  businessType: '',
  statusId: undefined as number | undefined,
  remark: '',
  customFields: {} as Record<string, unknown>,
})

const enabledStatuses = computed(() => statuses.value.filter((item) => item.isEnabled))
const enabledFields = computed(() => fields.value.filter((item) => item.isEnabled))

const rules = {
  name: [{ required: true, message: '请输入商家名称', trigger: 'blur' }],
  statusId: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

const fieldRules = (field: MerchantFieldDef) => {
  if (!field.isRequired) {
    return []
  }
  return [{ required: true, message: `请填写${field.fieldName}`, trigger: 'change' }]
}

const parseOptions = (field: MerchantFieldDef): Array<{ label: string; value: string }> => {
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

const fetchMeta = async () => {
  const [statusRes, fieldRes] = await Promise.all([getStatusesApi(), getFieldsApi()])
  statuses.value = statusRes
  fields.value = fieldRes
}

const fetchDetail = async () => {
  if (!isEdit.value) {
    return
  }
  const [detail, customFields] = await Promise.all([
    getMerchantDetailApi(id.value),
    getMerchantCustomFieldsApi(id.value),
  ])

  form.name = detail.name || ''
  form.creditCode = detail.creditCode || ''
  form.contactName = detail.contactName || ''
  form.contactPhone = detail.contactPhone || ''
  form.address = detail.address || ''
  form.licenseNo = detail.licenseNo || ''
  form.businessType = detail.businessType || ''
  form.statusId = detail.statusId
  form.remark = detail.remark || ''

  form.customFields = {}
  customFields.forEach((item) => {
    form.customFields[item.fieldKey] = item.value
  })
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchMeta()
    await fetchDetail()
  } finally {
    loading.value = false
  }
})

const buildPayload = () => ({
  name: form.name,
  creditCode: form.creditCode || undefined,
  contactName: form.contactName || undefined,
  contactPhone: form.contactPhone || undefined,
  address: form.address || undefined,
  licenseNo: form.licenseNo || undefined,
  businessType: form.businessType || undefined,
  statusId: form.statusId,
  remark: form.remark || undefined,
  customFields: form.customFields,
})

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateMerchantApi(id.value, buildPayload())
      ElMessage.success('更新成功')
    } else {
      await createMerchantApi(buildPayload())
      ElMessage.success('创建成功')
    }
    await router.push('/merchants')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-block" v-loading="loading">
    <el-page-header :content="isEdit ? '编辑商家' : '新增商家'" @back="router.back()" />

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
      style="margin-top: 16px"
    >
      <el-card shadow="never">
        <template #header>基础信息</template>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="商家名称" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="统一社会信用代码">
              <el-input v-model="form.creditCode" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系人">
              <el-input v-model="form.contactName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.contactPhone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经营地址">
              <el-input v-model="form.address" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="许可证编号">
              <el-input v-model="form.licenseNo" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经营类型">
              <el-input v-model="form.businessType" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="当前状态" prop="statusId">
              <el-select v-model="form.statusId" style="width: 100%">
                <el-option
                  v-for="item in enabledStatuses"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注说明">
              <el-input v-model="form.remark" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <el-card shadow="never" style="margin-top: 16px">
        <template #header>自定义字段</template>

        <el-row :gutter="16">
          <el-col v-for="field in enabledFields" :key="field.id" :span="12">
            <el-form-item
              :label="field.fieldName"
              :prop="`customFields.${field.fieldKey}`"
              :rules="fieldRules(field)"
            >
              <el-input
                v-if="field.fieldType === 'TEXT'"
                v-model="form.customFields[field.fieldKey] as string"
              />

              <el-input
                v-else-if="field.fieldType === 'TEXTAREA'"
                v-model="form.customFields[field.fieldKey] as string"
                type="textarea"
                :rows="3"
              />

              <el-input-number
                v-else-if="field.fieldType === 'NUMBER'"
                v-model="form.customFields[field.fieldKey] as number"
                style="width: 100%"
              />

              <el-date-picker
                v-else-if="field.fieldType === 'DATE'"
                v-model="form.customFields[field.fieldKey] as string"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />

              <el-select
                v-else-if="field.fieldType === 'SELECT'"
                v-model="form.customFields[field.fieldKey]"
                style="width: 100%"
              >
                <el-option
                  v-for="opt in parseOptions(field)"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>

              <el-select
                v-else-if="field.fieldType === 'MULTI_SELECT'"
                v-model="form.customFields[field.fieldKey]"
                multiple
                style="width: 100%"
              >
                <el-option
                  v-for="opt in parseOptions(field)"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>

              <el-switch
                v-else-if="field.fieldType === 'BOOLEAN'"
                v-model="form.customFields[field.fieldKey] as boolean"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <div style="margin-top: 16px">
        <el-button @click="router.back()">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">保存</el-button>
      </div>
    </el-form>
  </div>
</template>
