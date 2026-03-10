<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  copyTemplateApi,
  deleteTemplateApi,
  getTemplatesApi,
  toggleTemplateApi,
  type CopyTemplatePayload,
} from '@/api/template'
import type { DataTemplate, TemplateStatus } from '@/types'

const router = useRouter()
const loading = ref(false)
const submitting = ref(false)
const list = ref<DataTemplate[]>([])
const copyDialogVisible = ref(false)
const copyFormRef = ref()
const copySourceId = ref(0)

const query = reactive({
  name: '',
  code: '',
  status: undefined as TemplateStatus | undefined,
})

const copyForm = reactive<CopyTemplatePayload>({
  name: '',
  code: '',
  description: '',
})

const copyRules = {
  name: [{ required: true, message: '请输入新模板名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入新模板编码', trigger: 'blur' }],
}

const statusTagMap: Record<TemplateStatus, 'info' | 'success' | 'warning'> = {
  DRAFT: 'info',
  PUBLISHED: 'success',
  ARCHIVED: 'warning',
}

const getStatusTagType = (status: TemplateStatus) => statusTagMap[status]

const filteredList = computed(() => {
  return list.value.filter((item) => {
    const matchName = !query.name.trim() || item.name.includes(query.name.trim())
    const matchCode = !query.code.trim() || item.code.includes(query.code.trim())
    const matchStatus = !query.status || item.status === query.status
    return matchName && matchCode && matchStatus
  })
})

const fetchList = async () => {
  loading.value = true
  try {
    list.value = await getTemplatesApi()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchList()
})

const resetQuery = async () => {
  query.name = ''
  query.code = ''
  query.status = undefined
  await fetchList()
}

const openCopyDialog = (row: DataTemplate) => {
  copySourceId.value = row.id
  copyForm.name = `${row.name}-副本`
  copyForm.code = `${row.code}_copy`
  copyForm.description = row.description || ''
  copyDialogVisible.value = true
}

const closeCopyDialog = () => {
  copyDialogVisible.value = false
  copySourceId.value = 0
  copyForm.name = ''
  copyForm.code = ''
  copyForm.description = ''
}

const onSubmitCopy = async () => {
  const valid = await copyFormRef.value?.validate().catch(() => false)
  if (!valid || !copySourceId.value) {
    return
  }

  submitting.value = true
  try {
    await copyTemplateApi(copySourceId.value, {
      name: copyForm.name,
      code: copyForm.code,
      description: copyForm.description || undefined,
    })
    ElMessage.success('模板复制成功')
    closeCopyDialog()
    await fetchList()
  } finally {
    submitting.value = false
  }
}

const onToggle = async (row: DataTemplate, value: boolean) => {
  row.isEnabled = !value
  try {
    await toggleTemplateApi(row.id, { isEnabled: value })
    row.isEnabled = value
    ElMessage.success('模板状态更新成功')
  } catch {
    row.isEnabled = !value
  }
}

const onDelete = async (row: DataTemplate) => {
  await ElMessageBox.confirm(`确认删除模板“${row.name}”吗？`, '删除模板', {
    type: 'warning',
  })
  await deleteTemplateApi(row.id)
  ElMessage.success('模板删除成功')
  await fetchList()
}

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
</script>

<template>
  <div class="page-block">
    <el-form :inline="true" class="filter-form">
      <el-form-item label="模板名称">
        <el-input v-model="query.name" placeholder="请输入模板名称" clearable />
      </el-form-item>
      <el-form-item label="模板编码">
        <el-input v-model="query.code" placeholder="请输入模板编码" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" clearable placeholder="请选择" style="width: 140px">
          <el-option label="草稿" value="DRAFT" />
          <el-option label="已发布" value="PUBLISHED" />
          <el-option label="已归档" value="ARCHIVED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="page-block__actions">
      <el-button type="primary" @click="router.push('/templates/create')">新建模板</el-button>
    </div>

    <el-table v-loading="loading" :data="filteredList" border>
      <template #empty>暂无模板数据</template>
      <el-table-column prop="name" label="模板名称" min-width="180" />
      <el-table-column prop="code" label="模板编码" min-width="180" />
      <el-table-column label="模板状态" width="120">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="启用状态" width="110">
        <template #default="{ row }">
          <el-switch
            :model-value="row.isEnabled"
            @update:model-value="(value) => onToggle(row, !!value)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="fieldCount" label="字段数" width="90" />
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="220" fixed="right">
        <template #default="{ row }">
          <el-space wrap>
            <el-button link type="primary" @click="router.push(`/templates/${row.id}`)"
              >详情</el-button
            >
            <el-button link type="warning" @click="openCopyDialog(row)">复制</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="copyDialogVisible" title="复制模板" width="540px" @closed="closeCopyDialog">
      <el-form ref="copyFormRef" :model="copyForm" :rules="copyRules" label-width="100px">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="copyForm.name" />
        </el-form-item>
        <el-form-item label="模板编码" prop="code">
          <el-input v-model="copyForm.code" />
        </el-form-item>
        <el-form-item label="模板说明">
          <el-input v-model="copyForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeCopyDialog">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmitCopy">确认复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page-block__actions {
  margin-bottom: 12px;
}
</style>
