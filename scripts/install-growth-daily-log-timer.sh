#!/usr/bin/env bash
# Installs the nightly growth-log auto-fill on the production VM (16 Nov 2026).
#
#   bash install-growth-daily-log-timer.sh
#
# 1. Adds CRON_SECRET to /opt/animaldex/shared/app.env if it is missing (the
#    running container only sees it after the next deploy-selfhost.sh).
# 2. Writes /usr/local/bin/animaldex-growth-daily-log.sh, which POSTs to
#    /api/cron/growth-daily-log on 127.0.0.1:3001.
# 3. Installs animaldex-growth-daily-log.{service,timer}: 20:10 UTC daily
#    (03:10 Jakarta, once yesterday has ended there and the sources have had a
#    few hours), with a random delay, off the other timers' slots.
#
# Each run writes the last three finished Jakarta days into
# growth_marketing_daily from the connected sources (src/lib/growth-daily-log.ts):
# social views, Google clicks, shorts and SEO pages; ad_spend stays 0 (no ads
# run). Hand-entered days are never overwritten.
# Pause without the VM: set GROWTH_DAILY_LOG_DISABLED=1 in app.env and
# redeploy, or `sudo systemctl disable --now animaldex-growth-daily-log.timer`.

set -euo pipefail

ENV_FILE=/opt/animaldex/shared/app.env
RUNNER=/usr/local/bin/animaldex-growth-daily-log.sh
LOG=/var/log/animaldex-growth-daily-log.log

if ! sudo grep -q '^CRON_SECRET=' "$ENV_FILE"; then
    echo "CRON_SECRET=$(openssl rand -hex 32)" | sudo tee -a "$ENV_FILE" > /dev/null
    echo "Added CRON_SECRET to $ENV_FILE (live after the next deploy)."
fi

sudo tee "$RUNNER" > /dev/null <<'RUNNER_EOF'
#!/usr/bin/env bash
set -uo pipefail
: "${CRON_SECRET:?CRON_SECRET is required}"
URL='http://127.0.0.1:3001/api/cron/growth-daily-log'
RESULT=$(curl -sS -m 300 -X POST -H "Authorization: Bearer $CRON_SECRET" "$URL" 2>&1)
echo "$(date -u +%FT%TZ) $RESULT" >> /var/log/animaldex-growth-daily-log.log
RUNNER_EOF
sudo chmod 755 "$RUNNER"
sudo touch "$LOG"

sudo tee /etc/systemd/system/animaldex-growth-daily-log.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex growth log auto-fill (growth_marketing_daily)
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=$RUNNER
Nice=10
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-growth-daily-log.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Nightly AnimalDex growth log auto-fill

[Timer]
OnCalendar=*-*-* 20:10:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-growth-daily-log.timer
systemctl list-timers --no-pager | grep animaldex-growth-daily-log
echo "Log: $LOG"
