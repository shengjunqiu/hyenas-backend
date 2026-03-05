<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { getAdminsApi } from '@/api/admin'
import { batchAssignMerchantAdminsApi } from '@/api/merchant'
import type { Admin } from '@/types'

const props = defineProps<{ merchantIds: number[] }>()
const emit = defineEmits<{ success: [] }>()

const visible = defineModel<boolean>({ required: true })
const loading = ref(false)
const adminOptions = ref<Admin[]>([])
const selectedAdminIds = ref<number[]>([])

const loadAdmins = async () => {
  loading.value = true
  try {
    const res = await getAdminsApi({ page: 1, pageSize: 100 })
    adminOptions.value = res.list.filter((item) => item.role === 'NORMAL')
  } finally {
    loading.value = false
  }
}

watch(
  () => visible.value,
  (val) => {
    if (val) {
      selectedAdminIds.value = []
      void loadAdmins()
    }
  },
)

const onSubmit = async () => {
  if (!props.merchantIds.length) {
    ElMessage.warning('请先选择商户')
    return
  }
  if (!selectedAdminIds.value.length) {
    ElMessage.warning('请选择要分配的管理员')
    return
  }

  loading.value = true
  try {
    const result = await batchAssignMerchantAdminsApi({
      merchantIds: props.merchantIds,
      adminIds: selectedAdminIds.value,
    })
    ElMessage.success(
      `批量分配完成：新增 ${result.createdCount} 条，跳过 ${result.skippedCount} 条`,
    )
    visible.value = false
    emit('success')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="批量分配管理员" width="560px">
    <div v-loading="loading">
      <el-alert
        :closable="false"
        type="info"
        show-icon
        :title="`已选择 ${merchantIds.length} 个商户`"
      />

      <el-form label-width="90px" style="margin-top: 16px">
        <el-form-item label="选择管理员">
          <el-select
            v-model="selectedAdminIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择普通管理员"
            style="width: 100%"
          >
            <el-option
              v-for="item in adminOptions"
              :key="item.id"
              :label="`${item.name}（${item.username}）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="onSubmit">确认分配</el-button>
    </template>
  </el-dialog>
</template>
