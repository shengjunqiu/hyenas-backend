<script setup lang="ts">
import dayjs from 'dayjs'
import { useRoute, useRouter } from 'vue-router'
import type { MerchantDetail, MerchantStatusLog } from '@/types'
import { getMerchantDetailApi } from '@/api/merchant'
import AssignAdminDialog from '@/components/AssignAdminDialog.vue'
import ChangeStatusDialog from '@/components/ChangeStatusDialog.vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const id = computed(() => Number(route.params.id))

const loading = ref(false)
const detail = ref<MerchantDetail | null>(null)
const showAssignDialog = ref(false)
const showStatusDialog = ref(false)

const logs = computed(() => (detail.value?.statusLogs || []) as MerchantStatusLog[])

const fetchDetail = async () => {
  loading.value = true
  try {
    detail.value = await getMerchantDetailApi(id.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchDetail()
})

const formatDate = (val?: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-')
</script>

<template>
  <div class="page-block" v-loading="loading">
    <el-page-header content="商家详情" @back="router.push('/merchants')" />

    <div style="margin: 12px 0">
      <el-space>
        <el-button type="primary" @click="router.push(`/merchants/${id}/edit`)">编辑</el-button>
        <el-button @click="showStatusDialog = true">变更状态</el-button>
        <el-button v-role="'SUPER'" @click="showAssignDialog = true">分配管理员</el-button>
      </el-space>
    </div>

    <el-card shadow="never">
      <template #header>基础信息</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="商家名称">{{ detail?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="统一社会信用代码">{{
          detail?.creditCode || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="联系人">{{ detail?.contactName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{
          detail?.contactPhone || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="经营地址">{{ detail?.address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="许可证编号">{{
          detail?.licenseNo || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="经营类型">{{
          detail?.businessType || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail?.status?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{
          detail?.remark || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatDate(detail?.createdAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{
          formatDate(detail?.updatedAt)
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>自定义属性</template>
      <el-descriptions :column="2" border>
        <template v-if="detail?.customFields && Object.keys(detail.customFields).length">
          <el-descriptions-item v-for="(value, key) in detail.customFields" :key="key" :label="key">
            {{ Array.isArray(value) ? value.join('，') : String(value ?? '-') }}
          </el-descriptions-item>
        </template>
        <el-descriptions-item v-else label="提示">暂无自定义属性</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>分配信息</template>
      <el-space wrap>
        <el-tag v-for="item in detail?.admins || []" :key="item.admin.id" type="info">
          {{ item.admin.name }}（{{ item.admin.username }}）
        </el-tag>
        <span v-if="!detail?.admins?.length">暂无分配管理员</span>
      </el-space>
    </el-card>

    <el-card shadow="never" style="margin-top: 16px">
      <template #header>状态变更记录</template>
      <el-timeline v-if="logs.length">
        <el-timeline-item
          v-for="item in logs"
          :key="item.id"
          :timestamp="formatDate(item.createdAt)"
          placement="top"
        >
          <div>
            {{ item.changer?.name || '-' }}：{{ item.fromStatus?.name || '初始' }} →
            {{ item.toStatus?.name || '-' }}
          </div>
          <div v-if="item.remark">备注：{{ item.remark }}</div>
        </el-timeline-item>
      </el-timeline>
      <div v-else>暂无记录</div>
    </el-card>

    <AssignAdminDialog
      v-if="userStore.isSuper"
      v-model="showAssignDialog"
      :merchant-id="id"
      @update:model-value="fetchDetail"
    />
    <ChangeStatusDialog
      v-model="showStatusDialog"
      :merchant-id="id"
      :current-status-id="detail?.statusId"
      @success="fetchDetail"
    />
  </div>
</template>
