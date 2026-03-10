<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { getDatabaseRecordsApi } from '@/api/database-record'
import { importProjectRecordsApi } from '@/api/project'
import type { DataTemplateField, DatabaseRecord, ProjectImportResult } from '@/types'

const props = defineProps<{
  projectId: number
  templateId?: number
  templateFields?: DataTemplateField[]
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const visible = defineModel<boolean>({ default: false })
const tableRef = ref()
const loading = ref(false)
const submitting = ref(false)
const list = ref<DatabaseRecord[]>([])
const total = ref(0)
const result = ref<ProjectImportResult | null>(null)
const selectedRecordMap = ref<Record<number, DatabaseRecord>>({})

const query = reactive({
  keyword: '',
  primaryKeyValue: '',
  page: 1,
  pageSize: 10,
})

const dynamicColumns = computed(() =>
  (props.templateFields || []).filter((field) => field.isPrimaryKey || field.isListed),
)

const selectedRecords = computed(() => Object.values(selectedRecordMap.value))
const selectedIds = computed(() => selectedRecords.value.map((item) => item.id))

const readCellValue = (row: DatabaseRecord, fieldKey: string) => {
  const value = row.dataJson?.[fieldKey]
  if (Array.isArray(value)) {
    return value.join('、')
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  return value ?? '-'
}

const syncTableSelection = async () => {
  await nextTick()
  if (!tableRef.value) {
    return
  }

  list.value.forEach((row) => {
    tableRef.value.toggleRowSelection(row, !!selectedRecordMap.value[row.id])
  })
}

const fetchList = async () => {
  if (!visible.value || !props.templateId) {
    list.value = []
    total.value = 0
    return
  }

  loading.value = true
  try {
    const res = await getDatabaseRecordsApi({
      templateId: props.templateId,
      keyword: query.keyword || undefined,
      primaryKeyValue: query.primaryKeyValue || undefined,
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = res.list
    total.value = res.pagination.total
    await syncTableSelection()
  } finally {
    loading.value = false
  }
}

const resetState = () => {
  query.keyword = ''
  query.primaryKeyValue = ''
  query.page = 1
  query.pageSize = 10
  list.value = []
  total.value = 0
  result.value = null
  selectedRecordMap.value = {}
}

const onSelectionChange = (selection: DatabaseRecord[]) => {
  const nextSelection = { ...selectedRecordMap.value }
  const currentPageIds = new Set(list.value.map((item) => item.id))

  currentPageIds.forEach((id) => {
    delete nextSelection[id]
  })

  selection.forEach((item) => {
    nextSelection[item.id] = item
  })

  selectedRecordMap.value = nextSelection
}

const onSearch = async () => {
  query.page = 1
  await fetchList()
}

const onReset = async () => {
  query.keyword = ''
  query.primaryKeyValue = ''
  query.page = 1
  await fetchList()
}

const onImport = async () => {
  if (!props.projectId || !props.templateId) {
    return
  }
  if (!selectedIds.value.length) {
    ElMessage.warning('请至少选择一条数据库数据')
    return
  }

  submitting.value = true
  try {
    result.value = await importProjectRecordsApi(props.projectId, {
      recordIds: selectedIds.value,
    })
    ElMessage.success('项目数据导入成功')
    emit('success')
  } finally {
    submitting.value = false
  }
}

watch([() => visible.value, () => props.templateId], async ([nextVisible]) => {
  if (!nextVisible) {
    return
  }
  resetState()
  await fetchList()
})
</script>

<template>
  <el-dialog v-model="visible" title="从数据库导入项目数据" width="1080px" @closed="resetState">
    <template v-if="templateId">
      <el-form :inline="true" class="filter-form">
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

      <el-alert
        :closable="false"
        type="info"
        show-icon
        :title="`已选择 ${selectedIds.length} 条数据库数据`"
        style="margin-bottom: 16px"
      />

      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="list"
        border
        row-key="id"
        @selection-change="onSelectionChange"
      >
        <template #empty>暂无可导入的数据库数据</template>
        <el-table-column type="selection" width="55" />
        <el-table-column prop="primaryKeyValue" label="主键值" min-width="160" fixed="left" />
        <el-table-column
          v-for="field in dynamicColumns"
          :key="field.id"
          :label="field.fieldName"
          min-width="160"
        >
          <template #default="{ row }">
            {{ readCellValue(row, field.fieldKey) }}
          </template>
        </el-table-column>
        <el-table-column prop="sourceName" label="来源名称" min-width="180" />
      </el-table>

      <div class="database-record-picker__pagination">
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

      <el-card v-if="result" shadow="never" class="database-record-picker__result">
        <template #header>导入结果</template>
        <el-descriptions :column="3" border>
          <el-descriptions-item label="选择总数">{{ result.totalCount }}</el-descriptions-item>
          <el-descriptions-item label="新增数">{{ result.createdCount }}</el-descriptions-item>
          <el-descriptions-item label="跳过数">{{ result.skippedCount }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <el-empty v-else description="当前项目未绑定模板，无法导入数据库数据" />

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="submitting" :disabled="!templateId" @click="onImport">
        导入所选数据
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.database-record-picker__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.database-record-picker__result {
  margin-top: 16px;
}
</style>
