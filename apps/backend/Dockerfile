# ============================================================
# WeCreator Backend — Multi-stage Dockerfile
# NestJS 11 + Prisma 6 + Node 20 LTS
# ============================================================

# ── Stage 1: 安装依赖 + 构建 ──────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# 拷贝 workspace 根配置
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# 拷贝各包的 package.json（保留 monorepo 依赖图）
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

# 安装全部依赖（含 devDeps，构建时需要）
RUN pnpm install --frozen-lockfile

# 拷贝 shared 包源码并编译
COPY packages/shared/ packages/shared/

# 拷贝后端源码
COPY apps/backend/ apps/backend/

# Prisma generate（生成客户端）
RUN cd apps/backend && pnpm dlx prisma generate

# NestJS 构建
RUN cd apps/backend && pnpm run build

# ── Stage 2: 生产运行镜像 ─────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10 --activate

# 安全：使用非 root 用户
RUN addgroup --system --gid 1001 wecreator && \
    adduser --system --uid 1001 --ingroup wecreator appuser

WORKDIR /app

# 拷贝 workspace 根配置
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/backend/package.json apps/backend/

# 仅安装生产依赖
RUN pnpm install --frozen-lockfile --prod

# 从 builder 拷贝构建产物
COPY --from=builder /app/apps/backend/dist apps/backend/dist

# 拷贝 Prisma schema + migration（运行时需要）
COPY --from=builder /app/apps/backend/prisma apps/backend/prisma

# 拷贝生成的 Prisma Client
COPY --from=builder /app/apps/backend/node_modules/.prisma apps/backend/node_modules/.prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/runtime node_modules/.pnpm/@prisma+client-runtime/

# 切换用户
USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

EXPOSE 3000

# 启动命令
CMD ["node", "apps/backend/dist/main.js"]
