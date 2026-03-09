# 前端开发任务文档 V2

## 项目信息

- **项目名称**: 数据库管理与项目管理系统 - 前端
- **技术栈**: Vue 3 + Element Plus + Pinia + Vite + TypeScript
- **包管理器**: pnpm
- **文档版本**: V2.0
- **更新日期**: 2026-03-09

---

## 阶段一：类型、路由和菜单基础建设

### 任务 1.1：补充业务类型定义

在 `frontend/src/types/index.ts` 中新增类型：

- `DataTemplate`
- `DataTemplateField`
- `DatabaseRecord`
- `DatabaseImportLog`
- `Project`
- `ProjectMember`
- `ProjectRecord`
- `ProjectImportResult`

建议补充枚举类型：

- `FieldType`
- `TemplateStatus`
- `ProjectStatus`
- `ProjectMemberRole`

**完成标准**:

- 类型可覆盖全部新页面和接口

---

### 任务 1.2：补充 API 封装

新增 API 文件：

- `src/api/template.ts`
- `src/api/database-record.ts`
- `src/api/project.ts`

建议接口方法：

`template.ts`

- `getTemplatesApi`
- `getTemplateDetailApi`
- `createTemplateApi`
- `copyTemplateApi`
- `updateTemplateApi`
- `toggleTemplateApi`
- `deleteTemplateApi`
- `deleteTemplateFieldApi`

`database-record.ts`

- `getDatabaseRecordsApi`
- `getDatabaseRecordDetailApi`
- `createDatabaseRecordApi`
- `updateDatabaseRecordApi`
- `deleteDatabaseRecordApi`
- `importDatabaseRecordsByExcelApi`
- `getDatabaseImportLogsApi`

`project.ts`

- `getProjectsApi`
- `getProjectDetailApi`
- `createProjectApi`
- `updateProjectApi`
- `deleteProjectApi`
- `assignProjectAdminApi`
- `getProjectMembersApi`
- `addProjectMemberApi`
- `removeProjectMemberApi`
- `getProjectRecordsApi`
- `getProjectRecordDetailApi`
- `updateProjectRecordApi`
- `deleteProjectRecordApi`
- `importProjectRecordsApi`

**完成标准**:

- 所有后端新接口都有对应 API 方法

---

### 任务 1.3：补充路由配置

在 `frontend/src/router/index.ts` 中新增路由：

- `/templates`
- `/templates/create`
- `/templates/:id`
- `/database-records`
- `/database-records/create`
- `/database-records/:id`
- `/database-records/:id/edit`
- `/projects`
- `/projects/create`
- `/projects/:id`
- `/projects/:id/edit`
- `/projects/:id/records`

路由权限建议：

- 模板管理：仅 `SUPER`
- 数据库管理：仅 `SUPER`
- 项目管理：`ALL`，但由后端返回数据范围控制

**完成标准**:

- 页面路由可访问
- 权限跳转逻辑正确

---

### 任务 1.4：更新侧边菜单

在 `frontend/src/layouts/AdminLayout.vue` 中新增菜单项：

| 菜单名称 | 路由 | 权限 |
|---|---|---|
| 模板管理 | `/templates` | SUPER |
| 数据库管理 | `/database-records` | SUPER |
| 项目管理 | `/projects` | ALL |

说明：

- 项目管理对项目管理员和项目成员也可见
- 模板管理和数据库管理仅超级管理员可见

**完成标准**:

- 菜单显示与角色一致

---

## 阶段二：模板管理页面

### 任务 2.1：实现模板列表页

创建 `src/pages/template/List.vue`。

页面功能：

- 搜索条件：模板名称、模板编码、状态
- 表格列：模板名称、编码、状态、字段数、创建时间、更新时间
- 操作：查看详情、复制模板、启用/停用、删除
- “新建模板”按钮

组件建议：

- 使用 `ElTable`
- 状态使用 `ElTag`
- 启用/停用用 `ElSwitch` 或操作按钮

**完成标准**:

- 可完成模板查询和操作入口跳转

---

### 任务 2.2：实现模板创建页

创建 `src/pages/template/Form.vue` 或 `Create.vue`。

页面结构：

1. 模板基础信息
- 模板名称
- 模板编码
- 模板说明

2. 字段配置区域
- 使用字段表格或可增删卡片
- 支持新增字段行
- 支持删除未提交字段
- 支持配置：
  - 字段名称
  - 字段编码
  - 字段类型
  - 是否必填
  - 是否主键
  - 是否列表展示
  - 是否可搜索
  - 默认值
  - 选项配置
  - 排序
  - 备注

前端校验：

