# 后端开发任务文档 V2

## 项目信息

- **项目名称**: 数据库管理与项目管理系统 - 后端
- **技术栈**: NestJS + Prisma + PostgreSQL + TypeScript
- **包管理器**: pnpm
- **文档版本**: V2.0
- **更新日期**: 2026-03-09

---

## 阶段一：数据模型与基础设施

### 任务 1.1：补充 Prisma Schema

在 `backend/prisma/schema.prisma` 中新增以下模型：

1. `DataTemplate`
2. `DataTemplateField`
3. `DatabaseRecord`
4. `DatabaseImportLog`
5. `Project`
6. `ProjectMember`
7. `ProjectRecord`
8. `ProjectImportLog`

新增枚举：

- `TemplateStatus`
- `FieldType`
- `ProjectStatus`
- `ProjectMemberRole`
- `ImportSourceType`

约束要求：

- `DataTemplate.code` 唯一
- `DataTemplateField.templateId + fieldKey` 唯一
- `DatabaseRecord.templateId + primaryKeyValue` 唯一
- `Project.code` 唯一
- `ProjectMember.projectId + adminId` 唯一
- `ProjectRecord.projectId + sourceRecordId` 唯一

**完成标准**:

- Prisma schema 通过校验
- 所有关系字段与索引定义完整

---

### 任务 1.2：创建数据库迁移

执行 Prisma migration：

```bash
cd backend
npx prisma migrate dev --name add_database_and_project_modules
```

需要确认：

- 新表全部创建成功
- 索引和唯一约束全部生效
- 不破坏现有管理员和商家相关表

**完成标准**:

- 本地迁移成功
- 测试库和开发库可重复执行

---

### 任务 1.3：生成 Prisma Client 并验证构建

```bash
cd backend
npx prisma generate
npm run build
```

**完成标准**:

- Prisma Client 正常生成
- 后端 TypeScript 构建通过

---

## 阶段二：模板管理模块

### 任务 2.1：创建 Template 模块

创建模块：

```bash
nest g module modules/template
nest g controller modules/template
nest g service modules/template
```

建议目录补充：

- `src/modules/template/dto/create-template.dto.ts`
- `src/modules/template/dto/update-template.dto.ts`
- `src/modules/template/dto/toggle-template.dto.ts`
- `src/modules/template/dto/create-template-field.dto.ts`
- `src/modules/template/dto/copy-template.dto.ts`

**完成标准**:

- 模块骨架完成
- 路由已注册到主模块

---

### 任务 2.2：实现模板列表与详情接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/templates` | GET | SUPER | 模板列表 |
| `/templates/:id` | GET | SUPER | 模板详情 |

列表返回字段建议：

- `id`
- `name`
- `code`
- `status`
- `isEnabled`
- `fieldCount`
- `createdAt`
- `updatedAt`

详情返回内容建议：

- 模板基础信息
- 字段列表
- 来源模板信息

**完成标准**:

- 可查询模板列表和详情
- 响应字段满足前端展示需要

---

### 任务 2.3：实现创建模板接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/templates` | POST | SUPER | 创建模板 |

DTO 建议：

- `name`
- `code`
- `description`
- `fields: CreateTemplateFieldDto[]`

字段 DTO 建议：

- `fieldKey`
- `fieldName`
- `fieldType`
- `isRequired`
- `isPrimaryKey`
- `isListed`
- `isSearchable`
- `defaultValue`
- `optionsJson`
- `sort`
- `remark`

业务规则：

- 模板编码唯一
- 字段编码在模板内唯一
- 主键字段只能有一个
- 单选、多选字段必须配置选项

**完成标准**:

- 可一次性创建模板和字段
- 参数校验和业务校验正确

---

### 任务 2.4：实现模板复制接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/templates/:id/copy` | POST | SUPER | 复制模板 |

业务规则：

- 复制模板基础信息和全部字段
- 新模板需重新输入 `name` 和 `code`
- `copiedFromId` 记录来源模板

**完成标准**:

- 模板复制成功
- 新旧模板互不影响

---

### 任务 2.5：实现模板状态与删除接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/templates/:id/status` | PUT | SUPER | 启用/停用模板 |
| `/templates/:id` | PUT | SUPER | 编辑模板基础信息 |
| `/templates/:id` | DELETE | SUPER | 删除模板 |

业务规则：

- 只允许编辑基础信息，不允许编辑字段结构
- 已被项目绑定的模板不允许物理删除，建议报错或仅允许停用
- 停用模板后不可再用于新建项目或导入数据库数据

**完成标准**:

- 模板状态切换生效
- 删除限制正确

---

### 任务 2.6：实现字段删除接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/templates/:id/fields/:fieldId` | DELETE | SUPER | 删除字段 |

