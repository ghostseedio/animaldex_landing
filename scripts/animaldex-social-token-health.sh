#!/usr/bin/env bash
set -euo pipefail

: "${CRON_SECRET:?CRON_SECRET is required}"
curl --fail --silent --show-error --max-time 180 \
  -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  https://animaldex.app/api/cron/social-token-health
printf '\n'
