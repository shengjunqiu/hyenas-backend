<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { getAdminsApi } from '@/api/admin'
import { assignProjectAdminApi } from '@/api/project'
import type { Admin, Project } from '@/types'

const props = defineProps<{
  project: Project | null
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const visible = defineModel<boolean>({ required: true })
const loading = ref(false)
const adminOptions = ref<Admin[]>([])
const selectedAdminId = ref<number | undefined>()

const currentAdminLabel = computed(() => {
  if (!props.project?.projectAdmin) {
    return '暂未分配'
  }
  return `${props.project.projectAdmin.name}（${props.project.projectAdmin.username}）`
})

const loadAdmins = async () => {
  if (!props.project?.id) {
    return
  }
  loading.value = true
  try {
    const res = await getAdminsApi({ page: 1, pageSize: 100 })
    adminOptions.value = res.list.filter(
      (item) => item.role === 'NORMAL' && item.status === 'ENABLED',
    )
    selectedAdminId.value = props.project.projectAdminId ?? undefined
  } finally {
    loading.value = false
  }
}

watch(
  () => visible.value,
  (value) => {
    if (value) {
      void loadAdmins()
    }
  },
)

const onSubmit = async () => {
  if (!props.project?.id) {
    return
  }
  if (!selectedAdminId.value) {
    ElMessage.warning('请选择项目管理员')
    return
  }

  loading.value = true
  try {
    await assignProjectAdminApi(props.project.id, { adminId: selectedAdminId.value })
    ElMessage.success('项目管理员分配成功')
    visible.value = false
    emit('success')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="分配项目管理员" width="560px">
    <div v-loading="loading">
      <el-alert
        :closable="false"
        type="info"
        show-icon
        :title="`当前项目管理员：${currentAdminLabel}`"
      />

      <el-form label-width="100px" style="margin-top: 16px">
        <el-form-item label="选择管理员" required>
          <el-select v-model="selectedAdminId" placeholder="请选择普通管理员" style="width: 100%">
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
