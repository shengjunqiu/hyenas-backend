<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'

const route = useRoute()
const title = computed(() => (route.path.endsWith('/create') ? '新增数据库数据' : '编辑数据库数据'))
</script>

<template>
  <ModulePlaceholder
    :title="title"
    description="数据库数据表单路由已接入，后续补动态字段表单。"
    :tips="['阶段三将在这里实现按模板动态渲染的数据编辑页。']"
  />
</template>
