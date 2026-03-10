<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { FormRules } from 'element-plus'
import { createProjectApi, getProjectDetailApi, updateProjectApi } from '@/api/project'
import { getTemplatesApi } from '@/api/template'
import { useUserStore } from '@/stores/user'
import type { DataTemplate, ProjectStatus } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const id = computed(() => Number(route.params.id || 0))
const isEdit = computed(() => !!id.value)

const loading = ref(false)
const submitting = ref(false)
const templatesLoading = ref(false)
const formRef = ref()
const templates = ref<DataTemplate[]>([])

const form = reactive({
  name: '',
  code: '',
  templateId: undefined as number | undefined,
  description: '',
  status: 'DRAFT' as ProjectStatus,
  startDate: '',
  endDate: '',
})

const enabledTemplates = computed(() => templates.value.filter((item) => item.isEnabled))

const rules: FormRules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入项目编号', trigger: 'blur' }],
  templateId: [{ required: !isEdit.value, message: '请选择模板', trigger: 'change' }],
}

const fetchTemplates = async () => {
  templatesLoading.value = true
  try {
    templates.value = await getTemplatesApi()
  } finally {
    templatesLoading.value = false
  }
}

const fetchDetail = async () => {
  if (!isEdit.value) {
    return
  }

  const detail = await getProjectDetailApi(id.value)
  form.name = detail.name
  form.code = detail.code
  form.templateId = detail.templateId
  form.description = detail.description || ''
  form.status = detail.status
  form.startDate = detail.startDate || ''
  form.endDate = detail.endDate || ''
}

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateProjectApi(id.value, {
        name: form.name,
        code: form.code,
        description: form.description || undefined,
        status: form.status,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      })
      ElMessage.success('项目更新成功')
    } else {
      await createProjectApi({
        name: form.name,
        code: form.code,
        templateId: form.templateId!,
        description: form.description || undefined,
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      })
      ElMessage.success('项目创建成功')
    }
    await router.push('/projects')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await fetchTemplates()
    await fetchDetail()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page-block" v-loading="loading">
    <el-page-header :content="isEdit ? '编辑项目' : '新建项目'" @back="router.back()" />

    <el-alert
      v-if="!userStore.isSuper && !isEdit"
      type="warning"
      :closable="false"
      show-icon
      title="当前角色不可创建项目。"
      style="margin-top: 16px"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" class="project-form">
      <el-card shadow="never">
        <template #header>项目基础信息</template>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="项目名称" prop="name">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="项目编号" prop="code">
              <el-input v-model="form.code" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="绑定模板" prop="templateId">
              <el-select
                v-model="form.templateId"
                style="width: 100%"
                :disabled="isEdit"
                :loading="templatesLoading"
                placeholder="请选择模板"
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
            <el-form-item label="项目状态">
              <el-select v-model="form.status" style="width: 100%">
                <el-option label="草稿" value="DRAFT" />
                <el-option label="进行中" value="ACTIVE" />
                <el-option label="已完成" value="COMPLETED" />
                <el-option label="已归档" value="ARCHIVED" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开始时间">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间">
              <el-date-picker
                v-model="form.endDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="项目描述">
              <el-input v-model="form.description" type="textarea" :rows="4" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <div class="project-form__footer">
        <el-button @click="router.back()">取消</el-button>
        <el-button
          type="primary"
          :loading="submitting"
          :disabled="!userStore.isSuper && !isEdit"
          @click="onSubmit"
        >
          {{ isEdit ? '保存修改' : '创建项目' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.project-form {
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.project-form__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
