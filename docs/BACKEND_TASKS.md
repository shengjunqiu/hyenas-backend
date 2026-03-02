# 后端开发任务文档

## 项目信息

- **项目名称**: 食品经营商家管理系统 - 后端
- **技术栈**: NestJS + Prisma + PostgreSQL + TypeScript
- **包管理器**: pnpm
- **文档版本**: V1.0
- **更新日期**: 2026-03-02

---

## 阶段一：项目初始化与基础设施

### 任务 1.1：创建 NestJS 项目

- 使用 `@nestjs/cli` 创建项目
- 选择 pnpm 作为包管理器
- 选择 strict 模式的 TypeScript 配置
- 验证项目能正常启动

```bash
pnpm add -g @nestjs/cli
nest new hyenas-backend --package-manager pnpm --strict
```

**完成标准**: `pnpm start:dev` 能正常启动，访问 `http://localhost:3000` 返回 Hello World

---

### 任务 1.2：集成 Prisma

- 安装 Prisma 依赖
- 初始化 Prisma，选择 PostgreSQL
- 创建 `PrismaService` 并注册为全局模块
- 配置 `.env` 中的 `DATABASE_URL`

```bash
pnpm add prisma @prisma/client
pnpm prisma init --datasource-provider postgresql
```

需要创建的文件：
- `src/prisma/prisma.module.ts`
- `src/prisma/prisma.service.ts`

**完成标准**: `PrismaService` 可在任意模块中注入使用，`pnpm prisma db push` 能连接数据库

---

### 任务 1.3：编写 Prisma Schema（全部数据模型）

根据 PRD 第 7 章数据模型设计，在 `prisma/schema.prisma` 中定义以下模型：

1. **Admin**（管理员表）
   - id, username, passwordHash, name, phone, role(enum: SUPER/NORMAL), status(enum: ENABLED/DISABLED), createdAt, updatedAt

2. **Merchant**（商家表）
   - id, name, creditCode, contactName, contactPhone, address, licenseNo, businessType, statusId(关联 MerchantStatus), remark, createdBy, createdAt, updatedAt, deletedAt

3. **MerchantStatus**（商家状态模板表）
   - id, name, code, color, sort, isEnabled, remark, createdAt, updatedAt

4. **MerchantFieldDef**（自定义字段定义表）
   - id, fieldKey, fieldName, fieldType(enum: TEXT/TEXTAREA/NUMBER/DATE/SELECT/MULTI_SELECT/BOOLEAN), isRequired, isEnabled, isSearchable, defaultValue, optionsJson(Json), sort, remark, createdAt, updatedAt

5. **MerchantFieldValue**（自定义字段值表）
   - id, merchantId, fieldDefId, valueText, valueJson(Json), createdAt, updatedAt
   - 唯一约束: (merchantId, fieldDefId)

6. **MerchantAdmin**（商家管理员分配关系表）
   - id, merchantId, adminId, assignedBy, createdAt
   - 唯一约束: (merchantId, adminId)

7. **MerchantStatusLog**（状态变更日志表）
   - id, merchantId, fromStatusId, toStatusId, changedBy, remark, createdAt

8. **OperationLog**（操作日志表）
   - id, module, action, targetType, targetId, targetName, operatorId, operatorName, beforeData(Json), afterData(Json), ip, createdAt

所有表名使用 `@@map("snake_case")` 映射，字段名使用 `@map("snake_case")` 映射。

执行迁移：

```bash
pnpm prisma migrate dev --name init
```

**完成标准**: 迁移成功，`pnpm prisma studio` 能看到所有表结构

---

### 任务 1.4：配置全局基础设施

1. **全局异常过滤器**
   - 创建 `src/common/filters/http-exception.filter.ts`
   - 统一错误响应格式: `{ code: number, message: string, data: null }`

2. **全局响应拦截器**
   - 创建 `src/common/interceptors/transform.interceptor.ts`
   - 统一成功响应格式: `{ code: 0, message: 'success', data: any }`

3. **全局验证管道**
   - 在 `main.ts` 中启用 `ValidationPipe`
   - 配置 `whitelist: true, transform: true`

4. **环境变量配置**
   - 安装 `@nestjs/config`
   - 创建 `.env` 和 `.env.example`
   - 配置: DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT

```bash
pnpm add @nestjs/config class-validator class-transformer
```

**完成标准**: 接口返回统一格式，参数验证失败返回友好错误信息

---

### 任务 1.5：集成 Swagger

- 安装 `@nestjs/swagger`
- 在 `main.ts` 中配置 Swagger
- 设置 API 标题、描述、版本
- 启用 Bearer Auth

```bash
pnpm add @nestjs/swagger
```

