<script setup lang="ts">
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadProps, UploadUserFile } from 'element-plus'
import { importMerchantsApi, type MerchantImportResult } from '@/api/merchant'
import type { MerchantStatus } from '@/types'

const props = defineProps<{ statusOptions: MerchantStatus[] }>()
const visible = defineModel<boolean>({ required: true })
const emits = defineEmits<{ success: [] }>()

const loading = ref(false)
const selectedFile = ref<File>()
const fileList = ref<UploadUserFile[]>([])
const result = ref<MerchantImportResult | null>(null)

const enabledStatusNames = computed(() =>
  props.statusOptions
    .filter((item) => item.isEnabled)
    .map((item) => item.name)
    .join('、'),
)

watch(
  () => visible.value,
  (val) => {
    if (!val) {
      return
    }
    selectedFile.value = undefined
    fileList.value = []
    result.value = null
  },
  { immediate: true },
)

const onFileChange: UploadProps['onChange'] = (uploadFile) => {
  const rawFile = uploadFile.raw
  if (!rawFile) {
    selectedFile.value = undefined
    fileList.value = []
    return
  }

  if (!/\.(xlsx|xls)$/i.test(rawFile.name)) {
    ElMessage.error('请上传 .xlsx 或 .xls 文件')
    selectedFile.value = undefined
    fileList.value = []
    return false
  }

  selectedFile.value = rawFile
  fileList.value = [
    {
      name: rawFile.name,
      size: rawFile.size,
      status: 'ready',
    },
  ]
  result.value = null
}

const onRemove: UploadProps['onRemove'] = () => {
  selectedFile.value = undefined
  fileList.value = []
}

const onSubmit = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择 Excel 文件')
    return
  }

  loading.value = true
  try {
    const res = await importMerchantsApi(selectedFile.value)
    result.value = res

    if (res.successCount > 0) {
      emits('success')
    }

    if (res.failureCount === 0) {
      ElMessage.success(`导入成功，共导入 ${res.successCount} 条商家`)
      visible.value = false
      return
    }

    ElMessage.warning(
      `导入完成，成功 ${res.successCount} 条，失败 ${res.failureCount} 条，请检查失败原因`,
    )
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="Excel 导入商家" width="760px">
    <el-alert type="info" show-icon :closable="false">
      <template #title>
        第一行请使用表头。仅“经营者名称”为必填列；其它列即使缺失或留空也允许导入。
      </template>
      <template #default>
        状态列支持填写状态名称、状态编码或状态
        ID；如果整列缺失或单元格留空，会自动使用默认状态。当前启用状态：{{
          enabledStatusNames || '暂无'
        }}。
        如果经营者名称已存在，会保留已有非空字段，只补全原来为空的新字段。导入暂不包含自定义字段和管理员分配。
      </template>
    </el-alert>

    <el-upload
      drag
      :auto-upload="false"
      :limit="1"
      :file-list="fileList"
      accept=".xlsx,.xls"
      style="margin-top: 16px"
      :on-change="onFileChange"
      :on-remove="onRemove"
    >
      <el-icon style="font-size: 32px"><UploadFilled /></el-icon>
      <div style="margin-top: 12px">将 Excel 文件拖到此处，或点击上传</div>
      <template #tip>
        <div class="el-upload__tip">单个文件大小建议不超过 5MB</div>
      </template>
    </el-upload>

    <el-card v-if="result" shadow="never" style="margin-top: 16px">
      <template #header>导入结果</template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="总行数">{{ result.total }}</el-descriptions-item>
        <el-descriptions-item label="成功">{{ result.successCount }}</el-descriptions-item>
        <el-descriptions-item label="失败">{{ result.failureCount }}</el-descriptions-item>
      </el-descriptions>

      <el-table
        v-if="result.errors.length"
        :data="result.errors"
        border
        style="margin-top: 16px"
        max-height="280"
      >
        <el-table-column prop="rowNumber" label="Excel 行号" width="110" />
        <el-table-column prop="merchantName" label="经营者名称" min-width="180" />
        <el-table-column prop="reason" label="失败原因" min-width="280" />
      </el-table>
    </el-card>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="loading" @click="onSubmit">开始导入</el-button>
    </template>
  </el-dialog>
</template>