- 至少一个字段
- 只能有一个主键字段
- 单选/多选必须有选项

**完成标准**:

- 可创建模板并提交字段定义

---

### 任务 2.3：实现模板详情页

创建 `src/pages/template/Detail.vue`。

展示内容：

- 模板基础信息
- 字段列表
- 来源模板信息

操作：

- 复制模板
- 删除字段
- 启用/停用模板

注意：

- 不提供字段编辑入口

**完成标准**:

- 模板信息完整展示
- 可完成复制和字段删除

---

### 任务 2.4：抽取模板字段构建组件

创建 `src/components/TemplateFieldBuilder.vue`。

能力要求：

- 支持字段行新增/删除
- 按字段类型动态显示不同配置项
- 对主键字段、选项字段做前端校验

**完成标准**:

- 模板新建页复用字段构建组件

---

## 阶段三：数据库数据管理页面

### 任务 3.1：实现数据库数据列表页

创建 `src/pages/database-record/List.vue`。

页面功能：

- 必选模板筛选
- 关键字搜索
- 主键值搜索
- 表格动态列展示
- 新建数据按钮
- Excel 导入按钮
- 查看详情、编辑、删除操作

关键点：

- 列表列需根据模板字段动态生成
- 默认展示主键字段和 `isListed = true` 的字段

**完成标准**:

- 可基于模板查看数据列表
- 动态列渲染正确

---

### 任务 3.2：实现数据库数据新增/编辑页

创建：

- `src/pages/database-record/Form.vue`

页面逻辑：

- 新增模式必须先选择模板
- 编辑模式加载已有数据和模板定义
- 根据模板动态渲染表单

动态表单渲染规则：

- `TEXT` -> `ElInput`
- `TEXTAREA` -> `ElInput type="textarea"`
- `NUMBER` -> `ElInputNumber`
- `DATE` -> `ElDatePicker`
- `SELECT` -> `ElSelect`
- `MULTI_SELECT` -> `ElSelect multiple`
- `BOOLEAN` -> `ElSwitch`

**完成标准**:

- 可新增和编辑数据库数据
- 动态字段渲染与提交正确

---

### 任务 3.3：实现数据库数据详情页

创建：

- `src/pages/database-record/Detail.vue`

展示内容：

- 模板信息
- 主键值
- 动态字段值
- 创建时间、更新时间、来源信息

**完成标准**:

- 数据详情展示清晰

---

### 任务 3.4：实现 Excel 导入弹窗

创建：

- `src/components/ExcelImportDialog.vue`

功能要求：

- 选择模板
- 上传 Excel 文件
- 提交导入
- 显示导入结果：
  - 总数
  - 新增数
  - 更新数
  - 失败数
  - 失败明细

**完成标准**:

- 数据库数据可通过 Excel 导入

---

### 任务 3.5：实现数据库导入日志页或弹窗

可选实现：

- 独立页面 `src/pages/database-record/ImportLogs.vue`
- 或在列表页中使用抽屉/弹窗

展示字段：

- 模板
- 文件名
- 操作人
- 导入时间
- 新增数
- 更新数
- 失败数

**完成标准**:

- 可查看导入历史

---

## 阶段四：项目管理页面

### 任务 4.1：实现项目列表页

创建 `src/pages/project/List.vue`。

页面功能：

- 搜索条件：项目名称、项目编号、模板、状态
- 表格列：项目名称、项目编号、模板、项目管理员、状态、数据量、创建时间
- 操作：查看详情、编辑、分配项目管理员、进入项目数据
- “新建项目”按钮仅超级管理员可见

权限要求：

- 超级管理员看全部项目
- 项目管理员和项目成员只看参与项目

**完成标准**:

- 项目列表可正常展示和筛选

---

### 任务 4.2：实现项目新增/编辑页

创建 `src/pages/project/Form.vue`。

页面字段：

- 项目名称
- 项目编号
- 绑定模板
- 项目描述
- 项目状态
- 开始时间
- 结束时间

规则：

- 新增时可选择模板
- 编辑时模板不可修改
- 项目管理员可编辑除模板外的基础信息

**完成标准**:

- 超级管理员可创建项目
- 项目管理员可编辑自己项目

---

### 任务 4.3：实现项目详情页

创建 `src/pages/project/Detail.vue`。

展示区域：

- 基础信息
- 绑定模板
- 项目管理员
- 项目成员
- 数据概览

操作：

- 分配项目管理员
- 管理项目成员
- 进入项目数据页

**完成标准**:

- 项目详情信息完整

---

### 任务 4.4：实现项目管理员分配弹窗

