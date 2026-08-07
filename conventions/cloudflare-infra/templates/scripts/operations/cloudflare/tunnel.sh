#!/usr/bin/env bash
# Check or explicitly reconcile Cloudflare tunnel ingress and DNS from the manifest.
set -euo pipefail

OPERATIONS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$OPERATIONS_ROOT/../.." && pwd)"
PATH="$PROJECT_ROOT/.tooling/bin:$PATH"
export PATH
CONFIG_FILE="$PROJECT_ROOT/operations.config.json"
MODE="check"
API="https://api.cloudflare.com/client/v4"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_FILE="${2:?}"; shift 2 ;;
    --check) MODE="check"; shift ;;
    --apply) MODE="apply"; shift ;;
    --run) MODE="run"; shift ;;
    -h | --help) echo "Usage: tunnel.sh [--config file] [--check|--apply|--run]"; exit 0 ;;
    *) echo "tunnel: unknown option $1" >&2; exit 1 ;;
  esac
done

"$OPERATIONS_ROOT/validate-config.sh" "$CONFIG_FILE"
# shellcheck source=/dev/null
source "$OPERATIONS_ROOT/shared/dotenv.sh"
[[ -f "$PROJECT_ROOT/.env" ]] && dotenv::fill "$PROJECT_ROOT/.env" CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
: "${CLOUDFLARE_API_TOKEN:?missing CLOUDFLARE_API_TOKEN in the environment or .env}"
: "${CLOUDFLARE_ACCOUNT_ID:?missing CLOUDFLARE_ACCOUNT_ID in the environment or .env}"

api() {
  curl -sS -K - "$@" <<EOF
header = "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
EOF
}

result() {
  local filter="$1" payload
  payload="$(cat)"
  if ! jq -e '.success == true' <<<"$payload" >/dev/null; then
    echo "Cloudflare API error: $(jq -r '[.errors[]?.message] | join("; ")' <<<"$payload")" >&2
    return 1
  fi
  jq -r "$filter" <<<"$payload"
}

send_json() {
  local method="$1" url="$2" body="$3" temp_file status=0
  temp_file="$(mktemp)"
  chmod 600 "$temp_file"
  printf '%s' "$body" >"$temp_file"
  api -X "$method" "$url" -H "Content-Type: application/json" --data-binary "@$temp_file" \
    | result '.result // empty' >/dev/null || status=$?
  rm -f -- "$temp_file"
  return "$status"
}

tunnel_name="$(jq -r '.cloudflare.tunnelName' "$CONFIG_FILE")"
zone="$(jq -r '.cloudflare.zone' "$CONFIG_FILE")"
tunnel_id="$(api -G "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel" \
  --data-urlencode "name=$tunnel_name" --data-urlencode "is_deleted=false" \
  | result '.result[0].id // empty')"
[[ -n "$tunnel_id" ]] || { echo "tunnel: no tunnel named '$tunnel_name'" >&2; exit 1; }

config_url="$API/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id/configurations"
current="$(api "$config_url" | result '.result.config // {} | @json')"
desired="$(printf '%s' "$current" \
  | env OPERATIONS_ROOT="$OPERATIONS_ROOT" \
    "$OPERATIONS_ROOT/cloudflare/tunnel-plan.sh" "$CONFIG_FILE")"
drift=0
if [[ -n "$desired" ]]; then
  drift=1
  echo "tunnel: ingress differs"
  [[ "$MODE" == "apply" ]] && send_json PUT "$config_url" "{\"config\":$desired}"
fi

zone_id="$(api -G "$API/zones" --data-urlencode "name=$zone" | result '.result[0].id // empty')"
[[ -n "$zone_id" ]] || { echo "tunnel: no zone named '$zone'" >&2; exit 1; }
content="$tunnel_id.cfargotunnel.com"
while IFS= read -r hostname; do
  [[ -n "$hostname" ]] || continue
  record="$(api -G "$API/zones/$zone_id/dns_records" --data-urlencode "name=$hostname" | result '.result[0] // null | @json')"
  if ! jq -e --arg content "$content" '.type == "CNAME" and .content == $content and .proxied == true' <<<"$record" >/dev/null; then
    drift=1
    echo "tunnel: DNS differs for $hostname"
    if [[ "$MODE" == "apply" ]]; then
      body="$(jq -nc --arg name "$hostname" --arg content "$content" '{type:"CNAME",name:$name,content:$content,proxied:true,comment:"toolu local dev tunnel"}')"
      record_id="$(jq -r '.id // empty' <<<"$record")"
      if [[ -n "$record_id" ]]; then
        send_json PATCH "$API/zones/$zone_id/dns_records/$record_id" "$body"
      else
        send_json POST "$API/zones/$zone_id/dns_records" "$body"
      fi
    fi
  fi
done < <(jq -r '.services[] | .localHostname // empty' "$CONFIG_FILE")

if [[ "$MODE" == "check" && $drift -eq 1 ]]; then
  echo "tunnel: drift found; review it, then run with --apply" >&2
  exit 1
fi
if [[ "$MODE" == "apply" ]]; then
  echo "tunnel: configuration reconciled"
  exit 0
fi
if [[ "$MODE" == "run" ]]; then
  [[ $drift -eq 0 ]] || { echo "tunnel: refusing to run with drift; apply it explicitly first" >&2; exit 1; }
  command -v cloudflared >/dev/null 2>&1 || { echo "tunnel: cloudflared is required" >&2; exit 1; }
  token="$(api "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id/token" | result '.result')"
  exec cloudflared tunnel --no-autoupdate run --token-file <(printf '%s' "$token")
else
  echo "tunnel: configuration is in sync"
fi
