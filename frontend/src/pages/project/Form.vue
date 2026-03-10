<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'

const route = useRoute()
const title = computed(() => (route.path.endsWith('/create') ? '新建项目' : '编辑项目'))
</script>

<template>
  <ModulePlaceholder
    :title="title"
    description="项目表单路由已接入，后续补模板选择和管理员分配流程。"
    :tips="['阶段四将在这里实现项目创建和编辑。']"
  />
</template>
