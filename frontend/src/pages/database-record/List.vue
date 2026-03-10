<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import {
  deleteDatabaseRecordApi,
  getDatabaseImportLogDetailApi,
  getDatabaseImportLogsApi,
  getDatabaseRecordsApi,
} from '@/api/database-record'
import { getTemplateDetailApi, getTemplatesApi } from '@/api/template'
import ExcelImportDialog from '@/components/ExcelImportDialog.vue'
import { formatDynamicFieldValue, useDynamicColumns } from '@/composables/useDynamicColumns'
import type { DataTemplate, DatabaseImportLog, DatabaseRecord } from '@/types'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const templatesLoading = ref(false)
const logsLoading = ref(false)
const logDetailLoading = ref(false)
const templates = ref<DataTemplate[]>([])
const selectedTemplate = ref<DataTemplate | null>(null)
const list = ref<DatabaseRecord[]>([])
const total = ref(0)
const logList = ref<DatabaseImportLog[]>([])
const logsDrawerVisible = ref(false)
const logDetailDialogVisible = ref(false)
const importDialogVisible = ref(false)
const selectedLogDetail = ref<DatabaseImportLog | null>(null)

const query = reactive({
  templateId: undefined as number | undefined,
  keyword: '',
  primaryKeyValue: '',
  page: 1,
  pageSize: 20,
})

const logQuery = reactive({
  page: 1,
  pageSize: 20,
})

const dynamicColumns = useDynamicColumns(() => selectedTemplate.value?.fields)

const enabledTemplates = computed(() => templates.value.filter((item) => item.isEnabled))
const templateHasNoFields = computed(
  () => !!selectedTemplate.value && !(selectedTemplate.value.fields || []).length,
)

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'

const fetchTemplates = async () => {
  templatesLoading.value = true
  try {
    templates.value = await getTemplatesApi()
  } finally {
    templatesLoading.value = false
  }
}

const fetchTemplateDetail = async (templateId: number) => {
  selectedTemplate.value = await getTemplateDetailApi(templateId)
}

