# WeCreator 部署手册

> 最后更新：2026-04-28

---

## 目录

- [1. 架构概览](#1-架构概览)
- [2. 服务器要求](#2-服务器要求)
- [3. 目录结构](#3-目录结构)
- [4. 首次部署](#4-首次部署)
- [5. 日常更新部署](#5-日常更新部署)
- [6. 环境变量](#6-环境变量)
- [7. 服务端口说明](#7-服务端口说明)
- [8. 数据库管理](#8-数据库管理)
- [9. 日志与监控](#9-日志与监控)
- [10. 备份与恢复](#10-备份与恢复)
- [11. 故障排查](#11-故障排查)
- [12. 安全建议](#12-安全建议)

---

## 1. 架构概览

```
┌───────────────────────────────────────────────────────────────┐
│                    Nginx (wc-nginx)                            │
│  :8080 PC企业后台 │ :8081 平台运营后台 │ :8088 API网关(小程序)  │
└────────────┬──────────────────┬────────────────┬──────────────┘
             │                  │                │
             ▼                  ▼                ▼
┌───────────────────────────────────────────────────────────────┐
│              NestJS Backend (wc-backend:3000)                  │
│              Node.js 20 + Prisma 6 + NestJS 11                │
└───────┬──────────────┬──────────────┬─────────────────────────┘
        │              │              │
        ▼              ▼              ▼
   ┌─────────┐  ┌───────────┐  ┌──────────┐
   │  MySQL  │  │  MongoDB  │  │  Redis   │
   │  8.0    │  │  6.0      │  │  7.x     │
   │ 主数据库 │  │ 消息存储   │  │ 缓存/锁  │
   └─────────┘  └───────────┘  └──────────┘
```

**前端应用（构建为静态文件）：**
- `pc-admin` — PC 企业后台（Vue 3 + Ant Design Vue）
- `platform-admin` — 平台运营后台（Vue 3 + Ant Design Vue）
- `worker-mp` — 零工小程序（Taro + React，独立发布）

---

## 2. 服务器要求

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2 核 | 4 核 |
| 内存 | 8 GB | 16 GB |
| 磁盘 | 40 GB SSD | 80 GB SSD |
| 系统 | CentOS 7+ / Ubuntu 20.04+ | CentOS 7 |
| Docker | 24.0+ | 最新稳定版 |
| Docker Compose | v2.20+ | 最新稳定版 |

**当前生产环境：**
- 阿里云 ECS: `47.95.66.155`
- CentOS 7, 2 核 16GB 内存, 79GB 磁盘
- Docker 24.0.7 + Docker Compose v2.21.0

---

## 3. 目录结构

```
/root/wecreator/                    ← 服务器项目根目录
├── apps/
│   ├── backend/                    ← NestJS 后端源码
│   │   ├── Dockerfile
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   ├── pc-admin/                   ← PC 企业后台前端源码
│   │   └── Dockerfile
│   ├── platform-admin/             ← 平台运营后台前端源码
│   │   └── Dockerfile
│   └── worker-mp/                  ← 零工小程序源码
├── packages/
│   └── shared/                     ← 公共包
├── docker/
│   ├── docker-compose.prod.yml     ← 生产 Docker Compose
│   ├── docker-compose.yml          ← 本地开发 Compose
│   ├── .env.prod                   ← 生产环境变量 ⚠️ 不提交 git
│   ├── .env.production.example     ← 环境变量模板
│   ├── nginx/nginx.conf            ← Nginx 配置
│   ├── mysql-conf/wecreator.cnf    ← MySQL 优化配置
│   └── init-sql/                   ← 数据库初始化脚本
├── scripts/
│   └── backup-db.sh                ← 数据库备份脚本
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

---

## 4. 首次部署

### 4.1 服务器初始化

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl enable docker && systemctl start docker

# 2. 安装 Docker Compose (已内置于 Docker 24+)
docker compose version

# 3. 创建项目目录
mkdir -p /root/wecreator
```

### 4.2 上传代码

从开发机同步代码到服务器：

```bash
# 从本地开发机执行
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.pnpm-store' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude 'docker/.env.prod' \
  --exclude 'docker/.env' \
  -e "ssh -i ~/.ssh/wc_deploy_ed25519" \
  /Users/lk/we创客/wecreator/ \
  root@47.95.66.155:/root/wecreator/
```

### 4.3 配置环境变量

```bash
# 在服务器上
cd /root/wecreator/docker

# 复制模板并编辑
cp .env.production.example .env.prod

# 生成安全密码
openssl rand -hex 16  # 用于各数据库密码
openssl rand -hex 32  # 用于 JWT_SECRET / JWT_REFRESH_SECRET

# 编辑 .env.prod，填写所有密码和密钥
vi .env.prod
```

### 4.4 构建并启动

```bash
cd /root/wecreator

# 构建所有镜像
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build

# 启动所有服务
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d

# 等待所有服务健康
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod ps
```

### 4.5 初始化数据库

```bash
# 进入 backend 容器执行 Prisma 迁移
docker exec wc-backend sh -c 'cd /app/apps/backend && npx prisma db push --accept-data-loss'

# 如需初始种子数据
docker exec wc-backend sh -c 'cd /app/apps/backend && npx prisma db seed'
```

---

## 5. 日常更新部署

### 5.1 快速部署（推荐）

在本地开发机执行以下一键命令：

```bash
# ── Step 1: 同步代码到服务器 ──
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.pnpm-store' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude 'docker/.env.prod' \
  --exclude 'docker/.env' \
  -e "ssh -i ~/.ssh/wc_deploy_ed25519" \
  /Users/lk/we创客/wecreator/ \
  root@47.95.66.155:/root/wecreator/

# ── Step 2: SSH 到服务器执行构建 + 重启 ──
ssh -i ~/.ssh/wc_deploy_ed25519 root@47.95.66.155 << 'EOF'
cd /root/wecreator

# 重新构建变更的镜像
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build backend pc-admin-build

# 重启服务（保持数据库不动）
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d backend pc-admin-build nginx

# 清理旧镜像释放空间
docker image prune -f

# 验证
sleep 10
docker ps --filter name=wc- --format 'table {{.Names}}\t{{.Status}}'
EOF
```

### 5.2 仅更新后端

```bash
ssh -i ~/.ssh/wc_deploy_ed25519 root@47.95.66.155 << 'EOF'
cd /root/wecreator
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build backend
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d backend
docker image prune -f
EOF
```

### 5.3 仅更新前端

```bash
ssh -i ~/.ssh/wc_deploy_ed25519 root@47.95.66.155 << 'EOF'
cd /root/wecreator
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build pc-admin-build
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d pc-admin-build nginx
docker image prune -f
EOF
```

### 5.4 涉及数据库 Schema 变更时

```bash
# 构建并重启后端后，执行迁移
ssh -i ~/.ssh/wc_deploy_ed25519 root@47.95.66.155 << 'EOF'
cd /root/wecreator
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build backend
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d backend

# 等待后端启动
sleep 15

# 执行数据库 schema 同步
docker exec wc-backend sh -c 'cd /app/apps/backend && npx prisma db push --accept-data-loss'

# 重启后端以使用新 schema
docker restart wc-backend
EOF
```

> ⚠️ **注意：** `--accept-data-loss` 会自动应用破坏性变更（如删除字段）。如果需要谨慎操作，先不加此参数查看变更预览。

---

## 6. 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | `openssl rand -hex 16` |
| `MYSQL_DATABASE` | 数据库名 | `wecreator` |
| `MYSQL_USER` | 应用数据库用户 | `wcadmin` |
| `MYSQL_PASSWORD` | 应用数据库密码 | `openssl rand -hex 16` |
| `REDIS_PASSWORD` | Redis 密码 | `openssl rand -hex 16` |
| `MONGO_USER` | MongoDB 用户 | `wcadmin` |
| `MONGO_PASSWORD` | MongoDB 密码 | `openssl rand -hex 16` |
| `MONGO_DATABASE` | MongoDB 库名 | `wecreator_msg` |
| `JWT_SECRET` | JWT 访问令牌签名 | `openssl rand -hex 32` |
| `JWT_ACCESS_EXPIRES` | 访问令牌过期时间 | `2h` |
| `JWT_REFRESH_SECRET` | 刷新令牌签名 | `openssl rand -hex 32` |
| `JWT_REFRESH_EXPIRES` | 刷新令牌过期时间 | `7d` |
| `AES_KEY` | 敏感信息加密密钥（32字节） | `openssl rand -hex 16` |
| `AES_IV` | AES 初始化向量（16字节） | `openssl rand -hex 8` |
| `WECHAT_APPID` | 微信小程序 AppID | `wxXXXXXX` |
| `WECHAT_SECRET` | 微信小程序 AppSecret | `xxxxx` |
| `OSS_BUCKET` | 阿里云 OSS 存储桶 | `wecreator-prod` |
| `OSS_REGION` | OSS 区域 | `oss-cn-hangzhou` |
| `OSS_ACCESS_KEY` | 阿里云 AccessKey | `LTAI5tXXXX` |
| `OSS_SECRET` | 阿里云 SecretKey | `xxxxx` |

> ⚠️ **AES_KEY 和 AES_IV 一旦在生产环境设定后不可修改**，否则已加密数据（手机号、身份证）将无法解密！

---

## 7. 服务端口说明

| 端口 | 服务 | 用途 | 外部可访问 |
|------|------|------|-----------|
| **8080** | Nginx → pc-admin | PC 企业后台 | ✅ |
| **8081** | Nginx → platform-admin | 平台运营后台 | ✅ |
| **8088** | Nginx → backend | API 网关（小程序） | ✅ |
| 3000 | backend | NestJS API | ❌ 仅 Docker 内网 |
| 3306 | mysql | MySQL 数据库 | ❌ 仅 Docker 内网 |
| 27017 | mongodb | MongoDB 消息库 | ❌ 仅 Docker 内网 |
| 6379 | redis | Redis 缓存 | ❌ 仅 Docker 内网 |

**访问方式：**
- 企业后台：`http://47.95.66.155:8080`
- 运营后台：`http://47.95.66.155:8081`
- API 接口：`http://47.95.66.155:8088/api/v1/`
- WebSocket：`http://47.95.66.155:8080/socket.io/`（通过 Nginx）

---

## 8. 数据库管理

### 8.1 连接数据库

```bash
# MySQL（从服务器）
docker exec -it wc-mysql mysql -u wcadmin -p wecreator

# MongoDB
docker exec -it wc-mongodb mongosh -u wcadmin -p <密码> --authenticationDatabase admin wecreator_msg

# Redis
docker exec -it wc-redis redis-cli -a <密码>
```

### 8.2 Schema 变更

本项目使用 `prisma db push` 管理 Schema（无迁移文件方式）：

```bash
# 在后端容器内执行
docker exec wc-backend sh -c 'cd /app/apps/backend && npx prisma db push --accept-data-loss'
```

### 8.3 数据库性能

MySQL 配置文件路径：`docker/mysql-conf/wecreator.cnf`

关键参数：
- `innodb_buffer_pool_size = 1G` — InnoDB 缓冲池
- `max_connections = 500` — 最大连接数
- `slow_query_log = 1` — 启用慢查询日志
- `long_query_time = 2` — 超过 2 秒算慢查询

---

## 9. 日志与监控

### 9.1 查看日志

```bash
# 后端日志
docker logs wc-backend --tail 100 -f

# Nginx 访问日志
docker exec wc-nginx cat /var/log/nginx/access.log | tail -50

# MySQL 慢查询
docker exec wc-mysql cat /var/log/mysql/slow.log | tail -50

# 全部服务日志
docker compose -f docker/docker-compose.prod.yml logs -f --tail 50
```

### 9.2 资源监控

```bash
# Docker 容器资源使用
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# 磁盘使用
df -h /
docker system df
```

### 9.3 健康检查

```bash
# 快速检查所有服务状态
docker ps --filter name=wc- --format 'table {{.Names}}\t{{.Status}}'

# 测试 API 可达性
curl -s -o /dev/null -w '%{http_code}' http://localhost:8088/api/v1/tasks
# 预期返回 401（需认证）= 正常

# 测试前端
curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/
# 预期返回 200 = 正常
```

---

## 10. 备份与恢复

### 10.1 手动备份

```bash
# 执行备份脚本
bash /root/wecreator/scripts/backup-db.sh
```

### 10.2 自动备份（Crontab）

```bash
# 每天凌晨 3 点自动备份
crontab -e
0 3 * * * /root/wecreator/scripts/backup-db.sh >> /var/log/wecreator/backup.log 2>&1
```

### 10.3 恢复 MySQL

```bash
# 解压并恢复
gunzip /opt/wecreator/backups/mysql/wecreator_20260428_030000.sql.gz
docker exec -i wc-mysql mysql -u wcadmin -p<密码> wecreator < /opt/wecreator/backups/mysql/wecreator_20260428_030000.sql
```

### 10.4 恢复 MongoDB

```bash
docker exec -i wc-mongodb mongorestore \
  -u wcadmin -p <密码> --authenticationDatabase admin \
  --gzip --db wecreator_msg /data/backup/wecreator_msg_20260428/
```

---

## 11. 故障排查

### 11.1 常见问题

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| Backend `unhealthy` | Dockerfile healthcheck 路由不存在 | 不影响运行，可忽略 |
| MongoDB 崩溃重启 | 磁盘空间不足 | `docker system prune -af` 清理 |
| 前端白屏 | Nginx 未加载最新构建 | 重建 `pc-admin-build` 并重启 Nginx |
| API 返回 404 | 路由未注册/路径错误 | 检查 `docker logs wc-backend` |
| API 返回 400 | DTO 验证失败 | 检查请求体字段是否完整 |
| 连接数据库超时 | MySQL 容器未启动 | `docker restart wc-mysql` |

### 11.2 磁盘空间清理

```bash
# 查看使用情况
df -h /
docker system df

# 清理未使用的 Docker 资源
docker system prune -af        # 删除所有未使用镜像+缓存
docker builder prune -af       # 清理构建缓存
docker volume prune -f         # 清理未使用的卷（⚠️ 谨慎！）

# 清理旧日志
find /var/log -name "*.gz" -mtime +7 -delete
journalctl --vacuum-size=200M
```

### 11.3 完全重启

```bash
cd /root/wecreator

# 停止所有服务
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod down

# 重新启动（保留数据卷）
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d
```

### 11.4 回滚到上一版本

```bash
# 如果部署后出问题，可以用 git 回滚本地代码后重新 rsync 部署
# 本地开发机：
cd /Users/lk/we创客/wecreator
git stash  # 或 git checkout <之前的commit>

# 重新执行部署流程（同 5.1 节）
```

---

## 12. 安全建议

### 已实施
- ✅ 数据库服务不暴露到公网（仅 Docker 内网）
- ✅ Nginx 添加安全头（X-Frame-Options, CSP, HSTS）
- ✅ JWT 双 Token 机制（短期 access + 长期 refresh）
- ✅ AES-256 加密敏感字段
- ✅ Redis 设置密码
- ✅ MySQL 独立应用用户（非 root）

### 建议完善
- ⬜ 配置防火墙，仅开放 8080/8081/8088 端口
- ⬜ 启用 HTTPS（推荐使用域名 + Let's Encrypt）
- ⬜ 配置 fail2ban 防暴力破解
- ⬜ 定期更新系统安全补丁
- ⬜ 开启阿里云安全组规则

### 防火墙参考配置

```bash
# CentOS 7 firewalld
firewall-cmd --permanent --add-port=8080/tcp
firewall-cmd --permanent --add-port=8081/tcp
firewall-cmd --permanent --add-port=8088/tcp
firewall-cmd --permanent --add-port=22/tcp
firewall-cmd --reload
```

---

## 附录：SSH 连接信息

| 项目 | 值 |
|------|---|
| 服务器 IP | `47.95.66.155` |
| SSH 用户 | `root` |
| SSH 密钥 | `~/.ssh/wc_deploy_ed25519` |
| 项目路径 | `/root/wecreator` |

**快速连接：**
```bash
ssh -i ~/.ssh/wc_deploy_ed25519 root@47.95.66.155
```

---

## 附录：一键部署脚本

将以下内容保存为本地 `deploy.sh`，后续部署只需执行 `bash deploy.sh`：

```bash
#!/bin/bash
# WeCreator 一键部署脚本
# 用法: bash deploy.sh [backend|frontend|all]

set -euo pipefail

SERVER="root@47.95.66.155"
SSH_KEY="$HOME/.ssh/wc_deploy_ed25519"
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER"
LOCAL_DIR="/Users/lk/we创客/wecreator/"
REMOTE_DIR="/root/wecreator/"
TARGET="${1:-all}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 WeCreator Deploy — target: $TARGET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Sync code
echo "📦 Syncing code..."
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.pnpm-store' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude 'docker/.env.prod' \
  --exclude 'docker/.env' \
  --exclude 'sessions' \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  "$LOCAL_DIR" "$SERVER:$REMOTE_DIR"

echo "✅ Code synced"

# Step 2: Build & restart
echo "🔨 Building on server..."

case "$TARGET" in
  backend)
    $SSH_CMD "cd $REMOTE_DIR && docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build backend && docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d backend"
    ;;
  frontend)
    $SSH_CMD "cd $REMOTE_DIR && docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build pc-admin-build && docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d pc-admin-build nginx"
    ;;
  all|*)
    $SSH_CMD "cd $REMOTE_DIR && docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod build backend pc-admin-build && docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod up -d"
    ;;
esac

# Step 3: Cleanup
$SSH_CMD "docker image prune -f > /dev/null 2>&1; docker builder prune -f > /dev/null 2>&1" || true

# Step 4: Verify
echo ""
echo "🔍 Verifying..."
sleep 10
$SSH_CMD "docker ps --filter name=wc- --format 'table {{.Names}}\t{{.Status}}'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deploy complete!"
echo "   PC Admin:  http://47.95.66.155:8080"
echo "   Platform:  http://47.95.66.155:8081"
echo "   API:       http://47.95.66.155:8088/api/v1/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**使用方法：**
```bash
bash deploy.sh          # 全量部署（后端+前端）
bash deploy.sh backend  # 仅后端
bash deploy.sh frontend # 仅前端
```
