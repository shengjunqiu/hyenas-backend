# 数据库管理与项目管理功能开发文档

- **文档名称**：数据库管理与项目管理功能开发文档
- **文档版本**：V2.0
- **更新日期**：2026-03-09
- **适用对象**：后端开发、前端开发、测试工程师、项目负责人

---

# 1. 开发目标

基于现有 NestJS + Prisma + PostgreSQL + Vue 3 系统，新增一套“数据库管理 + 项目管理”能力。

本次开发目标：

1. 新增模板驱动的数据模型
2. 新增数据库数据管理与 Excel 导入能力
3. 新增项目管理、项目成员和项目数据能力
4. 建立系统角色与项目角色结合的权限模型
5. 保持与当前管理员上下级体系兼容

---

# 2. 范围说明

## 2.1 本次开发范围

- 数据模板管理
- 模板字段管理
- 数据库数据管理
- Excel 导入数据库数据
- 项目管理
- 项目管理员分配
- 项目成员分配
- 项目数据管理
- 从数据库导入项目数据
- 后端权限与日志能力扩展
- 前端页面、接口、路由与权限控制

## 2.2 不在本次范围

- 模板版本管理
- 项目数据导出
- 导入异步任务队列
- 审批流
- 数据回滚
- 多模板项目

---

# 3. 数据库设计

## 3.1 设计原则

- 保持现有 `Admin`、`OperationLog`、认证模型不变
- 新增的业务表全部使用独立主键
- 动态数据字段统一以 JSON 存储
- 项目数据与数据库数据分表存储，避免引用式耦合
- 所有关键关系建立唯一约束和索引

---

## 3.2 表结构建议

## 3.2.1 `data_templates`

用途：存储数据模板定义。

建议字段：

- `id`
- `name`
- `code`
- `description`
- `status`
- `is_enabled`
- `copied_from_id`
- `created_by`
- `created_at`
- `updated_at`

约束建议：

- `code` 唯一
- `copied_from_id` 可为空，表示来源模板

---

## 3.2.2 `data_template_fields`

用途：存储模板字段定义。

建议字段：

- `id`
- `template_id`
- `field_key`
- `field_name`
- `field_type`
- `is_required`
- `is_primary_key`
- `is_listed`
- `is_searchable`
- `default_value`
- `options_json`
- `sort`
- `remark`
- `created_at`
- `updated_at`

约束建议：

- `template_id + field_key` 唯一
- 每个模板只能有一个 `is_primary_key = true`

---

## 3.2.3 `database_records`

用途：存储系统数据库中的原始记录。

建议字段：

- `id`
- `template_id`
- `primary_key_value`
- `data_json`
- `source_type`
- `source_name`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

约束建议：

- `template_id + primary_key_value` 唯一

说明：

- `data_json` 保存模板字段值
- `primary_key_value` 便于导入更新和快速查询

---

## 3.2.4 `database_import_logs`

用途：记录数据库数据导入情况。

建议字段：

- `id`
- `template_id`
- `file_name`
- `total_count`
- `created_count`
- `updated_count`
- `failed_count`
- `failure_details_json`
- `operator_id`
- `created_at`

---

## 3.2.5 `projects`

用途：存储项目基础信息。

建议字段：

- `id`
- `name`
- `code`
- `template_id`
- `description`
- `status`
- `project_admin_id`
- `start_date`
- `end_date`
- `created_by`
- `created_at`
- `updated_at`
- `deleted_at`

约束建议：

- `code` 唯一
- `template_id` 必填
- `project_admin_id` 可为空，允许先建项目后分配管理员

说明：

- 第一版建议项目只允许一个项目管理员主负责人
- 若后续要支持多个项目管理员，可拆成关系表

---

## 3.2.6 `project_members`

用途：存储项目成员关系。

建议字段：

- `id`
- `project_id`
- `admin_id`
- `role`
- `assigned_by`
- `created_at`

约束建议：

- `project_id + admin_id` 唯一

角色枚举建议：

- `PROJECT_ADMIN`
- `PROJECT_MEMBER`

说明：

- 若 `projects.project_admin_id` 存在，可同步写入 `project_members`
- 为减少查询复杂度，建议 `project_members` 作为统一成员关系表

---

## 3.2.7 `project_records`

用途：存储项目中的数据副本。

建议字段：

- `id`
- `project_id`
- `template_id`
- `source_record_id`
- `source_primary_key_value`
- `data_json`
- `imported_by`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

约束建议：

- `project_id + source_record_id` 唯一

说明：

- 项目数据是副本
- 修改项目数据不影响 `database_records`

---

## 3.2.8 `project_import_logs`

用途：记录从数据库导入项目数据的结果。

建议字段：

- `id`
- `project_id`
- `template_id`
- `record_ids_json`
- `total_count`
- `created_count`
- `skipped_count`
- `operator_id`
- `created_at`

---

# 4. Prisma 模型建议

