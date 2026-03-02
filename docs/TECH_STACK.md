# 技术栈文档

## 项目概述

食品经营商家管理系统 - 全栈技术架构方案

**文档版本**: V1.1
**更新日期**: 2026-03-02
**适用对象**: 技术团队、架构师、开发工程师

---

## 技术选型原则

1. **现代化**: 采用最新稳定版本的主流技术
2. **类型安全**: 全栈 TypeScript，减少运行时错误
3. **开发效率**: 优先选择开发体验好、生态完善的框架
4. **企业级**: 选择经过大规模生产验证的技术方案
5. **可维护性**: 代码结构清晰，易于扩展和维护

---

## 后端技术栈

### 运行时

**Node.js 20 LTS**

- 长期支持版本，稳定可靠
- 原生支持 ESM
- 性能持续优化

### 核心框架

**NestJS 10+**

- 渐进式 Node.js 框架，深受 Angular 启发
- 模块化架构，天然支持大型项目
- 装饰器 + 依赖注入，代码结构清晰
- 内置支持 Guards、Interceptors、Pipes、Middleware
- 完善的官方文档和活跃社区

```typescript
// 示例：商家控制器
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { MerchantService } from './merchant.service'
import { RolesGuard } from '../auth/roles.guard'
import { Roles } from '../auth/roles.decorator'

@Controller('merchants')
@UseGuards(RolesGuard)
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Get()
  findAll(@Query() query: QueryMerchantDto) {
    return this.merchantService.findAll(query)
  }

  @Post()
  @Roles('super')
  create(@Body() dto: CreateMerchantDto) {
    return this.merchantService.create(dto)
  }
}
```

```typescript
// 示例：商家服务
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class MerchantService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryMerchantDto) {
    return this.prisma.merchant.findMany({
      where: { deletedAt: null },
      include: { status: true, admins: true },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    })
  }
}
```

**为什么选择 NestJS？**
- 模块化架构天然适合本系统的多模块设计（商家、状态、字段、分配、日志）
- 依赖注入让服务层解耦清晰，便于测试
- Guards 机制完美匹配 RBAC + 数据权限校验需求
- Interceptors 适合统一处理操作日志记录
- 生态成熟，Prisma、JWT、Swagger 等集成方案完善

### 数据库

**PostgreSQL 16+**

- 开源关系型数据库
- 强大的 JSONB 支持（适合存储自定义字段值）
- 完善的事务和并发控制
- 丰富的索引类型（B-tree、GIN、GiST）
- 支持全文搜索

**为什么选择 PostgreSQL？**
- 自定义字段值可用 JSONB 类型存储，支持索引查询
- 支持复杂查询和聚合
- 数据完整性约束强
- 社区活跃，生态成熟

### ORM

**Prisma 5+**

- 类型安全的数据库客户端
- 自动生成 TypeScript 类型
- 直观的查询 API
- 内置迁移工具（prisma migrate）
- 可视化数据管理（prisma studio）

```typescript
// prisma/schema.prisma 示例
model Merchant {
  id           Int       @id @default(autoincrement())
  name         String
  creditCode   String?   @map("credit_code")
  contactName  String?   @map("contact_name")
  contactPhone String?   @map("contact_phone")
  address      String?
  licenseNo    String?   @map("license_no")
  businessType String?   @map("business_type")
  statusId     Int       @map("status_id")
  remark       String?
  createdBy    Int       @map("created_by")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  status       MerchantStatus    @relation(fields: [statusId], references: [id])
  admins       MerchantAdmin[]
  fieldValues  MerchantFieldValue[]
  statusLogs   MerchantStatusLog[]

  @@map("merchants")
}
```

### 认证与授权

**JWT + Passport + RBAC**

- **@nestjs/jwt + @nestjs/passport**: NestJS 官方认证方案
  - Access Token + Refresh Token 双 Token 机制
  - Token 过期时间: Access 2h, Refresh 7d
  - Passport Strategy 模式，扩展性强

