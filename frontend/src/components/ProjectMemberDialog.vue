<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { getAdminsApi } from '@/api/admin'
import { addProjectMemberApi, getProjectMembersApi, removeProjectMemberApi } from '@/api/project'
import { useUserStore } from '@/stores/user'
import type { Admin, Project, ProjectMember } from '@/types'

const props = defineProps<{
  project: Project | null
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const userStore = useUserStore()
const visible = defineModel<boolean>({ required: true })
const loading = ref(false)
const memberList = ref<ProjectMember[]>([])
const adminOptions = ref<Admin[]>([])
const selectedAdminId = ref<number | undefined>()

const canManage = computed(
  () => !userStore.isSuper && props.project?.projectAdminId === userStore.user?.id,
)

const availableOptions = computed(() => {
  const assignedIds = new Set(memberList.value.map((item) => item.adminId))
  return adminOptions.value.filter((item) => !assignedIds.has(item.id))
})

const loadData = async () => {
  if (!props.project?.id) {
    return
  }
  loading.value = true
  try {
    const memberRes = await getProjectMembersApi(props.project.id)
    memberList.value = memberRes

    if (canManage.value) {
      const adminRes = await getAdminsApi({ page: 1, pageSize: 100 })
      adminOptions.value = adminRes.list.filter(
        (item) => item.role === 'NORMAL' && item.status === 'ENABLED',
      )
    } else {
      adminOptions.value = []
    }
    selectedAdminId.value = undefined
  } finally {
    loading.value = false
  }
}

watch(
  () => visible.value,
  (value) => {
    if (value) {
      void loadData()
    }
  },
)

const onAdd = async () => {
  if (!props.project?.id) {
    return
  }
  if (!selectedAdminId.value) {
    ElMessage.warning('请选择项目成员')
    return
  }

  loading.value = true
  try {
    await addProjectMemberApi(props.project.id, { adminId: selectedAdminId.value })
    ElMessage.success('项目成员添加成功')
    selectedAdminId.value = undefined
    await loadData()
    emit('success')
  } finally {
    loading.value = false
  }
}

const onRemove = async (member: ProjectMember) => {
  if (!props.project?.id) {
    return
  }
  loading.value = true
  try {
    await removeProjectMemberApi(props.project.id, member.id)
    ElMessage.success('项目成员移除成功')
    await loadData()
    emit('success')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="项目成员管理" width="760px">
    <div v-loading="loading">
      <el-alert
        v-if="!canManage"
        :closable="false"
        type="info"
        show-icon
        title="当前为查看模式。仅项目管理员可添加或移除成员。"
        style="margin-bottom: 16px"
      />

      <el-form v-if="canManage" label-width="100px" style="margin-bottom: 16px">
        <el-form-item label="新增成员">
          <div class="project-member-dialog__actions">
            <el-select
              v-model="selectedAdminId"
              placeholder="请选择自己名下的子管理员"
              style="width: 100%"
            >
              <el-option
                v-for="item in availableOptions"
                :key="item.id"
                :label="`${item.name}（${item.username}）`"
                :value="item.id"
              />
            </el-select>
            <el-button type="primary" @click="onAdd">添加成员</el-button>
          </div>
        </el-form-item>
      </el-form>

      <el-table :data="memberList" border>
        <template #empty>暂无项目成员</template>
        <el-table-column label="成员姓名" min-width="140">
          <template #default="{ row }">{{ row.admin?.name || '-' }}</template>
        </el-table-column>
        <el-table-column label="登录账号" min-width="150">
          <template #default="{ row }">{{ row.admin?.username || '-' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.role === 'PROJECT_ADMIN' ? 'danger' : 'info'">
              {{ row.role === 'PROJECT_ADMIN' ? '项目管理员' : '项目成员' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="分配人" min-width="150">
          <template #default="{ row }">
            {{ row.assigner ? `${row.assigner.name}（${row.assigner.username}）` : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="分配时间" min-width="170" />
        <el-table-column v-if="canManage" label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="danger"
              :disabled="row.role === 'PROJECT_ADMIN'"
              @click="onRemove(row)"
            >
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.project-member-dialog__actions {
  display: flex;
  gap: 8px;
  width: 100%;
}
</style>
