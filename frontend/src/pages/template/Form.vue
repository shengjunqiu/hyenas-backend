<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { FormRules } from 'element-plus'
import { createTemplateApi, type CreateTemplateFieldPayload } from '@/api/template'
import TemplateFieldBuilder from '@/components/TemplateFieldBuilder.vue'

type TemplateFieldFormItem = CreateTemplateFieldPayload & { optionsJson: string[] }

const router = useRouter()
const formRef = ref()
const fieldBuilderRef = ref<InstanceType<typeof TemplateFieldBuilder>>()
const submitting = ref(false)

const form = reactive({
  name: '',
  code: '',
  description: '',
  fields: [
    {
      fieldName: '',
      fieldKey: '',
      fieldType: 'TEXT',
      isRequired: false,
      isPrimaryKey: true,
      isListed: true,
      isSearchable: false,
      defaultValue: '',
      optionsJson: [] as string[],
      sort: 0,
      remark: '',
    },
  ] as TemplateFieldFormItem[],
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入模板编码', trigger: 'blur' }],
}

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  const fieldValid = fieldBuilderRef.value?.validateFields()
  if (!fieldValid) {
    return
  }

  submitting.value = true
  try {
    await createTemplateApi({
      name: form.name,
      code: form.code,
      description: form.description || undefined,
      fields: form.fields.map((item, index) => ({
        ...item,
        fieldName: item.fieldName.trim(),
        fieldKey: item.fieldKey.trim(),
        defaultValue: item.defaultValue || undefined,
        optionsJson:
          item.fieldType === 'SELECT' || item.fieldType === 'MULTI_SELECT'
            ? item.optionsJson
            : undefined,
        sort: item.sort ?? index,
        remark: item.remark || undefined,
      })),
    })
    ElMessage.success('模板创建成功')
    await router.push('/templates')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-block">
    <el-page-header content="新建模板" @back="router.back()" />

    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" class="template-form">
      <el-card shadow="never">
        <template #header>模板基础信息</template>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="form.name" placeholder="请输入模板名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="模板编码" prop="code">
              <el-input v-model="form.code" placeholder="请输入模板编码" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="模板说明">
              <el-input v-model="form.description" type="textarea" :rows="3" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <el-card shadow="never">
        <TemplateFieldBuilder ref="fieldBuilderRef" v-model="form.fields" />
      </el-card>

      <div class="template-form__footer">
        <el-button @click="router.back()">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">创建模板</el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.template-form {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.template-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
