# 生产部署说明（不使用 Docker）

本文档基于当前仓库结构编写：

- `backend/`：NestJS + Prisma + PostgreSQL
- `frontend/`：Vue 3 + Vite

推荐部署拓扑：

- 使用 `Nginx` 对外提供站点
- 前端构建产物由 `Nginx` 直接提供
- 后端以 `systemd` 服务方式运行在 `127.0.0.1:3001`
- `Nginx` 将 `/api` 反向代理到后端
- PostgreSQL 部署在本机或内网数据库服务器

之所以推荐前后端同域部署，是因为当前前端请求基址固定为 `/api`，开发环境依赖 Vite 代理，后端也没有启用跨域。生产环境如果改成前后端分域名，需要额外修改后端 CORS 配置。

## 1. 环境要求

建议服务器环境：

- Ubuntu 22.04 或 Ubuntu 24.04
- Node.js 20+
- pnpm 8+
- PostgreSQL 15+
- Nginx

建议至少准备：

- 2C4G 服务器
- 20GB 以上磁盘
- 可选域名，例如 `admin.example.com`

## 2. 项目运行原理

当前项目有两种常见访问方式：

- 有域名：`https://admin.example.com/`
- 无域名：`http://服务器公网IP/`

对应接口地址：

- 前端页面：`http://服务器公网IP/` 或 `https://admin.example.com/`
- 后端接口：`http://服务器公网IP/api/...` 或 `https://admin.example.com/api/...`
- Swagger 文档：`http://服务器公网IP/api-docs` 或 `https://admin.example.com/api-docs`

对应关系：

- 前端构建后的静态文件放在 `/var/www/hyenas`
- 后端服务监听在 `127.0.0.1:3001`
- Nginx 负责静态资源分发、SPA 路由回退和 API 反代
- 如果你有域名，再额外配置 HTTPS

## 3. 目录约定

本文档统一使用以下目录，便于后续维护：

- 项目目录：`/srv/hyenas-backend`
- 前端静态目录：`/var/www/hyenas`
- systemd 服务名：`hyenas-backend`

你也可以替换成自己的路径，但要保证后面的命令和配置同步调整。

## 4. 服务器初始化

### 4.1 安装基础软件

```bash
sudo apt update
sudo apt install -y curl git nginx postgresql postgresql-contrib
```

安装 Node.js 20：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

安装 pnpm：

```bash
sudo npm install -g pnpm
```

检查版本：

```bash
node -v
pnpm -v
nginx -v
psql --version
```

## 5. 拉取项目代码

```bash
cd /srv
sudo git clone <你的仓库地址> hyenas-backend
sudo chown -R $USER:$USER /srv/hyenas-backend
cd /srv/hyenas-backend
```

如果服务器已经配置了 SSH Key，推荐使用 SSH 地址：

```bash
git clone git@github.com:your-org/your-repo.git hyenas-backend
```

## 6. 初始化 PostgreSQL

### 6.1 创建数据库和用户

进入 PostgreSQL：

```bash
sudo -u postgres psql
```

执行：

```sql
CREATE USER hyenas_user WITH PASSWORD '请替换成强密码';
CREATE DATABASE merchants OWNER hyenas_user;
\q
```

### 6.2 检查连接

```bash
pg_isready -h 127.0.0.1 -p 5432
```

如果数据库不在本机，而是在内网其他机器，请把后续 `DATABASE_URL` 里的地址改成对应的数据库主机地址。

## 7. 配置后端环境变量

当前项目提供了示例文件：`backend/.env.example`。

在服务器上创建 `backend/.env`：

```bash
cd /srv/hyenas-backend/backend
cp .env.example .env
```

修改为：

```env
# Database
DATABASE_URL="postgresql://hyenas_user:请替换成强密码@127.0.0.1:5432/merchants?schema=public"

# JWT
JWT_SECRET="请替换成长度足够的随机字符串"
JWT_EXPIRES_IN="2h"
JWT_REFRESH_EXPIRES_IN="7d"

# App
PORT=3001
```

生成随机 JWT 密钥可以使用：

```bash
openssl rand -base64 32
```

## 8. 部署后端

### 8.1 安装依赖

