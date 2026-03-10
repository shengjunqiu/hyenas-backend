<script setup lang="ts">
import dayjs from 'dayjs'
import { getProjectDetailApi } from '@/api/project'
import ProjectAdminAssignDialog from '@/components/ProjectAdminAssignDialog.vue'
import ProjectMemberDialog from '@/components/ProjectMemberDialog.vue'
import { useUserStore } from '@/stores/user'
import type { Project } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const id = computed(() => Number(route.params.id || 0))

const loading = ref(false)
const detail = ref<Project | null>(null)
const adminDialogVisible = ref(false)
const memberDialogVisible = ref(false)

const canManageMembers = computed(() => detail.value?.projectAdminId === userStore.user?.id)
const templateHasNoFields = computed(
  () => !!detail.value?.template && !(detail.value.template?.fields || []).length,
)
const emptyMemberDescription = computed(() =>
  canManageMembers.value ? '暂无项目成员，可点击上方按钮添加成员' : '暂无项目成员',
)

const fetchDetail = async () => {
  if (!id.value) {
    return
  }
  loading.value = true
  try {
    detail.value = await getProjectDetailApi(id.value)
  } finally {
    loading.value = false
  }
}

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'

onMounted(() => {
  void fetchDetail()
})
</script>

<template>
  <div class="page-block" v-loading="loading">
    <el-page-header content="项目详情" @back="router.back()" />

    <template v-if="detail">
      <div class="project-detail__toolbar">
        <el-space wrap>
          <el-button v-if="userStore.isSuper" type="primary" @click="adminDialogVisible = true">
            分配项目管理员
          </el-button>
          <el-button v-if="canManageMembers" @click="memberDialogVisible = true"
            >管理项目成员</el-button
          >
          <el-button type="success" plain @click="router.push(`/projects/${detail.id}/records`)">
            进入项目数据
          </el-button>
        </el-space>
      </div>

      <el-card shadow="never">
        <template #header>基础信息</template>
        <el-alert
          v-if="templateHasNoFields"
          :closable="false"
          type="warning"
          show-icon
          title="当前项目绑定的模板未配置任何字段，模板配置异常，请联系超级管理员处理。"
          style="margin-bottom: 16px"
        />
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="项目编号">{{ detail.code }}</el-descriptions-item>
          <el-descriptions-item label="项目状态">{{ detail.status }}</el-descriptions-item>
          <el-descriptions-item label="绑定模板">
            {{ detail.template ? `${detail.template.name}（${detail.template.code}）` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="项目管理员">
            {{
              detail.projectAdmin
                ? `${detail.projectAdmin.name}（${detail.projectAdmin.username}）`
                : '暂未分配'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ detail.creator ? `${detail.creator.name}（${detail.creator.username}）` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="开始时间">{{
            formatDate(detail.startDate)
          }}</el-descriptions-item>
          <el-descriptions-item label="结束时间">{{
            formatDate(detail.endDate)
          }}</el-descriptions-item>
          <el-descriptions-item label="项目描述" :span="2">
            {{ detail.description || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>项目成员</template>
            <el-alert
              v-if="!canManageMembers"
              :closable="false"
              type="info"
              show-icon
              title="仅项目管理员可维护项目成员。当前页面为查看模式。"
              style="margin-bottom: 16px"
            />
            <el-empty v-if="!(detail.members || []).length" :description="emptyMemberDescription" />
            <el-table v-else :data="detail.members || []" border>
              <el-table-column label="成员姓名" min-width="140">
                <template #default="{ row }">{{ row.admin?.name || '-' }}</template>
              </el-table-column>
              <el-table-column label="账号" min-width="150">
                <template #default="{ row }">{{ row.admin?.username || '-' }}</template>
              </el-table-column>
              <el-table-column label="角色" width="120">
                <template #default="{ row }">
                  <el-tag :type="row.role === 'PROJECT_ADMIN' ? 'danger' : 'info'">
                    {{ row.role === 'PROJECT_ADMIN' ? '项目管理员' : '项目成员' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>数据概览</template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="项目数据量">{{
                detail.recordCount || 0
              }}</el-descriptions-item>
              <el-descriptions-item label="成员数量">{{
                detail.members?.length || 0
              }}</el-descriptions-item>
              <el-descriptions-item label="模板状态">
                {{ detail.template?.status || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="模板启用状态">
                {{ detail.template?.isEnabled ? '启用中' : '未启用' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
      </el-row>

      <ProjectAdminAssignDialog
        v-model="adminDialogVisible"
        :project="detail"
        @success="() => void fetchDetail()"
      />
      <ProjectMemberDialog
        v-model="memberDialogVisible"
        :project="detail"
        @success="() => void fetchDetail()"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.page-block {
  display: grid;
  gap: 16px;
}

.project-detail__toolbar {
  display: flex;
  justify-content: space-between;
}
</style>
