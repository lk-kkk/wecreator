#!/bin/bash
# S2-038: 数据库每日自动备份脚本
# Crontab: 0 3 * * * /opt/wecreator/scripts/backup-db.sh >> /var/log/wecreator/backup.log 2>&1

set -euo pipefail

# ── 配置 ──────────────────────────────────────
BACKUP_DIR="/opt/wecreator/backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-wcadmin}"
MYSQL_PASS="${MYSQL_PASS:-wecreator@2026}"
MYSQL_DB="${MYSQL_DB:-wecreator_dev}"
MONGO_HOST="${MONGO_HOST:-localhost}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_DB="${MONGO_DB:-wecreator_msg}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

mkdir -p "${BACKUP_DIR}/mysql" "${BACKUP_DIR}/mongodb" "${BACKUP_DIR}/redis"

echo "═══════════════════════════════════════════════"
echo "🗄️  WeCreator Database Backup — ${DATE}"
echo "═══════════════════════════════════════════════"

# ── 1. MySQL 备份 ──────────────────────────────
echo "1. MySQL backup..."
MYSQL_FILE="${BACKUP_DIR}/mysql/${MYSQL_DB}_${DATE}.sql.gz"
mysqldump \
    -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" \
    -u "${MYSQL_USER}" -p"${MYSQL_PASS}" \
    --single-transaction --routines --triggers --events \
    "${MYSQL_DB}" | gzip > "${MYSQL_FILE}"
MYSQL_SIZE=$(du -sh "${MYSQL_FILE}" | cut -f1)
echo "   ✅ MySQL: ${MYSQL_FILE} (${MYSQL_SIZE})"

# ── 2. MongoDB 备份 ──────────────────────────────
echo "2. MongoDB backup..."
MONGO_DIR="${BACKUP_DIR}/mongodb/${MONGO_DB}_${DATE}"
mongodump \
    --host="${MONGO_HOST}" --port="${MONGO_PORT}" \
    --db="${MONGO_DB}" --out="${MONGO_DIR}" --gzip
MONGO_SIZE=$(du -sh "${MONGO_DIR}" | cut -f1)
echo "   ✅ MongoDB: ${MONGO_DIR} (${MONGO_SIZE})"

# ── 3. Redis RDB 备份 ──────────────────────────
echo "3. Redis backup..."
redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" BGSAVE 2>/dev/null || true
sleep 2
REDIS_RDB=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" CONFIG GET dir 2>/dev/null | tail -1)/dump.rdb
if [ -f "${REDIS_RDB}" ]; then
    REDIS_FILE="${BACKUP_DIR}/redis/redis_${DATE}.rdb"
    cp "${REDIS_RDB}" "${REDIS_FILE}"
    REDIS_SIZE=$(du -sh "${REDIS_FILE}" | cut -f1)
    echo "   ✅ Redis: ${REDIS_FILE} (${REDIS_SIZE})"
else
    echo "   ⚠️ Redis RDB not found, skipping"
fi

# ── 4. 清理过期备份 ──────────────────────────────
echo "4. Cleanup old backups (>${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -type f -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -type d -empty -delete 2>/dev/null || true
echo "   ✅ Cleanup done"

# ── 5. 上传到 OSS（可选） ──────────────────────
# 如果配置了 ossutil, 可启用远程备份:
# ossutil cp -r "${BACKUP_DIR}/mysql/${MYSQL_DB}_${DATE}.sql.gz" \
#   oss://wecreator-backup/mysql/ --force

echo ""
echo "═══════════════════════════════════════════════"
echo "✅ Backup completed at $(date)"
echo "═══════════════════════════════════════════════"
