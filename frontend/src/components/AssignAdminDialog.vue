<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { getAdminsApi } from '@/api/admin'
import {
  assignMerchantAdminsApi,
  getMerchantAdminsApi,
  unassignMerchantAdminApi,
  type MerchantAdminRelation,
} from '@/api/merchant'
import type { Admin } from '@/types'

const props = defineProps<{ merchantId: number }>()
const visible = defineModel<boolean>({ required: true })
const loading = ref(false)
const adminOptions = ref<Admin[]>([])
const currentRelations = ref<MerchantAdminRelation[]>([])
const selectedAdminIds = ref<number[]>([])

const assignedAdminIds = computed(() => currentRelations.value.map((item) => item.adminId))

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
      getAdminsApi({ page: 1, pageSize: 100 }),
      getMerchantAdminsApi(props.merchantId),
    ])
    adminOptions.value = adminRes.list.filter((item) => item.role === 'NORMAL')
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
)

const onAssign = async () => {
  if (!selectedAdminIds.value.length) {
    ElMessage.warning('请选择要分配的管理员')
    return
  }

  loading.value = true
  try {
    const res = await assignMerchantAdminsApi(props.merchantId, {
      adminIds: selectedAdminIds.value,
    })
    currentRelations.value = res
    selectedAdminIds.value = []
    ElMessage.success('分配成功')
  } finally {
    loading.value = false
  }
}

const onUnassign = async (adminId: number) => {
  loading.value = true
  try {
    await unassignMerchantAdminApi(props.merchantId, adminId)
    currentRelations.value = currentRelations.value.filter((item) => item.adminId !== adminId)
    ElMessage.success('解除分配成功')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="分配管理员" width="560px">
    <div v-loading="loading">
      <el-space wrap>
        <el-tag
          v-for="item in currentRelations"
          :key="item.id"
          closable
          @close="onUnassign(item.adminId)"
        >
          {{ item.admin.name }}（{{ item.admin.username }}）
        </el-tag>
      </el-space>

      <el-divider />

      <el-form label-width="90px">
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
