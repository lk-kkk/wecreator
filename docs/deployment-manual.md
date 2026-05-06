# WeCreator 部署手册

> **最后更新**: 2026-04-29  
> **文档版本**: v1.0

---

## 1. 服务器信息

| 项目 | 值 |
|------|------|
| **IP 地址** | 47.95.66.155 |
| **操作系统** | CentOS / Alibaba Cloud Linux |
| **用户名** | root |
| **部署路径** | `/root/wecreator/` |
| **SSH Key** | `~/.ssh/wc_deploy_ed25519` (本地) |
| **Docker** | Docker Compose v2 |

---

## 2. 项目架构

```
WeCreator (pnpm monorepo)
├── apps/
│   ├── backend/          # NestJS 11 + Prisma 6 API 服务
│   ├── pc-admin/         # Vue 3 + Vite — PC 企业后台
│   ├── platform-admin/   # Vue 3 + Vite — 平台运营后台
│   └── worker-mp/        # 微信小程序（独立部署）
├── packages/
│   └── shared/           # 公共类型/工具库
└── docker/
    ├── docker-compose.prod.yml   # 生产环境编排
    ├── .env.prod                 # 生产环境变量（不入 git）
    ├── nginx/nginx.conf          # Nginx 配置
    ├── mysql-conf/               # MySQL 配置
    └── init-sql/                 # 初始化 SQL
```

### 容器服务

| 容器名 | 镜像 | 端口 | 用途 |
|--------|------|------|------|
| `wc-backend` | 自建 (Node 20) | 3000 (内网) | NestJS API |
| `wc-nginx` | nginx:1.27-alpine | 8080/8081/8088 | 反向代理+静态 |
| `wc-mysql` | mysql:8.0 | 3306 (内网) | 主数据库 |
| `wc-redis` | redis:7-alpine | 6379 (内网) | 缓存/锁 |
| `wc-mongodb` | mongo:6.0 | 27017 (内网) | 消息存储 |
| `wc-pc-build` | 自建 | — | PC 前端构建产物 |
| `wc-platform-build` | 自建 | — | 平台前端构建产物 |

### 访问地址

| 服务 | URL |
|------|-----|
| **PC 企业后台** | http://47.95.66.155:8080 |
| **平台运营后台** | http://47.95.66.155:8081 |
| **API 网关** (小程序用) | http://47.95.66.155:8088/api/v1/ |

---

## 3. 快速部署（一键脚本）

### 前置条件

- 本地已安装 `rsync`、`ssh`
- SSH 密钥 `~/.ssh/wc_deploy_ed25519` 已配置到服务器

### 部署命令

```bash
# 项目根目录下执行
cd /Users/lk/we创客/wecreator

# 全量部署（后端 + 前端）
bash deploy.sh all

# 仅部署后端
bash deploy.sh backend

# 仅部署前端
bash deploy.sh frontend
```

### 脚本做了什么

1. **Rsync 同步代码** → 排除 node_modules/.git/dist 等
2. **Docker 构建镜像** → 多阶段构建，自动安装依赖
3. **重启容器** → `docker compose up -d`
4. **数据库迁移** → `prisma db push`
5. **清理旧镜像** → `docker image prune -f`
6. **验证服务** → 输出容器状态表

---

## 4. 手动部署步骤

### Step 1: 同步代码

```bash
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.pnpm-store' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude 'docker/.env.prod' \
  --exclude 'docker/.env' \
  --exclude 'sessions' \
  --exclude '.DS_Store' \
  -e "ssh -i ~/.ssh/wc_deploy_ed25519 -o StrictHostKeyChecking=no" \
  /Users/lk/we创客/wecreator/ root@47.95.66.155:/root/wecreator/
```

### Step 2: SSH 到服务器

```bash
ssh -i ~/.ssh/wc_deploy_ed25519 root@47.95.66.155
cd /root/wecreator
```

### Step 3: 构建镜像

```bash
# 构建全部
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build

# 仅构建后端
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build backend

# 仅构建前端
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build pc-admin-build platform-admin-build
```

### Step 4: 启动/重启服务

```bash
# 启动全部服务
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d

# 仅重启后端
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d backend

# 仅重启 nginx
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d nginx
```

### Step 5: 数据库迁移

```bash
docker exec wc-backend sh -c 'cd /app/apps/backend && npx prisma db push --accept-data-loss'
```

### Step 6: 验证

```bash
# 查看容器状态
docker ps --filter name=wc-

# 测试 API
curl http://localhost:8088/api/v1/

# 查看后端日志
docker logs wc-backend --tail 50

# 查看 nginx 日志
docker logs wc-nginx --tail 50
```

---

## 5. 环境变量配置

环境变量文件位于 `docker/.env.prod`（服务器上 `/root/wecreator/docker/.env.prod`）

⚠️ **此文件不入 git，rsync 同步时已排除**

### 关键变量

| 变量 | 说明 |
|------|------|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 |
| `MYSQL_DATABASE` | 数据库名 (wecreator) |
| `MYSQL_USER` / `MYSQL_PASSWORD` | 应用用户凭证 |
| `REDIS_PASSWORD` | Redis 连接密码 |
| `MONGO_USER` / `MONGO_PASSWORD` | MongoDB 凭证 |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | JWT 签名密钥 |
| `AES_KEY` / `AES_IV` | 敏感数据加密 (不可更改！) |
| `WECHAT_APPID` / `WECHAT_SECRET` | 微信小程序配置 |
| `OSS_*` | 阿里云 OSS 存储配置 |