const fetchList = async () => {
  if (!query.templateId) {
    list.value = []
    total.value = 0
    return
  }

  loading.value = true
  try {
    const res = await getDatabaseRecordsApi({
      templateId: query.templateId,
      keyword: query.keyword || undefined,
      primaryKeyValue: query.primaryKeyValue || undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = res.list
    total.value = res.pagination.total
  } finally {
    loading.value = false
  }
}

const fetchImportLogs = async () => {
  if (!query.templateId) {
    logList.value = []
    return
  }

  logsLoading.value = true
  try {
    const res = await getDatabaseImportLogsApi({
      templateId: query.templateId,
      page: logQuery.page,
      pageSize: logQuery.pageSize,
    })
    logList.value = res.list
  } finally {
    logsLoading.value = false
  }
}

const openLogsDrawer = async () => {
  if (!query.templateId) {
    ElMessage.warning('请先选择模板')
    return
  }
  logsDrawerVisible.value = true
  await fetchImportLogs()
}

const openLogDetail = async (logId: number) => {
  logDetailLoading.value = true
  logDetailDialogVisible.value = true
  try {
    selectedLogDetail.value = await getDatabaseImportLogDetailApi(logId)
  } finally {
    logDetailLoading.value = false
  }
}

const onTemplateChange = async (templateId?: number) => {
  query.page = 1
  selectedTemplate.value = null

  if (!templateId) {
    await fetchList()
    return
  }

  await fetchTemplateDetail(templateId)
  await fetchList()
}

const onSearch = async () => {
  query.page = 1
  await fetchList()
}

const onReset = async () => {
  query.templateId = undefined
  query.keyword = ''
  query.primaryKeyValue = ''
  query.page = 1
  selectedTemplate.value = null
  await fetchList()
}

const onDelete = async (row: DatabaseRecord) => {
  await ElMessageBox.confirm(`确认删除数据“${row.primaryKeyValue}”吗？`, '删除数据', {
    type: 'warning',
  })
  await deleteDatabaseRecordApi(row.id)
  ElMessage.success('数据删除成功')
  await fetchList()
}

const emptyRecordDescription = computed(() => {
  if (!query.templateId) {
    return '请先选择模板'
  }
  if (templateHasNoFields.value) {
    return '当前模板未配置字段，请先修复模板配置'
  }
  return '暂无数据库数据，可新建数据或使用 Excel 导入'
})

onMounted(async () => {
  await fetchTemplates()

  const initialTemplateId = Number(route.query.templateId || 0)
  if (initialTemplateId) {
    query.templateId = initialTemplateId
    await onTemplateChange(initialTemplateId)
  }
})
</script>

<template>
  <div class="page-block">
    <el-form :inline="true" class="filter-form">
      <el-form-item label="模板" required>
        <el-select
          v-model="query.templateId"
          placeholder="请选择模板"
          style="width: 220px"
          :loading="templatesLoading"
          @change="(value) => onTemplateChange(value as number | undefined)"
        >
          <el-option
            v-for="item in enabledTemplates"
            :key="item.id"
            :label="`${item.name}（${item.code}）`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关键字">
        <el-input v-model="query.keyword" placeholder="来源名称/主键值" clearable />
      </el-form-item>
      <el-form-item label="主键值">
        <el-input v-model="query.primaryKeyValue" placeholder="请输入主键值" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">搜索</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>

    <div class="page-block__actions">
      <el-space wrap>
        <el-button
          type="primary"
          :disabled="!query.templateId"
          @click="
            router.push({
              path: '/database-records/create',
              query: { templateId: query.templateId },
            })
          "
        >
          新建数据
        </el-button>
        <el-button :disabled="!query.templateId" @click="importDialogVisible = true"
          >Excel 导入</el-button
        >
        <el-button :disabled="!query.templateId" @click="openLogsDrawer">导入日志</el-button>
      </el-space>
    </div>

    <el-alert
      v-if="templateHasNoFields"
      :closable="false"
      type="warning"
      show-icon
      title="当前模板未配置任何字段，模板配置异常。列表可查看基础信息，但新增和导入前建议先修复模板。"
      style="margin-bottom: 12px"
    />

    <el-table v-loading="loading" :data="list" border>
      <template #empty>{{ emptyRecordDescription }}</template>
      <el-table-column prop="primaryKeyValue" label="主键值" min-width="160" fixed="left" />
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
      <el-table-column prop="sourceName" label="来源名称" min-width="160" />
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="180" fixed="right">
        <template #default="{ row }">
          <el-space wrap>
            <el-button link type="primary" @click="router.push(`/database-records/${row.id}`)"
              >详情</el-button
            >
            <el-button link type="warning" @click="router.push(`/database-records/${row.id}/edit`)"
              >编辑</el-button
            >
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

    <ExcelImportDialog
      v-model="importDialogVisible"
      @success="
        () => {
          void fetchList()
          if (logsDrawerVisible) {
            void fetchImportLogs()
          }
        }
      "
    />

    <el-drawer v-model="logsDrawerVisible" title="导入日志" size="760px">
      <el-table v-loading="logsLoading" :data="logList" border>
        <template #empty>暂无导入日志</template>
        <el-table-column label="模板" min-width="180">
          <template #default="{ row }">
            {{ row.template ? `${row.template.name}（${row.template.code}）` : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="fileName" label="文件名" min-width="180" />
        <el-table-column label="操作人" min-width="140">
          <template #default="{ row }">
            {{ row.operator ? `${row.operator.name}（${row.operator.username}）` : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="createdCount" label="新增数" width="90" />
        <el-table-column prop="updatedCount" label="更新数" width="90" />
        <el-table-column prop="failedCount" label="失败数" width="90" />
        <el-table-column label="导入时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openLogDetail(row.id)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <el-dialog v-model="logDetailDialogVisible" title="导入日志详情" width="760px">
      <div v-loading="logDetailLoading">
        <template v-if="selectedLogDetail">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="文件名">{{
              selectedLogDetail.fileName
            }}</el-descriptions-item>
            <el-descriptions-item label="新增数">{{
              selectedLogDetail.createdCount
            }}</el-descriptions-item>
            <el-descriptions-item label="更新数">{{
              selectedLogDetail.updatedCount
            }}</el-descriptions-item>
            <el-descriptions-item label="失败数">{{
              selectedLogDetail.failedCount
            }}</el-descriptions-item>
            <el-descriptions-item label="总数">{{
              selectedLogDetail.totalCount
            }}</el-descriptions-item>
            <el-descriptions-item label="导入时间">
              {{ formatDate(selectedLogDetail.createdAt) }}
            </el-descriptions-item>
          </el-descriptions>

          <el-table
            :data="(selectedLogDetail.failureDetailsJson as Array<Record<string, unknown>>) || []"
            border
            style="margin-top: 16px"
          >
            <template #empty>无失败明细</template>
            <el-table-column prop="row" label="行号" width="100" />
            <el-table-column prop="primaryKeyValue" label="主键值" min-width="140" />
            <el-table-column prop="reason" label="失败原因" min-width="260" />
          </el-table>
        </template>
      </div>
    </el-dialog>
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
