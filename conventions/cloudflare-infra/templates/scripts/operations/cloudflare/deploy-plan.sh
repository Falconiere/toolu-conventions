#!/usr/bin/env bash
# Print the ordered deployment operations for one deployed environment.
set -euo pipefail

CONFIG_FILE="${1:-operations.config.json}"
ENV_SLUG="${2:-}"
OPERATIONS_ROOT="${OPERATIONS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
"$OPERATIONS_ROOT/validate-config.sh" "$CONFIG_FILE"

case "$ENV_SLUG" in
  development | production) ;;
  local) echo "deploy-plan: local has no deployed Worker" >&2; exit 1 ;;
  *) echo "deploy-plan: environment must be development or production" >&2; exit 1 ;;
esac

jq -r --arg env "$ENV_SLUG" '
  . as $root
  | .cloudflare.deploy[$env] as $deploy
  | (if $root.infisical
     then ["download-secrets " + $env, "validate-secrets"]
     else []
     end)
    + (if $deploy.migrateCommand then ["migrate " + $deploy.migrateCommand] else [] end)
    + (if $deploy.checkCommand then ["check " + $deploy.checkCommand] else [] end)
    + (if $root.infisical then ["sync-worker-secrets " + $deploy.worker] else [] end)
    + ["deploy " + $deploy.command]
  | .[]
' "$CONFIG_FILE"
