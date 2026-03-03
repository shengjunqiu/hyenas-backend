import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { AdminRole } from '@/types'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login/Index.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/merchants',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'merchants',
        name: 'MerchantList',
        component: () => import('@/pages/merchant/List.vue'),
        meta: { title: '商家管理' },
      },
      {
        path: 'merchants/create',
        name: 'MerchantCreate',
        component: () => import('@/pages/merchant/Form.vue'),
        meta: { title: '新增商家', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'merchants/:id',
        name: 'MerchantDetail',
        component: () => import('@/pages/merchant/Detail.vue'),
        meta: { title: '商家详情' },
      },
      {
        path: 'merchants/:id/edit',
        name: 'MerchantEdit',
        component: () => import('@/pages/merchant/Form.vue'),
        meta: { title: '编辑商家' },
      },
      {
        path: 'statuses',
        name: 'StatusList',
        component: () => import('@/pages/status/List.vue'),
        meta: { title: '状态管理', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'fields',
        name: 'FieldList',
        component: () => import('@/pages/field/List.vue'),
        meta: { title: '字段管理', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'admins',
        name: 'AdminList',
        component: () => import('@/pages/admin/List.vue'),
        meta: { title: '管理员管理', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'logs',
        name: 'LogList',
        component: () => import('@/pages/log/List.vue'),
        meta: { title: '操作日志' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const hasRoleAccess = (to: RouteLocationNormalized, role?: AdminRole) => {
  const roles = to.meta.roles as AdminRole[] | undefined
  if (!roles?.length) {
    return true
  }
  return !!role && roles.includes(role)
}

router.beforeEach(async (to) => {
  const userStore = useUserStore()
  const requiresAuth = !!to.meta.requiresAuth || to.path !== '/login'

  if (!userStore.token && requiresAuth) {
    return '/login'
  }

  if (to.path === '/login' && userStore.token) {
    return '/'
  }

  if (userStore.token && !userStore.user) {
    try {
      await userStore.fetchProfile()
    } catch {
      userStore.clearAuth()
      return '/login'
    }
  }

  if (!hasRoleAccess(to, userStore.user?.role)) {
    ElMessage.warning('无访问权限')
    return '/'
  }

  return true
})

export default router