- **RBAC (基于角色的访问控制)**
  - 角色: 超级管理员 (super)、普通管理员 (normal)
  - 功能权限: Guard 装饰器控制
  - 数据权限: Service 层强制过滤

```typescript
// 角色守卫示例
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler())
    if (!requiredRoles) return true

    const { user } = context.switchToHttp().getRequest()
    return requiredRoles.includes(user.role)
  }
}
```

### 密码加密

**bcrypt**

- 行业标准密码哈希算法
- 自动加盐
- 可调节计算成本
- 使用 `bcryptjs` 库（纯 JS 实现，跨平台兼容）

```typescript
import * as bcrypt from 'bcryptjs'

// 加密
const hashed = await bcrypt.hash(password, 10)

// 验证
const isValid = await bcrypt.compare(password, hashed)
```

### 数据验证

**class-validator + class-transformer**

- NestJS 官方推荐的验证方案
- 装饰器风格，与 NestJS 无缝集成
- 自动转换和验证请求数据
- 支持自定义验证规则

```typescript
import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator'

export class CreateMerchantDto {
  @IsString()
  @IsNotEmpty({ message: '商家名称不能为空' })
  name: string

  @IsOptional()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  contactPhone?: string

  @IsInt()
  statusId: number
}
```

### 日志

**NestJS 内置 Logger + Winston**

- NestJS 内置日志系统满足基本需求
- Winston 用于生产环境结构化日志
- 支持多种传输方式（文件、控制台、远程）
- 日志分级: Error、Warn、Log、Debug、Verbose

### 缓存（可选）

**Redis 7+ / @nestjs/cache-manager**

- 热点数据缓存（状态模板、字段定义）
- 第一版可先用内存缓存，后续切换 Redis
- 使用 `@nestjs/cache-manager` 统一缓存接口

### API 文档

**Swagger / OpenAPI**

- 使用 `@nestjs/swagger` 插件
- 装饰器自动生成 API 文档
- 交互式 API 调试界面

```typescript
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

@ApiTags('商家管理')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantController {
  @Get()
  @ApiOperation({ summary: '获取商家列表' })
  findAll() {}
}
```

### 包管理器

**pnpm**

- 比 npm/yarn 更快，磁盘占用更小
- 严格的依赖管理，避免幽灵依赖
- 兼容 npm 生态

---

## 前端技术栈

### 核心框架

**Vue 3 + TypeScript**

- Vue 3.4+，组合式 API (Composition API)
- `<script setup>` 语法糖，开发效率高
- TypeScript 5.0+，完整类型支持
- 响应式系统性能优秀

**为什么选择 Vue 3？**
- 模板语法直观，后台管理系统开发效率高
- 组合式 API 逻辑复用能力强
- 与 Element Plus 深度集成
- 学习曲线平缓，团队上手快

```vue
<!-- 示例：商家列表页 -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getMerchants } from '@/api/merchant'
import type { Merchant } from '@/types'

const merchants = ref<Merchant[]>([])
const loading = ref(false)

const fetchData = async () => {
  loading.value = true
  const { data } = await getMerchants()
  merchants.value = data.list
  loading.value = false
}

onMounted(fetchData)
</script>

<template>
  <el-table :data="merchants" v-loading="loading">
    <el-table-column prop="name" label="商家名称" />
    <el-table-column prop="contactName" label="联系人" />
    <el-table-column prop="status.name" label="状态" />
  </el-table>
</template>
```

### 构建工具

**Vite 5+**

- 极速冷启动
- 热模块替换 (HMR)
- 原生 ESM
- 优化的生产构建

### UI 组件库

**Element Plus**

- Vue 3 生态最成熟的企业级 UI 库
- 组件丰富，覆盖后台管理全场景
- 中文文档完善
- 主题定制能力强
- 按需引入，减小打包体积

