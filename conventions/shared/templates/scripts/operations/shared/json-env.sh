#!/usr/bin/env bash
# Export a JSON secret object without evaluating values as shell source.

[[ -n "${TOOLU_OPERATIONS_JSON_ENV_SOURCED:-}" ]] && return 0
TOOLU_OPERATIONS_JSON_ENV_SOURCED=1

json_env::__decode() {
  if base64 --decode </dev/null >/dev/null 2>&1; then
    base64 --decode
  else
    base64 -D
  fi
}

json_env::load() {
  local file="$1" key encoded value entries
  command -v jq >/dev/null 2>&1 || { echo "json-env: jq is required" >&2; return 1; }
  command -v base64 >/dev/null 2>&1 || { echo "json-env: base64 is required" >&2; return 1; }
  [[ -f "$file" ]] || { echo "json-env: missing $file" >&2; return 1; }

  entries="$(jq -r '
    if type == "array" then reduce .[] as $secret ({}; .[$secret.key] = $secret.value) else . end
    | to_entries[]
    | if (.key | test("^[A-Za-z_][A-Za-z0-9_]*$"))
      then [.key, (.value | tostring | @base64)] | @tsv
      else error("invalid environment key: " + .key)
      end
  ' "$file")" || return 1
  while IFS=$'\t' read -r key encoded || [[ -n "${key:-}" ]]; do
    [[ -n "$key" ]] || continue
    value="$(printf '%s' "$encoded" | json_env::__decode)" || return 1
    printf -v "$key" '%s' "$value"
    export "${key?}"
  done <<<"$entries"
}
