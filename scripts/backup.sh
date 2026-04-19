#!/bin/sh
# ============================================================
# Kharrazi Fleet — PostgreSQL Backup Script
# ============================================================
# Runs inside the backup Docker container (postgres:16-alpine).
# Environment variables expected:
#   PGHOST       — postgres hostname (default: postgres)
#   PGUSER       — database user    (default: kharrazi_user)
#   PGDATABASE   — database name    (default: kharrazi_db)
#   PGPASSWORD   — database password (set in docker-compose env)
#   BACKUP_KEEP_DAYS — how many daily backups to keep (default: 7)
# ============================================================

set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="${BACKUP_DIR}/kharrazi_${TIMESTAMP}.sql.gz"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup at $TIMESTAMP..."

# Run pg_dump and compress with gzip
pg_dump \
  --host="${PGHOST:-postgres}" \
  --username="${PGUSER:-kharrazi_user}" \
  --dbname="${PGDATABASE:-kharrazi_db}" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip > "$FILENAME"

echo "[backup] Backup written to $FILENAME ($(du -sh "$FILENAME" | cut -f1))"

# Remove backups older than KEEP_DAYS days
DELETED=$(find "$BACKUP_DIR" -name "kharrazi_*.sql.gz" -mtime "+${KEEP_DAYS}" -type f)
if [ -n "$DELETED" ]; then
  echo "[backup] Removing old backups:"
  echo "$DELETED"
  find "$BACKUP_DIR" -name "kharrazi_*.sql.gz" -mtime "+${KEEP_DAYS}" -type f -delete
fi

echo "[backup] Done. Current backups:"
ls -lh "$BACKUP_DIR"/kharrazi_*.sql.gz 2>/dev/null || echo "  (none)"