```bash
cd /srv/hyenas-backend/backend
pnpm install --frozen-lockfile
```

如果执行过迁移或 `seed` 后出现 Prisma Client 类型缺失，可以手动补一次：

```bash
pnpm prisma generate
```

### 8.2 执行数据库迁移

生产环境使用：

```bash
pnpm prisma migrate deploy
```

不要在生产环境使用 `pnpm prisma migrate dev`。

### 8.3 初始化种子数据

首次部署建议执行一次：

```bash
pnpm prisma db seed
```

当前种子脚本会写入默认管理员账号：

- 用户名：`admin`
- 密码：`admin123`

上线后务必立即登录并修改密码。

### 8.4 构建后端

```bash
pnpm build
```

构建成功后，产物位于：

- `backend/dist`

### 8.5 手动验证后端

先手动启动一次，确认服务可用：

```bash
node dist/src/main.js
```

如果终端显示服务已启动，可访问：

- `http://127.0.0.1:3001/api-docs`

确认没问题后，按 `Ctrl+C` 停掉，继续配置 `systemd`。

## 9. 配置 systemd 托管后端

创建服务文件：

```bash
sudo nano /etc/systemd/system/hyenas-backend.service
```

填入以下内容：

```ini
[Unit]
Description=Hyenas Backend Service
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/srv/hyenas-backend/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/src/main.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

给后端目录授权：

```bash
sudo chown -R www-data:www-data /srv/hyenas-backend/backend
```

重新加载并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable hyenas-backend
sudo systemctl start hyenas-backend
```

查看状态：

```bash
sudo systemctl status hyenas-backend
```

查看实时日志：

```bash
sudo journalctl -u hyenas-backend -f
```

常用操作：

```bash
sudo systemctl restart hyenas-backend
sudo systemctl stop hyenas-backend
sudo systemctl start hyenas-backend
```

## 10. 部署前端

### 10.1 安装依赖并构建

```bash
cd /srv/hyenas-backend/frontend
pnpm install --frozen-lockfile
pnpm build
```

构建成功后，产物位于：

- `frontend/dist`

### 10.2 发布静态文件

```bash
sudo mkdir -p /var/www/hyenas
sudo cp -r /srv/hyenas-backend/frontend/dist/* /var/www/hyenas/
sudo chown -R www-data:www-data /var/www/hyenas
```

## 11. 配置 Nginx

### 11.1 创建站点配置

```bash
sudo nano /etc/nginx/sites-available/hyenas
```

如果你没有域名，直接用 IP 访问，填入以下配置：

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    root /var/www/hyenas;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api-docs {
        proxy_pass http://127.0.0.1:3001/api-docs;
        proxy_set_header Host $host;
    }

    location /api-json {
        proxy_pass http://127.0.0.1:3001/api-json;
        proxy_set_header Host $host;
    }
}
```

如果你有域名，只需要把上面的：

```nginx
server_name _;
```

改成：

```nginx
server_name admin.example.com;
```

### 11.2 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/hyenas /etc/nginx/sites-enabled/hyenas
sudo nginx -t
sudo systemctl reload nginx
```

如果 `/etc/nginx/sites-enabled/default` 会冲突，可以先删掉默认站点：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 12. 配置 HTTPS（可选）

只有在你已经绑定域名时，才建议配置 HTTPS。

如果你当前是直接用服务器 IP 访问，这一节可以先跳过，先使用：

- `http://服务器公网IP/`
- `http://服务器公网IP/api-docs`

安装 Certbot：

```bash
sudo apt install -y certbot python3-certbot-nginx
```

申请证书：

```bash
sudo certbot --nginx -d admin.example.com
```

测试自动续期：

```bash
sudo certbot renew --dry-run
```

## 13. 验证部署结果

完成后应至少验证以下地址：

- 无域名时：`http://服务器公网IP/`
- 无域名时：`http://服务器公网IP/api-docs`
- 有域名时：`https://admin.example.com/`
- 有域名时：`https://admin.example.com/api-docs`

登录验证：

- 账号：`admin`
- 密码：`admin123`

建议重点检查：

