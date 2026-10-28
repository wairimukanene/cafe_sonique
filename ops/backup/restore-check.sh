#!/usr/bin/env bash
# Proves the latest backup can be restored: downloads it from R2, restores it into a
# throwaway database next to the live one, compares row counts, then drops the copy.
# The live database is only read.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cafe_sonique}"
REMOTE="${BACKUP_REMOTE:-sonique-backup}"
CHECK_DB=cafe_sonique_restore_check

cd "$APP_DIR"
work="$(mktemp -d)"
psql() { docker compose exec -T postgres psql -U sonique -v ON_ERROR_STOP=1 -qtA "$@"; }
cleanup() {
  psql -d postgres -c "drop database if exists $CHECK_DB" >/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

latest="$(rclone lsf "$REMOTE:db" | sort | tail -n 1)"
if [ -z "$latest" ]; then
  echo "No database backups found in R2." >&2
  exit 1
fi
echo "Restoring $latest into $CHECK_DB"
rclone copyto "$REMOTE:db/$latest" "$work/$latest"

psql -d postgres -c "drop database if exists $CHECK_DB" -c "create database $CHECK_DB" >/dev/null
docker compose exec -T postgres pg_restore -U sonique -d "$CHECK_DB" --no-owner --exit-on-error <"$work/$latest"

tables="$(psql -d cafe_sonique -c "select tablename from pg_tables where schemaname = 'public' order by 1")"
differences=0
while read -r table; do
  [ -n "$table" ] || continue
  live="$(psql -d cafe_sonique -c "select count(*) from public.\"$table\"")"
  restored="$(psql -d "$CHECK_DB" -c "select count(*) from public.\"$table\"")"
  marker=""
  if [ "$live" != "$restored" ]; then
    marker="  <- differs (changes made since the backup are expected here)"
    differences=$((differences + 1))
  fi
  printf '%-28s live %-7s backup %s%s\n' "$table" "$live" "$restored" "$marker"
done <<<"$tables"

for folder in media receipts; do
  sample="$(rclone lsf "$REMOTE:$folder" --files-only 2>/dev/null | head -n 1 || true)"
  if [ -n "$sample" ]; then
    rclone copyto "$REMOTE:$folder/$sample" "$work/sample"
    echo "Downloaded and decrypted $folder/$sample ($(du -h "$work/sample" | cut -f1))"
  fi
done

echo "Restore check finished: $differences table(s) differ from live."
