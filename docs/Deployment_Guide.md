# WeCreator 部署说明书 V1.0

> **文档版本:** V1.0 · 2026-04-19
> **对应代码版本:** Git `567954a` · PRD V3.7
> **适用环境:** CentOS 8+ / Ubuntu 22.04+ / Debian 12+

---

## 目录

1. [系统架构总览](#1-系统架构总览)
2. [服务器要求](#2-服务器要求)
3. [快速部署（Docker Compose 一键启动）](#3-快速部署docker-compose-一键启动)
4. [分步部署详解](#4-分步部署详解)
5. [SSL 证书配置](#5-ssl-证书配置)
6. [数据库初始化与迁移](#6-数据库初始化与迁移)
7. [零工端微信小程序发布](#7-零工端微信小程序发布)
8. [环境变量完整参考](#8-环境变量完整参考)
9. [健康检查与监控](#9-健康检查与监控)
10. [日志管理](#10-日志管理)
11. [备份与恢复](#11-备份与恢复)
12. [常见问题排查](#12-常见问题排查)
13. [安全加固清单](#13-安全加固清单)
14. [附录：端口清单与域名规划](#14-附录端口清单与域名规划)

---

## 1. 系统架构总览

```
                    ┌─────────────────────────────────────────┐
                    │              Nginx (443/80)              │
                    │   SSL 终止 · 静态托管 · 反向代理 · 限速  │
                    └────┬──────────┬──────────┬──────────────┘
                         │          │          │
              ┌──────────┘   ┌──────┘   ┌──────┘
              ▼              ▼          ▼
     admin.wecreator.cn  ops.wecreator.cn  api.wecreator.cn
     (企业 PC 后台)      (运营后台)        (API 网关/小程序)
     Vue3 静态文件       Vue3 静态文件      ↓
                                           ▼
                               ┌────────────────────┐
                               │  NestJS Backend     │
                               │  Port 3000          │
                               │  125 API · 19 模块  │
                               └──┬──────┬───────┬───┘
                                  │      │       │
                    ┌─────────────┘      │       └────────────┐
                    ▼                    ▼                    ▼
            ┌───────────┐      ┌──────────────┐      ┌──────────┐
            │  MySQL 8.0 │      │  Redis 7.x   │      │ MongoDB  │
            │  41 张表    │      │  缓存+分布式锁 │      │ 6.0      │
            │  Port 3306 │      │  Port 6379   │      │ IM 消息   │
            └───────────┘      └──────────────┘      │ Port 27017│
                                                      └──────────┘
```

**应用组件清单：**

| 组件 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| Backend API | NestJS 11 + Prisma 6 | 3000 | 后端核心，125 个 API |
| PC Admin | Vue 3 + Ant Design Vue 4 | Nginx 443 | 企业管理后台 (26+ 页) |
| Platform Admin | Vue 3 + Ant Design Vue 4 | Nginx 443 | 平台运营后台 (12 页) |
| Worker Mini-Program | Taro 4 + React 19 | — | 零工端微信小程序 (26 页) |
| MySQL | 8.0 | 3306 | 主数据库（41 表 · 51 枚举） |
| Redis | 7.x Alpine | 6379 | 缓存 + 分布式锁 + 会话 |
| MongoDB | 6.0 | 27017 | IM 消息 + AI 对话记录存储 |
| Nginx | 1.27 Alpine | 80/443 | 反向代理 + 静态托管 + SSL |

---

## 2. 服务器要求

### 2.1 最低配置（单机部署）

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 40 GB SSD | 100 GB SSD |
| 带宽 | 5 Mbps | 10 Mbps+ |
| 操作系统 | Ubuntu 22.04 LTS / CentOS 8+ | Ubuntu 22.04 LTS |

### 2.2 软件依赖

| 软件 | 最低版本 | 安装方式 |
|------|---------|---------|
| Docker | 24.0+ | [官方文档](https://docs.docker.com/engine/install/) |
| Docker Compose | 2.20+ | Docker Desktop 自带 / 单独安装 |
| Git | 2.30+ | `apt install git` / `yum install git` |

> **提示：** 如果服务器已安装 Docker Desktop（含 Compose V2），无需额外安装。

### 2.3 域名与 DNS

需要 3 个子域名，均指向服务器公网 IP：

| 域名 | 用途 |
|------|------|
| `admin.wecreator.cn` | 企业 PC 后台 |
| `ops.wecreator.cn` | 平台运营后台 |
| `api.wecreator.cn` | API 网关（小程序 + 开放接口） |

---

## 3. 快速部署（Docker Compose 一键启动）

适合首次部署，约 10 分钟完成。

### Step 1: 克隆代码

```bash
git clone https://your-git-server/wecreator.git /opt/wecreator
cd /opt/wecreator
```

### Step 2: 准备环境变量

```bash
cp docker/.env.production.example docker/.env.production

# 编辑环境变量（必须填写所有 <xxx> 占位符）
vi docker/.env.production
```

**快速生成密钥：**

```bash
# 数据库密码
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -base64 24)"
echo "MYSQL_PASSWORD=$(openssl rand -base64 24)"
echo "REDIS_PASSWORD=$(openssl rand -base64 24)"
echo "MONGO_PASSWORD=$(openssl rand -base64 24)"

# JWT 密钥
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"

# AES 密钥
echo "AES_KEY=$(openssl rand -hex 16)"
echo "AES_IV=$(openssl rand -hex 8)"
```

### Step 3: 准备 SSL 证书

```bash
mkdir -p docker/nginx/ssl

# 将 SSL 证书文件放入（PEM 格式）:
# docker/nginx/ssl/admin.wecreator.cn.pem
# docker/nginx/ssl/admin.wecreator.cn.key
# docker/nginx/ssl/ops.wecreator.cn.pem
# docker/nginx/ssl/ops.wecreator.cn.key
# docker/nginx/ssl/api.wecreator.cn.pem
# docker/nginx/ssl/api.wecreator.cn.key
```

### Step 4: 构建并启动

```bash
cd /opt/wecreator

# 构建所有镜像
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  build

# 启动（后台运行）
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  up -d

# 查看启动状态
docker compose -f docker/docker-compose.prod.yml ps
```

### Step 5: 数据库迁移

```bash
# 进入后端容器执行 Prisma 迁移
docker exec -it wc-backend sh -c \
  "cd apps/backend && npx prisma migrate deploy"
```

### Step 6: 验证

```bash
# 检查后端健康
curl -s http://localhost:3000/api/v1/health

# 检查 Nginx
curl -s -o /dev/null -w "%{http_code}" https://admin.wecreator.cn

# 检查所有容器
docker compose -f docker/docker-compose.prod.yml ps
```

**期望输出：** 所有容器状态为 `Up (healthy)`。

---

## 4. 分步部署详解

### 4.1 基础设施层（数据库三件套）

如果已有独立的 MySQL/Redis/MongoDB 实例（如云数据库 RDS），可跳过此步，直接在环境变量中配置连接地址。

```bash
# 仅启动数据库服务
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  up -d mysql redis mongodb

# 等待健康检查通过
docker compose -f docker/docker-compose.prod.yml \
  ps --format "table {{.Name}}\t{{.Status}}"
```

### 4.2 后端 API 部署

```bash
# 构建后端镜像
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  build backend

# 启动
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  up -d backend

# 数据库迁移
docker exec -it wc-backend sh -c \
  "cd apps/backend && npx prisma migrate deploy"

# 验证
curl http://localhost:3000/api/v1/health
```

### 4.3 前端构建与 Nginx

```bash
# 构建前端镜像（会自动输出静态文件到共享 volume）
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  build pc-admin-build platform-admin-build

# 运行构建容器（一次性任务）
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  up pc-admin-build platform-admin-build

# 启动 Nginx
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  up -d nginx
```

### 4.4 不使用 Docker 的裸机部署

如需裸机部署（不推荐），参考以下步骤：

```bash
# 1. 安装 Node.js 20 LTS + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
corepack enable && corepack prepare pnpm@10 --activate

# 2. 安装依赖
cd /opt/wecreator
pnpm install --frozen-lockfile

# 3. 构建共享包
cd packages/shared && pnpm run typecheck

# 4. 构建后端
cd apps/backend
cp .env.example .env  # 编辑填写生产配置
pnpm dlx prisma generate
pnpm run build

# 5. 构建前端
cd apps/pc-admin && pnpm run build      # 输出 → dist/
cd apps/platform-admin && pnpm run build # 输出 → dist/

# 6. 启动后端（推荐用 PM2）
npm install -g pm2
cd apps/backend
NODE_ENV=production pm2 start dist/main.js --name wc-api -i 2

# 7. 配置 Nginx 指向前端 dist 目录和后端端口
```

---

## 5. SSL 证书配置

### 5.1 使用 Let's Encrypt（免费）

```bash
# 安装 certbot
sudo apt install certbot

# 申请证书（先确保 80 端口可访问，暂停 Nginx）
sudo certbot certonly --standalone \
  -d admin.wecreator.cn \
  -d ops.wecreator.cn \
  -d api.wecreator.cn

# 证书位于 /etc/letsencrypt/live/<domain>/
# fullchain.pem → .pem 文件
# privkey.pem   → .key 文件

# 复制到 Docker 挂载目录
for domain in admin.wecreator.cn ops.wecreator.cn api.wecreator.cn; do
  sudo cp /etc/letsencrypt/live/$domain/fullchain.pem docker/nginx/ssl/$domain.pem
  sudo cp /etc/letsencrypt/live/$domain/privkey.pem docker/nginx/ssl/$domain.key
done

# 设置自动续期 crontab
0 0 1 * * certbot renew --quiet && docker exec wc-nginx nginx -s reload
```

### 5.2 使用云厂商 SSL（推荐生产）

阿里云/腾讯云免费 SSL 或付费 DV/OV 证书，下载 Nginx 格式后放入 `docker/nginx/ssl/`。

### 5.3 自签名证书（仅测试）

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/admin.wecreator.cn.key \
  -out docker/nginx/ssl/admin.wecreator.cn.pem \
  -subj "/CN=admin.wecreator.cn"
```

---

## 6. 数据库初始化与迁移

### 6.1 Prisma 迁移

```bash
# 首次部署 — 执行所有迁移
docker exec -it wc-backend sh -c \
  "cd apps/backend && npx prisma migrate deploy"

# 查看迁移状态
docker exec -it wc-backend sh -c \
  "cd apps/backend && npx prisma migrate status"
```

**现有迁移记录（6 个）：**

| 迁移 | 说明 |
|------|------|
| `20260416063913_init_all_tables` | 初始全量建表（41 张表） |
| `20260417095642_add_platform_admin` | 平台管理后台表 |
| `20260417104715_v3_3_marketplace_applications` | 服务广场 + 报名 |
| `20260417161731_v3_4_worker_pool_and_review_fields` | 零工库 + 评价 |
| `20260418049900_v2_prd_full_alignment` | PRD V3.6 全量对齐 |
| `20260418_r9_phone_hash_index` | 手机号 Hash 安全索引 |

### 6.2 初始化种子数据

首次部署后需要创建平台超级管理员和企业测试账号。

**方法 A — 通过 API 注册（推荐）：**

1. 部署完成后访问 `https://admin.wecreator.cn/register` 注册第一个企业账号
2. 在数据库中将该账号的 `role` 修改为 `super_admin`

**方法 B — 直接写入数据库：**

```bash
docker exec -it wc-mysql mysql -u wcadmin -p${MYSQL_PASSWORD} wecreator
```

```sql
-- 创建平台超级管理员
INSERT INTO platform_users (username, password_hash, role, is_active, created_at, updated_at)
VALUES ('admin', '<bcrypt_hash>', 'super_admin', true, NOW(), NOW());

-- bcrypt hash 生成方法:
-- node -e "console.log(require('bcryptjs').hashSync('your_password', 10))"
```

### 6.3 后续版本升级流程

```bash
# 1. 拉取新代码
cd /opt/wecreator && git pull

# 2. 重新构建镜像
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  build backend pc-admin-build platform-admin-build

# 3. 执行数据库迁移
docker exec -it wc-backend sh -c \
  "cd apps/backend && npx prisma migrate deploy"

# 4. 滚动重启
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  up -d --no-deps backend

# 5. 更新前端静态文件
docker compose -f docker/docker-compose.prod.yml \
  --env-file docker/.env.production \
  up pc-admin-build platform-admin-build
docker exec wc-nginx nginx -s reload

# 6. 验证
curl -s http://localhost:3000/api/v1/health
```

---

## 7. 零工端微信小程序发布

小程序不通过 Docker 部署，需通过微信开发者工具上传。

### 7.1 构建

```bash
cd /opt/wecreator

# 安装依赖（如未安装）
pnpm install --frozen-lockfile

# 生产构建
cd apps/worker-mp
pnpm run build:weapp:prod
# 输出目录: dist/
```

### 7.2 配置

确认 `apps/worker-mp/.env.production`：

```env
TARO_APP_API_BASE=https://api.wecreator.cn/api/v1
```

### 7.3 上传审核

1. 打开 **微信开发者工具**
2. 导入项目：选择 `apps/worker-mp/dist/` 目录
3. 填写小程序 AppID
4. 点击 **上传** → 填写版本号和描述
5. 登录 **微信公众平台** → 版本管理 → 提交审核

### 7.4 小程序服务器域名配置

微信公众平台 → 开发管理 → 开发设置 → 服务器域名：

| 类型 | 域名 |
|------|------|
| request 合法域名 | `https://api.wecreator.cn` |
| socket 合法域名 | `wss://api.wecreator.cn` |
| uploadFile 合法域名 | `https://api.wecreator.cn` |
| downloadFile 合法域名 | `https://<OSS_BUCKET>.<OSS_REGION>.aliyuncs.com` |

---

## 8. 环境变量完整参考

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `MYSQL_ROOT_PASSWORD` | ✅ | — | MySQL root 密码 |
| `MYSQL_DATABASE` | ❌ | wecreator | 数据库名 |
| `MYSQL_USER` | ❌ | wcadmin | 数据库用户 |
| `MYSQL_PASSWORD` | ✅ | — | 数据库用户密码 |
| `REDIS_PASSWORD` | ✅ | — | Redis 密码 |
| `MONGO_USER` | ❌ | wcadmin | MongoDB 用户 |
| `MONGO_PASSWORD` | ✅ | — | MongoDB 密码 |
| `MONGO_DATABASE` | ❌ | wecreator_msg | MongoDB 数据库名 |
| `JWT_SECRET` | ✅ | — | JWT 签名密钥（≥32 字符） |
| `JWT_ACCESS_EXPIRES` | ❌ | 2h | Access Token 有效期 |
| `JWT_REFRESH_SECRET` | ✅ | — | Refresh Token 密钥（须与 JWT_SECRET 不同） |
| `JWT_REFRESH_EXPIRES` | ❌ | 7d | Refresh Token 有效期 |
| `AES_KEY` | ✅ | — | AES-256 密钥（恰好 32 字节） |
| `AES_IV` | ✅ | — | AES IV（恰好 16 字节） |
| `WECHAT_APPID` | ✅ | — | 微信小程序 AppID |
| `WECHAT_SECRET` | ✅ | — | 微信小程序 AppSecret |
| `OSS_BUCKET` | ✅ | — | 阿里云 OSS Bucket 名称 |
| `OSS_REGION` | ✅ | — | OSS 地域（如 oss-cn-hangzhou） |
| `OSS_ACCESS_KEY` | ✅ | — | 阿里云 RAM AccessKey |
| `OSS_SECRET` | ✅ | — | 阿里云 RAM SecretKey |

---

## 9. 健康检查与监控

### 9.1 健康检查端点

```bash
# 后端存活检查
curl http://localhost:3000/api/v1/health
# 期望返回: { "code": 0, "data": { "status": "ok" } }
```

### 9.2 Docker 健康状态

```bash
# 查看所有服务状态
docker compose -f docker/docker-compose.prod.yml ps

# 查看单个容器健康详情
docker inspect --format='{{json .State.Health}}' wc-backend | python3 -m json.tool
```

### 9.3 推荐监控方案

| 监控维度 | 工具建议 | 说明 |
|---------|---------|------|
| 容器状态 | Docker healthcheck | 已在 Compose 中配置 |
| 服务器资源 | Prometheus + Node Exporter | CPU/内存/磁盘/网络 |
| 应用日志 | ELK / Loki + Grafana | 后端日志聚合 |
| 数据库 | Percona Monitoring Tools | MySQL 慢查询/连接数 |
| 可用性 | UptimeRobot / 阿里云云监控 | HTTPS 拨测 |

---

## 10. 日志管理

### 10.1 查看日志

```bash
# 后端日志（实时跟踪）
docker logs wc-backend -f --tail 100

# Nginx 访问日志
docker exec wc-nginx tail -f /var/log/nginx/access.log

# MySQL 慢查询
docker exec wc-mysql tail -f /var/log/mysql/slow.log

# 所有服务日志
docker compose -f docker/docker-compose.prod.yml logs -f
```

### 10.2 日志轮转

Docker 默认日志驱动为 `json-file`，建议配置轮转：

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

修改后重启 Docker：`sudo systemctl restart docker`

---

## 11. 备份与恢复

### 11.1 自动备份

项目已包含备份脚本 `scripts/backup-db.sh`，配置 crontab 自动执行：

```bash
# 每天凌晨 3 点执行
0 3 * * * /opt/wecreator/scripts/backup-db.sh >> /var/log/wecreator/backup.log 2>&1
```

**备份内容：**
- MySQL: `mysqldump --single-transaction` (gzip 压缩)
- MongoDB: `mongodump --gzip`
- Redis: RDB 快照复制
- 默认保留 30 天

### 11.2 手动备份

```bash
# MySQL
docker exec wc-mysql mysqldump -u wcadmin -p${MYSQL_PASSWORD} wecreator \
  --single-transaction | gzip > backup_$(date +%Y%m%d).sql.gz

# MongoDB
docker exec wc-mongodb mongodump \
  --db wecreator_msg --gzip --archive=/tmp/mongo_backup.gz
docker cp wc-mongodb:/tmp/mongo_backup.gz ./
```

### 11.3 恢复

```bash
# MySQL 恢复
gunzip < backup_20260419.sql.gz | \
  docker exec -i wc-mysql mysql -u wcadmin -p${MYSQL_PASSWORD} wecreator

# MongoDB 恢复
docker cp mongo_backup.gz wc-mongodb:/tmp/
docker exec wc-mongodb mongorestore \
  --db wecreator_msg --gzip --archive=/tmp/mongo_backup.gz
```

---

## 12. 常见问题排查

### Q1: 后端启动失败 — 数据库连接拒绝

```
Error: Can't reach database server at `mysql:3306`
```

**原因：** MySQL 容器尚未就绪。
**解决：** `docker-compose.prod.yml` 已配置 `depends_on` + `healthcheck`，确认 MySQL 健康后再启动后端：

```bash
docker compose -f docker/docker-compose.prod.yml ps mysql
# 确认状态为 Up (healthy)
```

### Q2: Prisma 迁移失败

```
Error: P3009 migrate found failed migrations
```

**解决：**

```bash
# 查看迁移状态
docker exec -it wc-backend sh -c "cd apps/backend && npx prisma migrate status"

# 标记失败迁移为已解决（确认数据库已到对应状态后执行）
docker exec -it wc-backend sh -c \
  "cd apps/backend && npx prisma migrate resolve --applied <迁移名>"
```

### Q3: Nginx 502 Bad Gateway

**原因：** 后端未启动或端口不匹配。
**排查：**

```bash
# 1. 确认后端运行
docker logs wc-backend --tail 20

# 2. 确认网络连通
docker exec wc-nginx wget -qO- http://backend:3000/api/v1/health

# 3. 确认 Nginx 配置语法
docker exec wc-nginx nginx -t
```

### Q4: WebSocket 连接失败

**原因：** Nginx 未正确代理 WebSocket。
**确认：** `nginx.conf` 中 `/socket.io/` 路由必须包含 `Upgrade` 和 `Connection` 头（已配置）。

### Q5: 小程序请求失败

**原因：** 域名未在微信公众平台配置白名单。
**解决：** 参照 [§7.4 小程序服务器域名配置](#74-小程序服务器域名配置) 添加域名白名单。

### Q6: 文件上传失败 413 Request Entity Too Large

**原因：** Nginx 请求体大小限制。
**解决：** 确认 `nginx.conf` 中 `client_max_body_size` 至少为 `50m`（已配置）。

### Q7: DATABASE_URL 中密码含特殊字符

**原因：** 密码中的 `@`、`#` 等字符需 URL 编码。
**解决：** `@` → `%40`, `#` → `%23`。建议生成密码时避免特殊字符。

---

## 13. 安全加固清单

### 部署前必做 ✅

- [ ] **修改所有默认密码** — 数据库、Redis、MongoDB 不得使用示例密码
- [ ] **生成随机 JWT 密钥** — `openssl rand -hex 32`，至少 32 字符
- [ ] **生成随机 AES 密钥** — 用于手机号和身份证加密
- [ ] **关闭 Swagger** — 生产环境 `NODE_ENV=production` 自动禁用
- [ ] **开启 HTTPS** — 全站强制 HTTPS，HTTP 自动跳转
- [ ] **防火墙规则** — 仅开放 80/443，数据库端口不对外暴露
- [ ] **Nginx 限速** — 已在 `nginx.conf` 中配置 `limit_req 30r/s`
- [ ] **Helmet 安全头** — 后端已集成 Helmet 中间件

### 定期检查 🔄

- [ ] SSL 证书续期（Let's Encrypt 90 天有效期）
- [ ] 依赖安全更新：`pnpm audit`
- [ ] 数据库备份验证（每月恢复测试一次）
- [ ] 日志审计（异常登录、大额操作）
- [ ] Docker 镜像安全扫描：`docker scout`

### 网络隔离建议

```yaml
# docker-compose.prod.yml 中数据库端口仅内部访问（去掉 ports 映射）
mysql:
  # ports:            # 注释掉，不对外暴露
  #   - "3306:3306"
redis:
  # ports:
  #   - "6379:6379"
mongodb:
  # ports:
  #   - "27017:27017"
```

如确实需要远程连接数据库，可绑定到本机：

```yaml
ports:
  - "127.0.0.1:3306:3306"  # 仅本机可访问，配合 SSH 隧道使用
```

---

## 14. 附录：端口清单与域名规划

### 14.1 端口清单

| 端口 | 服务 | 对外 | 说明 |
|------|------|:----:|------|
| 80 | Nginx | ✅ | HTTP → HTTPS 重定向 |
| 443 | Nginx | ✅ | HTTPS 主入口 |
| 3000 | Backend | ❌ | NestJS API（仅容器内部） |
| 3306 | MySQL | ❌ | 主数据库（建议仅本机） |
| 6379 | Redis | ❌ | 缓存（建议仅本机） |
| 27017 | MongoDB | ❌ | 消息存储（建议仅本机） |

### 14.2 域名规划

| 域名 | 用途 | 对应服务 |
|------|------|---------|
| `admin.wecreator.cn` | 企业 PC 后台 | Nginx → pc-admin 静态 + /api → backend |
| `ops.wecreator.cn` | 平台运营后台 | Nginx → platform-admin 静态 + /api → backend |
| `api.wecreator.cn` | API 网关 | Nginx → backend（小程序/开放接口） |

### 14.3 项目文件结构（部署相关）

```
wecreator/
├── apps/
│   ├── backend/
│   │   ├── Dockerfile              ← 后端多阶段构建
│   │   ├── prisma/
│   │   │   ├── schema.prisma          ← 41张表定义
│   │   │   └── migrations/            ← 6个迁移
│   │   └── .env.example            ← 环境变量模板
│   ├── pc-admin/
│   │   └── Dockerfile              ← 企业端前端构建
│   ├── platform-admin/
│   │   └── Dockerfile              ← 运营端前端构建
│   └── worker-mp/
│       ├── .env.production         ← 小程序生产API地址
│       └── dist/                   ← 构建输出(导入微信开发者工具)
├── docker/
│   ├── docker-compose.yml      ← 开发环境(MySQL+Redis+MongoDB)
│   ├── docker-compose.prod.yml ← 生产环境(全组件)
│   ├── .env.production.example ← 生产环境变量模板
│   ├── nginx/
│   │   ├── nginx.conf              ← Nginx 反向代理配置
│   │   └── ssl/                    ← SSL 证书目录
│   └── mysql-conf/
│       └── wecreator.cnf           ← MySQL 生产优化配置
├── scripts/
│   └── backup-db.sh            ← 数据库自动备份脚本
└── .dockerignore               ← Docker 构建排除规则
```

---

> **文档版本:** V1.0 · 2026-04-19
> **对应代码:** WeCreator PRD V3.7 · 125 API · 41 表 · 51 枚举
> **应用组件:** Backend + PC Admin + Platform Admin + Worker MP + MySQL + Redis + MongoDB + Nginx