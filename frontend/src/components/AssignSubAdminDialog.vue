<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { getSubAdminsApi } from '@/api/sub-admin'
import {
  assignMerchantSubAdminsApi,
  getMerchantSubAdminsApi,
  unassignMerchantSubAdminApi,
  type MerchantSubAdminRelation,
} from '@/api/merchant'
import type { Admin } from '@/types'

const props = defineProps<{ merchantId: number }>()
const visible = defineModel<boolean>({ required: true })
const loading = ref(false)
const adminOptions = ref<Admin[]>([])
const currentRelations = ref<MerchantSubAdminRelation[]>([])
const selectedAdminIds = ref<number[]>([])

const assignedAdminIds = computed(() => currentRelations.value.map((item) => item.subAdminId))

const availableOptions = computed(() =>
  adminOptions.value.filter((item) => !assignedAdminIds.value.includes(item.id)),
)

const loadData = async () => {
  if (!props.merchantId) {
    return
  }
  loading.value = true
  try {
    const [adminRes, relationRes] = await Promise.all([
      getSubAdminsApi({ page: 1, pageSize: 100 }),
      getMerchantSubAdminsApi(props.merchantId),
    ])
    adminOptions.value = adminRes.list
    currentRelations.value = relationRes
  } finally {
    loading.value = false
  }
}

watch(
  () => visible.value,
  (val) => {
    if (val) {
      void loadData()
      selectedAdminIds.value = []
    }
  },
  { immediate: true },
)

const onAssign = async () => {
  if (!selectedAdminIds.value.length) {
    ElMessage.warning('请选择要分配的子管理员')
    return
  }

  loading.value = true
  try {
    const res = await assignMerchantSubAdminsApi(props.merchantId, {
      adminIds: selectedAdminIds.value,
    })
    currentRelations.value = res
    selectedAdminIds.value = []
    ElMessage.success('分配成功')
  } finally {
    loading.value = false
  }
}

const onUnassign = async (subAdminId: number) => {
  loading.value = true
  try {
    await unassignMerchantSubAdminApi(props.merchantId, subAdminId)
    currentRelations.value = currentRelations.value.filter((item) => item.subAdminId !== subAdminId)
    ElMessage.success('解除分配成功')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="分配子管理员" width="560px">
    <div v-loading="loading">
      <el-space wrap>
        <el-tag
          v-for="item in currentRelations"
          :key="item.id"
          closable
          @close="onUnassign(item.subAdminId)"
        >
          {{ item.subAdmin.name }}（{{ item.subAdmin.username }}）
        </el-tag>
      </el-space>

      <el-divider />

      <el-form label-width="100px">
        <el-form-item label="选择子管理员">
          <el-select
            v-model="selectedAdminIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择子管理员"
            style="width: 100%"
          >
            <el-option
              v-for="item in availableOptions"
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
      <el-button type="primary" :loading="loading" @click="onAssign">确认分配</el-button>
    </template>
  </el-dialog>
</template>
