#!/usr/bin/env bash
# Installs the 10-minute Wildlife Guide sales job on the production VM.
#
#   bash install-wildlife-guide-timer.sh
#
# 1. Adds CRON_SECRET to /opt/animaldex/shared/app.env if it is missing. The
#    running container only sees it after the next deploy-selfhost.sh, which
#    merges app.env into the new container's env.
# 2. Writes /usr/local/bin/animaldex-wildlife-guides.sh, which POSTs to
#    /api/cron/wildlife-guide-refunds (queued card refunds to Paddle) and then
#    /api/cron/wildlife-guide-emails (sale, reminder, refund and payout emails
#    through Resend) on 127.0.0.1:3001.
# 3. Installs animaldex-wildlife-guides.{service,timer}: every 10 minutes at
#    :05, :15, ... with a short random delay. The database sweep that queues
#    no-reply refunds and emails runs at :03, :13, ...
#
# Pause: `sudo systemctl disable --now animaldex-wildlife-guides.timer`. Queued
# emails and refunds wait in the database and go out when it is back.

set -euo pipefail

ENV_FILE=/opt/animaldex/shared/app.env
RUNNER=/usr/local/bin/animaldex-wildlife-guides.sh
LOG=/var/log/animaldex-wildlife-guides.log

# app.env is root-only (chmod 600), so it is read and written with sudo, and
# the service gets CRON_SECRET through EnvironmentFile.
if ! sudo grep -q '^CRON_SECRET=' "$ENV_FILE"; then
    echo "CRON_SECRET=$(openssl rand -hex 32)" | sudo tee -a "$ENV_FILE" > /dev/null
    echo "Added CRON_SECRET to $ENV_FILE (live after the next deploy)."
fi

sudo tee "$RUNNER" > /dev/null <<'RUNNER_EOF'
#!/usr/bin/env bash
set -uo pipefail
: "${CRON_SECRET:?CRON_SECRET is required}"
for JOB in wildlife-guide-refunds wildlife-guide-emails; do
    RESULT=$(curl -sS -m 120 -X POST -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:3001/api/cron/$JOB" 2>&1)
    echo "$(date -u +%FT%TZ) $JOB $RESULT" >> /var/log/animaldex-wildlife-guides.log
done
RUNNER_EOF
sudo chmod 755 "$RUNNER"
sudo touch "$LOG"

sudo tee /etc/systemd/system/animaldex-wildlife-guides.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex Wildlife Guide card refunds and sales emails
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=$RUNNER
Nice=10
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-wildlife-guides.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Wildlife Guide refunds and emails every 10 minutes

[Timer]
OnCalendar=*:05/10
RandomizedDelaySec=60
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-wildlife-guides.timer
systemctl list-timers --no-pager | grep animaldex-wildlife-guides
echo "Log: $LOG"
