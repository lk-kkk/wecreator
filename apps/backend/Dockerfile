# ============================================================
# WeCreator Backend — Multi-stage Dockerfile
# NestJS 11 + Prisma 6 + Node 20 LTS
# ============================================================

# ── Stage 1: 安装依赖 + 构建 ──────────────────
FROM node:20-alpine AS builder

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories && \
    apk add --no-cache openssl libc6-compat

RUN corepack enable && corepack prepare pnpm@10 --activate && \
    pnpm config set registry https://registry.npmmirror.com

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY apps/backend/ apps/backend/

# Prisma generate（用锁定 v6）
RUN cd apps/backend && pnpm exec prisma generate

# NestJS build
RUN cd apps/backend && pnpm run build

# ── Stage 2: 生产运行镜像 ─────────────────────
FROM node:20-alpine AS runner

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories && \
    apk add --no-cache openssl libc6-compat wget

RUN addgroup --system --gid 1001 wecreator && \
    adduser --system --uid 1001 --ingroup wecreator appuser

WORKDIR /app

# 直接从 builder 复制 workspace。pnpm workspace 每个包都有自己的 node_modules（软链接到 root .pnpm）
# 全部拷贝保证运行时 resolution 路径完整
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma

# 切换用户
USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/ || exit 1

EXPOSE 3000

CMD ["node", "apps/backend/dist/src/main.js"]
