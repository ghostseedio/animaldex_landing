#!/usr/bin/env bash
# Roll the production VM's `animaldex-app` container onto a new GHCR image.
#
# Usage (on the VM):
#   curl -fsSL https://raw.githubusercontent.com/ghostseedio/animaldex_landing/main/scripts/deploy-selfhost.sh | bash -s -- <git sha>
#
# The image must already exist: run the "Build self-host Docker image"
# workflow for that sha first. The script reuses the running container's env
# and restart policy, health-checks the new image on a side port before the
# swap, and prints the rollback command. Run it as a script, never `source`
# it: `set -e` in an interactive login shell closes the SSH session on error.
#
# Zero downtime: once nginx has the :3002 backup (scripts/install-nginx-zero-downtime.sh,
# run once), the health-checked new image keeps running on :3002 while the
# prod container is swapped, and nginx serves visitors from it until :3001
# answers again. A new prod container that never comes up is rolled back to
# the old image. The health-check watchdog is paused for the swap.
set -euo pipefail

SHA="${1:-}"
if [ -z "$SHA" ]; then
    echo "usage: $0 <full git sha>" >&2
    exit 2
fi

CONTAINER="animaldex-app"
NEW_IMAGE="ghcr.io/ghostseedio/animaldex_landing:sha-${SHA}"
PROD_BIND="127.0.0.1:3001:3000"
SIDE_PORT=3002
WATCHDOG="animaldex-healthcheck.timer"
ENV_FILE="$(mktemp /tmp/animaldex.env.XXXXXX)"
PROBE_LOG="$(mktemp /tmp/animaldex-probe.XXXXXX)"
probe_pid=""
watchdog_paused=0
keep_side=0
cleanup() {
    [ -n "$probe_pid" ] && kill "$probe_pid" 2>/dev/null
    [ "$watchdog_paused" = 1 ] && systemctl start "$WATCHDOG" 2>/dev/null
    [ "$keep_side" = 1 ] || docker rm -f animaldex-next >/dev/null 2>&1
    rm -f "$ENV_FILE" "$PROBE_LOG"
    return 0
}
trap cleanup EXIT

PROXY=(-H 'Host: animaldex.app' -H 'X-Forwarded-Host: animaldex.app' -H 'X-Forwarded-Proto: https')

# Polls / on 127.0.0.1:<port> every 2 s, up to <tries> times; leaves the last status in $code.
code=000
wait_healthy() {
    for _ in $(seq 1 "$2"); do
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --max-redirs 0 "${PROXY[@]}" "http://127.0.0.1:$1/" || true)"
        [ "$code" = "200" ] && return 0
        sleep 2
    done
    return 1
}

# A pull needs several GB. If the disk is tight, drop stale image tags first
# (the daily animaldex-cleanup timer does the same); abort if it is still tight
# rather than fill the disk, which has taken the site down before.
free_gb=$(df --output=avail -BG / | tail -1 | tr -dc 0-9)
if [ "${free_gb:-0}" -lt 8 ] && [ -x /usr/local/bin/animaldex-cleanup.sh ]; then
    echo "== only ${free_gb} GB free, running animaldex-cleanup first"
    /usr/local/bin/animaldex-cleanup.sh || true
    free_gb=$(df --output=avail -BG / | tail -1 | tr -dc 0-9)
fi
if [ "${free_gb:-0}" -lt 6 ]; then
    echo "only ${free_gb} GB free on /, not pulling a new image; free space first" >&2
    exit 1
fi

OLD_IMAGE="$(docker inspect "$CONTAINER" --format '{{.Config.Image}}')"
RESTART="$(docker inspect "$CONTAINER" --format '{{.HostConfig.RestartPolicy.Name}}')"
RESTART="${RESTART:-unless-stopped}"
# The VM mounts a signal handler into /app and may start node through it, so
# binds, entrypoint and command are replicated from the running container.
BIND_ARGS=()
while IFS= read -r bind; do
    [ -n "$bind" ] && BIND_ARGS+=(-v "$bind")
done < <(docker inspect "$CONTAINER" --format '{{range .HostConfig.Binds}}{{println .}}{{end}}')
ENTRYPOINT_ARGS=()
entrypoint="$(docker inspect "$CONTAINER" --format '{{range .Config.Entrypoint}}{{.}} {{end}}')"
entrypoint="${entrypoint% }"
[ -n "$entrypoint" ] && ENTRYPOINT_ARGS=(--entrypoint "$entrypoint")
CMD_ARGS=()
while IFS= read -r word; do
    [ -n "$word" ] && CMD_ARGS+=("$word")