**完成标准**: 访问 `http://localhost:3000/api-docs` 能看到 Swagger 文档页面

---

## 阶段二：认证模块

### 任务 2.1：创建 Auth 模块

```bash
nest g module modules/auth
nest g controller modules/auth
nest g service modules/auth
```

安装依赖：

```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs
pnpm add -D @types/passport-jwt @types/bcryptjs
```

---

### 任务 2.2：实现 JWT 策略

创建以下文件：
- `src/modules/auth/strategies/jwt.strategy.ts` — 从 Token 中解析用户信息
- `src/modules/auth/guards/jwt-auth.guard.ts` — JWT 认证守卫
- `src/modules/auth/guards/roles.guard.ts` — 角色权限守卫
- `src/modules/auth/decorators/roles.decorator.ts` — `@Roles('SUPER')` 装饰器
- `src/modules/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` 装饰器，获取当前登录用户

**完成标准**: JWT 守卫能正确拦截未认证请求，返回 401

---

### 任务 2.3：实现认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/auth/login` | POST | 管理员登录，返回 accessToken + refreshToken |
| `/auth/logout` | POST | 退出登录（前端清除 Token 即可） |
| `/auth/profile` | GET | 获取当前登录用户信息 |
| `/auth/change-password` | POST | 修改密码（需验证旧密码） |
| `/auth/refresh` | POST | 刷新 Token |

DTO 定义：
- `LoginDto`: username(必填), password(必填)
- `ChangePasswordDto`: oldPassword(必填), newPassword(必填, 最少 6 位)

业务规则：
- 登录时校验账号状态，禁用账号返回"账号已被禁用"
- 密码使用 bcrypt 加密和验证
- 登录成功记录操作日志

**完成标准**: 能正常登录获取 Token，用 Token 访问 `/auth/profile` 返回用户信息

---

### 任务 2.4：创建种子数据

创建 `prisma/seed.ts`：
- 插入一个默认超级管理员账号（admin / admin123）
- 插入默认商家状态模板（待审核、正常经营、暂停经营、整改中、已停业、已注销）

在 `package.json` 中配置：

```json
{
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

```bash
pnpm prisma db seed
```

**完成标准**: 种子数据成功写入，能用默认账号登录

---

## 阶段三：管理员管理模块

### 任务 3.1：创建 Admin 模块

```bash
nest g module modules/admin
nest g controller modules/admin
nest g service modules/admin
```

---

### 任务 3.2：实现管理员接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/admins` | GET | SUPER | 管理员列表（分页、搜索） |
| `/admins` | POST | SUPER | 新增管理员 |
| `/admins/:id` | PUT | SUPER | 编辑管理员 |
| `/admins/:id/status` | PUT | SUPER | 启用/禁用管理员 |
| `/admins/:id/reset-password` | POST | SUPER | 重置密码 |

DTO 定义：
- `QueryAdminDto`: keyword(可选), status(可选), page(默认1), pageSize(默认20)
- `CreateAdminDto`: username(必填,唯一), password(必填), name(必填), phone(可选), role(必填, SUPER/NORMAL)
- `UpdateAdminDto`: name(可选), phone(可选), role(可选)
- `UpdateStatusDto`: status(必填, ENABLED/DISABLED)

业务规则：
- 登录账号唯一校验
- 密码加密存储
- 禁用管理员后不可登录
- 至少保留一个超级管理员不可禁用
- 列表返回每个管理员负责的商家数量
- 所有操作记录操作日志

**完成标准**: 所有接口通过 Swagger 测试，权限控制正确

---

## 阶段四：商家状态管理模块

### 任务 4.1：创建 MerchantStatus 模块

```bash
nest g module modules/merchant-status
nest g controller modules/merchant-status
nest g service modules/merchant-status
```

---

### 任务 4.2：实现状态模板接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/merchant-statuses` | GET | ALL | 状态模板列表 |
| `/merchant-statuses` | POST | SUPER | 新增状态模板 |
| `/merchant-statuses/:id` | PUT | SUPER | 编辑状态模板 |
| `/merchant-statuses/:id/toggle` | PUT | SUPER | 启用/禁用状态模板 |

DTO 定义：
- `CreateMerchantStatusDto`: name(必填), code(必填,唯一), color(可选), sort(可选), remark(可选)
- `UpdateMerchantStatusDto`: name(可选), color(可选), sort(可选), remark(可选)

业务规则：
- 状态编码唯一
- 已被商家使用的状态不可删除，只能禁用
- 禁用的状态不能作为商家的新状态
- 操作记录日志

**完成标准**: 状态模板 CRUD 正常，禁用逻辑正确

---

## 阶段五：自定义字段模块

### 任务 5.1：创建 MerchantField 模块

