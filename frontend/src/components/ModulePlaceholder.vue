<script setup lang="ts">
defineProps<{
  title: string
  description: string
  tips?: string[]
}>()
</script>

<template>
  <div class="module-placeholder">
    <el-card shadow="never">
      <template #header>
        <div class="module-placeholder__header">
          <div>
            <h2>{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <el-tag type="info">阶段一占位页</el-tag>
        </div>
      </template>

      <el-empty description="页面骨架已接入，后续阶段补业务交互" />

      <div v-if="tips?.length" class="module-placeholder__tips">
        <div v-for="tip in tips" :key="tip" class="module-placeholder__tip">
          {{ tip }}
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.module-placeholder {
  .module-placeholder__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;

    h2 {
      margin: 0 0 8px;
      font-size: 20px;
      line-height: 1.2;
    }

    p {
      margin: 0;
      color: var(--el-text-color-secondary);
    }
  }

  .module-placeholder__tips {
    display: grid;
    gap: 12px;
    margin-top: 16px;
  }

  .module-placeholder__tip {
    padding: 12px 14px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
    border-radius: 10px;
  }
}
</style>