done < <(docker inspect "$CONTAINER" --format '{{range .Config.Cmd}}{{println .}}{{end}}')
echo "old image : $OLD_IMAGE"
echo "new image : $NEW_IMAGE"
echo "restart   : $RESTART"
echo "binds     : ${BIND_ARGS[*]:-none}"
echo "entrypoint: ${entrypoint:-image default}"
echo "command   : ${CMD_ARGS[*]:-image default}"

docker pull "$NEW_IMAGE"

# PATH/HOSTNAME/HOME/NODE_VERSION/YARN_VERSION come from the image; everything else is ours.
docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -vE '^(PATH|HOSTNAME|HOME|NODE_VERSION|YARN_VERSION)=' | sed '/^$/d' > "$ENV_FILE"
echo "env vars  : $(wc -l < "$ENV_FILE") carried over ($(grep -E '^NODE_OPTIONS=' "$ENV_FILE" || echo 'no NODE_OPTIONS'))"
# New or changed variables go in this file (KEY=value lines, no quotes, chmod
# 600); its values replace the carried-over ones, and later deploys keep them
# because they carry the running container's env forward.
EXTRA_ENV="/opt/animaldex/shared/app.env"
if [ -r "$EXTRA_ENV" ]; then
    keys="$(grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$EXTRA_ENV" | sed 's/=$//' | paste -sd'|' - || true)"
    if [ -n "$keys" ]; then
        { grep -vE "^(${keys})=" "$ENV_FILE" || true; } > "$ENV_FILE.merged"
        grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$EXTRA_ENV" >> "$ENV_FILE.merged"
        mv "$ENV_FILE.merged" "$ENV_FILE"
        echo "env vars  : $(echo "$keys" | tr '|' '\n' | wc -l) set from $EXTRA_ENV ($(echo "$keys" | tr '|' ' '))"
    fi
fi

echo "== booting new image on 127.0.0.1:${SIDE_PORT} for a health check"
docker rm -f animaldex-next >/dev/null 2>&1 || true
docker run -d --name animaldex-next --env-file "$ENV_FILE" "${BIND_ARGS[@]}" "${ENTRYPOINT_ARGS[@]}" \
    -p "127.0.0.1:${SIDE_PORT}:3000" "$NEW_IMAGE" "${CMD_ARGS[@]}" >/dev/null
wait_healthy "$SIDE_PORT" 45 || true
echo "new image / -> $code"
if [ "$code" != "200" ]; then
    echo "NEW IMAGE UNHEALTHY, aborting before touching prod" >&2
    docker logs --tail 50 animaldex-next || true
    exit 1
fi
curl -sS -o /dev/null -w 'new image /comparisons/cheetah-vs-leopard -> %{http_code} %{redirect_url}\n' \
    --max-redirs 0 "${PROXY[@]}" "http://127.0.0.1:${SIDE_PORT}/comparisons/cheetah-vs-leopard"

backup_ready=0
grep -RqsE "^[[:space:]]*server[[:space:]]+127\.0\.0\.1:${SIDE_PORT}[[:space:]]+backup" /etc/nginx/ && backup_ready=1
if [ "$backup_ready" = 1 ]; then
    echo "== swapping ${CONTAINER}; nginx serves the new image from :${SIDE_PORT} meanwhile"
else
    docker rm -f animaldex-next >/dev/null
    echo "== swapping ${CONTAINER} (down until it boots: nginx has no :${SIDE_PORT} backup; run scripts/install-nginx-zero-downtime.sh once)"
fi
if systemctl is-active --quiet "$WATCHDOG" 2>/dev/null; then
    systemctl stop "$WATCHDOG"
    watchdog_paused=1
fi
# What visitors get through Cloudflare during the swap, once a second (the
# query string misses any edge cache).
( while :; do
    curl -s -o /dev/null --max-time 5 -w '%{http_code}\n' "https://animaldex.app/?deploy-probe=$(date +%s%N)" >> "$PROBE_LOG" 2>/dev/null || true
    sleep 1
done ) &
probe_pid=$!

run_prod() {
    docker run -d --name "$CONTAINER" --restart "$RESTART" --env-file "$ENV_FILE" "${BIND_ARGS[@]}" "${ENTRYPOINT_ARGS[@]}" \
        -p "$PROD_BIND" "$1" "${CMD_ARGS[@]}" >/dev/null
}
docker stop -t 10 "$CONTAINER" >/dev/null 2>&1 || true
docker rm -f "$CONTAINER" >/dev/null
run_prod "$NEW_IMAGE"
if ! wait_healthy 3001 45; then
    echo "NEW PROD CONTAINER UNHEALTHY (/ -> $code); rolling back to $OLD_IMAGE" >&2
    docker logs --tail 50 "$CONTAINER" >&2 || true
    docker rm -f "$CONTAINER" >/dev/null
    run_prod "$OLD_IMAGE"
    if wait_healthy 3001 45; then
        echo "rolled back: prod is on $OLD_IMAGE again" >&2
    elif [ "$backup_ready" = 1 ]; then
        keep_side=1
        echo "ROLLBACK UNHEALTHY TOO: left animaldex-next ($NEW_IMAGE) on :${SIDE_PORT}, which nginx serves from. Fix :3001 before removing it." >&2
    fi
    exit 1
