#!/usr/bin/env bash
# Production watchdog: restarts animaldex-app when it has really stopped
# answering. Runs from a systemd timer a minute after each run ends (install
# with scripts/install-healthcheck-timer.sh). Log: /var/log/animaldex-healthcheck.log,
# one folder per restart under /var/log/animaldex-hangs/.
#
# Rewritten Nov 1 2026. The old watchdog (one probe, 10 s timeout, ~45 s of
# perf capture before the restart) turned short stalls into outages: it
# restarted containers that were still warming up (a fresh Next.js spends a
# minute or two at full CPU), which then failed the next probe too, so one
# stall became two or three restarts (Nov 1: 11:03, 11:05, 11:08; 13:56,
# 14:04). Now:
#   - a container started under GRACE_SECONDS ago is left to warm up;
#   - a deploy in progress (its animaldex-next side container) is left alone;
#   - it restarts only after two failed probes PROBE_GAP seconds apart;
#   - it saves stats/top/logs/pressure (seconds) and restarts straight away;
#   - after the restart it waits up to 2 minutes for / and logs how long it took.
set -uo pipefail

URL="http://127.0.0.1:3001/"
CONTAINER="animaldex-app"
LOG="/var/log/animaldex-healthcheck.log"
CAPTURE_DIR="/var/log/animaldex-hangs"
GRACE_SECONDS=180
PROBE_GAP=20

say() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*" >> "$LOG"; }
probe() { curl --max-time "$1" --fail --silent --output /dev/null "$URL"; }

# A deploy is swapping containers; deploy-selfhost.sh watches that itself.
if docker ps --format '{{.Names}}' | grep -qx animaldex-next; then exit 0; fi

started=$(docker inspect -f '{{.State.StartedAt}}' "$CONTAINER" 2>/dev/null) || {
    say "no $CONTAINER container - nothing to restart"
    exit 0
}
if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" != "true" ]; then
    say "$CONTAINER is not running - starting it"
    docker start "$CONTAINER" >> "$LOG" 2>&1
    exit 0
fi

# Still warming up (just deployed, restarted or booted).
started_at=$(date -d "$started" +%s 2>/dev/null || echo 0)
age=$(( $(date +%s) - started_at ))
[ "$age" -lt "$GRACE_SECONDS" ] && exit 0

probe 15 && exit 0
sleep "$PROBE_GAP"
if probe 20; then
    say "slow answer (over 15 s) - recovered without a restart"
    exit 0
fi

TS=$(date -u '+%Y%m%dT%H%M%SZ')
INCIDENT="$CAPTURE_DIR/$TS"
mkdir -p "$INCIDENT"
say "health check FAILED twice - restarting incident=$INCIDENT"

timeout 10 docker stats "$CONTAINER" --no-stream > "$INCIDENT/docker-stats.txt" 2>&1
timeout 10 docker top "$CONTAINER" -eo pid,ppid,stat,%cpu,%mem,etime,args > "$INCIDENT/docker-top.txt" 2>&1
timeout 10 docker logs "$CONTAINER" --tail 400 > "$INCIDENT/docker-logs.txt" 2>&1
{ uptime; free -m; for f in cpu memory io; do echo "$f: $(cat /proc/pressure/$f 2>/dev/null | tr '\n' ' ')"; done; } > "$INCIDENT/host.txt" 2>&1
timeout 5 ss -tanp > "$INCIDENT/sockets.txt" 2>&1

t0=$(date +%s)
docker restart -t 20 "$CONTAINER" >> "$LOG" 2>&1
for _ in $(seq 1 24); do
    sleep 5
    if probe 10; then
        say "recovery SUCCESS after $(( $(date +%s) - t0 ))s incident=$INCIDENT"
        exit 0
    fi
done
say "recovery FAILED: / still not answering $(( $(date +%s) - t0 ))s after the restart incident=$INCIDENT"
exit 1
