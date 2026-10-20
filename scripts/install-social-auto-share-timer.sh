#!/usr/bin/env bash
# Installs the 2-hourly social auto-share on the production VM.
#
#   bash install-social-auto-share-timer.sh
#
# 1. Adds CRON_SECRET to /opt/animaldex/shared/app.env if it is missing. The
#    running container only sees it after the next deploy-selfhost.sh, which
#    merges app.env into the new container's env.
# 2. Writes /usr/local/bin/animaldex-social-auto-share.sh, which POSTs to
#    /api/cron/social-auto-share on 127.0.0.1:3001 (not through Cloudflare,
#    whose 100 s limit the copy drafting can approach).
# 3. Installs animaldex-social-auto-share.{service,timer}: every 2 hours at
#    :25, with a random delay, so it does not land on a deploy or the cleanup.
#
# Each run shares at most one video (the oldest not yet on some connected
# platform) to every platform that still needs it, then returns while the
# upload runs in the app. A run skips while an earlier upload is still going.
# Pause without the VM: set SOCIAL_AUTO_SHARE_DISABLED=1 in app.env and redeploy,
# or `sudo systemctl disable --now animaldex-social-auto-share.timer`.

set -euo pipefail

ENV_FILE=/opt/animaldex/shared/app.env
RUNNER=/usr/local/bin/animaldex-social-auto-share.sh
LOG=/var/log/animaldex-social-auto-share.log

if ! grep -q '^CRON_SECRET=' "$ENV_FILE"; then
    echo "CRON_SECRET=$(openssl rand -hex 32)" >> "$ENV_FILE"
    echo "Added CRON_SECRET to $ENV_FILE (live after the next deploy)."
fi

sudo tee "$RUNNER" > /dev/null <<'RUNNER_EOF'
#!/usr/bin/env bash
set -uo pipefail
SECRET=$(grep '^CRON_SECRET=' /opt/animaldex/shared/app.env | cut -d= -f2-)
URL='http://127.0.0.1:3001/api/cron/social-auto-share'
RESULT=$(curl -sS -m 300 -X POST -H "Authorization: Bearer $SECRET" "$URL" 2>&1)
echo "$(date -u +%FT%TZ) $RESULT" >> /var/log/animaldex-social-auto-share.log
RUNNER_EOF
sudo chmod 755 "$RUNNER"
sudo touch "$LOG"
sudo chown "$(id -un)" "$LOG"

sudo tee /etc/systemd/system/animaldex-social-auto-share.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex social auto-share
After=docker.service

[Service]
Type=oneshot
User=$(id -un)
ExecStart=$RUNNER
Nice=10
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-social-auto-share.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Every-2-hours AnimalDex social auto-share

[Timer]
OnCalendar=*-*-* 00/2:25:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-social-auto-share.timer
systemctl list-timers --no-pager | grep animaldex-social-auto-share
echo "Log: $LOG"
