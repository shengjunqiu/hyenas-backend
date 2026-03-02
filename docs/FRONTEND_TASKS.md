# 前端开发任务文档

## 项目信息

- **项目名称**: 食品经营商家管理系统 - 前端
- **技术栈**: Vue 3 + Element Plus + Pinia + Vite + TypeScript
- **包管理器**: pnpm
- **文档版本**: V1.0
- **更新日期**: 2026-03-02

---

## 阶段一：项目初始化与基础设施

### 任务 1.1：创建 Vue 3 项目

使用 Vite 创建项目：

```bash
pnpm create vite hyenas-frontend --template vue-ts
cd hyenas-frontend
pnpm install
```

配置 `vite.config.ts`：
- 路径别名 `@` → `src/`
- API 代理 `/api` → 后端地址

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

配置 `tsconfig.json` 路径别名：

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**完成标准**: `pnpm dev` 能正常启动，页面可访问

---

### 任务 1.2：安装核心依赖

```bash
# UI 组件库
pnpm add element-plus @element-plus/icons-vue

# 状态管理
pnpm add pinia

# 路由
pnpm add vue-router

# HTTP 客户端
pnpm add axios

# 工具库
pnpm add dayjs lodash-es
pnpm add -D @types/lodash-es

# 样式
pnpm add -D sass

# Element Plus 按需引入
pnpm add -D unplugin-vue-components unplugin-auto-import
```

在 `vite.config.ts` 中配置 Element Plus 按需引入：

```typescript
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
})
```

**完成标准**: 所有依赖安装成功，Element Plus 组件可正常使用

---

### 任务 1.3：搭建项目目录结构

创建以下目录和文件：

```
src/
├── api/                  # API 接口
│   └── index.ts
├── components/           # 通用组件
├── layouts/              # 布局组件
│   └── AdminLayout.vue
├── pages/                # 页面
│   └── login/
│       └── Index.vue
├── router/               # 路由
│   └── index.ts
├── stores/               # Pinia 状态
│   └── user.ts
├── types/                # 类型定义
│   └── index.ts
├── utils/                # 工具函数
│   └── request.ts
├── styles/               # 全局样式
│   └── global.scss
├── App.vue
└── main.ts
```

**完成标准**: 目录结构创建完成，项目能正常编译

---

### 任务 1.4：配置 Axios 请求封装

创建 `src/utils/request.ts`：

- 创建 Axios 实例，baseURL 设为 `/api`
- 请求拦截器：自动从 Pinia store 读取 Token 并添加到 Authorization 头
- 响应拦截器：
  - 正常响应：解包返回 `response.data`
  - 401：清除用户状态，跳转登录页
  - 其他错误：`ElMessage.error` 显示错误信息
- 导出封装好的 `get`、`post`、`put`、`del` 方法，带泛型支持

```typescript
// 使用示例
import { get, post } from '@/utils/request'

const data = await get<MerchantListResult>('/merchants', { params })
const result = await post<Merchant>('/merchants', body)
```

**完成标准**: 请求封装完成，Token 自动携带，错误统一处理

---

### 任务 1.5：配置 Pinia 和用户状态

创建 `src/stores/user.ts`：

- `token`: 存储 accessToken，同步到 localStorage
- `refreshToken`: 存储 refreshToken
- `user`: 当前用户信息（id, username, name, role）
- `isSuper`: 计算属性，判断是否超级管理员
- `login(username, password)`: 调用登录接口，保存 Token 和用户信息
- `logout()`: 清除状态，跳转登录页
- `fetchProfile()`: 获取当前用户信息

在 `main.ts` 中注册 Pinia。

**完成标准**: 登录后状态持久化，刷新页面不丢失

---

### 任务 1.6：配置路由和导航守卫

创建 `src/router/index.ts`：

路由结构：

