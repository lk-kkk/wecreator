# ============================================================
# WeCreator Platform Admin — Multi-stage Dockerfile
# ============================================================

FROM node:20-alpine AS builder

RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories

RUN corepack enable && corepack prepare pnpm@10 --activate && \
    pnpm config set registry https://registry.npmmirror.com

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/platform-admin/package.json apps/platform-admin/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY apps/platform-admin/ apps/platform-admin/

RUN cd apps/platform-admin && pnpm exec vite build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/platform-admin/dist /usr/share/nginx/html/platform-admin

EXPOSE 80
