<script setup lang="ts">
import dayjs from 'dayjs'
import { getProjectsApi } from '@/api/project'
import { getTemplatesApi } from '@/api/template'
import ProjectAdminAssignDialog from '@/components/ProjectAdminAssignDialog.vue'
import { useUserStore } from '@/stores/user'
import type { DataTemplate, Project, ProjectStatus } from '@/types'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const templatesLoading = ref(false)
const list = ref<Project[]>([])
const total = ref(0)
const templates = ref<DataTemplate[]>([])
const adminDialogVisible = ref(false)
const selectedProject = ref<Project | null>(null)

const query = reactive({
  keyword: '',
  templateId: undefined as number | undefined,
  status: undefined as ProjectStatus | undefined,
  page: 1,
  pageSize: 20,
})

const statusTagMap: Record<ProjectStatus, 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'info',
  ACTIVE: 'success',
  COMPLETED: 'warning',
  ARCHIVED: 'danger',
}

const getStatusTagType = (status: ProjectStatus) => statusTagMap[status]

const canEdit = (project: Project) =>
  userStore.isSuper || project.projectAdminId === userStore.user?.id

const fetchTemplates = async () => {
  templatesLoading.value = true
  try {
    templates.value = await getTemplatesApi()
  } finally {
    templatesLoading.value = false
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getProjectsApi({
      keyword: query.keyword || undefined,
      templateId: query.templateId,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = res.list
    total.value = res.pagination.total
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchTemplates(), fetchList()])
})

const onReset = async () => {
  query.keyword = ''
  query.templateId = undefined
  query.status = undefined
  query.page = 1
  await fetchList()
}

const openAssignDialog = (project: Project) => {
  selectedProject.value = project
  adminDialogVisible.value = true
}

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'

const emptyProjectDescription = computed(() => {
  if (query.keyword || query.templateId || query.status) {
    return '没有匹配的项目，请调整筛选条件后重试'
  }
  return userStore.isSuper ? '暂无项目，可先创建项目' : '暂无可访问项目，请联系超级管理员分配'
})
</script>

<template>
  <div class="page-block">
    <el-form :inline="true" class="filter-form">
      <el-form-item label="项目名称/编号">
        <el-input v-model="query.keyword" placeholder="请输入项目名称或编号" clearable />
      </el-form-item>
      <el-form-item label="模板">
        <el-select
          v-model="query.templateId"
          clearable
          placeholder="请选择模板"
          style="width: 200px"
          :loading="templatesLoading"
        >
          <el-option
            v-for="item in templates"
            :key="item.id"
            :label="`${item.name}（${item.code}）`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" clearable placeholder="请选择" style="width: 140px">
          <el-option label="草稿" value="DRAFT" />
          <el-option label="进行中" value="ACTIVE" />
          <el-option label="已完成" value="COMPLETED" />
          <el-option label="已归档" value="ARCHIVED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="page-block__actions">
      <el-button v-if="userStore.isSuper" type="primary" @click="router.push('/projects/create')">
        新建项目
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <template #empty>{{ emptyProjectDescription }}</template>
      <el-table-column prop="name" label="项目名称" min-width="180" />
      <el-table-column prop="code" label="项目编号" min-width="160" />
      <el-table-column label="模板" min-width="180">
        <template #default="{ row }">
          {{ row.template ? `${row.template.name}（${row.template.code}）` : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="项目管理员" min-width="160">
        <template #default="{ row }">
          {{ row.projectAdmin ? `${row.projectAdmin.name}（${row.projectAdmin.username}）` : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="recordCount" label="数据量" width="90" />
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="260" fixed="right">
        <template #default="{ row }">
          <el-space wrap>
            <el-button link type="primary" @click="router.push(`/projects/${row.id}`)"
              >详情</el-button
            >
            <el-button
              v-if="canEdit(row)"
              link
              type="warning"
              @click="router.push(`/projects/${row.id}/edit`)"
            >
              编辑
            </el-button>
            <el-button v-if="userStore.isSuper" link type="success" @click="openAssignDialog(row)">
              分配管理员
            </el-button>
            <el-button link @click="router.push(`/projects/${row.id}/records`)">项目数据</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>

    <div class="page-block__pagination">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        background
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        @change="fetchList"
      />
    </div>

    <ProjectAdminAssignDialog
      v-model="adminDialogVisible"
      :project="selectedProject"
      @success="() => void fetchList()"
    />
  </div>
</template>

<style scoped lang="scss">
.page-block__actions {
  margin-bottom: 12px;
}

.page-block__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