```typescript
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/login/Index.vue'),
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    redirect: '/merchants',
    meta: { requiresAuth: true },
    children: [
      // 商家管理
      { path: 'merchants', name: 'MerchantList', component: () => import('@/pages/merchant/List.vue') },
      { path: 'merchants/create', name: 'MerchantCreate', component: () => import('@/pages/merchant/Form.vue') },
      { path: 'merchants/:id', name: 'MerchantDetail', component: () => import('@/pages/merchant/Detail.vue') },
      { path: 'merchants/:id/edit', name: 'MerchantEdit', component: () => import('@/pages/merchant/Form.vue') },
      // 状态管理（超级管理员）
      { path: 'statuses', name: 'StatusList', component: () => import('@/pages/status/List.vue'), meta: { roles: ['SUPER'] } },
      // 自定义字段管理（超级管理员）
      { path: 'fields', name: 'FieldList', component: () => import('@/pages/field/List.vue'), meta: { roles: ['SUPER'] } },
      // 管理员管理（超级管理员）
      { path: 'admins', name: 'AdminList', component: () => import('@/pages/admin/List.vue'), meta: { roles: ['SUPER'] } },
      // 操作日志
      { path: 'logs', name: 'LogList', component: () => import('@/pages/log/List.vue') },
    ],
  },
]
```

导航守卫：
- 未登录访问需认证页面 → 跳转 `/login`
- 已登录访问 `/login` → 跳转 `/`
- 角色权限不足 → 跳转 `/`（或提示无权限）

**完成标准**: 路由跳转正常，未登录自动跳转登录页，权限路由控制正确

---

### 任务 1.7：配置代码规范

```bash
pnpm add -D eslint prettier eslint-plugin-vue @vue/eslint-config-typescript @vue/eslint-config-prettier
pnpm add -D husky lint-staged
```

配置 `.eslintrc.cjs`、`.prettierrc`、`.husky/pre-commit`。

**完成标准**: 提交代码时自动检查和格式化

---

## 阶段二：布局与登录

### 任务 2.1：实现登录页

创建 `src/pages/login/Index.vue`：

- 居中卡片布局
- 表单字段：用户名、密码
- 表单验证：用户名必填、密码必填且最少 6 位
- 登录按钮，loading 状态
- 调用 `userStore.login()`，成功后跳转首页
- 错误提示（账号密码错误、账号被禁用）

**完成标准**: 能正常登录，错误提示友好

---

### 任务 2.2：实现后台布局

创建 `src/layouts/AdminLayout.vue`：

- 左侧菜单栏（ElMenu）
  - 根据用户角色动态显示菜单项
  - 超级管理员：全部菜单
  - 普通管理员：商家管理、操作日志
  - 菜单项带图标（@element-plus/icons-vue）
  - 支持折叠/展开

- 顶部导航栏（ElHeader）
  - 左侧：菜单折叠按钮 + 面包屑
  - 右侧：用户名 + 下拉菜单（修改密码、退出登录）

- 主内容区（ElMain）
  - `<router-view />` 渲染子路由

菜单配置：

| 菜单名称 | 路由 | 图标 | 权限 |
|---------|------|------|------|
| 商家管理 | /merchants | Shop | ALL |
| 状态管理 | /statuses | SetUp | SUPER |
| 字段管理 | /fields | Document | SUPER |
| 管理员管理 | /admins | User | SUPER |
| 操作日志 | /logs | Notebook | ALL |

**完成标准**: 布局完整，菜单根据角色动态显示，路由切换正常

---

### 任务 2.3：实现修改密码弹窗

创建 `src/components/ChangePasswordDialog.vue`：

- ElDialog 弹窗
- 表单字段：旧密码、新密码、确认新密码
- 验证规则：旧密码必填、新密码最少 6 位、确认密码一致
- 调用修改密码接口
- 成功后提示并退出登录

**完成标准**: 修改密码流程正常

---

## 阶段三：商家管理页面

### 任务 3.1：定义 API 接口和类型

创建 `src/types/index.ts`，定义所有业务类型：

```typescript
// 管理员
interface Admin {
  id: number
  username: string
  name: string
  phone: string
  role: 'SUPER' | 'NORMAL'
  status: 'ENABLED' | 'DISABLED'
  createdAt: string
  merchantCount?: number
}

// 商家
interface Merchant {
  id: number
  name: string
  creditCode: string
  contactName: string
  contactPhone: string
  address: string
  licenseNo: string
  businessType: string
  status: MerchantStatus
  remark: string
  createdAt: string
  updatedAt: string
  admins: Admin[]
}

// 商家状态模板
interface MerchantStatus {
  id: number
  name: string
  code: string
  color: string
  sort: number
  isEnabled: boolean
}

// 自定义字段定义
interface MerchantFieldDef {
  id: number
  fieldKey: string
  fieldName: string
  fieldType: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN'
  isRequired: boolean
  isEnabled: boolean
  isSearchable: boolean
  defaultValue: string
  optionsJson: string[]
  sort: number
}

// 分页响应
interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}
```

