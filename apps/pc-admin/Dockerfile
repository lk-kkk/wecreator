# ============================================================
# WeCreator PC Admin — Multi-stage Dockerfile
# Vue 3 + Vite → Nginx 静态托管
# ============================================================

# ── Stage 1: 构建 ─────────────────────────────
FROM node:20-alpine AS builder

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories

RUN corepack enable && corepack prepare pnpm@10 --activate && \
    pnpm config set registry https://registry.npmmirror.com

WORKDIR /app

# 拷贝 workspace 根配置
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/pc-admin/package.json apps/pc-admin/

RUN pnpm install --frozen-lockfile

# 拷贝源码
COPY packages/shared/ packages/shared/
COPY apps/pc-admin/ apps/pc-admin/

# 构建（跳过 vue-tsc，本地已 typecheck；服务端唯构建产物）
RUN cd apps/pc-admin && pnpm exec vite build

# ── Stage 2: Nginx 托管（此阶段仅用于 volume 注入）
FROM nginx:1.27-alpine AS runner

# 拷贝构建产物到 Nginx 目录
COPY --from=builder /app/apps/pc-admin/dist /usr/share/nginx/html/pc-admin

EXPOSE 80
