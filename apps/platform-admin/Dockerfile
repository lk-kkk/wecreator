# ============================================================
# WeCreator Platform Admin — Multi-stage Dockerfile
# Vue 3 + Vite → Nginx 静态托管
# ============================================================

# ── Stage 1: 构建 ─────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/platform-admin/package.json apps/platform-admin/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY apps/platform-admin/ apps/platform-admin/

RUN cd apps/platform-admin && pnpm run build

# ── Stage 2: Nginx 托管 ───────────────────────
FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/platform-admin/dist /usr/share/nginx/html/platform-admin

EXPOSE 80
