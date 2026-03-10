import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { useUserStore } from '@/stores/user'
import type { AdminRole } from '@/types'

const routes: RouteRecordRaw[] = [
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
        meta: { title: '管理员管理' },
      },
      {
        path: 'logs',
        name: 'LogList',
        component: () => import('@/pages/log/List.vue'),
        meta: { title: '操作日志' },
      },
      {
        path: 'templates',
        name: 'TemplateList',
        component: () => import('@/pages/template/List.vue'),
        meta: { title: '模板管理', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'templates/create',
        name: 'TemplateCreate',
        component: () => import('@/pages/template/Form.vue'),
        meta: { title: '新建模板', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'templates/:id',
        name: 'TemplateDetail',
        component: () => import('@/pages/template/Detail.vue'),
        meta: { title: '模板详情', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'database-records',
        name: 'DatabaseRecordList',
        component: () => import('@/pages/database-record/List.vue'),
        meta: { title: '数据库管理', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'database-records/create',
        name: 'DatabaseRecordCreate',
        component: () => import('@/pages/database-record/Form.vue'),
        meta: { title: '新增数据库数据', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'database-records/:id',
        name: 'DatabaseRecordDetail',
        component: () => import('@/pages/database-record/Detail.vue'),
        meta: { title: '数据库数据详情', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'database-records/:id/edit',
        name: 'DatabaseRecordEdit',
        component: () => import('@/pages/database-record/Form.vue'),
        meta: { title: '编辑数据库数据', roles: ['SUPER'] as AdminRole[] },
      },
      {
        path: 'projects',
        name: 'ProjectList',
        component: () => import('@/pages/project/List.vue'),
        meta: { title: '项目管理' },
      },
      {
        path: 'projects/create',
        name: 'ProjectCreate',
        component: () => import('@/pages/project/Form.vue'),
        meta: { title: '新建项目' },
      },
      {
        path: 'projects/:id',
        name: 'ProjectDetail',
        component: () => import('@/pages/project/Detail.vue'),
        meta: { title: '项目详情' },
      },
      {
        path: 'projects/:id/edit',
        name: 'ProjectEdit',
        component: () => import('@/pages/project/Form.vue'),
        meta: { title: '编辑项目' },
      },
      {
        path: 'projects/:id/records',
        name: 'ProjectRecordList',
        component: () => import('@/pages/project/RecordList.vue'),
        meta: { title: '项目数据' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

NProgress.configure({ showSpinner: false })

const hasRoleAccess = (to: RouteLocationNormalized, role?: AdminRole) => {
  const roles = to.meta.roles as AdminRole[] | undefined
  if (!roles?.length) {
    return true
  }
  return !!role && roles.includes(role)
}

router.beforeEach(async (to) => {
  NProgress.start()
  const userStore = useUserStore()
  const requiresAuth = !!to.meta.requiresAuth || to.path !== '/login'

  if (!userStore.token && requiresAuth) {
    ElMessage.warning('请先登录')
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

router.afterEach(() => {
  NProgress.done()
})

router.onError(() => {
  NProgress.done()
})

export default router