fi
kill "$probe_pid" 2>/dev/null || true
wait "$probe_pid" 2>/dev/null || true
probe_pid=""
docker rm -f animaldex-next >/dev/null 2>&1 || true
if [ "$watchdog_paused" = 1 ]; then
    systemctl start "$WATCHDOG"
    watchdog_paused=0
fi
docker ps --filter "name=${CONTAINER}" --format 'running   : {{.Image}} ({{.Status}})'
echo "visitors  : $(sort "$PROBE_LOG" | uniq -c | awk '{printf "%s HTTP %s, ", $1, $2}' | sed 's/, $//') during the swap"
curl -sS -o /dev/null -w 'prod / -> HTTP %{http_code}\n' "${PROXY[@]}" "http://127.0.0.1:3001/"
curl -sS -o /dev/null -w 'prod /blog/capture-animals-app -> HTTP %{http_code}\n' "${PROXY[@]}" "http://127.0.0.1:3001/blog/capture-animals-app"

echo
echo "Done. Rollback if needed:"
echo "  curl -fsSL https://raw.githubusercontent.com/ghostseedio/animaldex_landing/main/scripts/deploy-selfhost.sh | bash -s -- ${OLD_IMAGE##*:sha-}"

# Keep only the new image and the one it replaced; every older tag goes now,
# so the disk never again fills with a month of deploys.
echo "== removing image tags older than ${OLD_IMAGE##*:sha-}"
removed=0
while IFS= read -r tag; do
    [ -z "$tag" ] && continue
    [ "$tag" = "$NEW_IMAGE" ] && continue
    [ "$tag" = "$OLD_IMAGE" ] && continue
    if docker image rm "$tag" >/dev/null 2>&1; then removed=$((removed + 1)); fi
done < <(docker image ls ghcr.io/ghostseedio/animaldex_landing --format '{{.Repository}}:{{.Tag}}')
docker image prune -f >/dev/null 2>&1 || true
echo "removed ${removed} old tag(s); disk now $(df --output=pcent / | tail -1 | tr -d ' ') used"

# A fresh container starts with an empty ISR cache (the home page pre-renders
# no locale, the hubs revalidate daily), so the first visitor to each hub pays
# a 3-10 s cold render. Warm the new container before they do. This has to run
# against the swapped-in container: the side container's filesystem, cache
# included, went with `docker rm -f animaldex-next`. Best effort throughout; a
# warm-up error never fails the deploy.
echo "== warming the ISR cache on 127.0.0.1:3001"
warm_start=$(date +%s)
warm_count=0
warm_done=" "
warm_url() {
    case "$warm_done" in *" $1 "*) return 0 ;; esac
    curl -s -o /dev/null --max-time "$2" "${PROXY[@]}" "http://127.0.0.1:3001$1" || true
    warm_done="${warm_done}$1 "
    warm_count=$((warm_count + 1))
}
for path in / /id /es/tier-list /fr/tier-list /pt/tier-list /animals /blog \
    /tier-list /locations /animal-hybrids /comparisons /animal-powers \
    /qualities /animal-frequencies /animal-trials /pokemon-animals \
    /wildlife-guides /animals/lion /animals/bengal-tiger \
    /animals/red-fox /animals/bald-eagle /animals/great-white-shark \
    /animals/cheetah; do
    warm_url "$path" 30
done
# The sitemap is a daily-ISR route itself, so this fetch warms it as well.
# Its <loc>s carry the public host; keep the path and hit it on the prod port.
sitemap_paths="$(curl -s --max-time 30 "${PROXY[@]}" "http://127.0.0.1:3001/sitemap.xml" \
    | grep -oE '<loc>[^<]+</loc>' \
    | sed -E 's#^<loc>https?://[^/]+##; s#</loc>$##' \
    | grep -E '^/' | head -40 || true)"
while IFS= read -r path; do
    [ -n "$path" ] && warm_url "$path" 20
done <<< "$sitemap_paths"
echo "warmed ${warm_count} URL(s) in $(( $(date +%s) - warm_start )) s"