建议新增以下 Prisma model：

- `DataTemplate`
- `DataTemplateField`
- `DatabaseRecord`
- `DatabaseImportLog`
- `Project`
- `ProjectMember`
- `ProjectRecord`
- `ProjectImportLog`

新增枚举建议：

- `TemplateStatus`
- `FieldType`
- `ProjectStatus`
- `ProjectMemberRole`
- `ImportSourceType`

说明：

- 如果当前项目已存在类似 `MerchantFieldType`，建议抽取更通用的字段类型枚举
- 为避免与旧功能强耦合，建议新模块采用独立模型，不直接复用 `Merchant` 相关表

---

# 5. 后端模块拆分建议

## 5.1 新增模块

建议新增以下模块：

- `template`
- `database-record`
- `database-import`
- `project`
- `project-member`
- `project-record`
- `project-import`

如需减少模块数，也可合并为：

- `template`
- `database`
- `project`

---

## 5.2 模块职责

### `template`

负责：

- 模板增删改查
- 模板复制
- 模板字段管理
- 模板合法性校验

### `database`

负责：

- 数据库数据增删改查
- Excel 导入
- 导入日志

### `project`

负责：

- 项目增删改查
- 项目管理员分配
- 项目成员管理
- 项目数据导入
- 项目数据增删改查

---

# 6. 后端接口设计

## 6.1 模板管理接口

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/templates` | GET | SUPER | 模板列表 |
| `/templates/:id` | GET | SUPER | 模板详情 |
| `/templates` | POST | SUPER | 新建模板 |
| `/templates/:id/copy` | POST | SUPER | 复制模板 |
| `/templates/:id` | PUT | SUPER | 编辑模板基础信息，不编辑字段结构 |
| `/templates/:id/status` | PUT | SUPER | 启用/停用模板 |
| `/templates/:id` | DELETE | SUPER | 删除模板 |

字段接口：

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/templates/:id/fields` | GET | SUPER | 查看模板字段 |
| `/templates/:id/fields` | POST | SUPER | 新增字段，仅模板发布前允许 |
| `/templates/:id/fields/:fieldId` | DELETE | SUPER | 删除字段 |

说明：

- 由于字段创建后不可修改，接口中不提供字段编辑

---

## 6.2 数据库数据接口

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/database-records` | GET | SUPER | 数据列表 |
| `/database-records/:id` | GET | SUPER | 数据详情 |
| `/database-records` | POST | SUPER | 新增数据 |
| `/database-records/:id` | PUT | SUPER | 编辑数据 |
| `/database-records/:id` | DELETE | SUPER | 删除数据 |
| `/database-records/import-excel` | POST | SUPER | Excel 导入 |
| `/database-records/import-logs` | GET | SUPER | 导入日志列表 |

请求要点：

- 列表必须带 `templateId`
- 新增和编辑要根据模板字段校验 `dataJson`
- 导入接口需做主键更新逻辑

---

## 6.3 项目管理接口

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/projects` | GET | SUPER/PROJECT_ADMIN/PROJECT_MEMBER | 按权限返回项目列表 |
| `/projects/:id` | GET | SUPER/PROJECT_ADMIN/PROJECT_MEMBER | 项目详情 |
| `/projects` | POST | SUPER | 新建项目 |
| `/projects/:id` | PUT | SUPER/PROJECT_ADMIN | 编辑项目 |
| `/projects/:id` | DELETE | SUPER | 删除或归档项目 |
| `/projects/:id/assign-admin` | POST | SUPER | 分配项目管理员 |

说明：

- `GET /projects` 对超级管理员返回全部
- 对项目管理员和项目成员只返回参与项目

---

