<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import {
  exportAdminGroupStatisticsApi,
  exportSingleAdminGroupStatisticsApi,
  getMerchantStatusStatisticsApi,
} from '@/api/admin'
import type { AdminMerchantStatusStatItem, MerchantStatusStatItem } from '@/types'

const loading = ref(false)
const exportLoading = ref(false)
const exportingAdminId = ref<number | null>(null)
const totalAdminCount = ref(0)
const totalMerchantCount = ref(0)
const statusStats = ref<MerchantStatusStatItem[]>([])
const adminStats = ref<AdminMerchantStatusStatItem[]>([])

const activeStatusCount = computed(() => {
  return statusStats.value.filter((item) => item.merchantCount > 0).length
})

const activeAdminCount = computed(() => {
  return adminStats.value.filter((item) => item.merchantCount > 0).length
})

const fetchStatistics = async () => {
  loading.value = true
  try {
    const res = await getMerchantStatusStatisticsApi()
    totalAdminCount.value = res.totalAdminCount
    totalMerchantCount.value = res.totalMerchantCount
    statusStats.value = res.statusStats
    adminStats.value = res.adminStats
  } finally {
    loading.value = false
  }
}

const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(2)}%`

const percentValue = (ratio: number) => Number((ratio * 100).toFixed(2))

const resolveFileName = (contentDisposition?: string) => {
  if (!contentDisposition) {
    return 'admin-merchant-status-statistics.xlsx'
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1])
  }

  const plainMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (plainMatch?.[1]) {
    return plainMatch[1]
  }

  return 'admin-merchant-status-statistics.xlsx'
}

const onExport = async () => {
  exportLoading.value = true
  try {
    const response = await exportAdminGroupStatisticsApi()
    const fileName = resolveFileName(response.headers['content-disposition'])
    const url = window.URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } finally {
    exportLoading.value = false
  }
}

const downloadFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

const onExportAdmin = async (adminId: number) => {
  exportingAdminId.value = adminId
  try {
    const response = await exportSingleAdminGroupStatisticsApi(adminId)
    const fileName = resolveFileName(response.headers['content-disposition'])
    downloadFile(response.data, fileName)
    ElMessage.success('导出成功')
  } finally {
    exportingAdminId.value = null
  }
}

onMounted(() => {
  void fetchStatistics()
})
</script>

<template>
  <div v-loading="loading" class="statistics-page">
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">所属管理员数</div>
        <div class="summary-value">{{ totalAdminCount }}</div>
        <div class="summary-hint">当前超级管理员创建的普通管理员</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">去重商家总数</div>
        <div class="summary-value">{{ totalMerchantCount }}</div>
        <div class="summary-hint">同一商家被多个管理员负责时仅统计 1 次</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">有商家分布的状态数</div>
        <div class="summary-value">{{ activeStatusCount }}</div>
        <div class="summary-hint">仅统计数量大于 0 的状态</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">有负责商家的管理员数</div>
        <div class="summary-value">{{ activeAdminCount }}</div>
        <div class="summary-hint">仅统计负责商家数大于 0 的管理员</div>
      </div>
    </div>

    <div class="page-block">
      <div class="page-header">
        <div>
          <div class="page-title">商家状态分布</div>
          <div class="page-desc">按当前商家状态聚合数量和占比</div>
        </div>
        <el-button type="primary" plain @click="fetchStatistics">刷新统计</el-button>
      </div>

      <el-empty v-if="!statusStats.length" description="暂无状态数据" />

      <div v-else class="status-grid">
        <div
          v-for="item in statusStats"
          :key="item.statusId"
          class="status-card"
          :style="{ '--status-color': item.color || '#409eff' }"
        >
          <div class="status-card__head">
            <div>
              <div class="status-name">{{ item.statusName }}</div>
              <div class="status-code">{{ item.statusCode }}</div>
            </div>
            <el-tag :style="{ borderColor: item.color || '#409eff', color: item.color || '#409eff' }">
              {{ item.merchantCount }} 家
            </el-tag>
          </div>
          <div class="status-ratio">{{ formatPercent(item.ratio) }}</div>
          <el-progress
            :percentage="percentValue(item.ratio)"
            :stroke-width="10"
            :color="item.color || '#409eff'"
          />
        </div>
      </div>
    </div>

    <div class="page-block">
      <el-table :data="statusStats" border>
        <template #empty>暂无统计数据</template>
        <el-table-column label="状态名称" min-width="180">
          <template #default="{ row }">
            <div class="status-cell">
              <span
                class="status-dot"
                :style="{ backgroundColor: row.color || '#409eff' }"
              />
              <span>{{ row.statusName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="statusCode" label="状态编码" min-width="180" />
        <el-table-column prop="merchantCount" label="商家数量" width="120" />
        <el-table-column label="占比" min-width="220">
          <template #default="{ row }">
            <div class="ratio-cell">
              <span>{{ formatPercent(row.ratio) }}</span>
              <el-progress
                :percentage="percentValue(row.ratio)"
                :stroke-width="8"
                :show-text="false"
                :color="row.color || '#409eff'"
              />
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="page-block">
      <div class="page-header">
        <div>
          <div class="page-title">按管理员分组统计</div>
          <div class="page-desc">每个管理员负责商家的状态数量与内部占比</div>
        </div>
        <el-button class="export-button" :icon="Download" :loading="exportLoading" @click="onExport">
          导出 Excel
        </el-button>
      </div>

      <el-table :data="adminStats" border>
        <template #empty>暂无管理员统计数据</template>
        <el-table-column label="管理员" min-width="220">
          <template #default="{ row }">
            <div class="admin-cell">
              <div class="admin-name">{{ row.adminName }}</div>
              <div class="admin-meta">{{ row.username }}<span v-if="row.phone"> · {{ row.phone }}</span></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="账号状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'">
              {{ row.status === 'ENABLED' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="merchantCount" label="负责商家数" width="120" />
        <el-table-column label="状态分布" min-width="520">
          <template #default="{ row }">
            <div class="admin-status-list">
              <div
                v-for="item in row.statusStats"
                :key="`${row.adminId}-${item.statusId}`"
                class="admin-status-item"
              >
                <div class="admin-status-item__head">
                  <div class="status-cell">
                    <span
                      class="status-dot"
                      :style="{ backgroundColor: item.color || '#409eff' }"
                    />
                    <span>{{ item.statusName }}</span>
                  </div>
                  <span>{{ item.merchantCount }} 家 / {{ formatPercent(item.ratio) }}</span>
                </div>
                <el-progress
                  :percentage="percentValue(item.ratio)"
                  :stroke-width="6"
                  :show-text="false"
                  :color="item.color || '#409eff'"
                />
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              class="row-export-button"
              :icon="Download"
              :loading="exportingAdminId === row.adminId"
              @click="onExportAdmin(row.adminId)"
            >
              导出
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.statistics-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.summary-card {
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%);
  border: 1px solid #dbeafe;
}

.summary-label {
  font-size: 14px;
  color: #4b5563;
}

.summary-value {
  margin-top: 8px;
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  line-height: 1;
}

.summary-hint {
  margin-top: 10px;
  font-size: 13px;
  color: #6b7280;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.page-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
}

:deep(.export-button.el-button) {
  height: 40px;
  padding: 0 18px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #0f9d58 0%, #22c55e 100%);
  box-shadow: 0 12px 24px rgba(34, 197, 94, 0.24);
  color: #ffffff;
  font-weight: 600;
}

:deep(.export-button.el-button:hover) {
  background: linear-gradient(135deg, #0c8c4d 0%, #16a34a 100%);
  color: #ffffff;
}

:deep(.export-button.el-button.is-loading) {
  color: rgba(255, 255, 255, 0.92);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.status-card {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid #e5edf5;
  background: linear-gradient(180deg, #ffffff 0%, #f9fbfd 100%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
}

.status-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.status-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.status-code {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.status-ratio {
  margin: 16px 0 10px;
  font-size: 28px;
  font-weight: 700;
  color: var(--status-color);
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-name {
  font-weight: 600;
  color: #111827;
}

.admin-meta {
  font-size: 12px;
  color: #6b7280;
}

.admin-status-list {
  display: grid;
  gap: 10px;
}

.admin-status-item {
  display: grid;
  gap: 6px;
}

.admin-status-item__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #4b5563;
}

:deep(.row-export-button.el-button) {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 500;
}

:deep(.row-export-button.el-button:hover) {
  border-color: #93c5fd;
  background: #dbeafe;
  color: #1d4ed8;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ratio-cell {
  display: grid;
  grid-template-columns: 72px 1fr;
  align-items: center;
  gap: 12px;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
