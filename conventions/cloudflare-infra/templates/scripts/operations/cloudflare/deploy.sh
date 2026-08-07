#!/usr/bin/env bash
# Fetch secrets, validate, migrate/check, sync Worker secrets, then deploy code.
set -euo pipefail

OPERATIONS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$OPERATIONS_ROOT/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/operations.config.json"
ENV_SLUG=""
DRY_RUN=0
PLAN_ONLY=0

usage() {
  cat <<'EOF'
Usage: deploy.sh --env development|production [--config file] [--plan|--dry-run]

--plan prints the ordered operations without credentials or network access.
--dry-run fetches and validates secrets, then stops before remote mutations.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_SLUG="${2:?}"; shift 2 ;;
    --config) CONFIG_FILE="${2:?}"; shift 2 ;;
    --plan) PLAN_ONLY=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "deploy: unknown option $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$ENV_SLUG" in development | production) ;; *) echo "deploy: --env must be development or production" >&2; exit 1 ;; esac
"$OPERATIONS_ROOT/validate-config.sh" "$CONFIG_FILE"
if [[ $PLAN_ONLY -eq 1 ]]; then
  env OPERATIONS_ROOT="$OPERATIONS_ROOT" \
    "$OPERATIONS_ROOT/cloudflare/deploy-plan.sh" "$CONFIG_FILE" "$ENV_SLUG"
  exit 0
fi

# shellcheck source=/dev/null
source "$OPERATIONS_ROOT/shared/dotenv.sh"
[[ -f "$PROJECT_ROOT/.env" ]] && dotenv::fill "$PROJECT_ROOT/.env" CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID
: "${CLOUDFLARE_API_TOKEN:?missing CLOUDFLARE_API_TOKEN in the environment or .env}"
: "${CLOUDFLARE_ACCOUNT_ID:?missing CLOUDFLARE_ACCOUNT_ID in the environment or .env}"

deploy_config="$(jq -c --arg env "$ENV_SLUG" '.cloudflare.deploy[$env]' "$CONFIG_FILE")"
worker="$(jq -r '.worker' <<<"$deploy_config")"
staging_root="$PROJECT_ROOT/.tooling/operations"
[[ ! -L "$PROJECT_ROOT/.tooling" && ! -L "$staging_root" ]] \
  || { echo "deploy: refusing a symlinked project staging directory" >&2; exit 1; }
mkdir -p "$staging_root"
chmod 700 "$staging_root"
workdir="$(mktemp -d "$staging_root/deploy.XXXXXX")"
cleanup() {
  if [[ -d "$workdir" && ! -L "$workdir" && "$workdir" == "$staging_root"/deploy.* ]]; then
    rm -rf -- "$workdir"
  else
    echo "deploy: refusing to clean unexpected path $workdir" >&2
  fi
}
trap cleanup EXIT

if jq -e 'has("infisical")' "$CONFIG_FILE" >/dev/null; then
  secret_path="$(jq -r '.infisical.secretPath' "$CONFIG_FILE")"
  "$OPERATIONS_ROOT/infisical/download.sh" --env "$ENV_SLUG" --path "$secret_path" \
    --format json --output "$workdir/runtime.json"
  "$OPERATIONS_ROOT/cloudflare/filter-secrets.sh" \
    <"$workdir/runtime.json" >"$workdir/worker-secrets.json"
  chmod 600 "$workdir/worker-secrets.json"
  jq -e 'type == "object" and length > 0' "$workdir/worker-secrets.json" >/dev/null \
    || { echo "deploy: no Worker runtime secrets resolved" >&2; exit 1; }
  # shellcheck source=/dev/null
  source "$OPERATIONS_ROOT/shared/json-env.sh"
  json_env::load "$workdir/worker-secrets.json"
fi

database_env="$(jq -r '.databaseUrlEnv // empty' <<<"$deploy_config")"
if [[ -n "$database_env" && -z "${!database_env:-}" ]]; then
  echo "deploy: required database URL $database_env is absent in '$ENV_SLUG'" >&2
  exit 1
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "deploy: secrets and configuration validated; no remote changes made."
  exit 0
fi

run_configured() {
  local key="$1" label="$2" command
  command="$(jq -r --arg key "$key" '.[$key] // empty' <<<"$deploy_config")"
  # The manifest is reviewed repository code, not request data. Shell syntax is
  # intentional so projects can compose package scripts and migration checks.
  [[ -z "$command" ]] || { echo "→ $label"; (cd "$PROJECT_ROOT" && bash -c "$command"); }
}

run_configured migrateCommand "Migrating '$ENV_SLUG'"
run_configured checkCommand "Checking '$ENV_SLUG'"
if [[ -f "$workdir/worker-secrets.json" ]]; then
  bunx wrangler secret bulk "$workdir/worker-secrets.json" --name "$worker"
fi
deploy_command="$(jq -r '.command' <<<"$deploy_config")"
(cd "$PROJECT_ROOT" && bash -c "$deploy_command")
