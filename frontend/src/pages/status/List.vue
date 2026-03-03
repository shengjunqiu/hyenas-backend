<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { createStatusApi, getStatusesApi, toggleStatusApi, updateStatusApi } from '@/api/status'
import type { MerchantStatus } from '@/types'

const loading = ref(false)
const submitting = ref(false)
const list = ref<MerchantStatus[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()

const form = reactive({
  id: 0,
  name: '',
  code: '',
  color: '#409eff',
  sort: 0,
  remark: '',
})

const rules = {
  name: [{ required: true, message: '请输入状态名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入状态编码', trigger: 'blur' }],
}

const fetchList = async () => {
  loading.value = true
  try {
    list.value = await getStatusesApi()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchList()
})

const resetForm = () => {
  form.id = 0
  form.name = ''
  form.code = ''
  form.color = '#409eff'
  form.sort = 0
  form.remark = ''
}

const onCreate = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const onEdit = (row: MerchantStatus) => {
  isEdit.value = true
  form.id = row.id
  form.name = row.name
  form.code = row.code
  form.color = row.color || '#409eff'
  form.sort = row.sort
  form.remark = row.remark || ''
  dialogVisible.value = true
}

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateStatusApi(form.id, {
        name: form.name,
        color: form.color,
        sort: form.sort,
        remark: form.remark || undefined,
      })
      ElMessage.success('状态更新成功')
    } else {
      await createStatusApi({
        name: form.name,
        code: form.code,
        color: form.color,
        sort: form.sort,
        remark: form.remark || undefined,
      })
      ElMessage.success('状态创建成功')
    }
    dialogVisible.value = false
    await fetchList()
  } finally {
    submitting.value = false
  }
}

const onToggle = async (row: MerchantStatus, value: boolean) => {
  row.isEnabled = !value
  try {
    await toggleStatusApi(row.id, value)
    row.isEnabled = value
    ElMessage.success('状态更新成功')
  } catch {
    row.isEnabled = !value
  }
}
</script>

<template>
  <div class="page-block">
    <div style="margin-bottom: 12px">
      <el-button type="primary" @click="onCreate">新增状态</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <template #empty>暂无数据</template>
      <el-table-column prop="name" label="状态名称" min-width="150" />
      <el-table-column prop="code" label="状态编码" min-width="180" />
      <el-table-column label="显示颜色" min-width="120">
        <template #default="{ row }">
          <div style="display: flex; align-items: center; gap: 8px">
            <span
              :style="{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: row.color || '#d9d9d9',
                border: '1px solid #e5e7eb',
              }"
            />
            <span>{{ row.color || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序值" width="100" />
      <el-table-column label="是否启用" width="120">
        <template #default="{ row }">
          <el-switch
            :model-value="row.isEnabled"
            @update:model-value="(val) => onToggle(row, !!val)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="200" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑状态' : '新增状态'"
      width="520px"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="状态名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="状态编码" prop="code">
          <el-input v-model="form.code" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="显示颜色">
          <el-color-picker v-model="form.color" />
        </el-form-item>
        <el-form-item label="排序值">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>
