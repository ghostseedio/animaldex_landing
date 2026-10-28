#!/usr/bin/env bash
# One-time VM setup for zero-downtime deploys. nginx gets an upstream with the
# app on 127.0.0.1:3001 and a backup on 127.0.0.1:3002; deploy-selfhost.sh
# keeps the new image running on 3002 while it swaps the prod container, so
# visitors are served throughout instead of getting ~1 minute of 502s.
#
#   U=https://raw.githubusercontent.com/ghostseedio/animaldex_landing/<sha>/scripts
#   curl -fsSLo z.sh $U/install-nginx-zero-downtime.sh && sudo bash z.sh
#
# Idempotent. Backs up every file it edits to /opt/animaldex/shared/, checks the
# result with `nginx -t` and puts the old files back if it fails; reloads
# nginx gracefully (no dropped connections).
set -euo pipefail

UPSTREAM_CONF=/etc/nginx/conf.d/10-animaldex-upstream.conf
BACKUP_DIR="/opt/animaldex/shared/nginx-backup-$(date -u +%Y%m%dT%H%M%SZ)"
APP_URL_RE='http://(127\.0\.0\.1|localhost):3001'

[ "$(id -u)" = 0 ] || { echo "run it with sudo" >&2; exit 1; }
command -v nginx >/dev/null || { echo "nginx is not installed" >&2; exit 1; }

if grep -RqsE '^[[:space:]]*server[[:space:]]+127\.0\.0\.1:3002[[:space:]]+backup' /etc/nginx/; then
    echo "nginx already has the 127.0.0.1:3002 backup; nothing to do"
    exit 0
fi

# Sites that proxy straight to the app (sites-enabled holds symlinks: edit the
# real file), and any existing upstream block that lists the app.
mapfile -t direct < <(grep -RlsE "proxy_pass[[:space:]]+${APP_URL_RE}" /etc/nginx/sites-enabled /etc/nginx/conf.d \
    | xargs -r -n1 readlink -f | sort -u)
mapfile -t upstreams < <(grep -RlsE "^[[:space:]]*server[[:space:]]+(127\.0\.0\.1|localhost):3001\b" /etc/nginx/sites-enabled /etc/nginx/conf.d \
    | xargs -r -n1 readlink -f | sort -u)

if [ "${#direct[@]}" -eq 0 ] && [ "${#upstreams[@]}" -eq 0 ]; then
    echo "found no nginx config that proxies to 127.0.0.1:3001; nothing changed. What proxies:" >&2
    nginx -T 2>/dev/null | grep -nE 'proxy_pass|upstream|server[[:space:]]+[0-9a-z.]+:[0-9]+' >&2 || true
    exit 1
fi

mkdir -p "$BACKUP_DIR"
edited=("${direct[@]}" "${upstreams[@]}")
for file in "${edited[@]}"; do
    cp -a "$file" "$BACKUP_DIR/$(echo "$file" | tr / _)"
done
restore() {
    for file in "${edited[@]}"; do
        cp -a "$BACKUP_DIR/$(echo "$file" | tr / _)" "$file"
    done
    [ "${#direct[@]}" -gt 0 ] && rm -f "$UPSTREAM_CONF"
    return 0
}

# max_fails=0 keeps the app from ever being marked down: between deploys
# nothing listens on 3002, so one failed request must not send the next ones
# to the empty backup. A request the app refuses still goes to the backup.
if [ "${#direct[@]}" -gt 0 ]; then
    cat > "$UPSTREAM_CONF" <<'EOF'
# animaldex.app (scripts/install-nginx-zero-downtime.sh): the app container on
# 3001; during a deploy the new image also runs on 3002 and serves while 3001
# restarts. max_fails=0: the app is never marked down between deploys, when
# nothing listens on 3002.
upstream animaldex_app {
    server 127.0.0.1:3001 max_fails=0;
    server 127.0.0.1:3002 backup;
}
EOF
    for file in "${direct[@]}"; do
        sed -i -E "s#proxy_pass([[:space:]]+)${APP_URL_RE}#proxy_pass\\1http://animaldex_app#g" "$file"
        echo "edited    : $file (proxy_pass -> http://animaldex_app)"
    done
    echo "wrote     : $UPSTREAM_CONF"
fi
for file in "${upstreams[@]}"; do
    sed -i -E 's#^([[:space:]]*)server[[:space:]]+(127\.0\.0\.1|localhost):3001\b([^;]*);#\1server \2:3001\3 max_fails=0;\n\1server 127.0.0.1:3002 backup;#' "$file"
    echo "edited    : $file (added the 127.0.0.1:3002 backup)"
done

if ! nginx -t; then
    echo "nginx -t failed; restoring the previous config from $BACKUP_DIR" >&2
    restore
    nginx -t && systemctl reload nginx
    exit 1
fi
systemctl reload nginx
echo "backup of the old files: $BACKUP_DIR"
sleep 2
curl -sS -o /dev/null -w 'https://animaldex.app/ -> HTTP %{http_code}\n' https://animaldex.app/ || true
echo "Done. Deploys with scripts/deploy-selfhost.sh now keep the site up while they swap."
