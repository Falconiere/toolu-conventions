#!/usr/bin/env bash
# Print the desired Cloudflare tunnel config only when ingress differs.
set -euo pipefail

CONFIG_FILE="${1:-operations.config.json}"
ROOT_DIR="${OPERATIONS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
"$ROOT_DIR/validate-config.sh" "$CONFIG_FILE"

jq --slurpfile operations "$CONFIG_FILE" '
  ($operations[0].services
    | map(select(.localHostname != null)
      | {hostname: .localHostname, service: ("http://localhost:" + (.port | tostring))})
    + [{service: "http_status:404"}]) as $wanted
  | if (.ingress // null) == $wanted then empty else . + {ingress: $wanted} end
'