- 登录是否成功
- 商家列表是否能正常加载
- 新增或编辑是否能提交
- Swagger 是否可访问
- 浏览器刷新任意二级页面是否仍能打开

## 14. 后续更新发布流程

代码更新后，执行以下步骤：

### 14.1 更新后端

```bash
cd /srv/hyenas-backend
git pull

cd backend
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm build
sudo systemctl restart hyenas-backend
```

### 14.2 更新前端

```bash
cd /srv/hyenas-backend/frontend
pnpm install --frozen-lockfile
pnpm build
sudo rsync -av --delete dist/ /var/www/hyenas/
sudo systemctl reload nginx
```

如果你没有安装 `rsync`，可以先安装：

```bash
sudo apt install -y rsync
```

## 15. 常用排查命令

查看后端服务状态：

```bash
sudo systemctl status hyenas-backend
```

查看后端日志：

```bash
sudo journalctl -u hyenas-backend -n 200 --no-pager
```

查看 Nginx 日志：

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

查看端口监听：

```bash
sudo ss -lntp | grep 3001
sudo ss -lntp | grep 80
sudo ss -lntp | grep 443
```

检查数据库连接：

```bash
pg_isready -h 127.0.0.1 -p 5432
```

## 16. 常见问题

### 16.1 页面能打开，但接口全部 404

通常是 Nginx 没有把 `/api` 转发到后端，或者后端服务没启动。

优先检查：

```bash
sudo systemctl status hyenas-backend
sudo nginx -t
```

### 16.2 刷新页面后出现 404

通常是 Nginx 没配置 SPA 路由回退。确认 `location /` 中存在：

```nginx
try_files $uri $uri/ /index.html;
```

### 16.3 登录失败

优先检查是否执行过：

```bash
pnpm prisma db seed
```

如果已执行，但密码不确定，可直接在后台重置或重新写入种子数据。

### 16.4 Prisma 报数据库连接错误

优先检查：

- `backend/.env` 中的 `DATABASE_URL` 是否正确
- PostgreSQL 是否已启动
- 用户名、密码、数据库名是否存在

### 16.5 前后端想分开域名部署

可以做，但不是当前项目的最低成本方案。因为现在前端请求默认走相对路径 `/api`，后端也没有开启跨域。

如果你要分域名部署，需要至少完成两件事：

- 修改前端请求基址，改为完整接口域名
- 在 NestJS 中启用 `app.enableCors(...)`

### 16.6 启动时报 `EADDRINUSE`

这表示你配置的端口已被其他进程占用。

优先检查：

```bash
sudo ss -lntp | grep 3001
```

如果确认该端口已被其他服务使用，可以把 `backend/.env` 中的：

```env
PORT=3001
```

改成其他未占用端口，例如 `3002`，然后同步修改 Nginx 里的反代端口。

## 17. 安全建议

上线前至少完成以下事项：

- 修改默认管理员密码
- 将 `JWT_SECRET` 改为强随机字符串
- 只让后端监听内网地址或 `127.0.0.1`
- 有域名时优先配置 HTTPS
- 定期备份 PostgreSQL 数据库
- 为服务器开启防火墙，仅放行 `80/443`

例如使用 UFW：

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 18. 备份建议

数据库备份：

```bash
pg_dump -h 127.0.0.1 -U hyenas_user -d merchants > merchants.sql
```

恢复：

```bash
psql -h 127.0.0.1 -U hyenas_user -d merchants < merchants.sql
```

如果是正式生产环境，建议接入：

- 定时数据库备份
- 日志轮转
- 监控告警

## 19. 最简部署顺序汇总

如果你只想先尽快上线一版，可以按这个顺序做：

1. 安装 Node、pnpm、PostgreSQL、Nginx
2. 拉代码到 `/srv/hyenas-backend`
3. 创建数据库和用户
4. 配置 `backend/.env`
5. 执行后端依赖安装、迁移、种子、构建
6. 配置 `systemd` 并启动后端
7. 执行前端依赖安装和构建
8. 把 `frontend/dist` 发布到 `/var/www/hyenas`
9. 配置 Nginx
10. 有域名时再申请 HTTPS 证书

按这个流程完成后，项目即可在不使用 Docker 的前提下稳定运行。