```bash
nest g module modules/merchant-field
nest g controller modules/merchant-field
nest g service modules/merchant-field
```

---

### 任务 5.2：实现字段定义接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/merchant-fields` | GET | ALL | 字段定义列表 |
| `/merchant-fields` | POST | SUPER | 新增字段定义 |
| `/merchant-fields/:id` | PUT | SUPER | 编辑字段定义 |
| `/merchant-fields/:id/toggle` | PUT | SUPER | 启用/禁用字段 |

DTO 定义：
- `CreateFieldDto`: fieldKey(必填,唯一), fieldName(必填), fieldType(必填,枚举), isRequired(默认false), isSearchable(默认false), defaultValue(可选), optionsJson(可选,单选/多选时必填), sort(可选), remark(可选)
- `UpdateFieldDto`: fieldName(可选), isRequired(可选), isSearchable(可选), defaultValue(可选), optionsJson(可选), sort(可选), remark(可选)

业务规则：
- fieldKey 唯一且创建后不可修改
- fieldType 有数据后不可修改
- 已有数据的字段只能禁用不能删除
- 操作记录日志

**完成标准**: 字段定义 CRUD 正常，类型约束正确

---

## 阶段六：商家管理模块

### 任务 6.1：创建 Merchant 模块

```bash
nest g module modules/merchant
nest g controller modules/merchant
nest g service modules/merchant
```

---

### 任务 6.2：实现商家 CRUD 接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/merchants` | GET | ALL | 商家列表（分页、筛选、数据权限） |
| `/merchants/:id` | GET | ALL | 商家详情（含自定义字段、分配信息、状态记录） |
| `/merchants` | POST | SUPER（或可配置） | 新增商家 |
| `/merchants/:id` | PUT | ALL（数据权限） | 编辑商家 |
| `/merchants/:id` | DELETE | SUPER | 删除商家（逻辑删除） |

DTO 定义：
- `QueryMerchantDto`: name(可选), contactName(可选), contactPhone(可选), statusId(可选), businessType(可选), adminId(可选,超级管理员可用), createdAtStart(可选), createdAtEnd(可选), page(默认1), pageSize(默认20)
- `CreateMerchantDto`: name(必填), creditCode(可选), contactName(可选), contactPhone(可选), address(可选), licenseNo(可选), businessType(可选), statusId(必填), remark(可选), customFields(可选, Record<string, any>)
- `UpdateMerchantDto`: 同 Create 但全部可选

**数据权限核心逻辑**（重要）：
- 超级管理员：查看和操作全部商家
- 普通管理员：只能查看和操作 `merchant_admins` 表中分配给自己的商家
- 列表查询时，普通管理员自动追加 `WHERE merchant_id IN (SELECT merchant_id FROM merchant_admins WHERE admin_id = ?)`
- 详情/编辑/删除时，普通管理员需校验是否有权限访问该商家

**完成标准**: 商家 CRUD 正常，数据权限隔离正确（普通管理员只能看到自己的商家）

---

### 任务 6.3：实现商家自定义字段值接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/merchants/:id/custom-fields` | GET | ALL（数据权限） | 获取商家的自定义字段值 |
| `/merchants/:id/custom-fields` | PUT | ALL（数据权限） | 批量更新商家的自定义字段值 |

业务规则：
- 只能填写已启用的字段
- 必填字段校验
- 根据字段类型校验值的格式
- 单选/多选值必须在选项范围内

**完成标准**: 自定义字段值读写正常，验证规则正确

---

### 任务 6.4：实现商家状态变更接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/merchants/:id/change-status` | PUT | ALL（数据权限） | 变更商家状态 |
| `/merchants/:id/status-logs` | GET | ALL（数据权限） | 查看状态变更记录 |

DTO 定义：
- `ChangeStatusDto`: statusId(必填), remark(可选)

业务规则：
- 新状态必须是已启用的状态模板
- 记录状态变更日志（原状态、新状态、操作人、时间、备注）
- 数据权限校验

**完成标准**: 状态变更正常，变更记录可查询

---

## 阶段七：商家分配管理模块

### 任务 7.1：创建 MerchantAssign 模块

```bash
nest g module modules/merchant-assign
nest g controller modules/merchant-assign
nest g service modules/merchant-assign
```

---

### 任务 7.2：实现分配接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/merchants/:id/admins` | GET | SUPER | 查看商家已分配的管理员 |
| `/merchants/:id/assign-admins` | POST | SUPER | 给商家分配管理员（支持多个） |
| `/merchants/:id/admins/:adminId` | DELETE | SUPER | 解除某个管理员的分配 |
| `/admins/:id/merchants` | GET | SUPER | 查看某管理员负责的商家列表 |

DTO 定义：
- `AssignAdminsDto`: adminIds(必填, number[])

