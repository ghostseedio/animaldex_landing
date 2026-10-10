#!/usr/bin/env bash
# Installs the hourly identity-review scan on the production VM.
#
#   bash install-identity-review-timer.sh
#
# 1. Adds CRON_SECRET to /opt/animaldex/shared/app.env if it is missing. The
#    running container only sees it after the next deploy-selfhost.sh, which
#    merges app.env into the new container's env.
# 2. Writes /usr/local/bin/animaldex-identity-review.sh, which POSTs to
#    /api/admin/maintenance/identity-review/scan on 127.0.0.1:3001.
# 3. Installs animaldex-identity-review.{service,timer}: hourly at :40, with a
#    random delay, so it does not land on the health check or a deploy.
#
# Each run queues new suspect pairs from the last 3 days and analyses up to 12
# with the vision model. It writes verdicts only; captures change when an
# operator applies one in /admin/identity-review.

set -euo pipefail

ENV_FILE=/opt/animaldex/shared/app.env
RUNNER=/usr/local/bin/animaldex-identity-review.sh
LOG=/var/log/animaldex-identity-review.log

if ! grep -q '^CRON_SECRET=' "$ENV_FILE"; then
    echo "CRON_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
    echo "Added CRON_SECRET to $ENV_FILE (live after the next deploy)."
fi

sudo tee "$RUNNER" > /dev/null <<'RUNNER_EOF'
#!/usr/bin/env bash
set -uo pipefail
SECRET=$(grep '^CRON_SECRET=' /opt/animaldex/shared/app.env | cut -d= -f2-)
URL='http://127.0.0.1:3001/api/admin/maintenance/identity-review/scan?days=3&limit=12'
RESULT=$(curl -sS -m 900 -X POST -H "Authorization: Bearer $SECRET" "$URL" 2>&1)
echo "$(date -u +%FT%TZ) $RESULT" >> /var/log/animaldex-identity-review.log
RUNNER_EOF
sudo chmod 755 "$RUNNER"
sudo touch "$LOG"
sudo chown "$(id -un)" "$LOG"

sudo tee /etc/systemd/system/animaldex-identity-review.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex identity-review scan
After=docker.service

[Service]
Type=oneshot
User=$(id -un)
ExecStart=$RUNNER
Nice=10
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-identity-review.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Hourly AnimalDex identity-review scan

[Timer]
OnCalendar=*-*-* *:40:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-identity-review.timer
systemctl list-timers --no-pager | grep animaldex-identity-review
echo "Log: $LOG"
