<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  deleteProjectRecordApi,
  getProjectDetailApi,
  getProjectRecordDetailApi,
  getProjectRecordsApi,
  updateProjectRecordApi,
} from '@/api/project'
import DatabaseRecordPickerDialog from '@/components/DatabaseRecordPickerDialog.vue'
import DynamicDataForm from '@/components/DynamicDataForm.vue'
import { formatDynamicFieldValue, useDynamicColumns } from '@/composables/useDynamicColumns'
import { useUserStore } from '@/stores/user'
import type { Project, ProjectRecord } from '@/types'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const id = computed(() => Number(route.params.id || 0))

const pageLoading = ref(false)
const listLoading = ref(false)
const detailLoading = ref(false)
const editLoading = ref(false)
const editSubmitting = ref(false)
const project = ref<Project | null>(null)
const list = ref<ProjectRecord[]>([])
const total = ref(0)
const detailDrawerVisible = ref(false)
const importDialogVisible = ref(false)
const editDialogVisible = ref(false)
const currentRecordDetail = ref<ProjectRecord | null>(null)
const editingRecord = ref<ProjectRecord | null>(null)
const editFormData = ref<Record<string, unknown>>({})
const editFormRef = ref<InstanceType<typeof DynamicDataForm> | null>(null)

const query = reactive({
  keyword: '',
  sourcePrimaryKeyValue: '',
  page: 1,
  pageSize: 20,
})

const templateFields = computed(() => project.value?.template?.fields || [])
const dynamicColumns = useDynamicColumns(templateFields)
const canImport = computed(
  () => userStore.isSuper || project.value?.projectAdminId === userStore.user?.id,
)

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'

const fetchProjectDetail = async () => {
  if (!id.value) {
    return
  }
  project.value = await getProjectDetailApi(id.value)
}

