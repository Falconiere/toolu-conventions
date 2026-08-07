#!/usr/bin/env bash
# Download one Infisical environment into a private file using machine identity.
set -euo pipefail

OPERATIONS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$OPERATIONS_ROOT/../.." && pwd)"
PATH="$PROJECT_ROOT/.tooling/bin:$PATH"
export PATH
# shellcheck source=/dev/null
source "$OPERATIONS_ROOT/shared/dotenv.sh"

ENV_SLUG="local"
SECRET_PATH="/"
OUTPUT_FILE=""
FORMAT="dotenv"
ENV_FILE="${INFISICAL_ENV_FILE:-$PROJECT_ROOT/.env}"

usage() {
  cat <<'EOF'
Usage: download.sh --output <file> [options]

Options:
  --env <slug>       local|development|production (default: local)
  --path <path>      Infisical secret path (default: /)
  --output <file>    Destination file (required)
  --format <format>  dotenv|dotenv-export|json|yaml|csv
  --env-file <file>  Machine-identity credentials file (default: .env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_SLUG="${2:?}"; shift 2 ;;
    --path) SECRET_PATH="${2:?}"; shift 2 ;;
    --output) OUTPUT_FILE="${2:?}"; shift 2 ;;
    --format) FORMAT="${2:?}"; shift 2 ;;
    --env-file) ENV_FILE="${2:?}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "download-secrets: unknown option $1" >&2; usage >&2; exit 1 ;;
  esac
done

case "$ENV_SLUG" in local | development | production) ;; *) echo "download-secrets: invalid environment '$ENV_SLUG'" >&2; exit 1 ;; esac
case "$FORMAT" in dotenv | dotenv-export | json | yaml | csv) ;; *) echo "download-secrets: unsupported format '$FORMAT'" >&2; exit 1 ;; esac
[[ -n "$OUTPUT_FILE" ]] || { echo "download-secrets: --output is required" >&2; exit 1; }
command -v infisical >/dev/null 2>&1 || { echo "download-secrets: infisical CLI is required" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] && dotenv::fill "$ENV_FILE" \
  INFISICAL_URL INFISICAL_PROJECT_ID \
  INFISICAL_MACHINE_IDENTITY_CLIENT_ID INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET

: "${INFISICAL_URL:?missing INFISICAL_URL in the environment or $ENV_FILE}"
: "${INFISICAL_PROJECT_ID:?missing INFISICAL_PROJECT_ID in the environment or $ENV_FILE}"
: "${INFISICAL_MACHINE_IDENTITY_CLIENT_ID:?missing INFISICAL_MACHINE_IDENTITY_CLIENT_ID in the environment or $ENV_FILE}"
: "${INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET:?missing INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET in the environment or $ENV_FILE}"

DOMAIN="${INFISICAL_DOMAIN:-$INFISICAL_URL}"
DOMAIN="${DOMAIN%/}"
case "$DOMAIN" in */api) ;; *) DOMAIN="$DOMAIN/api" ;; esac

token="$(infisical login \
  --method=universal-auth \
  --client-id="$INFISICAL_MACHINE_IDENTITY_CLIENT_ID" \
  --client-secret="$INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET" \
  --domain="$DOMAIN" --silent --plain)"
[[ -n "$token" ]] || { echo "download-secrets: Infisical returned an empty token" >&2; exit 1; }

target_dir="$(dirname "$OUTPUT_FILE")"
mkdir -p "$target_dir"
export_dir="$(mktemp -d "$target_dir/.operations-secrets.XXXXXX")"
cleanup() {
  case "$export_dir" in "$target_dir"/.operations-secrets.*) rm -rf -- "$export_dir" ;; esac
}
trap cleanup EXIT

INFISICAL_TOKEN="$token" INFISICAL_DISABLE_UPDATE_CHECK=true infisical export \
  --domain="$DOMAIN" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$ENV_SLUG" \
  --path="$SECRET_PATH" \
  --format="$FORMAT" \
  --output-file="$export_dir/secrets"

exported=""
while IFS= read -r candidate; do exported="$candidate"; break; done < <(find "$export_dir" -type f -print)
[[ -n "$exported" ]] || { echo "download-secrets: Infisical produced no file" >&2; exit 1; }
chmod 600 "$exported"
mv "$exported" "$OUTPUT_FILE"