创建 `src/api/merchant.ts`、`src/api/admin.ts`、`src/api/auth.ts`、`src/api/status.ts`、`src/api/field.ts`、`src/api/log.ts`：

每个文件封装对应模块的 API 调用函数。

**完成标准**: 所有 API 接口函数定义完成，类型完整

---

### 任务 3.2：实现商家列表页

创建 `src/pages/merchant/List.vue`：

- 顶部筛选区域（ElForm inline 模式）
  - 商家名称（输入框）
  - 联系人（输入框）
  - 联系电话（输入框）
  - 商家状态（下拉选择，从状态模板接口获取）
  - 经营类型（输入框）
  - 分配管理员（下拉选择，仅超级管理员可见，从管理员列表接口获取）
  - 创建时间范围（日期范围选择器）
  - 搜索按钮、重置按钮

- 操作按钮区域
  - 新增商家按钮（跳转新增页）

- 商家表格（ElTable）
  - 列：商家名称、联系人、联系电话、商家状态（ElTag，颜色取状态配置）、经营类型、分配管理员、创建时间、更新时间
  - 操作列：查看详情、编辑、删除（超级管理员）、分配管理员（超级管理员）、修改状态

- 分页（ElPagination）

- 删除确认弹窗（ElMessageBox.confirm）

**完成标准**: 列表展示正常，筛选和分页正常，数据权限正确（普通管理员只看到自己的商家）

---

### 任务 3.3：实现商家新增/编辑页

创建 `src/pages/merchant/Form.vue`（新增和编辑复用）：

- 通过路由参数判断是新增还是编辑（有 `:id` 为编辑）
- 编辑模式下，进入页面时加载商家详情回填表单

- 基础信息表单（ElForm）
  - 商家名称（必填）
  - 统一社会信用代码
  - 联系人
  - 联系电话（手机号格式校验）
  - 经营地址
  - 许可证编号
  - 经营类型
  - 当前状态（必填，下拉选择已启用的状态模板）
  - 备注说明

- 自定义字段区域
  - 从字段定义接口获取已启用的字段列表
  - 根据字段类型动态渲染对应的表单组件：
    - TEXT → ElInput
    - TEXTAREA → ElInput type="textarea"
    - NUMBER → ElInputNumber
    - DATE → ElDatePicker
    - SELECT → ElSelect
    - MULTI_SELECT → ElSelect multiple
    - BOOLEAN → ElSwitch
  - 必填字段添加验证规则

- 提交按钮（保存、取消）

**完成标准**: 新增和编辑正常，自定义字段动态渲染正确，表单验证完整

---

### 任务 3.4：实现商家详情页

创建 `src/pages/merchant/Detail.vue`：

- 使用 ElDescriptions 展示基础信息
  - 商家名称、统一社会信用代码、联系人、联系电话、经营地址、许可证编号、经营类型、备注、创建时间、更新时间

- 当前状态区域
  - 显示当前状态（ElTag 带颜色）
  - "变更状态"按钮 → 弹窗选择新状态 + 备注

- 自定义属性区域
  - ElDescriptions 展示所有已填写的自定义字段值

- 分配信息区域
  - 展示已分配的管理员列表（ElTag 或 ElTable）
  - 超级管理员可见"分配管理员"按钮

- 操作记录区域（ElTimeline 或 ElTable）
  - 展示状态变更记录：时间、操作人、原状态 → 新状态、备注

- 顶部操作按钮
  - 编辑（跳转编辑页）
  - 返回列表

**完成标准**: 详情页信息完整，状态变更和分配操作正常

---

### 任务 3.5：实现分配管理员弹窗

创建 `src/components/AssignAdminDialog.vue`：

