#!/usr/bin/env bash
# Nightly backup: database, uploaded media and expense receipts to Cloudflare R2.
# Everything is encrypted by the rclone "crypt" remote before it leaves the server.
# Run as root on the server. Set up once with ops/backup/setup.sh.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cafe_sonique}"
REMOTE="${BACKUP_REMOTE:-sonique-backup}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/sonique}"
LOCAL_KEEP_DAYS="${BACKUP_LOCAL_KEEP_DAYS:-7}"
STATUS_DIR="${BACKUP_STATUS_DIR:-/var/lib/sonique-backup}"

cd "$APP_DIR"
project="$(basename "$APP_DIR")"
stamp="$(TZ=Africa/Nairobi date +%Y-%m-%d_%H%M)"
dump="$LOCAL_DIR/db-$stamp.dump"

volume_dir() {
  docker volume inspect --format '{{.Mountpoint}}' "${project}_$1" 2>/dev/null || true
}

mkdir -p "$LOCAL_DIR" "$STATUS_DIR"
chmod 700 "$LOCAL_DIR"

echo "[$(date "+%Y-%m-%dT%H:%M:%S%z")] Dumping database"
docker compose exec -T postgres pg_dump -U sonique -d cafe_sonique --format=custom >"$dump.part"
if [ ! -s "$dump.part" ]; then
  echo "Database dump is empty; aborting." >&2
  exit 1
fi
mv "$dump.part" "$dump"
chmod 600 "$dump"

echo "[$(date "+%Y-%m-%dT%H:%M:%S%z")] Uploading database dump"
rclone copyto "$dump" "$REMOTE:db/$(basename "$dump")"

for volume in sonique_media sonique_receipts; do
  dir="$(volume_dir "$volume")"
  if [ -n "$dir" ] && [ -d "$dir" ]; then
    echo "[$(date "+%Y-%m-%dT%H:%M:%S%z")] Uploading new files from $volume"
    # copy, not sync: a file deleted on the site stays recoverable from the backup.
    rclone copy "$dir" "$REMOTE:${volume#sonique_}"
  fi
done

echo "[$(date "+%Y-%m-%dT%H:%M:%S%z")] Removing database dumps older than $KEEP_DAYS days from R2"
rclone delete --min-age "${KEEP_DAYS}d" "$REMOTE:db"
find "$LOCAL_DIR" -name 'db-*.dump' -mtime +"$LOCAL_KEEP_DAYS" -delete

date "+%Y-%m-%dT%H:%M:%S%z" >"$STATUS_DIR/last-success"
echo "[$(date "+%Y-%m-%dT%H:%M:%S%z")] Backup finished: $(basename "$dump") ($(du -h "$dump" | cut -f1))"
