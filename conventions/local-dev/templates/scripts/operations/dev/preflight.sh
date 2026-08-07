#!/usr/bin/env bash
# Verify the tools required by the selected operations modules.
set -euo pipefail

OPERATIONS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$OPERATIONS_ROOT/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/operations.config.json"
CHECK_CONFIG=0
INSTALL_MISSING=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config) CONFIG_FILE="${2:?}"; shift 2 ;;
    --check-config) CHECK_CONFIG=1; shift ;;
    --install) INSTALL_MISSING=1; shift ;;
    -h | --help) echo "Usage: preflight.sh [--config file] [--check-config|--install]"; exit 0 ;;
    *) echo "preflight: unknown option $1" >&2; exit 1 ;;
  esac
done

"$OPERATIONS_ROOT/validate-config.sh" "$CONFIG_FILE"
if [[ $CHECK_CONFIG -eq 1 ]]; then
  echo "preflight: configuration valid"
  exit 0
fi
TOOLING_BIN="$PROJECT_ROOT/.tooling/bin"
case ":$PATH:" in *":$TOOLING_BIN:"*) ;; *) PATH="$TOOLING_BIN:$PATH"; export PATH ;; esac
missing=0
need() { command -v "$1" >/dev/null 2>&1 || { echo "preflight: missing $1" >&2; missing=$((missing + 1)); }; }
need bash
need jq
need curl
need ps
if ! command -v lsof >/dev/null 2>&1 && ! command -v ss >/dev/null 2>&1; then
  echo "preflight: missing listener probe (install lsof or ss)" >&2
  missing=$((missing + 1))
fi
while IFS= read -r command_name; do need "$command_name"; done < <(jq -r '.services[].command | split(" ")[0]' "$CONFIG_FILE" | sort -u)
if jq -e 'has("infisical")' "$CONFIG_FILE" >/dev/null; then
  need base64
  if [[ $INSTALL_MISSING -eq 1 ]] && ! command -v infisical >/dev/null 2>&1; then
    "$OPERATIONS_ROOT/infisical/install-cli.sh"
  fi
  command -v infisical >/dev/null 2>&1 || echo "preflight: infisical missing; existing local secrets may still be used" >&2
fi
if jq -e 'has("cloudflare")' "$CONFIG_FILE" >/dev/null; then
  if [[ $INSTALL_MISSING -eq 1 ]] && ! command -v cloudflared >/dev/null 2>&1; then
    "$OPERATIONS_ROOT/cloudflare/install-cli.sh"
  fi
  command -v cloudflared >/dev/null 2>&1 || echo "preflight: cloudflared missing; local services will run without a tunnel" >&2
fi
[[ $missing -eq 0 ]] || exit 1
echo "preflight: ready"
