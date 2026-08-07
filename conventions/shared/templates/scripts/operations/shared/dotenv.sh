#!/usr/bin/env bash
# Safe dotenv parsing shared by operations modules. Source this file.

[[ -n "${TOOLU_OPERATIONS_DOTENV_SOURCED:-}" ]] && return 0
TOOLU_OPERATIONS_DOTENV_SOURCED=1

dotenv::__parse_line() {
  local line="${1%$'\r'}"
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && return 1
  [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || return 1
  DOTENV_KEY="${BASH_REMATCH[1]}"
  DOTENV_VALUE="${BASH_REMATCH[2]}"
  if [[ "$DOTENV_VALUE" =~ ^\"(.*)\"$ ]] || [[ "$DOTENV_VALUE" =~ ^\'(.*)\'$ ]]; then
    DOTENV_VALUE="${BASH_REMATCH[1]}"
  fi
}

dotenv::__apply() {
  local file="$1" mode="$2"
  shift 2
  local line key value wanted allowed
  [[ -f "$file" ]] || return 1

  while IFS= read -r line || [[ -n "$line" ]]; do
    dotenv::__parse_line "$line" || continue
    key="$DOTENV_KEY"
    value="$DOTENV_VALUE"
    if [[ $# -gt 0 ]]; then
      wanted=0
      for allowed in "$@"; do
        [[ "$allowed" == "$key" ]] && wanted=1 && break
      done
      [[ $wanted -eq 1 ]] || continue
    fi
    [[ "$mode" == "fill" && -n "${!key:-}" ]] && continue
    printf -v "$key" '%s' "$value"
    export "${key?}"
  done <"$file"
}

dotenv::load() {
  local file="$1"
  shift
  dotenv::__apply "$file" overwrite "$@"
}

dotenv::fill() {
  local file="$1"
  shift
  dotenv::__apply "$file" fill "$@"
}
