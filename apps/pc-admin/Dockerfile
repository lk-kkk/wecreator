# ============================================================
# WeCreator PC Admin — Multi-stage Dockerfile
# Vue 3 + Vite → Nginx 静态托管
# ============================================================

# ── Stage 1: 构建 ─────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# 拷贝 workspace 根配置
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/pc-admin/package.json apps/pc-admin/

RUN pnpm install --frozen-lockfile

# 拷贝源码
COPY packages/shared/ packages/shared/
COPY apps/pc-admin/ apps/pc-admin/

# 构建（输出到 apps/pc-admin/dist）
RUN cd apps/pc-admin && pnpm run build

# ── Stage 2: Nginx 托管 ───────────────────────
FROM nginx:1.27-alpine AS runner

# 拷贝构建产物到 Nginx 目录
COPY --from=builder /app/apps/pc-admin/dist /usr/share/nginx/html/pc-admin

# 拷贝 Nginx 配置（由外部 volume 挂载或用默认配置）
# 注意：实际配置由 docker-compose 中的 nginx 容器统一管理

EXPOSE 80
