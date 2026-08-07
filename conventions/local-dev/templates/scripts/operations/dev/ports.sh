#!/usr/bin/env bash
# Listener inspection and ownership checks for the local-dev supervisor.

[[ -n "${TOOLU_OPERATIONS_PORTS_SOURCED:-}" ]] && return 0
TOOLU_OPERATIONS_PORTS_SOURCED=1

dev_ports::listeners() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    { lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null || true; } | sort -u
  elif command -v ss >/dev/null 2>&1; then
    { ss -ltnpH "sport = :$port" 2>/dev/null || true; } \
      | tr ',' '\n' \
      | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
      | sort -u
  fi
}

dev_ports::is_owned() {
  local pid="$1" state_file="$2" recorded recorded_pid recorded_fingerprint current_fingerprint
  [[ -f "$state_file" ]] || return 1
  current_fingerprint="$(dev_ports::fingerprint "$pid")"
  [[ -n "$current_fingerprint" ]] || return 1
  while IFS= read -r recorded || [[ -n "$recorded" ]]; do
    recorded_pid="${recorded%%|*}"
    recorded_fingerprint="${recorded#*|}"
    [[ "$recorded_pid" == "$pid" && "$recorded_fingerprint" == "$current_fingerprint" ]] && return 0
  done <"$state_file"
  return 1
}

dev_ports::fingerprint() {
  local fingerprint
  fingerprint="$(ps -p "$1" -o lstart= 2>/dev/null)" || true
  printf '%s' "$fingerprint"
}

dev_ports::command() {
  local command_name
  command_name="$(ps -p "$1" -o comm= 2>/dev/null | tr -d ' ')" || true
  printf '%s' "${command_name:-?}"
}

dev_ports::assert_available() {
  local port="$1" state_file="$2" pid
  for pid in $(dev_ports::listeners "$port"); do
    if dev_ports::is_owned "$pid" "$state_file"; then
      echo "dev: :$port is still held by recorded pid $pid after shutdown; refusing to race it." >&2
    else
      echo "dev: :$port is held by foreign pid $pid ($(dev_ports::command "$pid")); refusing to signal it." >&2
    fi
    return 1
  done
}

# The state file is immutable during this function; nested reads use separate
# descriptors and never rewrite the outer loop's input.
# shellcheck disable=SC2094
dev_ports::stop_owned() {
  local state_file="$1" record pid alive
  [[ -f "$state_file" ]] || return 0
  while IFS= read -r record || [[ -n "$record" ]]; do
    pid="${record%%|*}"
    case "$pid" in '' | *[!0-9]*) continue ;; esac
    [[ "$pid" == "$$" ]] && continue
    dev_ports::is_owned "$pid" "$state_file" || continue
    kill "$pid" 2>/dev/null || true
  done <"$state_file"

  for _ in $(seq 1 20); do
    alive=0
    while IFS= read -r record || [[ -n "$record" ]]; do
      pid="${record%%|*}"
      dev_ports::is_owned "$pid" "$state_file" && alive=1
    done <"$state_file"
    [[ $alive -eq 0 ]] && return 0
    sleep 0.25
  done

  while IFS= read -r record || [[ -n "$record" ]]; do
    pid="${record%%|*}"
    dev_ports::is_owned "$pid" "$state_file" || continue
    kill -9 "$pid" 2>/dev/null || true
  done <"$state_file"
}