创建 `src/components/ProjectAdminAssignDialog.vue`。

功能要求：

- 仅超级管理员可打开
- 从普通管理员列表中选择项目管理员
- 显示当前项目管理员

**完成标准**:

- 可完成项目管理员分配和更换

---

### 任务 4.5：实现项目成员管理弹窗

创建 `src/components/ProjectMemberDialog.vue`。

功能要求：

- 项目管理员查看当前项目成员
- 添加成员
- 移除成员

权限逻辑：

- 项目管理员只能看到并选择自己名下子管理员
- 超级管理员可查看全量成员关系，是否直接操作可按后端能力决定

**完成标准**:

- 项目成员管理流程完整

---

## 阶段五：项目数据管理页面

### 任务 5.1：实现项目数据列表页

创建 `src/pages/project-record/List.vue`。

页面功能：

- 展示当前项目信息和模板信息
- 按动态字段展示项目数据列表
- 搜索关键字
- 查看详情
- 编辑
- 删除
- 从数据库导入数据

关键点：

- 动态列规则与数据库数据列表一致
- 数据范围仅为当前项目

**完成标准**:

- 项目数据列表正常展示

---

### 任务 5.2：实现项目数据详情页

可选：

- 独立页 `src/pages/project-record/Detail.vue`
- 或在列表页中使用抽屉展示

展示内容：

- 来源数据库数据 ID
- 来源主键值
- 动态字段值
- 导入时间
- 更新时间

**完成标准**:

- 可查看项目数据详情

---

### 任务 5.3：实现项目数据编辑能力

创建或复用动态表单组件：

- `src/components/DynamicDataForm.vue`

要求：

- 与数据库数据表单共用模板字段渲染逻辑
- 提交到项目数据更新接口
- 编辑仅影响项目副本数据

**完成标准**:

- 项目数据可独立编辑

---

### 任务 5.4：实现数据库数据选择导入弹窗

创建：

- `src/components/DatabaseRecordPickerDialog.vue`

功能要求：

- 按项目绑定模板自动过滤数据库数据
- 支持多选
- 支持搜索
- 提交后调用项目导入接口
- 返回导入结果统计

**完成标准**:

- 可从数据库选择数据导入项目

---

## 阶段六：通用能力抽取

### 任务 6.1：抽取动态数据表单组件

创建：

- `src/components/DynamicDataForm.vue`

职责：

- 根据模板字段定义渲染表单
- 管理表单数据
- 输出标准化 `dataJson`

供以下页面复用：

- 数据库数据新增/编辑
- 项目数据编辑

**完成标准**:

- 避免多页面重复实现动态字段渲染

---

### 任务 6.2：抽取动态表格列生成逻辑

建议：

- 创建组合式函数 `useDynamicColumns`
- 或工具函数 `buildTemplateColumns`

供以下页面复用：

- 数据库数据列表
- 项目数据列表

**完成标准**:

- 动态列逻辑统一

---

## 阶段七：权限与交互收口

### 任务 7.1：菜单与按钮权限控制

检查点：

- 模板管理按钮仅超级管理员可见
- 数据库管理按钮仅超级管理员可见
- 项目新建按钮仅超级管理员可见
- 项目管理员分配按钮仅超级管理员可见
- 项目成员管理按钮仅项目管理员可见

**完成标准**:

- 前端可见性与后端权限一致

---

### 任务 7.2：空态、错误态和成功提示

要求：

- 导入结果提示清晰
- 无权限时提示明确
- 无数据时展示引导文案
- 动态模板无字段时提示模板异常

**完成标准**:

- 页面交互完整

---

## 阶段八：联调与验收

### 任务 8.1：接口联调

重点联调：

- 模板创建与详情
- 数据库数据动态表单
- Excel 导入
- 项目创建与管理员分配
- 项目成员分配
- 项目数据导入

**完成标准**:

- 核心流程可完整跑通

---

### 任务 8.2：场景验收

验收场景建议：

1. 超级管理员创建模板并新增字段
2. 超级管理员导入数据库数据
3. 超级管理员创建项目并绑定模板
4. 超级管理员分配项目管理员
5. 项目管理员分配自己子管理员为项目成员
6. 项目管理员从数据库导入项目数据
7. 项目成员编辑项目内数据
8. 确认不影响数据库原始数据

**完成标准**:

- 关键业务链路全部通过

---

## 建议交付顺序

1. 类型与 API
2. 菜单与路由
3. 模板管理页
4. 数据库数据页
5. Excel 导入弹窗
6. 项目管理页
7. 项目成员与管理员弹窗
8. 项目数据页
9. 联调与收口
