#!/usr/bin/env bash
# One-time setup on the server (run as root): stores the Cloudflare R2 key, creates the
# backup encryption password and schedules the nightly backup at 03:00 Nairobi time.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cafe_sonique}"
CONFIG="${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root." >&2
  exit 1
fi

if ! command -v rclone >/dev/null; then
  echo "Installing rclone…"
  apt-get update -qq && apt-get install -y -qq rclone
fi

echo
echo "Paste the values from the Cloudflare R2 API token page."
read -rp "Endpoint (https://….r2.cloudflarestorage.com): " endpoint
read -rp "Access Key ID: " key_id
read -rsp "Secret Access Key (hidden while you type): " secret
echo
read -rp "Bucket name [sonique-backups]: " bucket
bucket="${bucket:-sonique-backups}"

mkdir -p "$(dirname "$CONFIG")"
rclone config create sonique-r2 s3 \
  provider=Cloudflare access_key_id="$key_id" secret_access_key="$secret" \
  endpoint="$endpoint" acl=private no_check_bucket=true >/dev/null

if ! rclone lsf "sonique-r2:$bucket" --max-depth 1 >/dev/null 2>&1; then
  rclone config delete sonique-r2
  echo "Could not open bucket '$bucket' with that key. Check the values and run this again." >&2
  exit 1
fi

if rclone listremotes | grep -qx "sonique-backup:"; then
  echo "Keeping the existing encryption password."
  passphrase=""
else
  passphrase="$(openssl rand -base64 24)"
  rclone config create sonique-backup crypt \
    remote="sonique-r2:$bucket" password="$passphrase" --obscure >/dev/null
fi
chmod 600 "$CONFIG"

install -m 644 "$APP_DIR/ops/backup/sonique-backup.service" /etc/systemd/system/
install -m 644 "$APP_DIR/ops/backup/sonique-backup.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now sonique-backup.timer >/dev/null

echo
echo "Done. The backup runs every night at 03:00 (Nairobi)."
if [ -n "$passphrase" ]; then
  echo
  echo "=================================================================="
  echo " BACKUP ENCRYPTION PASSWORD - save it in your password manager now"
  echo
  echo "   $passphrase"
  echo
  echo " Without it the backups cannot be opened if this server is lost."
  echo " It is shown only once. Do not send it in chat."
  echo "=================================================================="
fi
