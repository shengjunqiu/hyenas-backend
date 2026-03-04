# 本地启动与联调说明（前后端）

适用仓库结构：

- `backend/`：NestJS 后端
- `frontend/`：Vue 3 前端

## 1. 环境准备

确保本机已安装：

- Node.js 20+（建议 LTS）
- pnpm 8+
- PostgreSQL（你当前是 `postgresql@15`）

## 2. 启动数据库

```bash
brew services start postgresql@15
```

检查是否可用：

```bash
pg_isready -h localhost -p 5432
```

如果你使用当前项目配置，数据库连接为：

```env
postgresql://shengjunqiu:password@localhost:5432/merchants?schema=public
```

## 3. 后端启动（开发模式）

在仓库根目录执行：

```bash
cd backend
pnpm install
pnpm prisma migrate dev
pnpm prisma db seed
pnpm start:dev
```

后端默认地址：

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`

默认账号（seed 后）：

- 用户名：`admin`
- 密码：`admin123`

## 4. 前端启动（开发模式）

新开一个终端，在仓库根目录执行：

```bash
cd frontend
pnpm install
pnpm dev
```

前端默认地址（Vite）：

- `http://localhost:5173`

前端已配置代理：

- `/api` -> `http://localhost:3000`

所以前端请求写 `/api/...` 即可联调后端。

## 5. 联调顺序建议

1. 先确认 PostgreSQL 可连接。
2. 启动后端，访问 Swagger 确认接口正常。
3. 启动前端，进入登录页。
4. 使用 `admin/admin123` 登录后，逐页联调：
   - 商家管理
   - 状态管理
   - 字段管理
   - 管理员管理
   - 操作日志

## 6. 常用命令

后端：

```bash
cd backend
pnpm lint
pnpm build
pnpm test
```

前端：

```bash
cd frontend
pnpm lint
pnpm build
```

## 7. 常见问题

1. 前端 401 / 自动跳登录页
- 通常是 token 失效或后端未启动。
- 先确认后端 `http://localhost:3000` 可访问。

2. Prisma 报 `P1001: Can't reach database server`
- PostgreSQL 没启动或端口不对。
- 检查 `pg_isready -h localhost -p 5432`。

3. 登录失败
- 先执行 `pnpm prisma db seed`，确认默认管理员已写入。

4. 前端接口 404
- 检查前端请求是否走 `/api/...`，以及 Vite 代理是否生效。