const fetchList = async () => {
  if (!id.value) {
    return
  }

  listLoading.value = true
  try {
    const res = await getProjectRecordsApi(id.value, {
      keyword: query.keyword || undefined,
      sourcePrimaryKeyValue: query.sourcePrimaryKeyValue || undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = res.list
    total.value = res.pagination.total
  } finally {
    listLoading.value = false
  }
}

const fetchPageData = async () => {
  pageLoading.value = true
  try {
    await Promise.all([fetchProjectDetail(), fetchList()])
  } finally {
    pageLoading.value = false
  }
}

const loadRecordDetail = async (recordId: number) => {
  detailLoading.value = true
  try {
    currentRecordDetail.value = await getProjectRecordDetailApi(id.value, recordId)
  } finally {
    detailLoading.value = false
  }
}

const openDetailDrawer = async (recordId: number) => {
  detailDrawerVisible.value = true
  currentRecordDetail.value = null
  try {
    await loadRecordDetail(recordId)
  } catch {
    detailDrawerVisible.value = false
  }
}

const openEditDialog = async (recordId: number) => {
  editDialogVisible.value = true
  editLoading.value = true
  editingRecord.value = null
  editFormData.value = {}

  try {
    const detail = await getProjectRecordDetailApi(id.value, recordId)
    editingRecord.value = detail
    editFormData.value = { ...(detail.dataJson || {}) }
    await nextTick()
    editFormRef.value?.resetValidation()
  } catch {
    editDialogVisible.value = false
  } finally {
    editLoading.value = false
  }
}

const onSearch = async () => {
  query.page = 1
  await fetchList()
}

const onReset = async () => {
  query.keyword = ''
  query.sourcePrimaryKeyValue = ''
  query.page = 1
  await fetchList()
}

const onDelete = async (row: ProjectRecord) => {
  await ElMessageBox.confirm(`确认删除项目数据“${row.sourcePrimaryKeyValue}”吗？`, '删除项目数据', {
    type: 'warning',
  })
  await deleteProjectRecordApi(id.value, row.id)
  ElMessage.success('项目数据删除成功')
  await Promise.all([fetchProjectDetail(), fetchList()])
}

const onEditSubmit = async () => {
  if (!editingRecord.value) {
    return
  }

  const valid = await editFormRef.value?.validate()
  if (!valid) {
    return
  }

  editSubmitting.value = true
  try {
    await updateProjectRecordApi(id.value, editingRecord.value.id, {
      dataJson: editFormRef.value?.getNormalizedData() || editFormData.value,
    })
    ElMessage.success('项目数据更新成功')
    editDialogVisible.value = false
    await Promise.all([fetchProjectDetail(), fetchList()])
    if (currentRecordDetail.value?.id === editingRecord.value.id) {
      await loadRecordDetail(editingRecord.value.id)
    }
  } finally {
    editSubmitting.value = false
  }
}

const refreshAfterImport = async () => {
  await Promise.all([fetchProjectDetail(), fetchList()])
}

onMounted(() => {
  void fetchPageData()
})
</script>

<template>
  <div class="page-block" v-loading="pageLoading">
    <el-page-header content="项目数据" @back="router.back()" />

    <template v-if="project">
      <div class="project-record__toolbar">
        <el-space wrap>
          <el-button @click="router.push(`/projects/${project.id}`)">返回项目详情</el-button>
          <el-button v-if="canImport" type="primary" @click="importDialogVisible = true">
            从数据库导入
          </el-button>
        </el-space>
      </div>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>项目信息</template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="项目名称">{{ project.name }}</el-descriptions-item>
              <el-descriptions-item label="项目编号">{{ project.code }}</el-descriptions-item>
              <el-descriptions-item label="项目状态">{{ project.status }}</el-descriptions-item>
              <el-descriptions-item label="项目管理员">
                {{
                  project.projectAdmin
                    ? `${project.projectAdmin.name}（${project.projectAdmin.username}）`
                    : '暂未分配'
                }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>模板与数据</template>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="绑定模板">
                {{
                  project.template ? `${project.template.name}（${project.template.code}）` : '-'
                }}
              </el-descriptions-item>
              <el-descriptions-item label="模板字段数">
                {{ templateFields.length }}
              </el-descriptions-item>
              <el-descriptions-item label="项目数据量">
                {{ project.recordCount || 0 }}
              </el-descriptions-item>
              <el-descriptions-item label="模板状态">
                {{ project.template?.status || '-' }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
      </el-row>

      <el-form :inline="true" class="filter-form">
        <el-form-item label="关键字">
          <el-input v-model="query.keyword" placeholder="来源主键值" clearable />
        </el-form-item>
        <el-form-item label="来源主键值">
          <el-input
            v-model="query.sourcePrimaryKeyValue"
            placeholder="请输入来源数据库主键值"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">搜索</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="listLoading" :data="list" border>
        <template #empty>暂无项目数据</template>
        <el-table-column
          prop="sourcePrimaryKeyValue"
          label="来源主键值"
          min-width="160"
          fixed="left"
        />
        <el-table-column
          v-for="field in dynamicColumns"
          :key="field.id"
          :label="field.fieldName"
          min-width="160"
        >
          <template #default="{ row }">
            {{ formatDynamicFieldValue(row.dataJson, field.fieldKey) }}
          </template>
        </el-table-column>
        <el-table-column label="来源数据库记录" min-width="160">
          <template #default="{ row }">{{ row.sourceRecordId || '-' }}</template>
        </el-table-column>
        <el-table-column label="导入人" min-width="150">
          <template #default="{ row }">
            {{ row.importer ? `${row.importer.name}（${row.importer.username}）` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="导入时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="180" fixed="right">
          <template #default="{ row }">
            <el-space wrap>
              <el-button link type="primary" @click="openDetailDrawer(row.id)">详情</el-button>
              <el-button link type="warning" @click="openEditDialog(row.id)">编辑</el-button>
              <el-button link type="danger" @click="onDelete(row)">删除</el-button>
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
    </template>

    <el-drawer v-model="detailDrawerVisible" title="项目数据详情" size="720px">
      <div v-loading="detailLoading">
        <template v-if="currentRecordDetail">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="来源数据库数据 ID">
              {{ currentRecordDetail.sourceRecordId }}
            </el-descriptions-item>
            <el-descriptions-item label="来源主键值">
              {{ currentRecordDetail.sourcePrimaryKeyValue }}
            </el-descriptions-item>
            <el-descriptions-item label="来源记录状态">
              {{ currentRecordDetail.sourceRecord?.deletedAt ? '源数据已删除' : '源数据正常' }}
            </el-descriptions-item>
            <el-descriptions-item label="导入时间">
              {{ formatDate(currentRecordDetail.createdAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ formatDate(currentRecordDetail.updatedAt) }}
            </el-descriptions-item>
          </el-descriptions>

          <el-card shadow="never" class="project-record__detail-card">
            <template #header>动态字段值</template>
            <el-descriptions :column="1" border>
              <el-descriptions-item
                v-for="field in currentRecordDetail.template?.fields || templateFields"
                :key="field.id"
                :label="field.fieldName"
              >
                {{ formatDynamicFieldValue(currentRecordDetail.dataJson, field.fieldKey) }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </template>
      </div>
    </el-drawer>

    <el-dialog v-model="editDialogVisible" title="编辑项目数据" width="960px">
      <div v-loading="editLoading">
        <template v-if="editingRecord">
          <el-alert
            :closable="false"
            type="info"
            show-icon
            :title="`当前编辑的是项目内副本数据，来源主键：${editingRecord.sourcePrimaryKeyValue}`"
            style="margin-bottom: 16px"
          />

          <DynamicDataForm
            ref="editFormRef"
            v-model="editFormData"
            :fields="editingRecord.template?.fields || templateFields"
          />
        </template>
      </div>

      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="onEditSubmit"> 保存 </el-button>
      </template>
    </el-dialog>

    <DatabaseRecordPickerDialog
      v-model="importDialogVisible"
      :project-id="id"
      :template-id="project?.templateId"
      :template-fields="templateFields"
      @success="() => void refreshAfterImport()"
    />
  </div>
</template>

<style scoped lang="scss">
.page-block {
  display: grid;
  gap: 16px;
}

.project-record__toolbar {
  display: flex;
  justify-content: space-between;
}

.project-record__detail-card {
  margin-top: 16px;
}

.page-block__pagination {
  display: flex;
  justify-content: flex-end;
}
</style>