**核心组件使用**
- ElTable: 商家列表、管理员列表（内置排序、筛选、分页）
- ElForm + ElFormItem: 表单验证和提交
- ElDialog: 弹窗操作（分配管理员、状态变更）
- ElSelect: 下拉选择（状态、管理员）
- ElDatePicker: 日期选择（创建时间筛选）
- ElTag: 状态标签（支持颜色配置）
- ElMenu: 侧边栏菜单（权限控制）

### 状态管理

**Pinia**

- Vue 官方推荐的状态管理库
- 组合式 API 风格，与 Vue 3 完美契合
- TypeScript 支持好
- 轻量，无需 mutations
- 支持 devtools 调试

```typescript
// stores/user.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Admin } from '@/types'

export const useUserStore = defineStore('user', () => {
  const user = ref<Admin | null>(null)
  const token = ref('')

  const setUser = (admin: Admin) => {
    user.value = admin
  }

  const isSuper = computed(() => user.value?.role === 'super')

  return { user, token, setUser, isSuper }
})
```

### 路由

**Vue Router 4**

- Vue 官方路由
- 导航守卫（登录校验、权限控制）
- 路由懒加载
- 动态路由（根据角色生成菜单）

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/pages/Login.vue'),
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: 'merchants', component: () => import('@/pages/merchant/List.vue') },
        { path: 'merchants/:id', component: () => import('@/pages/merchant/Detail.vue') },
        {
          path: 'admins',
          component: () => import('@/pages/admin/List.vue'),
          meta: { roles: ['super'] },
        },
      ],
    },
  ],
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (to.meta.requiresAuth && !userStore.token) {
    next('/login')
  } else {
    next()
  }
})
```

### HTTP 客户端

**Axios**

- 拦截器处理认证 Token
- 统一错误处理和提示
- 请求/响应类型定义
- 支持请求取消

```typescript
import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 10000,
})

