#!/usr/bin/env bash
# Start every configured local service and optional provider adapters.
set -euo pipefail

OPERATIONS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$OPERATIONS_ROOT/../.." && pwd)"
PATH="$PROJECT_ROOT/.tooling/bin:$PATH"
export PATH
CONFIG_FILE="$PROJECT_ROOT/operations.config.json"
while [[ $# -gt 0 ]]; do
  case "$1" in --config) CONFIG_FILE="${2:?}"; shift 2 ;; -h | --help) echo "Usage: start.sh [--config file]"; exit 0 ;; *) echo "dev: unknown option $1" >&2; exit 1 ;; esac
done

"$OPERATIONS_ROOT/dev/preflight.sh" --config "$CONFIG_FILE"
# shellcheck source=/dev/null
source "$OPERATIONS_ROOT/dev/ports.sh"
state_dir="$PROJECT_ROOT/.tooling/operations"
state_file="$state_dir/dev.pids"
mkdir -p "$state_dir"

dev_ports::stop_owned "$state_file"
while IFS= read -r port; do
  dev_ports::assert_available "$port" "$state_file" || exit 1
done < <(jq -r '.services[].port' "$CONFIG_FILE")
: >"$state_file"

cleanup() {
  trap - INT TERM EXIT
  dev_ports::stop_owned "$state_file"
  [[ "$state_file" == "$PROJECT_ROOT/.tooling/operations/dev.pids" ]] && rm -f -- "$state_file"
}
trap cleanup INT TERM EXIT

if jq -e 'has("infisical")' "$CONFIG_FILE" >/dev/null; then
  secret_path="$(jq -r '.infisical.secretPath' "$CONFIG_FILE")"
  while IFS=$'\t' read -r service target; do
    [[ -n "$target" ]] || continue
    destination="$PROJECT_ROOT/$target"
    if ! "$OPERATIONS_ROOT/infisical/download.sh" --env local --path "$secret_path" --output "$destination"; then
      [[ -f "$destination" ]] || { echo "dev: no secrets for $service and no existing $target" >&2; exit 1; }
      echo "dev: secret refresh failed for $service; using existing $target" >&2
    fi
  done < <(jq -r '.services[] | select(.secretsTarget != null) | [.name,.secretsTarget] | @tsv' "$CONFIG_FILE")
fi

while IFS=$'\t' read -r name command; do
  command_argv=()
  read -r -a command_argv <<<"$command"
  (cd "$PROJECT_ROOT" && exec "${command_argv[@]}") &
  pid=$!
  printf '%s|%s\n' "$pid" "$(dev_ports::fingerprint "$pid")" >>"$state_file"
  echo "dev: started $name (pid $pid)"
done < <(jq -r '.services[] | [.name,.command] | @tsv' "$CONFIG_FILE")

while IFS=$'\t' read -r name healthcheck; do
  [[ -n "$healthcheck" ]] || continue
  ready=0
  for _ in $(seq 1 120); do
    if curl -fsS --max-time 1 "$healthcheck" >/dev/null 2>&1; then ready=1; break; fi
    sleep 0.25
  done
  [[ $ready -eq 1 ]] || { echo "dev: $name failed its health probe: $healthcheck" >&2; exit 1; }
done < <(jq -r '.services[] | [.name,(.healthcheck // "")] | @tsv' "$CONFIG_FILE")

if jq -e 'has("cloudflare")' "$CONFIG_FILE" >/dev/null; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "dev: cloudflared unavailable; local services remain active" >&2
  elif "$OPERATIONS_ROOT/cloudflare/tunnel.sh" --config "$CONFIG_FILE" --check; then
    "$OPERATIONS_ROOT/cloudflare/tunnel.sh" --config "$CONFIG_FILE" --run &
    tunnel_pid=$!
    printf '%s|%s\n' "$tunnel_pid" "$(dev_ports::fingerprint "$tunnel_pid")" >>"$state_file"
  else
    echo "dev: Cloudflare tunnel unavailable; local services remain active" >&2
  fi
fi

while :; do
  # The state file is immutable during this pass; is_owned opens a separate
  # descriptor only to compare the same recorded fingerprint.
  # shellcheck disable=SC2094
  while IFS= read -r record || [[ -n "$record" ]]; do
    pid="${record%%|*}"
    dev_ports::is_owned "$pid" "$state_file" \
      || { echo "dev: pid $pid exited or its process fingerprint changed; stopping the stack" >&2; exit 1; }
  done <"$state_file"
  sleep 1
done