---

## 6. 常见操作

### 6.1 查看日志

```bash
# 后端日志（实时）
docker logs -f wc-backend

# Nginx 日志
docker logs -f wc-nginx

# 指定时间范围
docker logs --since "2026-04-29T00:00:00" wc-backend
```

### 6.2 进入容器

```bash
# 进入后端容器
docker exec -it wc-backend sh

# 进入 MySQL
docker exec -it wc-mysql mysql -u wcadmin -p

# 进入 Redis
docker exec -it wc-redis redis-cli -a <REDIS_PASSWORD>

# 进入 MongoDB
docker exec -it wc-mongodb mongosh -u wcadmin -p <MONGO_PASSWORD> --authenticationDatabase admin
```

### 6.3 数据库备份

```bash
# MySQL 备份
docker exec wc-mysql mysqldump -u root -p<ROOT_PASSWORD> wecreator > backup_$(date +%Y%m%d).sql

# MongoDB 备份
docker exec wc-mongodb mongodump --username wcadmin --password <MONGO_PASSWORD> --authenticationDatabase admin --out /dump
docker cp wc-mongodb:/dump ./mongo_backup_$(date +%Y%m%d)
```

### 6.4 重启单个服务

```bash
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod restart backend
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod restart nginx
```

### 6.5 完全停止

```bash
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod down
```

### 6.6 查看磁盘空间

```bash
df -h /
docker system df
```

---

## 7. 故障排查

### 问题: 后端 unhealthy

```bash
# 检查健康检查详情
docker inspect wc-backend --format '{{json .State.Health.Log}}' | python3 -m json.tool

# 直接查看后端日志
docker logs wc-backend --tail 100

# 常见原因: 磁盘空间满、数据库连接失败
```

### 问题: MongoDB 无法启动

```bash
# 通常由磁盘空间不足引起
df -h /

# 清理空间
docker system prune -af
find /var/lib/docker/containers -name '*-json.log' -exec truncate -s 0 {} \;
journalctl --vacuum-size=50M
rm -rf /.Recycle_bin/*
```

### 问题: 磁盘空间不足

```bash
# 快速释放空间的操作
docker system prune -af                    # 清理 Docker 缓存
docker image prune -af                     # 删除无用镜像
truncate -s 0 /var/log/wtmp               # 清理登录日志
journalctl --vacuum-size=50M               # 清理 systemd 日志
rm -rf /.Recycle_bin/*                     # 清理宝塔回收站
find /var/lib/docker/containers -name '*-json.log' -exec truncate -s 0 {} \;
```

### 问题: 前端页面空白

```bash
# 检查 nginx 静态文件是否存在
docker exec wc-nginx ls /usr/share/nginx/html/pc-admin/
docker exec wc-nginx ls /usr/share/nginx/html/platform-admin/

# 重新构建前端
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build pc-admin-build
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d pc-admin-build nginx
```

### 问题: API 502/504

```bash
# 检查后端是否在运行
docker ps --filter name=wc-backend

# 检查 nginx 能否连到后端
docker exec wc-nginx wget -qO- http://backend:3000/api/v1/

# 后端可能 OOM，检查内存
docker stats --no-stream --filter name=wc-
```

---

## 8. 注意事项

1. **磁盘空间**: 服务器 79GB 磁盘，当前使用率 ~92%。每次部署后建议清理旧镜像
2. **AES 密钥**: `AES_KEY` 和 `AES_IV` 生产环境设定后**绝不可更改**，否则已加密数据将无法解密
3. **env 文件安全**: `docker/.env.prod` 不入 git，新部署需手动创建
4. **构建时间**: 后端完整构建约 1-2 分钟，前端各约 30 秒
5. **数据持久化**: MySQL/Redis/MongoDB 数据存储在 Docker volumes 中，`docker compose down` 不会删除数据，但 `docker compose down -v` 会！
6. **宿主机端口**: 80 端口被宝塔面板占用，WeCreator 使用 8080/8081/8088

---

## 9. SSH 密码登录（备选）

如果 SSH Key 不可用，可使用密码登录：

```bash
# 使用 sshpass（需安装: brew install hudochenkov/sshpass/sshpass）
sshpass -p '8uh(lJ0ok' ssh -o StrictHostKeyChecking=no root@47.95.66.155

# 或直接 ssh 然后输入密码
ssh root@47.95.66.155
# 密码: 8uh(lJ0ok
```

---

## 10. 网络架构图

```
                        ┌─────────────────────────────────────┐
                        │         服务器 47.95.66.155          │
  用户 ─────────────────┤                                     │
                        │  ┌─── wc-nginx ──────────────────┐  │
  :8080 (PC Admin) ─────┤  │  /pc-admin → 静态文件         │  │
  :8081 (Platform) ─────┤  │  /platform-admin → 静态文件   │  │
  :8088 (API)      ─────┤  │  /api/* → proxy → backend:3000│  │
                        │  └───────────────────────────────┘  │
                        │           ↓                          │
                        │  ┌─── wc-backend ─────────────────┐ │
                        │  │  NestJS API (port 3000)        │ │
                        │  │  ↕ MySQL | Redis | MongoDB     │ │
                        │  └────────────────────────────────┘ │
                        │                                     │
                        │  wc-mysql:3306  (数据持久化)        │
                        │  wc-redis:6379  (缓存/锁)          │
                        │  wc-mongodb:27017 (消息)           │
                        └─────────────────────────────────────┘
```

---

*文档维护：部署配置变更时请同步更新本手册*