业务规则：

- 删除字段后，数据库数据和项目数据中该字段对应内容同步删除
- 若数据以 JSON 存储，则需批量清理 JSON 中对应 key

技术建议：

- 在 service 中统一封装 JSON 字段清理逻辑
- 删除字段操作必须记录操作日志

**完成标准**:

- 删除字段后模板字段消失
- 相关数据中的字段值同步清除

---

## 阶段三：数据库数据管理模块

### 任务 3.1：创建 Database 模块

创建模块：

```bash
nest g module modules/database-record
nest g controller modules/database-record
nest g service modules/database-record
nest g module modules/database-import
nest g controller modules/database-import
nest g service modules/database-import
```

如需简化，可合并为单一 `database` 模块。

**完成标准**:

- 模块骨架完成

---

### 任务 3.2：实现数据库数据 CRUD 接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/database-records` | GET | SUPER | 数据列表 |
| `/database-records/:id` | GET | SUPER | 数据详情 |
| `/database-records` | POST | SUPER | 新增数据 |
| `/database-records/:id` | PUT | SUPER | 编辑数据 |
| `/database-records/:id` | DELETE | SUPER | 删除数据 |

列表查询参数建议：

- `templateId`
- `keyword`
- `primaryKeyValue`
- `page`
- `pageSize`

业务规则：

- 所有数据必须指定模板
- `dataJson` 必须符合模板字段定义
- 必填字段不能为空
- 主键字段值不能为空

**完成标准**:

- 数据 CRUD 正常
- 模板校验正确

---

### 任务 3.3：实现动态字段校验器

在数据库数据模块中抽取通用校验逻辑：

- `validateAgainstTemplate(templateId, dataJson)`
- `extractPrimaryKeyValue(template, dataJson)`
- `normalizeFieldValue(fieldDef, value)`

需覆盖：

- 文本格式
- 数字格式
- 日期格式
- 单选/多选范围校验
- 布尔格式校验

**完成标准**:

- 新增、编辑、导入全部复用同一套校验逻辑

---

### 任务 3.4：实现 Excel 导入数据库数据接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/database-records/import-excel` | POST | SUPER | Excel 导入数据库数据 |

入参建议：

- `templateId`
- `file`

处理流程：

1. 校验模板可用
2. 读取 Excel
3. 按表头映射模板字段
4. 校验主键字段列存在
5. 逐行校验
6. 存在主键则更新，不存在则新增
7. 记录导入日志

建议依赖：

- `xlsx` 或同类库

**完成标准**:

- 可成功导入 Excel
- 返回新增数、更新数、失败数
- 失败原因可定位到行

---

### 任务 3.5：实现数据库导入日志接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/database-records/import-logs` | GET | SUPER | 导入日志列表 |
| `/database-records/import-logs/:id` | GET | SUPER | 导入日志详情 |

**完成标准**:

- 可查看历史导入记录
- 可查看失败明细

---

## 阶段四：项目管理模块

### 任务 4.1：创建 Project 模块

创建模块：

```bash
nest g module modules/project
nest g controller modules/project
nest g service modules/project
nest g module modules/project-member
nest g controller modules/project-member
nest g service modules/project-member
nest g module modules/project-record
nest g controller modules/project-record
nest g service modules/project-record
nest g module modules/project-import
nest g controller modules/project-import
nest g service modules/project-import
```

**完成标准**:

- 项目相关模块骨架完成

---

### 任务 4.2：实现项目 CRUD 接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/projects` | GET | ALL（按权限） | 项目列表 |
| `/projects/:id` | GET | ALL（按权限） | 项目详情 |
| `/projects` | POST | SUPER | 创建项目 |
| `/projects/:id` | PUT | SUPER/PROJECT_ADMIN | 编辑项目 |
| `/projects/:id` | DELETE | SUPER | 删除或归档项目 |

DTO 建议：

- `name`
- `code`
- `templateId`
- `description`
- `status`
- `startDate`
- `endDate`

业务规则：

- 一个项目只能绑定一个模板
- 创建后模板不允许修改
- 普通管理员不可创建项目
- 项目管理员只能编辑自己负责项目的基础信息

**完成标准**:

- 项目 CRUD 正常
- 数据权限正确

---

### 任务 4.3：实现项目管理员分配接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/projects/:id/assign-admin` | POST | SUPER | 分配项目管理员 |

业务规则：

- 仅超级管理员可操作
- 只能分配普通管理员
- 被分配人为 `PROJECT_ADMIN`
- 同步维护 `projects.projectAdminId` 和 `project_members`

建议：

- 如果允许更换项目管理员，需要处理旧管理员的项目角色关系

**完成标准**:

- 项目管理员分配成功
- 项目详情和成员列表一致

---