// 请求拦截器：自动携带 Token
api.interceptors.request.use((config) => {
  const userStore = useUserStore()
  if (userStore.token) {
    config.headers.Authorization = `Bearer ${userStore.token}`
  }
  return config
})

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      // Token 过期，跳转登录
      router.push('/login')
    }
    ElMessage.error(err.response?.data?.message || '请求失败')
    return Promise.reject(err)
  },
)
```

### 样式方案

**SCSS + Element Plus 主题定制**

- SCSS 预处理器，变量和混入
- Element Plus CSS 变量覆盖，统一主题
- Scoped 样式隔离

### 工具库

**日期处理**: Day.js
- 轻量级（2KB）
- API 与 Moment.js 兼容
- Element Plus 日期组件默认支持

**工具函数**: Lodash-es
- 按需引入，Tree-shaking 友好
- 深拷贝、防抖、节流等

---

## 开发工具链

### 代码规范

**ESLint + Prettier**

- ESLint: 代码质量检查
- Prettier: 代码格式化
- `@antfu/eslint-config` 或 `@vue/eslint-config-typescript`

### Git Hooks

**Husky + lint-staged**

- 提交前自动检查
- 只检查暂存文件
- 保证代码质量

```json
{
  "lint-staged": {
    "*.{ts,vue}": ["eslint --fix", "prettier --write"]
  }
}
```

### 类型检查

**TypeScript 5.0+**

- 严格模式开启
- 路径别名配置
- 前后端可共享类型定义

```json
{
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## 部署架构

### 容器化

**Docker + Docker Compose**

- 统一开发和生产环境
- 服务编排
- 一键启动

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - db
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/merchants

  frontend:
    build: ./frontend
    ports:
      - "80:80"

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: merchants
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

### 反向代理

**Nginx**

- 前端静态资源服务
- API 反向代理到后端
- HTTPS 配置
- Gzip 压缩

### CI/CD

**GitHub Actions**

- 自动化测试
- 自动化构建和部署
- 代码质量检查

```yaml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - run: pnpm test
```

---

## 项目结构

### 后端结构（NestJS）

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/             # 认证模块
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── roles.decorator.ts
│   │   ├── merchant/         # 商家模块
│   │   │   ├── merchant.module.ts
│   │   │   ├── merchant.controller.ts
│   │   │   ├── merchant.service.ts
│   │   │   └── dto/
│   │   ├── merchant-status/  # 商家状态模块
│   │   ├── merchant-field/   # 自定义字段模块
│   │   ├── merchant-assign/  # 商家分配模块
│   │   ├── admin/            # 管理员模块
│   │   └── operation-log/    # 操作日志模块
│   ├── common/
│   │   ├── decorators/       # 自定义装饰器
│   │   ├── filters/          # 异常过滤器
│   │   ├── interceptors/     # 拦截器（日志记录）
│   │   └── pipes/            # 管道（数据转换）
│   ├── prisma/
│   │   └── prisma.service.ts
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
├── package.json
├── nest-cli.json
└── tsconfig.json
```

### 前端结构（Vue 3）

```
frontend/
├── src/
│   ├── api/                  # API 接口定义
│   │   ├── merchant.ts
│   │   ├── admin.ts
│   │   ├── auth.ts
│   │   └── index.ts
│   ├── components/           # 通用组件
│   │   ├── MerchantStatusTag.vue
│   │   └── AssignAdminDialog.vue
│   ├── layouts/              # 布局组件
│   │   └── AdminLayout.vue
│   ├── pages/                # 页面
│   │   ├── login/
│   │   │   └── Index.vue
│   │   ├── merchant/
│   │   │   ├── List.vue
│   │   │   ├── Detail.vue
│   │   │   └── Form.vue
│   │   ├── admin/
│   │   ├── status/
│   │   ├── field/
│   │   └── log/
│   ├── router/               # 路由配置
│   │   └── index.ts
│   ├── stores/               # Pinia 状态管理
│   │   └── user.ts
│   ├── types/                # 类型定义
│   │   └── index.ts
│   ├── utils/                # 工具函数
│   │   └── request.ts
│   ├── styles/               # 全局样式
│   ├── App.vue
│   └── main.ts
├── public/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── env.d.ts
```

---

## 性能优化策略

### 后端优化

1. **数据库优化**
   - 合理建立索引（商家名称、状态、创建时间）
   - Prisma 连接池配置
   - 查询优化（避免 N+1，使用 include）
   - 分页查询

2. **缓存策略**
   - 状态模板缓存（变更频率低）
   - 字段定义缓存
   - 第一版用内存缓存，后续可切 Redis

3. **日志优化**
   - 操作日志异步写入
   - 日志表定期归档

### 前端优化

1. **代码分割**
   - 路由懒加载
   - Element Plus 按需引入（unplugin-vue-components）
   - 第三方库按需引入

2. **资源优化**
   - Gzip / Brotli 压缩
   - 静态资源 CDN

3. **渲染优化**
   - v-memo 避免不必要的重渲染
   - 虚拟滚动（大数据量列表）
   - 防抖节流（搜索输入）

---

## 安全措施

### 后端安全

1. **认证安全**
   - JWT Token 过期机制
   - Refresh Token 轮换
   - 密码强度校验
   - 登录失败次数限制

2. **数据安全**
   - SQL 注入防护（Prisma 参数化查询）
   - XSS 防护（class-validator 输入验证）
   - CORS 配置
   - Helmet 安全头

3. **权限安全**
   - Guard 层功能权限校验
   - Service 层数据权限过滤
   - 操作日志全记录

### 前端安全

1. **输入验证**
   - Element Plus 表单验证
   - 特殊字符过滤

2. **敏感信息**
   - Token 存储（localStorage / httpOnly cookie）
   - 敏感数据脱敏显示
   - HTTPS 传输

---

## 测试策略

### 后端测试

**Jest（NestJS 内置）**

- 单元测试：Service 层业务逻辑
- 集成测试：Controller + Service + Database
- E2E 测试：完整 API 流程

```typescript
import { Test } from '@nestjs/testing'
import { MerchantService } from './merchant.service'

describe('MerchantService', () => {
  let service: MerchantService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MerchantService],
    }).compile()
    service = module.get(MerchantService)
  })

  it('should create a merchant', async () => {
    const merchant = await service.create(mockData)
    expect(merchant.name).toBe('测试商家')
  })
})
```

### 前端测试

**Vitest + Vue Test Utils**

- 组件测试
- 组合式函数测试
- 集成测试

```typescript
import { mount } from '@vue/test-utils'
import MerchantList from '@/pages/merchant/List.vue'

