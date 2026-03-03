<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { changeMerchantStatusApi } from '@/api/merchant'
import { getStatusesApi } from '@/api/status'
import type { MerchantStatus } from '@/types'

const props = defineProps<{ merchantId: number; currentStatusId?: number }>()
const visible = defineModel<boolean>({ required: true })
const emits = defineEmits<{ success: [] }>()

const loading = ref(false)
const statuses = ref<MerchantStatus[]>([])
const form = reactive({
  statusId: undefined as number | undefined,
  remark: '',
})

const availableStatuses = computed(() =>
  statuses.value.filter((item) => item.isEnabled && item.id !== props.currentStatusId),
)

watch(
  () => visible.value,
  async (val) => {
    if (!val) {
      return
    }
    form.statusId = undefined
    form.remark = ''
    statuses.value = await getStatusesApi()
  },
)

const onSubmit = async () => {
  if (!form.statusId) {
    ElMessage.warning('请选择新状态')
    return
  }

  loading.value = true
  try {
    await changeMerchantStatusApi(props.merchantId, form.statusId, form.remark || undefined)
    ElMessage.success('状态变更成功')
    visible.value = false
    emits('success')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="变更状态" width="500px">
    <el-form label-width="90px">
      <el-form-item label="新状态">
        <el-select v-model="form.statusId" placeholder="请选择状态" style="width: 100%">
          <el-option
            v-for="item in availableStatuses"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="onSubmit">确认</el-button>
    </template>
  </el-dialog>
</template>
