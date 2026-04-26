#!/bin/sh
set -eu

if [ -z "${APP_URL:-}" ] || [ -z "${CRON_SECRET:-}" ]; then
  echo "APP_URL and CRON_SECRET must be set" >&2
  exit 2
fi

echo "[cron] $(date -u +%FT%TZ) POST ${APP_URL}/api/cron/daily-summary"
curl --fail-with-body --show-error --silent \
  --max-time 600 \
  -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "${APP_URL}/api/cron/daily-summary"
echo
echo "[cron] done"
