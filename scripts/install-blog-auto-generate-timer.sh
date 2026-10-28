#!/usr/bin/env bash
# Installs the twice-daily blog auto-generate (news articles) on the production VM.
#
#   bash install-blog-auto-generate-timer.sh
#
# 1. Adds CRON_SECRET to /opt/animaldex/shared/app.env if it is missing. The
#    running container only sees it after the next deploy-selfhost.sh, which
#    merges app.env into the new container's env.
# 2. Writes /usr/local/bin/animaldex-blog-auto-generate.sh, which POSTs to
#    /api/cron/blog-auto-generate on 127.0.0.1:3001.
# 3. Installs animaldex-blog-auto-generate.{service,timer}: 07:40 and 19:40 UTC,
#    with a random delay, off the auto-share's :25 and the video timer's :50.
#
# Each run is "Latest news" → "Auto-pick and write" in /admin/blog-generator
# with a random focus (src/lib/blog-generator/auto-generate-plan.ts), standard
# research depth, and publishing on; it returns while the article is written
# (10-20 minutes). A run skips while another article is being written.
# Pause without the VM: set BLOG_AUTO_GENERATE_DISABLED=1 in app.env and
# redeploy, or `sudo systemctl disable --now animaldex-blog-auto-generate.timer`.

set -euo pipefail

ENV_FILE=/opt/animaldex/shared/app.env
RUNNER=/usr/local/bin/animaldex-blog-auto-generate.sh
LOG=/var/log/animaldex-blog-auto-generate.log

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
URL='http://127.0.0.1:3001/api/cron/blog-auto-generate'
RESULT=$(curl -sS -m 120 -X POST -H "Authorization: Bearer $CRON_SECRET" "$URL" 2>&1)
echo "$(date -u +%FT%TZ) $RESULT" >> /var/log/animaldex-blog-auto-generate.log
RUNNER_EOF
sudo chmod 755 "$RUNNER"
sudo touch "$LOG"

sudo tee /etc/systemd/system/animaldex-blog-auto-generate.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex blog auto-generate (news articles)
After=docker.service

[Service]
Type=oneshot
EnvironmentFile=$ENV_FILE
ExecStart=$RUNNER
Nice=10
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-blog-auto-generate.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Twice-daily AnimalDex blog auto-generate

[Timer]
OnCalendar=*-*-* 07,19:40:00
RandomizedDelaySec=300
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-blog-auto-generate.timer
systemctl list-timers --no-pager | grep animaldex-blog-auto-generate
echo "Log: $LOG"