业务规则：
- 仅超级管理员可操作
- 只能分配普通管理员（超级管理员无需分配）
- 同一商家与同一管理员不可重复分配
- 分配/解除立即生效
- 所有操作记录日志

**完成标准**: 分配和解除正常，普通管理员的数据权限实时变化

---

## 阶段八：操作日志模块

### 任务 8.1：创建 OperationLog 模块

```bash
nest g module modules/operation-log
nest g controller modules/operation-log
nest g service modules/operation-log
```

---

### 任务 8.2：实现日志记录机制

创建操作日志拦截器 `src/common/interceptors/operation-log.interceptor.ts`：
- 使用自定义装饰器 `@Log(module, action)` 标记需要记录日志的接口
- 拦截器自动记录：模块、操作类型、操作对象、操作人、操作前后数据、IP 地址
- 日志写入 `operation_logs` 表

```typescript
// 使用示例
@Post()
@Log('merchant', 'create')
create(@Body() dto: CreateMerchantDto) {}
```

---

### 任务 8.3：实现日志查询接口

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/operation-logs` | GET | SUPER（普通管理员可选查看自己的） | 操作日志列表（分页、筛选） |
| `/operation-logs/:id` | GET | SUPER | 日志详情 |

DTO 定义：
- `QueryLogDto`: module(可选), action(可选), operatorId(可选), targetType(可选), createdAtStart(可选), createdAtEnd(可选), page(默认1), pageSize(默认20)

**完成标准**: 各模块的关键操作都有日志记录，日志可查询和筛选

---

//TODO

## 阶段九：安全加固与优化

### 任务 9.1：安全配置

- 安装并配置 `helmet`（安全响应头）
- 配置 CORS（允许前端域名）
- 配置请求频率限制 `@nestjs/throttler`（登录接口防暴力破解）
- 确保所有商家相关接口都有数据权限校验

```bash
pnpm add helmet @nestjs/throttler
```

---

### 任务 9.2：数据库索引优化

在 Prisma Schema 中添加索引：

```prisma
model Merchant {
  // ...
  @@index([name])
  @@index([statusId])
  @@index([createdAt])
  @@index([deletedAt])
}

model MerchantAdmin {
  // ...
  @@index([adminId])
  @@index([merchantId])
}

model OperationLog {
  // ...
  @@index([module])
  @@index([operatorId])
  @@index([createdAt])
}
```

执行迁移：

```bash
pnpm prisma migrate dev --name add-indexes
```

---

### 任务 9.3：编写单元测试

为以下核心服务编写单元测试：
- `AuthService`: 登录、Token 生成与验证、密码校验
- `MerchantService`: CRUD、数据权限过滤
- `MerchantAssignService`: 分配与解除

使用 Jest + NestJS Testing 模块，Mock Prisma Service。

**完成标准**: 核心业务逻辑测试覆盖，`pnpm test` 全部通过

---

## 阶段十：部署准备

### 任务 10.1：Docker 化

创建以下文件：
- `Dockerfile` — 多阶段构建，生产镜像
- `docker-compose.yml` — 编排后端 + PostgreSQL
- `.dockerignore`

```dockerfile
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

---

### 任务 10.2：环境变量与配置

创建 `.env.example`：

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/merchants

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d

# 应用
PORT=3000
NODE_ENV=production
```

**完成标准**: `docker compose up` 能一键启动后端服务和数据库

---

## 任务执行顺序总结

```
阶段一（基础设施）
  1.1 创建项目 → 1.2 集成 Prisma → 1.3 数据模型 → 1.4 全局配置 → 1.5 Swagger
      ↓
阶段二（认证）
  2.1 Auth 模块 → 2.2 JWT 策略 → 2.3 认证接口 → 2.4 种子数据
      ↓
阶段三（管理员）
  3.1 Admin 模块 → 3.2 管理员接口
      ↓
阶段四（状态模板）
  4.1 Status 模块 → 4.2 状态接口
      ↓
阶段五（自定义字段）
  5.1 Field 模块 → 5.2 字段接口
      ↓
阶段六（商家核心）
  6.1 Merchant 模块 → 6.2 商家 CRUD → 6.3 自定义字段值 → 6.4 状态变更
      ↓
阶段七（分配管理）
  7.1 Assign 模块 → 7.2 分配接口
      ↓
阶段八（操作日志）
  8.1 Log 模块 → 8.2 日志机制 → 8.3 日志查询
      ↓
阶段九（安全与优化）
  9.1 安全配置 → 9.2 索引优化 → 9.3 单元测试
      ↓
阶段十（部署）
  10.1 Docker 化 → 10.2 环境配置
```

---

**文档维护**: 技术团队
**最后更新**: 2026-03-02
