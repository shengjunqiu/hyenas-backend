<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  copyTemplateApi,
  deleteTemplateApi,
  deleteTemplateFieldApi,
  getTemplateDetailApi,
  toggleTemplateApi,
  type CopyTemplatePayload,
} from '@/api/template'
import type { DataTemplate, DataTemplateField } from '@/types'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id || 0))

const loading = ref(false)
const submitting = ref(false)
const detail = ref<DataTemplate | null>(null)
const copyDialogVisible = ref(false)
const copyFormRef = ref()

const copyForm = reactive<CopyTemplatePayload>({
  name: '',
  code: '',
  description: '',
})

const copyRules = {
  name: [{ required: true, message: '请输入新模板名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入新模板编码', trigger: 'blur' }],
}

const fetchDetail = async () => {
  if (!id.value) {
    return
  }
  loading.value = true
  try {
    detail.value = await getTemplateDetailApi(id.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchDetail()
})

const openCopyDialog = () => {
  if (!detail.value) {
    return
  }
  copyForm.name = `${detail.value.name}-副本`
  copyForm.code = `${detail.value.code}_copy`
  copyForm.description = detail.value.description || ''
  copyDialogVisible.value = true
}

const closeCopyDialog = () => {
  copyDialogVisible.value = false
  copyForm.name = ''
  copyForm.code = ''
  copyForm.description = ''
}

const onSubmitCopy = async () => {
  const valid = await copyFormRef.value?.validate().catch(() => false)
  if (!valid || !detail.value) {
    return
  }

  submitting.value = true
  try {
    await copyTemplateApi(detail.value.id, {
      name: copyForm.name,
      code: copyForm.code,
      description: copyForm.description || undefined,
    })
    ElMessage.success('模板复制成功')
    closeCopyDialog()
  } finally {
    submitting.value = false
  }
}

const onToggle = async (value: boolean) => {
  if (!detail.value) {
    return
  }

  const previous = detail.value.isEnabled
  detail.value.isEnabled = value
  try {
    await toggleTemplateApi(detail.value.id, { isEnabled: value })
    ElMessage.success('模板状态更新成功')
  } catch {
    detail.value.isEnabled = previous
  }
}

const onDeleteTemplate = async () => {
  if (!detail.value) {
    return
  }

  await ElMessageBox.confirm(`确认删除模板“${detail.value.name}”吗？`, '删除模板', {
    type: 'warning',
  })
  await deleteTemplateApi(detail.value.id)
  ElMessage.success('模板删除成功')
  await router.push('/templates')
}

const onDeleteField = async (field: DataTemplateField) => {
  if (!detail.value) {
    return
  }

  await ElMessageBox.confirm(`确认删除字段“${field.fieldName}”吗？`, '删除字段', {
    type: 'warning',
  })
  await deleteTemplateFieldApi(detail.value.id, field.id)
  ElMessage.success('字段删除成功')
  await fetchDetail()
}

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'
</script>

<template>
  <div class="page-block" v-loading="loading">
    <el-page-header content="模板详情" @back="router.back()" />

    <template v-if="detail">
      <div class="template-detail__toolbar">
        <el-space wrap>
          <el-button type="primary" @click="openCopyDialog">复制模板</el-button>
          <el-button type="danger" plain @click="onDeleteTemplate">删除模板</el-button>
        </el-space>
        <el-space>
          <span>启用状态</span>
          <el-switch
            :model-value="detail.isEnabled"
            @update:model-value="(value) => onToggle(!!value)"
          />
        </el-space>
      </div>

      <el-card shadow="never">
        <template #header>基础信息</template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="模板名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="模板编码">{{ detail.code }}</el-descriptions-item>
          <el-descriptions-item label="模板状态">{{ detail.status }}</el-descriptions-item>
          <el-descriptions-item label="字段数量">{{
            detail.fields?.length || 0
          }}</el-descriptions-item>
          <el-descriptions-item label="来源模板">
            {{ detail.copiedFrom ? `${detail.copiedFrom.name}（${detail.copiedFrom.code}）` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ detail.creator ? `${detail.creator.name}（${detail.creator.username}）` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{
            formatDate(detail.createdAt)
          }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{
            formatDate(detail.updatedAt)
          }}</el-descriptions-item>
          <el-descriptions-item label="模板说明" :span="2">
            {{ detail.description || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <template #header>字段列表</template>
        <el-table :data="detail.fields || []" border>
          <template #empty>暂无字段配置</template>
          <el-table-column prop="fieldName" label="字段名称" min-width="140" />
          <el-table-column prop="fieldKey" label="字段编码" min-width="150" />
          <el-table-column prop="fieldType" label="字段类型" width="120" />
          <el-table-column label="必填" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isRequired ? 'danger' : 'info'">{{
                row.isRequired ? '是' : '否'
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="主键" width="90">
            <template #default="{ row }">
              <el-tag :type="row.isPrimaryKey ? 'success' : 'info'">{{
                row.isPrimaryKey ? '是' : '否'
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="列表展示" width="100">
            <template #default="{ row }">{{ row.isListed ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column label="可搜索" width="100">
            <template #default="{ row }">{{ row.isSearchable ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column label="选项配置" min-width="180">
            <template #default="{ row }">
              <el-space wrap>
                <el-tag
                  v-for="(option, index) in row.optionsJson || []"
                  :key="`${option}-${index}`"
                >
                  {{ option }}
                </el-tag>
                <span v-if="!(row.optionsJson || []).length">-</span>
              </el-space>
            </template>
          </el-table-column>
          <el-table-column prop="sort" label="排序值" width="90" />
          <el-table-column prop="remark" label="备注" min-width="160" />
          <el-table-column label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="danger"
                :disabled="row.isPrimaryKey"
                @click="onDeleteField(row)"
              >
                删除字段
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

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
.template-detail__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 16px 0;
}

.page-block {
  display: grid;
  gap: 16px;
}
</style>
