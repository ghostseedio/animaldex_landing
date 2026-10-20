#!/usr/bin/env bash
# Installs the 3-hourly page-video auto-generate on the production VM.
#
#   bash install-video-auto-generate-timer.sh
#
# 1. Adds CRON_SECRET to /opt/animaldex/shared/app.env if it is missing. The
#    running container only sees it after the next deploy-selfhost.sh, which
#    merges app.env into the new container's env.
# 2. Writes /usr/local/bin/animaldex-video-auto-generate.sh, which POSTs to
#    /api/cron/video-auto-generate on 127.0.0.1:3001.
# 3. Installs animaldex-video-auto-generate.{service,timer}: every 3 hours at
#    :50 from 01:50 UTC, with a random delay, off the auto-share's :25 slots.
#
# Each run starts at most one video, from a random page family and a random
# page of it without a video, and returns while it renders (5-20 minutes).
# A run skips while a video is being made or a social upload is encoding, and
# when the day's clip budget could not cover one more video. A finished video
# is published to its page, so the auto-share picks it up.
# Pause without the VM: set CONTENT_VIDEO_AUTO_DISABLED=1 in app.env and
# redeploy, or `sudo systemctl disable --now animaldex-video-auto-generate.timer`.

set -euo pipefail

ENV_FILE=/opt/animaldex/shared/app.env
RUNNER=/usr/local/bin/animaldex-video-auto-generate.sh
LOG=/var/log/animaldex-video-auto-generate.log

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
URL='http://127.0.0.1:3001/api/cron/video-auto-generate'
RESULT=$(curl -sS -m 280 -X POST -H "Authorization: Bearer $CRON_SECRET" "$URL" 2>&1)
echo "$(date -u +%FT%TZ) $RESULT" >> /var/log/animaldex-video-auto-generate.log
RUNNER_EOF
sudo chmod 755 "$RUNNER"
sudo touch "$LOG"

sudo tee /etc/systemd/system/animaldex-video-auto-generate.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex page-video auto-generate
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=$RUNNER
Nice=10
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-video-auto-generate.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Every-3-hours AnimalDex page-video auto-generate

[Timer]
OnCalendar=*-*-* 01/3:50:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-video-auto-generate.timer
systemctl list-timers --no-pager | grep animaldex-video-auto-generate
echo "Log: $LOG"
