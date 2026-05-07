#!/bin/bash
# ============================================================
# FleetOS — PostgreSQL Backup Script
# Usage:
#   bash scripts/backup.sh
#   Add to cron: 0 2 * * * /path/to/fleetos/scripts/backup.sh
# ============================================================

set -e

BACKUP_DIR="./backups"
DB_USER="${POSTGRES_USER:-traccar}"
DB_NAME="${POSTGRES_DB:-traccar}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILE="$BACKUP_DIR/traccar_backup_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -q "fleetos-postgres"; then
  # Docker mode
  docker exec fleetos-postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
else
  # Native mode
  pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
fi

echo "✓ Backup saved: $FILE ($(du -sh "$FILE" | cut -f1))"

# Keep only last 14 backups
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm
echo "✓ Old backups cleaned (keeping last 14)"