- ElDialog 弹窗
- 展示当前已分配的管理员（ElTag，可删除）
- ElSelect multiple 选择要分配的普通管理员
- 确认提交，调用分配接口
- 支持解除分配（点击已分配管理员的关闭按钮）

**完成标准**: 分配和解除分配正常，操作后列表实时刷新

---

### 任务 3.6：实现状态变更弹窗

创建 `src/components/ChangeStatusDialog.vue`：

- ElDialog 弹窗
- 显示当前状态
- ElSelect 选择新状态（仅已启用的状态模板，排除当前状态）
- ElInput textarea 填写备注（可选）
- 确认提交

**完成标准**: 状态变更正常，变更后列表和详情页状态实时更新

---

## 阶段四：状态管理页面

### 任务 4.1：实现状态模板列表页

创建 `src/pages/status/List.vue`：

- 操作按钮：新增状态
- ElTable 展示状态列表
  - 列：状态名称、状态编码、显示颜色（色块预览）、排序值、是否启用（ElSwitch）、备注、操作
  - 操作列：编辑
- 点击 ElSwitch 调用启用/禁用接口

- 新增/编辑弹窗（ElDialog + ElForm）
  - 状态名称（必填）
  - 状态编码（必填，新增时可编辑，编辑时只读）
  - 显示颜色（ElColorPicker）
  - 排序值（ElInputNumber）
  - 备注

**完成标准**: 状态模板 CRUD 正常，颜色选择器正常

---

## 阶段五：自定义字段管理页面

### 任务 5.1：实现字段定义列表页

创建 `src/pages/field/List.vue`：

- 操作按钮：新增字段
- ElTable 展示字段列表
  - 列：字段名称、字段标识、字段类型、是否必填、是否可搜索、是否启用（ElSwitch）、排序值、操作
  - 操作列：编辑

- 新增/编辑弹窗（ElDialog + ElForm）
  - 字段名称（必填）
  - 字段标识 fieldKey（必填，新增时可编辑，编辑时只读）
  - 字段类型（必填，ElSelect，新增时可选，编辑时根据是否有数据决定是否只读）
  - 是否必填（ElSwitch）
  - 是否可搜索（ElSwitch）
  - 默认值
  - 选项列表（当类型为 SELECT 或 MULTI_SELECT 时显示）
    - 动态添加/删除选项（ElTag + ElInput）
  - 排序值
  - 备注

**完成标准**: 字段定义 CRUD 正常，选项配置动态渲染正确

---

## 阶段六：管理员管理页面

### 任务 6.1：实现管理员列表页

创建 `src/pages/admin/List.vue`：

- 顶部筛选：关键词搜索、状态筛选
- 操作按钮：新增管理员
- ElTable 展示管理员列表
  - 列：登录账号、姓名、手机号、角色（ElTag）、账号状态（ElSwitch）、负责商家数、创建时间、操作
  - 操作列：编辑、重置密码
- 点击 ElSwitch 调用启用/禁用接口
- 分页

- 新增/编辑弹窗（ElDialog + ElForm）
  - 登录账号（必填，新增时可编辑，编辑时只读）
  - 密码（新增时必填，编辑时不显示）
  - 姓名（必填）
  - 手机号
  - 角色（ElSelect: 超级管理员/普通管理员）

- 重置密码确认弹窗
  - ElMessageBox.confirm 确认
  - 调用重置密码接口
  - 成功后提示新密码（或提示已重置为默认密码）

**完成标准**: 管理员 CRUD 正常，启用/禁用和重置密码正常

---

## 阶段七：操作日志页面

### 任务 7.1：实现操作日志列表页

创建 `src/pages/log/List.vue`：

- 顶部筛选
  - 操作模块（ElSelect: 商家、管理员、状态、字段、分配等）
  - 操作类型（ElSelect: 新增、编辑、删除、状态变更等）
  - 操作人（ElSelect，超级管理员可见全部，普通管理员只显示自己）
  - 时间范围（ElDatePicker range）
  - 搜索、重置按钮

- ElTable 展示日志列表
  - 列：操作模块、操作类型、操作对象、操作人、操作时间
  - 操作列：查看详情

- 分页

- 日志详情弹窗（ElDialog）
  - 展示完整日志信息
  - 操作前数据和操作后数据对比展示（JSON 格式化）

