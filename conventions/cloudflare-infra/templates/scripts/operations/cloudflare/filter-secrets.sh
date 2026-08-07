#!/usr/bin/env bash
# Remove deployment bootstrap credentials from an Infisical JSON export.
set -euo pipefail

command -v jq >/dev/null 2>&1 || {
  echo "filter-secrets: jq is required" >&2
  exit 3
}

jq '
  if type == "array" then reduce .[] as $secret ({}; .[$secret.key] = $secret.value) else . end
  | del(.CLOUDFLARE_API_TOKEN, .CLOUDFLARE_ACCOUNT_ID)
  | with_entries(select(.key | startswith("INFISICAL_") | not))
'
