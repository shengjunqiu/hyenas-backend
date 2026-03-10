<script setup lang="ts">
import type { UploadProps, UploadUserFile } from 'element-plus'
import { ElMessage } from 'element-plus'
import { importDatabaseRecordsByExcelApi } from '@/api/database-record'
import { getTemplatesApi } from '@/api/template'
import type { DataTemplate } from '@/types'

const visible = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  (e: 'success'): void
}>()

const loading = ref(false)
const templatesLoading = ref(false)
const templates = ref<DataTemplate[]>([])
const fileList = ref<UploadUserFile[]>([])
const result = ref<{
  logId: number
  totalCount: number
  createdCount: number
  updatedCount: number
  failedCount: number
  failures: Array<{ row: number; primaryKeyValue?: string; reason: string }>
} | null>(null)

const form = reactive({
  templateId: undefined as number | undefined,
  file: null as File | null,
})

const enabledTemplates = computed(() => templates.value.filter((item) => item.isEnabled))
const resultSummary = computed(() => {
  if (!result.value) {
    return ''
  }
  return `导入完成，共 ${result.value.totalCount} 条，新增 ${result.value.createdCount} 条，更新 ${result.value.updatedCount} 条，失败 ${result.value.failedCount} 条`
})

watch(
  visible,
  async (value) => {
    if (!value) {
      return
    }
    if (!templates.value.length) {
      templatesLoading.value = true
      try {
        templates.value = await getTemplatesApi()
      } finally {
        templatesLoading.value = false
      }
    }
  },
  { immediate: true },
)

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  form.file = file
  fileList.value = [
    {
      name: file.name,
      url: '',
      raw: file,
    },
  ]
  return false
}

const onRemove = () => {
  form.file = null
  fileList.value = []
}

const closeDialog = () => {
  visible.value = false
  form.templateId = undefined
  form.file = null
  fileList.value = []
  result.value = null
}

const onSubmit = async () => {
  if (!form.templateId) {
    ElMessage.warning('请选择模板')
    return
  }
  if (!form.file) {
    ElMessage.warning('请上传 Excel 文件')
    return
  }

  loading.value = true
  try {
    result.value = await importDatabaseRecordsByExcelApi({
      templateId: form.templateId,
      file: form.file,
    })
    ElMessage.success(resultSummary.value || 'Excel 导入完成')
    emit('success')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="Excel 导入数据库数据" width="760px" @closed="closeDialog">
    <el-form label-width="100px">
      <el-alert
        v-if="!enabledTemplates.length"
        :closable="false"
        type="warning"
        show-icon
        title="当前没有可用模板，请先创建并启用模板后再导入。"
        style="margin-bottom: 16px"
      />
      <el-form-item label="模板选择" required>
        <el-select
          v-model="form.templateId"
          placeholder="请选择模板"
          style="width: 100%"
          :loading="templatesLoading"
        >
          <el-option
            v-for="item in enabledTemplates"
            :key="item.id"
            :label="`${item.name}（${item.code}）`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="Excel 文件" required>
        <el-upload
          :auto-upload="false"
          :limit="1"
          :file-list="fileList"
          accept=".xlsx,.xls"
          :before-upload="beforeUpload"
          :on-remove="onRemove"
        >
          <el-button type="primary" plain>选择文件</el-button>
          <template #tip>
            <div class="el-upload__tip">支持 `.xlsx`、`.xls`，按表头映射模板字段</div>
          </template>
        </el-upload>
      </el-form-item>
    </el-form>

    <el-card v-if="result" shadow="never" class="excel-import-result">
      <template #header>导入结果</template>
      <el-alert
        :closable="false"
        :type="result.failedCount ? 'warning' : 'success'"
        show-icon
        :title="resultSummary"
        style="margin-bottom: 16px"
      />
      <el-descriptions :column="4" border>
        <el-descriptions-item label="总数">{{ result.totalCount }}</el-descriptions-item>
        <el-descriptions-item label="新增数">{{ result.createdCount }}</el-descriptions-item>
        <el-descriptions-item label="更新数">{{ result.updatedCount }}</el-descriptions-item>
        <el-descriptions-item label="失败数">{{ result.failedCount }}</el-descriptions-item>
      </el-descriptions>

      <el-table
        v-if="result.failures.length"
        :data="result.failures"
        border
        style="margin-top: 16px"
      >
        <el-table-column prop="row" label="行号" width="100" />
        <el-table-column prop="primaryKeyValue" label="主键值" min-width="140" />
        <el-table-column prop="reason" label="失败原因" min-width="260" />
      </el-table>
    </el-card>

    <template #footer>
      <el-button @click="closeDialog">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="onSubmit">开始导入</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.excel-import-result {
  margin-top: 12px;
}
</style>
