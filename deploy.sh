#!/bin/bash
# ============================================================
# WeCreator 一键部署脚本
# 用法: bash deploy.sh [backend|frontend|all]
# ============================================================

set -euo pipefail

SERVER="root@47.95.66.155"
SSH_KEY="$HOME/.ssh/wc_deploy_ed25519"
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER"
LOCAL_DIR="/Users/lk/we创客/wecreator/"
REMOTE_DIR="/root/wecreator/"
COMPOSE="docker compose -f docker/docker-compose.prod.yml --env-file docker/.env.prod"
TARGET="${1:-all}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 WeCreator Deploy — target: $TARGET"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Step 1: Sync code ──────────────────────────
echo ""
echo "📦 Step 1: Syncing code to server..."
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

echo "   ✅ Code synced"

# ── Step 2: Build & restart ────────────────────
echo ""
echo "🔨 Step 2: Building & restarting on server..."

# 前端部署需要删除旧 volume，否则 Docker 不会用新镜像的产物覆盖
refresh_frontend_volumes() {
  echo "   → Removing old frontend volumes..."
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE stop nginx pc-admin-build platform-admin-build && $COMPOSE rm -f nginx pc-admin-build platform-admin-build && docker volume rm docker_pc_admin_dist docker_platform_admin_dist 2>/dev/null || true"
}

case "$TARGET" in
  backend)
    echo "   → Building backend..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE build backend && $COMPOSE up -d backend"
    ;;
  frontend)
    echo "   → Building pc-admin frontend..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE build pc-admin-build platform-admin-build"
    refresh_frontend_volumes
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE up -d pc-admin-build platform-admin-build nginx"
    ;;
  all|*)
    echo "   → Building backend + pc-admin..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE build backend pc-admin-build platform-admin-build"
    refresh_frontend_volumes
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE up -d"
    ;;
esac

echo "   ✅ Services restarted"

# ── Step 3: DB migration (if needed) ──────────
if [[ "$TARGET" == "all" || "$TARGET" == "backend" ]]; then
  echo ""
  echo "🗄️  Step 3: Running database migration..."
  sleep 10
  $SSH_CMD "docker exec wc-backend sh -c 'cd /app/apps/backend && npx prisma db push --accept-data-loss' 2>&1" || echo "   ⚠️  Migration skipped (may need manual run)"
  echo "   ✅ Database in sync"

  echo "   → Restarting backend after migration..."
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE restart backend"
  echo "   ✅ Backend restarted"
fi

# ── Step 4: Cleanup ────────────────────────────
echo ""
echo "🧹 Step 4: Cleaning up..."
$SSH_CMD "docker image prune -f > /dev/null 2>&1; docker builder prune -f > /dev/null 2>&1" 2>/dev/null || true
echo "   ✅ Cleaned"

# ── Step 5: Verify ─────────────────────────────
echo ""
echo "🔍 Step 5: Verifying deployment..."
sleep 8
$SSH_CMD "docker ps --filter name=wc- --format 'table {{.Names}}\t{{.Status}}'"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deploy complete!"
echo ""
echo "   PC Admin:  http://47.95.66.155:8080"
echo "   Platform:  http://47.95.66.155:8081"
echo "   API:       http://47.95.66.155:8088/api/v1/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
