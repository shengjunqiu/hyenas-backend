<script setup lang="ts">
import dayjs from 'dayjs'
import { getDatabaseRecordDetailApi } from '@/api/database-record'
import type { DataTemplateField, DatabaseRecord } from '@/types'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id || 0))

const loading = ref(false)
const detail = ref<DatabaseRecord | null>(null)

const formatDate = (value?: string | null) =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'

const formatValue = (field: DataTemplateField) => {
  const value = detail.value?.dataJson?.[field.fieldKey]
  if (Array.isArray(value)) {
    return value.join('、') || '-'
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  return value ?? '-'
}

const fetchDetail = async () => {
  if (!id.value) {
    return
  }
  loading.value = true
  try {
    detail.value = await getDatabaseRecordDetailApi(id.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchDetail()
})
</script>

<template>
  <div class="page-block" v-loading="loading">
    <el-page-header content="数据库数据详情" @back="router.back()" />

    <template v-if="detail">
      <el-card shadow="never">
        <template #header>基础信息</template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="模板">
            {{ detail.template ? `${detail.template.name}（${detail.template.code}）` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="主键值">{{ detail.primaryKeyValue }}</el-descriptions-item>
          <el-descriptions-item label="来源类型">{{ detail.sourceType }}</el-descriptions-item>
          <el-descriptions-item label="来源名称">{{
            detail.sourceName || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="创建人">
            {{ detail.creator ? `${detail.creator.name}（${detail.creator.username}）` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="更新人">
            {{ detail.updater ? `${detail.updater.name}（${detail.updater.username}）` : '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{
            formatDate(detail.createdAt)
          }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{
            formatDate(detail.updatedAt)
          }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <template #header>动态字段值</template>
        <el-descriptions :column="2" border>
          <el-descriptions-item
            v-for="field in detail.template?.fields || []"
            :key="field.id"
            :label="field.fieldName"
          >
            {{ formatValue(field) }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>
  </div>
</template>

<style scoped lang="scss">
.page-block {
  display: grid;
  gap: 16px;
}
</style>
