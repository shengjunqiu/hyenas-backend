<script setup lang="ts">
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import {
  createAdminApi,
  getAdminsApi,
  resetAdminPasswordApi,
  updateAdminApi,
  updateAdminStatusApi,
} from '@/api/admin'
import type { Admin, AdminRole, AdminStatus } from '@/types'

const loading = ref(false)
const submitting = ref(false)
const passwordSubmitting = ref(false)
const list = ref<Admin[]>([])
const total = ref(0)
const dialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()

const query = reactive({
  keyword: '',
  status: undefined as AdminStatus | undefined,
  page: 1,
  pageSize: 20,
})

const form = reactive({
  id: 0,
  username: '',
  password: '',
  name: '',
  phone: '',
  role: 'NORMAL' as AdminRole,
})

const passwordForm = reactive({
  id: 0,
  newPassword: '',
})

const rules = {
  username: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getAdminsApi({
      keyword: query.keyword || undefined,
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

onMounted(() => {
  void fetchList()
})

const onReset = async () => {
  query.keyword = ''
  query.status = undefined
  query.page = 1
  await fetchList()
}

const resetForm = () => {
  form.id = 0
  form.username = ''
  form.password = ''
  form.name = ''
  form.phone = ''
  form.role = 'NORMAL'
}

const onCreate = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const onEdit = (row: Admin) => {
  isEdit.value = true
  form.id = row.id
  form.username = row.username
  form.password = ''
  form.name = row.name
  form.phone = row.phone || ''
  form.role = row.role
  dialogVisible.value = true
}

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateAdminApi(form.id, {
        name: form.name,
        phone: form.phone || undefined,
        role: form.role,
      })
      ElMessage.success('管理员更新成功')
    } else {
      await createAdminApi({
        username: form.username,
        password: form.password,
        name: form.name,
        phone: form.phone || undefined,
        role: form.role,
      })
      ElMessage.success('管理员创建成功')
    }
    dialogVisible.value = false
    await fetchList()
  } finally {
    submitting.value = false
  }
}

const onToggle = async (row: Admin, value: boolean) => {
  const targetStatus: AdminStatus = value ? 'ENABLED' : 'DISABLED'
  row.status = value ? 'DISABLED' : 'ENABLED'
  try {
    await updateAdminStatusApi(row.id, targetStatus)
    row.status = targetStatus
    ElMessage.success('状态更新成功')
  } catch {
    row.status = value ? 'DISABLED' : 'ENABLED'
  }
}

const openResetPassword = (row: Admin) => {
  passwordForm.id = row.id
  passwordForm.newPassword = ''
  passwordDialogVisible.value = true
}

const onConfirmResetPassword = async () => {
  if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  passwordSubmitting.value = true
  try {
    await resetAdminPasswordApi(passwordForm.id, passwordForm.newPassword)
    ElMessage.success('密码重置成功')
    passwordDialogVisible.value = false
  } finally {
    passwordSubmitting.value = false
  }
}

const formatDate = (val?: string | null) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-')
</script>

<template>
  <div class="page-block">
    <el-form :inline="true" class="filter-form">
      <el-form-item label="关键词">
        <el-input v-model="query.keyword" placeholder="账号/姓名/手机号" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" clearable placeholder="请选择" style="width: 140px">
          <el-option label="启用" value="ENABLED" />
          <el-option label="禁用" value="DISABLED" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">搜索</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>

    <div style="margin-bottom: 12px">
      <el-button type="primary" @click="onCreate">新增管理员</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <template #empty>暂无数据</template>
      <el-table-column prop="username" label="登录账号" min-width="140" />
      <el-table-column prop="name" label="姓名" min-width="120" />
      <el-table-column prop="phone" label="手机号" min-width="140" />
      <el-table-column label="角色" width="110">
        <template #default="{ row }">
          <el-tag :type="row.role === 'SUPER' ? 'danger' : 'info'">
            {{ row.role === 'SUPER' ? '超级管理员' : '普通管理员' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="账号状态" width="120">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 'ENABLED'"
            @update:model-value="(val) => onToggle(row, !!val)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="merchantCount" label="负责商家数" width="120" />
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-space>
            <el-button link type="primary" @click="onEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="openResetPassword(row)">重置密码</el-button>
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

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑管理员' : '新增管理员'"
      width="560px"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="超级管理员" value="SUPER" />
            <el-option label="普通管理员" value="NORMAL" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordDialogVisible" title="重置密码" width="460px">
      <el-form label-width="100px">
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="passwordSubmitting" @click="onConfirmResetPassword">
          确认重置
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
