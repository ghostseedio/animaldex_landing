#!/usr/bin/env bash
# Installs the daily disk cleanup on the production VM.
#
#   U=https://raw.githubusercontent.com/ghostseedio/animaldex_landing/<sha>/scripts
#   curl -fsSLo i.sh $U/install-vm-cleanup-timer.sh && bash i.sh <sha>
#
# 1. Downloads scripts/vm-cleanup.sh at the given commit to
#    /usr/local/bin/animaldex-cleanup.sh.
# 2. Installs animaldex-cleanup.{service,timer}: daily at 04:10 UTC with a
#    random delay, so it never lands on the health check or a deploy.
# 3. Runs it once so the install is verified immediately.
set -euo pipefail

SHA="${1:-main}"
RUNNER=/usr/local/bin/animaldex-cleanup.sh
LOG=/var/log/animaldex-cleanup.log
SRC="https://raw.githubusercontent.com/ghostseedio/animaldex_landing/${SHA}/scripts/vm-cleanup.sh"

sudo curl -fsSLo "$RUNNER" "$SRC"
sudo chmod 755 "$RUNNER"
sudo touch "$LOG"
sudo chown "$(id -un)" "$LOG"

sudo tee /etc/systemd/system/animaldex-cleanup.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex VM disk cleanup (old images, journal, hang dumps)
After=docker.service

[Service]
Type=oneshot
User=$(id -un)
ExecStart=$RUNNER
Nice=10
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-cleanup.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Daily AnimalDex VM disk cleanup

[Timer]
OnCalendar=*-*-* 04:10:00 UTC
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-cleanup.timer
systemctl list-timers --no-pager | grep animaldex-cleanup
bash "$RUNNER"
echo "Log: $LOG"
