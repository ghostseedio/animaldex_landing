#!/usr/bin/env bash
# Keeps the production VM's disk clear. Runs daily from a systemd timer
# (install with scripts/install-vm-cleanup-timer.sh) and at the end of every
# deploy-selfhost.sh.
#
# The disk filled twice in October 2026, both times to 502s: once from a
# runaway log, once from 14 stale animaldex_landing image tags at ~4.7 GB each
# (`docker image prune -f` frees nothing there, the tags are not dangling).
#
# What it does, in order:
#   1. Removes every animaldex_landing image tag except the one the running
#      container uses and the newest other tag, kept for rollback.
#   2. Prunes dangling images and exited containers older than 30 days.
#   3. Caps the systemd journal at 200 MB and drops health-check hang dumps
#      older than 14 days.
# It never touches a deploy in progress: if the animaldex-next health-check
# container exists, image removal is skipped for this run.
#
#   bash vm-cleanup.sh            # run now
#   bash vm-cleanup.sh --dry-run  # print what would go
set -uo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
LOG=/var/log/animaldex-cleanup.log
CONTAINER=animaldex-app
REPO=ghcr.io/ghostseedio/animaldex_landing

say() {
    local line="$(date -u +%FT%TZ) $*"
    echo "$line"
    [ -w "$LOG" ] && echo "$line" >> "$LOG"
    return 0
}
# In --dry-run every mutating command is printed instead of executed.
run() { if [ "$DRY" = 1 ]; then echo "would: $*"; else "$@" >/dev/null 2>&1; fi; }

before=$(df --output=pcent / | tail -1 | tr -dc 0-9)
say "start: disk ${before}% used"

if docker ps -a --format '{{.Names}}' | grep -qx animaldex-next; then
    say "deploy in progress (animaldex-next exists), skipping image removal"
else
    running=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null || true)
    # Newest tag that is not the running one stays for rollback.
    rollback=$(docker image ls "$REPO" --format '{{.CreatedAt}} {{.Repository}}:{{.Tag}}' \
        | sort -r | awk '{print $NF}' | grep -v -x -F "$running" | head -1 || true)
    removed=0
    while IFS= read -r tag; do
        [ -z "$tag" ] && continue
        [ "$tag" = "$running" ] && continue
        [ "$tag" = "$rollback" ] && continue
        if run docker image rm "$tag"; then removed=$((removed + 1)); fi
    done < <(docker image ls "$REPO" --format '{{.Repository}}:{{.Tag}}')
    say "images: kept running=${running##*:} rollback=${rollback##*:}, removed ${removed} tag(s)"
fi

run docker image prune -f || true
run docker container prune -f --filter "until=720h" || true
run sudo journalctl --vacuum-size=200M || true
if [ -d /var/log/animaldex-hangs ]; then
    run sudo find /var/log/animaldex-hangs -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} + || true
fi

after=$(df --output=pcent / | tail -1 | tr -dc 0-9)
say "done: disk ${after}% used"
if [ "${after:-0}" -ge 85 ]; then
    say "WARNING: disk still ${after}% after cleanup; largest dirs follow"
    sudo du -xsh /var/lib/docker /var/log /opt/animaldex /tmp /home 2>/dev/null | sort -h | tail -5 | tee -a "$LOG"
fi
