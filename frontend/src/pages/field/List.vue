<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { createFieldApi, getFieldsApi, toggleFieldApi, updateFieldApi } from '@/api/field'
import type { FieldType, MerchantFieldDef } from '@/types'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const list = ref<MerchantFieldDef[]>([])
const optionInput = ref('')
const formRef = ref()

const fieldTypes: Array<{ label: string; value: FieldType }> = [
  { label: '单行文本', value: 'TEXT' },
  { label: '多行文本', value: 'TEXTAREA' },
  { label: '数字', value: 'NUMBER' },
  { label: '日期', value: 'DATE' },
  { label: '单选', value: 'SELECT' },
  { label: '多选', value: 'MULTI_SELECT' },
  { label: '布尔值', value: 'BOOLEAN' },
]

const form = reactive({
  id: 0,
  fieldName: '',
  fieldKey: '',
  fieldType: 'TEXT' as FieldType,
  isRequired: false,
  isSearchable: false,
  defaultValue: '',
  optionsJson: [] as string[],
  sort: 0,
  remark: '',
})

const showOptions = computed(() => form.fieldType === 'SELECT' || form.fieldType === 'MULTI_SELECT')

const rules = {
  fieldName: [{ required: true, message: '请输入字段名称', trigger: 'blur' }],
  fieldKey: [{ required: true, message: '请输入字段标识', trigger: 'blur' }],
  fieldType: [{ required: true, message: '请选择字段类型', trigger: 'change' }],
}

const fetchList = async () => {
  loading.value = true
  try {
    list.value = await getFieldsApi()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchList()
})

const resetForm = () => {
  form.id = 0
  form.fieldName = ''
  form.fieldKey = ''
  form.fieldType = 'TEXT'
  form.isRequired = false
  form.isSearchable = false
  form.defaultValue = ''
  form.optionsJson = []
  form.sort = 0
  form.remark = ''
  optionInput.value = ''
}

const parseOptions = (optionsJson: unknown): string[] => {
  if (!Array.isArray(optionsJson)) {
    return []
  }
  return optionsJson
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }
      if (
        typeof item === 'object' &&
        item !== null &&
        'value' in item &&
        typeof (item as { value: unknown }).value === 'string'
      ) {
        return (item as { value: string }).value
      }
      return null
    })
    .filter((item): item is string => !!item)
}

const onCreate = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const onEdit = (row: MerchantFieldDef) => {
  isEdit.value = true
  form.id = row.id
  form.fieldName = row.fieldName
  form.fieldKey = row.fieldKey
  form.fieldType = row.fieldType
  form.isRequired = row.isRequired
  form.isSearchable = row.isSearchable
  form.defaultValue = row.defaultValue || ''
  form.optionsJson = parseOptions(row.optionsJson)
  form.sort = row.sort
  form.remark = row.remark || ''
  optionInput.value = ''
  dialogVisible.value = true
}

const addOption = () => {
  const val = optionInput.value.trim()
  if (!val) {
    return
  }
  if (form.optionsJson.includes(val)) {
    ElMessage.warning('选项已存在')
    return
  }
  form.optionsJson.push(val)
  optionInput.value = ''
}

const removeOption = (index: number) => {
  form.optionsJson.splice(index, 1)
}

watch(
  () => form.fieldType,
  (type) => {
    if (type !== 'SELECT' && type !== 'MULTI_SELECT') {
      form.optionsJson = []
    }
  },
)

const onSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    return
  }

  if (showOptions.value && !form.optionsJson.length) {
    ElMessage.warning('请选择或录入至少一个选项')
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateFieldApi(form.id, {
        fieldName: form.fieldName,
        isRequired: form.isRequired,
        isSearchable: form.isSearchable,
        defaultValue: form.defaultValue || undefined,
        optionsJson: showOptions.value ? form.optionsJson : undefined,
        sort: form.sort,
        remark: form.remark || undefined,
      })
      ElMessage.success('字段更新成功')
    } else {
      await createFieldApi({
        fieldName: form.fieldName,
        fieldKey: form.fieldKey,
        fieldType: form.fieldType,
        isRequired: form.isRequired,
        isSearchable: form.isSearchable,
        defaultValue: form.defaultValue || undefined,
        optionsJson: showOptions.value ? form.optionsJson : undefined,
        sort: form.sort,
        remark: form.remark || undefined,
      })
      ElMessage.success('字段创建成功')
    }
    dialogVisible.value = false
    await fetchList()
  } finally {
    submitting.value = false
  }
}

const onToggle = async (row: MerchantFieldDef, value: boolean) => {
  row.isEnabled = !value
  try {
    await toggleFieldApi(row.id, value)
    row.isEnabled = value
    ElMessage.success('状态更新成功')
  } catch {
    row.isEnabled = !value
  }
}
</script>

<template>
  <div class="page-block">
    <div style="margin-bottom: 12px">
      <el-button type="primary" @click="onCreate">新增字段</el-button>
    </div>

    <el-table v-loading="loading" :data="list" border>
      <template #empty>暂无数据</template>
      <el-table-column prop="fieldName" label="字段名称" min-width="140" />
      <el-table-column prop="fieldKey" label="字段标识" min-width="160" />
      <el-table-column prop="fieldType" label="字段类型" min-width="130" />
      <el-table-column label="是否必填" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isRequired ? 'danger' : 'info'">
            {{ row.isRequired ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否可搜索" width="110">
        <template #default="{ row }">
          <el-tag :type="row.isSearchable ? 'success' : 'info'">
            {{ row.isSearchable ? '是' : '否' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="是否启用" width="110">
        <template #default="{ row }">
          <el-switch
            :model-value="row.isEnabled"
            @update:model-value="(val) => onToggle(row, !!val)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序值" width="90" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑字段' : '新增字段'"
      width="640px"
      @closed="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="字段名称" prop="fieldName">
          <el-input v-model="form.fieldName" />
        </el-form-item>
        <el-form-item label="字段标识" prop="fieldKey">
          <el-input v-model="form.fieldKey" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="字段类型" prop="fieldType">
          <el-select v-model="form.fieldType" style="width: 100%" :disabled="isEdit">
            <el-option
              v-for="item in fieldTypes"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="是否必填">
          <el-switch v-model="form.isRequired" />
        </el-form-item>
        <el-form-item label="是否可搜索">
          <el-switch v-model="form.isSearchable" />
        </el-form-item>
        <el-form-item label="默认值">
          <el-input v-model="form.defaultValue" />
        </el-form-item>

        <el-form-item v-if="showOptions" label="选项列表">
          <div style="width: 100%">
            <el-space wrap>
              <el-tag
                v-for="(item, index) in form.optionsJson"
                :key="`${item}-${index}`"
                closable
                @close="removeOption(index)"
              >
                {{ item }}
              </el-tag>
            </el-space>
            <div style="display: flex; gap: 8px; margin-top: 8px">
              <el-input
                v-model="optionInput"
                placeholder="录入选项内容，按回车或点击添加"
                @keyup.enter="addOption"
              />
              <el-button @click="addOption">添加</el-button>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="排序值">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>
