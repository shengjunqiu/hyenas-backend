<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import type { Admin, Merchant, MerchantStatus } from '@/types'
import { deleteMerchantApi, getMerchantsApi } from '@/api/merchant'
import { getAdminsApi } from '@/api/admin'
import { getStatusesApi } from '@/api/status'
import { SUPERVISION_AGENCIES } from '@/constants/supervision-agencies'
import AssignAdminDialog from '@/components/AssignAdminDialog.vue'
import ChangeStatusDialog from '@/components/ChangeStatusDialog.vue'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const list = ref<Merchant[]>([])
const total = ref(0)
const statuses = ref<MerchantStatus[]>([])
const admins = ref<Admin[]>([])

const query = reactive({
  name: '',
  contactName: '',
  contactPhone: '',
  statusId: undefined as number | undefined,
  businessType: '',
  supervisionAgency: '',
  adminId: undefined as number | undefined,
  dateRange: [] as string[],
  page: 1,
  pageSize: 20,
})

const showAssignDialog = ref(false)
const showStatusDialog = ref(false)
const currentMerchantId = ref<number>(0)
const currentStatusId = ref<number | undefined>(undefined)

const statusMap = computed(() => new Map(statuses.value.map((s) => [s.id, s])))

const fetchList = async () => {
  loading.value = true
  try {
    const params = {
      name: query.name || undefined,
      contactName: query.contactName || undefined,
      contactPhone: query.contactPhone || undefined,
      statusId: query.statusId,
      businessType: query.businessType || undefined,
      supervisionAgency: query.supervisionAgency || undefined,
      adminId: userStore.isSuper ? query.adminId : undefined,
      createdAtStart: query.dateRange[0],
      createdAtEnd: query.dateRange[1],
      page: query.page,
      pageSize: query.pageSize,
    }
    const res = await getMerchantsApi(params)
    list.value = res.list
    total.value = res.pagination.total
  } finally {
    loading.value = false
  }
}

const fetchOptions = async () => {
  statuses.value = await getStatusesApi()
  if (userStore.isSuper) {
    const res = await getAdminsApi({ page: 1, pageSize: 100 })
    admins.value = res.list
  }
}

onMounted(async () => {
  await fetchOptions()
  await fetchList()
})

const onReset = async () => {
  query.name = ''
  query.contactName = ''
  query.contactPhone = ''
  query.statusId = undefined
  query.businessType = ''
  query.supervisionAgency = ''
  query.adminId = undefined
  query.dateRange = []
  query.page = 1
  await fetchList()
}

const onDelete = async (row: Merchant) => {
  await ElMessageBox.confirm(`确认删除商家“${row.name}”吗？`, '删除确认', {
    type: 'warning',
  })
  await deleteMerchantApi(row.id)
  ElMessage.success('删除成功')
  await fetchList()
}

const openAssign = (row: Merchant) => {
  currentMerchantId.value = row.id
  showAssignDialog.value = true
}

const openChangeStatus = (row: Merchant) => {
  currentMerchantId.value = row.id
  currentStatusId.value = row.statusId
  showStatusDialog.value = true
}

const formatDate = (val?: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-')
</script>

<template>
  <div class="page-block">
    <el-form :inline="true" class="filter-form">
      <el-form-item label="经营者名称">
        <el-input v-model="query.name" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="法定代表人（负责人）">
        <el-input v-model="query.contactName" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="法定代表人联系方式">
        <el-input v-model="query.contactPhone" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="商家状态">
        <el-select v-model="query.statusId" clearable placeholder="请选择" style="width: 160px">
          <el-option v-for="item in statuses" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="餐饮类型">
        <el-input v-model="query.businessType" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item label="日常监督管理机构">
        <el-select
          v-model="query.supervisionAgency"
          clearable
          placeholder="请选择"
          style="width: 260px"
        >
          <el-option v-for="item in SUPERVISION_AGENCIES" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="userStore.isSuper" label="分配管理员">
        <el-select v-model="query.adminId" clearable placeholder="请选择" style="width: 180px">
          <el-option
            v-for="item in admins"
            :key="item.id"
            :label="`${item.name}（${item.username}）`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="创建时间">
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

    <div style="margin-bottom: 12px">
      <el-button v-role="'SUPER'" type="primary" @click="router.push('/merchants/create')">
        新增商家
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <template #empty>暂无数据</template>
      <el-table-column prop="name" label="经营者名称" min-width="180" />
      <el-table-column prop="contactName" label="法定代表人（负责人）" min-width="150" />
      <el-table-column prop="contactPhone" label="法定代表人联系方式" min-width="160" />
      <el-table-column label="商家状态" min-width="140">
        <template #default="{ row }">
          <el-tag :color="statusMap.get(row.statusId)?.color || '#d9d9d9'" effect="light">
            {{ statusMap.get(row.statusId)?.name || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="businessType" label="餐饮类型" min-width="140" />
      <el-table-column prop="supervisionAgency" label="日常监督管理机构" min-width="180" />
      <el-table-column label="分配管理员" min-width="180">
        <template #default="{ row }">
          {{ row.admins?.map((item: { admin: Admin }) => item.admin.name).join('，') || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" min-width="280">
        <template #default="{ row }">
          <el-space wrap>
            <el-button link type="primary" @click="router.push(`/merchants/${row.id}`)"
              >详情</el-button
            >
            <el-button link type="primary" @click="router.push(`/merchants/${row.id}/edit`)">
              编辑
            </el-button>
            <el-button v-role="'SUPER'" link type="danger" @click="onDelete(row)">删除</el-button>
            <el-button v-role="'SUPER'" link type="primary" @click="openAssign(row)">
              分配管理员
            </el-button>
            <el-button link type="primary" @click="openChangeStatus(row)">修改状态</el-button>
          </el-space>
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

    <AssignAdminDialog
      v-if="currentMerchantId"
      v-model="showAssignDialog"
      :merchant-id="currentMerchantId"
      @update:model-value="fetchList"
    />

    <ChangeStatusDialog
      v-if="currentMerchantId"
      v-model="showStatusDialog"
      :merchant-id="currentMerchantId"
      :current-status-id="currentStatusId"
      @success="fetchList"
    />
  </div>
</template>