### 任务 4.4：实现项目成员接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/projects/:id/members` | GET | SUPER/PROJECT_ADMIN | 成员列表 |
| `/projects/:id/members` | POST | PROJECT_ADMIN | 新增项目成员 |
| `/projects/:id/members/:memberId` | DELETE | PROJECT_ADMIN | 移除项目成员 |

业务规则：

- 项目管理员只能管理自己负责的项目
- 项目管理员只能添加自己名下子管理员
- 不允许重复添加成员
- 项目管理员本人不走 `PROJECT_MEMBER` 分配逻辑

**完成标准**:

- 项目成员增删查正常
- 上下级限制正确

---

## 阶段五：项目数据管理模块

### 任务 5.1：实现项目数据列表与详情接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/projects/:id/records` | GET | ALL（按项目权限） | 项目数据列表 |
| `/projects/:id/records/:recordId` | GET | ALL（按项目权限） | 项目数据详情 |

业务规则：

- 超级管理员可看全部
- 项目管理员仅能看自己项目
- 项目成员仅能看参与项目

**完成标准**:

- 权限过滤正确
- 返回字段满足前端动态展示

---

### 任务 5.2：实现项目数据编辑与删除接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/projects/:id/records/:recordId` | PUT | ALL（按项目权限） | 编辑项目数据 |
| `/projects/:id/records/:recordId` | DELETE | ALL（按项目权限） | 删除项目数据 |

业务规则：

- 编辑项目数据不影响数据库原始数据
- 删除项目数据不影响数据库原始数据
- 编辑时仍需按模板校验 `dataJson`

**完成标准**:

- 项目数据可独立维护
- 不影响源数据库数据

---

### 任务 5.3：实现从数据库导入项目数据接口

实现接口：

| 接口 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/projects/:id/import-records` | POST | SUPER/PROJECT_ADMIN | 从数据库导入项目数据 |

DTO 建议：

- `recordIds: number[]`

业务规则：

- 只能导入与项目模板一致的数据
- 同一项目内同一 `sourceRecordId` 不可重复导入
- 导入后创建 `project_records`
- 导入结果写入 `project_import_logs`

返回建议：

- `totalCount`
- `createdCount`
- `skippedCount`

**完成标准**:

- 可按记录 ID 批量导入
- 去重逻辑正确

---

## 阶段六：统一权限与日志

### 任务 6.1：封装项目权限校验方法

在项目模块或公共服务中抽取：

- `ensureProjectAccessible(projectId, user)`
- `ensureProjectAdmin(projectId, user)`
- `ensureProjectMemberAssignable(projectId, operator, memberId)`

目标：

- 避免权限逻辑散落在多个 service 中

**完成标准**:

- 所有项目相关 service 复用统一权限方法

---

### 任务 6.2：扩展操作日志记录

为以下操作补充日志：

- 创建模板
- 复制模板
- 删除字段
- 导入数据库数据
- 创建项目
- 分配项目管理员
- 分配项目成员
- 导入项目数据
- 编辑项目数据
- 删除项目数据

建议模块名：

- `TEMPLATE`
- `DATABASE_RECORD`
- `DATABASE_IMPORT`
- `PROJECT`
- `PROJECT_MEMBER`
- `PROJECT_RECORD`
- `PROJECT_IMPORT`

**完成标准**:

- 关键操作均有日志

---

## 阶段七：测试与联调

### 任务 7.1：补充单元测试与集成测试

重点测试：

- 模板主键字段唯一
- 模板复制
- Excel 导入新增/更新
- 项目模板一致性校验
- 项目管理员权限
- 子管理员分配限制
- 项目数据副本隔离

**完成标准**:

- 核心 service 至少具备关键逻辑测试

---

### 任务 7.2：Swagger 校验与联调支持

要求：

- 所有新接口补齐 Swagger 注释
- DTO 字段描述完整
- 权限和用途写清楚

**完成标准**:

- 前端可直接依据 Swagger 联调

---

## 阶段八：上线前检查

### 任务 8.1：迁移与种子检查

检查项：

- Prisma migration 是否可在测试环境执行
- 是否需要新增模板、项目状态等基础种子数据

**完成标准**:

- 部署流程清晰
- 初始化数据准备完成

---

### 任务 8.2：性能与索引检查

建议新增索引：

- `database_records(template_id, primary_key_value)`
- `projects(template_id)`
- `projects(project_admin_id)`
- `project_members(project_id, admin_id)`
- `project_records(project_id, source_record_id)`

**完成标准**:

- 常用查询具备必要索引

---

## 建议交付顺序

1. Prisma 模型与 migration
2. 模板模块
3. 数据库数据模块
4. Excel 导入模块
5. 项目模块
6. 项目成员模块
7. 项目数据模块
8. 日志与测试