**完成标准**: 日志列表展示正常，筛选和分页正常，详情弹窗信息完整

---

## 阶段八：体验优化

### 任务 8.1：加载状态与空状态

- 所有列表页添加 `v-loading` 加载状态
- 所有表格添加 `empty` 插槽，显示"暂无数据"
- 所有提交按钮添加 loading 状态，防止重复提交
- 页面切换添加 NProgress 进度条（可选）

---

### 任务 8.2：权限指令

创建自定义指令 `v-role`：

```typescript
// src/directives/role.ts
// 用法: v-role="'SUPER'" 或 v-role="['SUPER']"
// 非指定角色时隐藏元素
```

在需要权限控制的按钮上使用：

```vue
<el-button v-role="'SUPER'" @click="handleAssign">分配管理员</el-button>
<el-button v-role="'SUPER'" @click="handleDelete">删除</el-button>
```

**完成标准**: 普通管理员看不到超级管理员专属按钮

---

### 任务 8.3：全局样式与主题

- 配置 Element Plus 主题色（CSS 变量覆盖）
- 全局样式：页面间距、表格样式、表单样式统一
- 响应式适配（最小宽度 1200px）

---

## 阶段九：测试与构建

### 任务 9.1：组件测试

安装测试依赖：

```bash
pnpm add -D vitest @vue/test-utils jsdom
```

为以下核心组件编写测试：
- 登录页：表单验证、登录流程
- 商家列表：数据渲染、筛选、分页
- 分配管理员弹窗：选择和提交

**完成标准**: `pnpm test` 全部通过

---

### 任务 9.2：生产构建与优化

- 配置生产环境变量 `.env.production`
- 构建优化：
  - Element Plus 按需引入（已配置）
  - 代码分割（路由懒加载已配置）
  - Gzip 压缩（`vite-plugin-compression`）
- 构建产物分析（`rollup-plugin-visualizer`，可选）

```bash
pnpm build
```

**完成标准**: 构建成功，产物体积合理

---

### 任务 9.3：Docker 化

创建 `Dockerfile`：

```dockerfile
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

创建 `nginx.conf`：
- 静态资源服务
- SPA history 模式支持（所有路由 fallback 到 index.html）
- API 反向代理到后端
- Gzip 压缩

**完成标准**: `docker build` 成功，容器启动后页面可访问

---

## 任务执行顺序总结

```
阶段一（基础设施）
  1.1 创建项目 → 1.2 安装依赖 → 1.3 目录结构 → 1.4 Axios 封装 → 1.5 Pinia → 1.6 路由 → 1.7 代码规范
      ↓
阶段二（布局与登录）
  2.1 登录页 → 2.2 后台布局 → 2.3 修改密码弹窗
      ↓
阶段三（商家管理 - 核心）
  3.1 API 和类型定义 → 3.2 商家列表 → 3.3 商家新增/编辑 → 3.4 商家详情 → 3.5 分配弹窗 → 3.6 状态变更弹窗
      ↓
阶段四（状态管理）
  4.1 状态模板列表
      ↓
阶段五（自定义字段）
  5.1 字段定义列表
      ↓
阶段六（管理员管理）
  6.1 管理员列表
      ↓
阶段七（操作日志）
  7.1 日志列表
      ↓
阶段八（体验优化）
  8.1 加载状态 → 8.2 权限指令 → 8.3 全局样式
      ↓
阶段九（测试与构建）
  9.1 组件测试 → 9.2 生产构建 → 9.3 Docker 化
```

---

## 前后端联调注意事项

1. **联调顺序**: 建议按后端开发进度逐模块联调
   - 先联调登录接口 → 再联调商家 CRUD → 再联调其他模块
2. **Mock 数据**: 后端接口未就绪时，可使用 Mock 数据开发页面
3. **接口格式约定**: 统一响应格式 `{ code: 0, message: 'success', data: any }`
4. **分页约定**: 请求 `{ page, pageSize }`，响应 `{ list, total, page, pageSize }`
5. **时间格式**: 统一使用 ISO 8601 格式，前端用 Day.js 格式化显示

---

**文档维护**: 技术团队
**最后更新**: 2026-03-02
