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
ENV_FILE="$(mktemp /tmp/animaldex.env.XXXXXX)"
trap 'rm -f "$ENV_FILE"; docker rm -f animaldex-next >/dev/null 2>&1 || true' EXIT

PROXY=(-H 'Host: animaldex.app' -H 'X-Forwarded-Host: animaldex.app' -H 'X-Forwarded-Proto: https')

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

echo "== booting new image on 127.0.0.1:${SIDE_PORT} for a health check"
docker rm -f animaldex-next >/dev/null 2>&1 || true
docker run -d --name animaldex-next --env-file "$ENV_FILE" "${BIND_ARGS[@]}" "${ENTRYPOINT_ARGS[@]}" \
    -p "127.0.0.1:${SIDE_PORT}:3000" "$NEW_IMAGE" "${CMD_ARGS[@]}" >/dev/null
code=000
for _ in $(seq 1 45); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-redirs 0 "${PROXY[@]}" "http://127.0.0.1:${SIDE_PORT}/" || true)"
    [ "$code" = "200" ] && break
    sleep 2
done
echo "new image / -> $code"
if [ "$code" != "200" ]; then
    echo "NEW IMAGE UNHEALTHY, aborting before touching prod" >&2
    docker logs --tail 50 animaldex-next || true
    exit 1
fi
curl -sS -o /dev/null -w 'new image /comparisons/cheetah-vs-leopard -> %{http_code} %{redirect_url}\n' \
    --max-redirs 0 "${PROXY[@]}" "http://127.0.0.1:${SIDE_PORT}/comparisons/cheetah-vs-leopard"
docker rm -f animaldex-next >/dev/null

echo "== swapping ${CONTAINER} (a few seconds of downtime)"
docker rm -f "$CONTAINER"
docker run -d --name "$CONTAINER" --restart "$RESTART" --env-file "$ENV_FILE" "${BIND_ARGS[@]}" "${ENTRYPOINT_ARGS[@]}" \
    -p "$PROD_BIND" "$NEW_IMAGE" "${CMD_ARGS[@]}" >/dev/null
sleep 5
docker ps --filter "name=${CONTAINER}" --format 'running   : {{.Image}} ({{.Status}})'
curl -sS -o /dev/null -w 'prod / -> HTTP %{http_code}\n' "http://127.0.0.1:3001/"
curl -sS -o /dev/null -w 'prod /blog/capture-animals-app -> HTTP %{http_code}\n' "${PROXY[@]}" "http://127.0.0.1:3001/blog/capture-animals-app"

echo
echo "Done. Rollback if needed:"
echo "  curl -fsSL https://raw.githubusercontent.com/ghostseedio/animaldex_landing/main/scripts/deploy-selfhost.sh | bash -s -- ${OLD_IMAGE##*:sha-}"
echo "Reclaim old layers once happy: docker image prune -f"
