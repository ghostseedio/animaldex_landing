#!/usr/bin/env bash
# Installs (or updates) the production watchdog on the VM.
#
#   U=https://raw.githubusercontent.com/ghostseedio/animaldex_landing/<sha>/scripts
#   curl -fsSLo i.sh $U/install-healthcheck-timer.sh && bash i.sh <sha>
#
# 1. Downloads scripts/vm-healthcheck.sh at the given commit to
#    /usr/local/bin/animaldex-healthcheck.sh (the old one is kept as .bak).
# 2. Writes animaldex-healthcheck.{service,timer}: first run 2 minutes after
#    boot, then a minute after each run ends. Runs as root (docker, /var/log).
# 3. Checks the script parses, then restarts the timer.
# deploy-selfhost.sh stops and restarts this timer around every swap.
set -euo pipefail

SHA="${1:-main}"
RUNNER=/usr/local/bin/animaldex-healthcheck.sh
SRC="https://raw.githubusercontent.com/ghostseedio/animaldex_landing/${SHA}/scripts/vm-healthcheck.sh"

TMP="$(mktemp)"
curl -fsSLo "$TMP" "$SRC"
bash -n "$TMP"
[ -f "$RUNNER" ] && sudo cp "$RUNNER" "$RUNNER.bak"
sudo install -m 755 "$TMP" "$RUNNER"
rm -f "$TMP"
sudo mkdir -p /var/log/animaldex-hangs
sudo touch /var/log/animaldex-healthcheck.log

sudo tee /etc/systemd/system/animaldex-healthcheck.service > /dev/null <<SERVICE_EOF
[Unit]
Description=AnimalDex production health check
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=oneshot
ExecStart=$RUNNER
TimeoutStartSec=300
SERVICE_EOF

sudo tee /etc/systemd/system/animaldex-healthcheck.timer > /dev/null <<'TIMER_EOF'
[Unit]
Description=Run AnimalDex production health check every minute

[Timer]
OnBootSec=2min
OnUnitInactiveSec=1min
AccuracySec=10s
Persistent=true

[Install]
WantedBy=timers.target
TIMER_EOF

sudo systemctl daemon-reload
sudo systemctl enable animaldex-healthcheck.timer
sudo systemctl restart animaldex-healthcheck.timer
systemctl list-timers --no-pager | grep animaldex-healthcheck
echo "Installed $RUNNER from ${SHA}. Log: /var/log/animaldex-healthcheck.log"
