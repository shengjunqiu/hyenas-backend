<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Fold,
  Expand,
  Shop,
  SetUp,
  Document,
  User,
  Notebook,
  Lock,
  SwitchButton,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import ChangePasswordDialog from '@/components/ChangePasswordDialog.vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const collapsed = ref(false)
const showChangePassword = ref(false)

interface MenuItem {
  path: string
  label: string
  icon: Component
  roles?: ('SUPER' | 'NORMAL')[]
}

const fullMenu: MenuItem[] = [
  { path: '/merchants', label: '商家管理', icon: Shop },
  { path: '/statuses', label: '状态管理', icon: SetUp, roles: ['SUPER'] },
  { path: '/fields', label: '字段管理', icon: Document, roles: ['SUPER'] },
  { path: '/admins', label: '管理员管理', icon: User, roles: ['SUPER'] },
  { path: '/logs', label: '操作日志', icon: Notebook },
]

const menuItems = computed(() => {
  return fullMenu.filter((item) => {
    if (!item.roles) {
      return true
    }
    return item.roles.includes(userStore.user?.role ?? 'NORMAL')
  })
})

const activePath = computed(() => route.path)

const breadcrumbs = computed(() => {
  return route.matched
    .filter((matched) => !!matched.meta?.title)
    .map((matched) => matched.meta.title as string)
})

const onLogout = async () => {
  await userStore.logout()
}

const onMenuSelect = (path: string) => {
  if (path !== route.path) {
    void router.push(path)
  }
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="sidebar">
      <div class="brand">{{ collapsed ? 'HY' : 'HYENAS' }}</div>
      <el-menu
        :default-active="activePath"
        class="menu"
        :collapse="collapsed"
        @select="onMenuSelect"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.label }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button text @click="collapsed = !collapsed">
            <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
          </el-button>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>首页</el-breadcrumb-item>
            <el-breadcrumb-item v-for="name in breadcrumbs" :key="name">
              {{ name }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <el-dropdown>
            <span class="user-name">{{ userStore.user?.name || userStore.user?.username }}</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="showChangePassword = true">
                  <el-icon><Lock /></el-icon>
                  修改密码
                </el-dropdown-item>
                <el-dropdown-item divided @click="onLogout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>

  <ChangePasswordDialog v-model="showChangePassword" />
</template>
