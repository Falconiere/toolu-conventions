#!/usr/bin/env bash
# Validate the shared operations manifest before any operational side effect.
set -euo pipefail

CONFIG_FILE="${1:-operations.config.json}"

fail() {
  echo "operations config: $1" >&2
  exit 3
}

command -v jq >/dev/null 2>&1 || fail "jq is required"
[[ -f "$CONFIG_FILE" ]] || fail "missing $CONFIG_FILE"
jq -e . "$CONFIG_FILE" >/dev/null 2>&1 || fail "$CONFIG_FILE is not valid JSON"

unknown="$(jq -r '
  (keys - ["$schema", "version", "stack", "runtime", "environments", "services", "infisical", "cloudflare"])
  | join(", ")
' "$CONFIG_FILE")"
[[ -z "$unknown" ]] || fail "unknown top-level key(s): $unknown"

jq -e '
  .version == 1 and
  (.stack | IN("console", "marketing", "backend-ts", "expo", "rust", "workspace")) and
  (.runtime | IN("client", "static", "server", "mixed")) and
  .environments == ["local", "development", "production"] and
  (.services | type == "array" and length > 0) and
  all(.services[];
    ((keys - ["name", "runtime", "command", "port", "healthcheck", "secretsTarget", "localHostname"]) | length == 0) and
    (.name | type == "string" and test("^[a-z][a-z0-9-]*$")) and
    (.runtime | IN("client", "static", "server")) and
    (.command | type == "string" and length > 0) and
    (.port | type == "number" and floor == . and . >= 1 and . <= 65535) and
    (.healthcheck == null or (.healthcheck | type == "string" and test("^https?://"))) and
    (.secretsTarget == null or (.secretsTarget | type == "string" and length > 0)) and
    (.localHostname == null or (.localHostname | type == "string" and length > 0)) and
    (.localHostname == null or .healthcheck != null)
  )
' "$CONFIG_FILE" >/dev/null || fail "required fields or service values do not match the contract"

duplicates="$(jq -r '
  [(.services | group_by(.name)[] | select(length > 1) | .[0].name),
   (.services | group_by(.port)[] | select(length > 1) | (.[0].port | tostring)),
   (.services | map(select(.localHostname != null)) | group_by(.localHostname)[] | select(length > 1) | .[0].localHostname)]
  | flatten | unique | join(", ")
' "$CONFIG_FILE")"
[[ -z "$duplicates" ]] || fail "duplicate service name, port, or hostname: $duplicates"

jq -e '
  (has("infisical") or all(.services[]; .secretsTarget == null)) and
  (has("cloudflare") or all(.services[]; .localHostname == null))
' "$CONFIG_FILE" >/dev/null \
  || fail "secretsTarget and localHostname require their provider module"

if jq -e 'has("cloudflare")' "$CONFIG_FILE" >/dev/null; then
  jq -e '
    (.stack | IN("console", "marketing", "backend-ts", "workspace")) and
    (.cloudflare | (keys - ["zone", "tunnelName", "deploy"] | length == 0)) and
    (.cloudflare.zone | type == "string" and length > 0) and
    (.cloudflare.tunnelName | type == "string" and length > 0) and
    (.cloudflare.deploy | keys | sort == ["development", "production"]) and
    all(.cloudflare.deploy[];
      ((keys - ["worker", "command", "migrateCommand", "checkCommand", "databaseUrlEnv"]) | length == 0) and
      (.worker | type == "string" and length > 0) and
      (.command | type == "string" and length > 0) and
      (.migrateCommand == null or (.migrateCommand | type == "string" and length > 0)) and
      (.checkCommand == null or (.checkCommand | type == "string" and length > 0)) and
      (.databaseUrlEnv == null or (.databaseUrlEnv | test("^[A-Z][A-Z0-9_]*$")))
    )
  ' "$CONFIG_FILE" >/dev/null || fail "Cloudflare is incompatible with this stack or its deploy map is invalid"
fi

if jq -e 'has("infisical")' "$CONFIG_FILE" >/dev/null; then
  jq -e '
    ((.stack | IN("backend-ts", "rust", "workspace")) or (.stack == "console" and .runtime == "mixed")) and
    (.runtime | IN("server", "mixed")) and
    (.infisical | (keys - ["secretPath"] | length == 0)) and
    (.infisical.secretPath | type == "string" and length > 0) and
    any(.services[]; .secretsTarget != null) and
    all(.services[] | select(.secretsTarget != null);
      .runtime == "server" and
      (.secretsTarget | startswith("/") | not) and
      (.secretsTarget | test("(^|/)\\.\\.(/|$)") | not) and
      (.secretsTarget | test("(^|/)(dist|build|public|assets|src)(/|$)"; "i") | not)
    )
  ' "$CONFIG_FILE" >/dev/null || fail "Infisical requires server services and safe relative secret targets"
fi