## 6.4 项目成员接口

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/projects/:id/members` | GET | SUPER/PROJECT_ADMIN | 查看成员 |
| `/projects/:id/members` | POST | PROJECT_ADMIN | 新增项目成员 |
| `/projects/:id/members/:memberId` | DELETE | PROJECT_ADMIN | 移除项目成员 |

业务校验：

- 操作人必须是该项目项目管理员
- 被分配成员必须满足 `parentAdminId = operator.id`

---

## 6.5 项目数据接口

| 接口 | 方法 | 权限 | 说明 |
|---|---|---|---|
| `/projects/:id/records` | GET | SUPER/PROJECT_ADMIN/PROJECT_MEMBER | 项目数据列表 |
| `/projects/:id/records/:recordId` | GET | SUPER/PROJECT_ADMIN/PROJECT_MEMBER | 项目数据详情 |
| `/projects/:id/records/:recordId` | PUT | SUPER/PROJECT_ADMIN/PROJECT_MEMBER | 编辑项目数据 |
| `/projects/:id/records/:recordId` | DELETE | SUPER/PROJECT_ADMIN/PROJECT_MEMBER | 删除项目数据 |
| `/projects/:id/import-records` | POST | SUPER/PROJECT_ADMIN | 从数据库导入项目数据 |

业务校验：

- 导入记录必须与项目模板一致
- 已导入的 `source_record_id` 不重复创建

---

# 7. 后端核心校验逻辑

## 7.1 模板校验

- 模板编码唯一
- 字段编码在模板内唯一
- 主键字段只能有一个
- 模板启用后不可再修改字段结构

## 7.2 数据库数据校验

- `dataJson` 字段必须符合模板定义
- 必填字段不能为空
- 主键字段不能为空
- 主键冲突时执行更新

## 7.3 项目校验

- 项目必须绑定模板
- 项目管理员必须是普通管理员
- 项目成员必须是项目管理员的子管理员

## 7.4 权限校验

- 项目管理员仅能操作自己负责项目
- 项目成员仅能访问自己参与项目
- 所有项目内操作需后端校验 `project_members`

---

# 8. 操作日志建议

建议记录以下操作：

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

建议 `module` 值新增：

- `TEMPLATE`
- `DATABASE_RECORD`
- `DATABASE_IMPORT`
- `PROJECT`
- `PROJECT_MEMBER`
- `PROJECT_RECORD`
- `PROJECT_IMPORT`

---

# 9. 前端开发设计

## 9.1 路由建议

建议新增以下一级菜单：

- `/templates`
- `/database-records`
- `/projects`

建议页面路由：

- `/templates`
- `/templates/create`
- `/templates/:id`
- `/database-records`
- `/database-records/create`
- `/database-records/:id`
- `/projects`
- `/projects/create`
- `/projects/:id`
- `/projects/:id/records`

---

## 9.2 页面结构建议

### 模板页

- 列表页：模板名称、编码、状态、字段数量、创建时间
- 新建页：基础信息 + 字段配置表单
- 详情页：基础信息 + 字段列表 + 复制模板

### 数据库数据页

- 列表页：模板筛选 + 关键字段展示
- 编辑页：根据模板动态渲染表单
- 导入弹窗：上传 Excel + 导入结果展示

### 项目页

- 列表页：项目名称、模板、管理员、状态、数据量
- 详情页：基础信息、成员列表、项目数据入口
- 成员弹窗：项目管理员和项目成员分开管理

### 项目数据页

- 列表页：展示项目数据关键字段
- 导入弹窗：从数据库数据列表选择并导入
- 编辑页：根据模板动态渲染表单

---

## 9.3 前端组件建议

建议抽取以下通用组件：

- `TemplateFieldBuilder`
- `DynamicDataForm`
- `ExcelImportDialog`
- `ProjectMemberDialog`
- `ProjectAdminAssignDialog`
- `DatabaseRecordPickerDialog`

---

# 10. 开发阶段建议

## 阶段一：后端数据模型与基础接口

- Prisma schema
- migration
- 模板接口
- 数据库数据接口
- 项目接口

## 阶段二：权限与导入逻辑

- 项目成员权限
- Excel 导入数据库数据
- 项目数据导入

## 阶段三：前端页面

- 模板管理页
- 数据库数据页
- 项目管理页
- 项目数据页

## 阶段四：联调与测试

- 权限联调
- 导入联调
- 边界测试

---

# 11. 测试重点

## 11.1 模板测试

- 字段结构冻结后不可修改
- 主键字段唯一
- 模板复制正确

## 11.2 导入测试

- Excel 列映射正确
- 主键存在时更新
- 主键不存在时新增
- 错误数据有明确失败原因

## 11.3 权限测试

- 超级管理员可管理全部项目
- 项目管理员只能看到自己负责项目
- 项目管理员只能分配自己子管理员
- 项目成员不可越权访问其他项目

## 11.4 项目数据测试

- 导入项目后生成副本
- 修改项目数据不影响数据库数据
- 同一数据可进入多个项目
- 同一项目中重复导入被正确拦截

---

# 12. 风险与注意事项

## 12.1 模板冻结后的维护风险

模板字段不可修改会提高后期变更成本，因此必须支持复制模板，否则模板演进会受阻。

## 12.2 动态表单复杂度

前端需要根据模板动态渲染表单，必须提前统一字段类型渲染协议。

## 12.3 导入性能

Excel 导入和项目批量导入在数据量大时可能较慢，第一版可同步处理，后续可升级为异步任务。

## 12.4 权限复杂度

系统角色、管理员上下级关系、项目角色三层权限叠加后，必须在后端集中实现统一校验方法，避免权限逻辑散落在多个 service 中。

---

# 13. 实施建议

建议先完成后端基础模型和 API，再做前端页面，原因如下：

- 模板驱动的数据结构会直接影响前端表单渲染
- 项目权限依赖后端接口定义
- 导入逻辑和数据副本模型需要先稳定

建议实施顺序：

1. Prisma 模型与 migration
2. 模板模块
3. 数据库数据模块
4. 项目和成员模块
5. 项目数据导入模块
6. 前端页面开发
7. 联调和测试