test('renders merchant list', () => {
  const wrapper = mount(MerchantList)
  expect(wrapper.text()).toContain('商家列表')
})
```

---

## 监控与日志

### 应用监控

- **性能监控**: 接口响应时间、吞吐量
- **错误监控**: 异常捕获和上报
- **业务监控**: 商家数量、操作频次等

### 日志系统

- **结构化日志**: JSON 格式输出
- **日志分级**: Error、Warn、Log、Debug
- **操作日志**: 数据库持久化，支持审计

---

## 开发环境要求

### 必需软件

- **Node.js**: 20 LTS
- **pnpm**: 8+
- **PostgreSQL**: 16+
- **Docker**: 24+（可选）

### 推荐 IDE

- **VS Code**
  - 插件: Volar, ESLint, Prettier, Prisma
  - 配置: 自动格式化、自动导入

---

## 技术栈总结

| 分类 | 技术选型 | 版本 |
|------|---------|------|
| 运行时 | Node.js | 20 LTS |
| 后端框架 | NestJS | 10+ |
| 数据库 | PostgreSQL | 16+ |
| ORM | Prisma | 5.0+ |
| 认证 | JWT + Passport | - |
| 密码加密 | bcrypt | - |
| 数据验证 | class-validator | - |
| API 文档 | @nestjs/swagger | - |
| 前端框架 | Vue 3 | 3.4+ |
| 构建工具 | Vite | 5+ |
| UI 组件库 | Element Plus | 2.5+ |
| 状态管理 | Pinia | 2.0+ |
| 路由 | Vue Router | 4+ |
| HTTP 客户端 | Axios | 1.6+ |
| 样式方案 | SCSS | - |
| 语言 | TypeScript | 5.0+ |
| 包管理器 | pnpm | 8+ |
| 代码规范 | ESLint + Prettier | - |
| 后端测试 | Jest | - |
| 前端测试 | Vitest | - |
| 容器化 | Docker | 24+ |
| 反向代理 | Nginx | 1.24+ |
| CI/CD | GitHub Actions | - |

---

## 技术选型优势

### 企业级架构

- **NestJS**: 模块化 + 依赖注入，天然适合中大型项目
- **Vue 3 + Element Plus**: 后台管理系统最成熟的组合
- **Prisma**: 类型安全 ORM，数据库操作零心智负担
- **PostgreSQL**: 功能最强大的开源关系型数据库

### 开发体验

- **全栈 TypeScript**: 前后端类型一致，减少联调成本
- **NestJS CLI**: 快速生成模块、控制器、服务
- **Vite**: 毫秒级热更新
- **Element Plus**: 开箱即用的表格、表单、弹窗

### 可维护性

- **NestJS 模块化**: 每个业务模块独立，职责清晰
- **Vue 组合式 API**: 逻辑复用和组织更灵活
- **Prisma Schema**: 数据模型即文档
- **统一代码规范**: ESLint + Prettier + Husky

### 可扩展性

- **NestJS 微服务**: 未来可平滑迁移到微服务架构
- **NestJS 插件生态**: WebSocket、GraphQL、消息队列等
- **Vue 插件系统**: 按需扩展功能
- **Prisma**: 支持多数据库切换

---

## 学习资源

### 官方文档

- NestJS: https://docs.nestjs.com
- Prisma: https://www.prisma.io/docs
- Vue 3: https://vuejs.org
- Element Plus: https://element-plus.org
- Pinia: https://pinia.vuejs.org
- Vite: https://vitejs.dev

---

**文档维护**: 技术团队
**最后更新**: 2026-03-02
