<script setup lang="ts">
import dayjs from 'dayjs'
import { getAdminsApi } from '@/api/admin'
import { getOperationLogDetailApi, getOperationLogsApi } from '@/api/log'
import { useUserStore } from '@/stores/user'
import type { Admin, OperationLog } from '@/types'

const userStore = useUserStore()
const loading = ref(false)
const detailLoading = ref(false)
const list = ref<OperationLog[]>([])
const total = ref(0)
const adminOptions = ref<Admin[]>([])
const detailVisible = ref(false)
const currentDetail = ref<OperationLog | null>(null)

const query = reactive({
  module: '',
  action: '',
  operatorId: undefined as number | undefined,
  targetType: '',
  dateRange: [] as string[],
  page: 1,
  pageSize: 20,
})

const fetchAdmins = async () => {
  if (!userStore.isSuper) {
    return
  }
  const res = await getAdminsApi({ page: 1, pageSize: 100 })
  adminOptions.value = res.list
}

const fetchList = async () => {
  loading.value = true
  try {
    const operatorId = userStore.isSuper ? query.operatorId : userStore.user?.id
    const res = await getOperationLogsApi({
      module: query.module || undefined,
      action: query.action || undefined,
      operatorId,
      targetType: query.targetType || undefined,
      createdAtStart: query.dateRange[0],
      createdAtEnd: query.dateRange[1],
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
  await fetchAdmins()
  await fetchList()
})

const onReset = async () => {
  query.module = ''
  query.action = ''
  query.operatorId = undefined
  query.targetType = ''
  query.dateRange = []
  query.page = 1
  await fetchList()
}

const openDetail = async (id: number) => {
  detailVisible.value = true
  detailLoading.value = true
  try {
    currentDetail.value = await getOperationLogDetailApi(id)
  } finally {
    detailLoading.value = false
  }
}

const formatDate = (val?: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-')
const formatJson = (val: unknown) => (val == null ? '-' : JSON.stringify(val, null, 2))
</script>

<template>
  <div class="page-block">
    <el-form :inline="true" class="filter-form">
      <el-form-item label="操作模块">
        <el-input v-model="query.module" placeholder="例如 MERCHANT" clearable />
      </el-form-item>
      <el-form-item label="操作类型">
        <el-input v-model="query.action" placeholder="例如 CREATE_MERCHANT" clearable />
      </el-form-item>
      <el-form-item v-if="userStore.isSuper" label="操作人">
        <el-select
          v-model="query.operatorId"
          clearable
          filterable
          placeholder="请选择操作人"
          style="width: 220px"
        >
          <el-option
            v-for="item in adminOptions"
            :key="item.id"
            :label="`${item.name}（${item.username}）`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="目标类型">
        <el-input v-model="query.targetType" placeholder="例如 MERCHANT" clearable />
      </el-form-item>
      <el-form-item label="时间范围">
        <el-date-picker
          v-model="query.dateRange"
          type="daterange"
          value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" border>
      <template #empty>暂无数据</template>
      <el-table-column prop="module" label="操作模块" min-width="140" />
      <el-table-column prop="action" label="操作类型" min-width="180" />
      <el-table-column prop="targetType" label="目标类型" min-width="130" />
      <el-table-column prop="targetName" label="操作对象" min-width="170" />
      <el-table-column prop="operatorName" label="操作人" min-width="140" />
      <el-table-column label="操作时间" min-width="180">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">查看详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display: flex; justify-content: flex-end; margin-top: 12px">
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

    <el-dialog v-model="detailVisible" title="日志详情" width="780px">
      <div v-loading="detailLoading">
        <el-descriptions v-if="currentDetail" :column="2" border>
          <el-descriptions-item label="ID">{{ currentDetail.id }}</el-descriptions-item>
          <el-descriptions-item label="模块">{{ currentDetail.module }}</el-descriptions-item>
          <el-descriptions-item label="动作">{{ currentDetail.action }}</el-descriptions-item>
          <el-descriptions-item label="目标类型">{{
            currentDetail.targetType
          }}</el-descriptions-item>
          <el-descriptions-item label="目标ID">{{
            currentDetail.targetId ?? '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="目标名称">{{
            currentDetail.targetName || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{
            currentDetail.operatorName
          }}</el-descriptions-item>
          <el-descriptions-item label="IP">{{ currentDetail.ip || '-' }}</el-descriptions-item>
          <el-descriptions-item label="操作时间" :span="2">
            {{ formatDate(currentDetail.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="操作前数据" :span="2">
            <el-input
              :model-value="formatJson(currentDetail.beforeData)"
              type="textarea"
              :rows="8"
              readonly
            />
          </el-descriptions-item>
          <el-descriptions-item label="操作后数据" :span="2">
            <el-input
              :model-value="formatJson(currentDetail.afterData)"
              type="textarea"
              :rows="8"
              readonly
            />
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>
