#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VALIDATOR="$ROOT_DIR/conventions/shared/templates/scripts/operations/validate-config.sh"
FIXTURES="$ROOT_DIR/conventions/__tests__/fixtures"
TEMPLATES="$ROOT_DIR/conventions"
TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/toolu-operations-tests.XXXXXX")"
passed=0
failed=0

cleanup() {
  if [[ -d "$TEST_TMP" && ! -L "$TEST_TMP" && "$(basename "$TEST_TMP")" == toolu-operations-tests.* ]]; then
    rm -rf -- "$TEST_TMP"
  else
    echo "refusing to clean unexpected test path: $TEST_TMP" >&2
  fi
}
trap cleanup EXIT

ok() {
  passed=$((passed + 1))
  printf '  ok    %s\n' "$1"
}

not_ok() {
  failed=$((failed + 1))
  printf '  FAIL  %s\n' "$1"
}

expect_ok() {
  local label="$1" file="$2"
  if "$VALIDATOR" "$file" >"$TEST_TMP/out" 2>&1; then
    ok "$label"
  else
    not_ok "$label"
    sed 's/^/        /' "$TEST_TMP/out"
  fi
}

expect_fail() {
  local label="$1" expected="$2"
  shift 2
  if "$@" >"$TEST_TMP/out" 2>&1; then
    not_ok "$label (unexpected success)"
  elif grep -Fq "$expected" "$TEST_TMP/out"; then
    ok "$label"
  else
    not_ok "$label (missing: $expected)"
    sed 's/^/        /' "$TEST_TMP/out"
  fi
}

mutate_fixture() {
  local jq_filter="$1" output="$2"
  jq "$jq_filter" "$FIXTURES/valid-backend.json" >"$output"
}

printf 'operations conventions\n'
expect_ok "valid backend manifest" "$FIXTURES/valid-backend.json"

mutate_fixture '.environments = ["local", "staging", "production"]' "$TEST_TMP/staging.json"
expect_fail "staging is not an environment" "required fields" "$VALIDATOR" "$TEST_TMP/staging.json"

mutate_fixture '.services += [.services[0] | .name = "other"]' "$TEST_TMP/duplicate-port.json"
expect_fail "duplicate ports fail" "duplicate service" "$VALIDATOR" "$TEST_TMP/duplicate-port.json"

mutate_fixture '.stack = "expo"' "$TEST_TMP/cloudflare-expo.json"
expect_fail "Cloudflare rejects Expo" "Cloudflare is incompatible" "$VALIDATOR" "$TEST_TMP/cloudflare-expo.json"

mutate_fixture '.services[0].secretsTarget = "src/config.ts"' "$TEST_TMP/client-secret.json"
expect_fail "Infisical rejects client targets" "safe relative secret target" "$VALIDATOR" "$TEST_TMP/client-secret.json"

mutate_fixture '.runtime = "mixed" | .services[0].runtime = "client" | .services[0].secretsTarget = ".env.local"' "$TEST_TMP/client-runtime-secret.json"
expect_fail "Infisical targets only server services" "server services" "$VALIDATOR" "$TEST_TMP/client-runtime-secret.json"

mutate_fixture 'del(.infisical)' "$TEST_TMP/orphan-secret-target.json"
expect_fail "secret target errors name the service" "api requires Infisical" "$VALIDATOR" "$TEST_TMP/orphan-secret-target.json"

mutate_fixture 'del(.cloudflare)' "$TEST_TMP/orphan-hostname.json"
expect_fail "local hostname errors name the service" "api requires Cloudflare" "$VALIDATOR" "$TEST_TMP/orphan-hostname.json"

mutate_fixture '.services[0].secretsTarget = "foo/../bar"' "$TEST_TMP/traversal-secret.json"
expect_fail "nested traversal secret targets are rejected" "safe relative secret" "$VALIDATOR" "$TEST_TMP/traversal-secret.json"

mutate_fixture '.services[0].secretsTarget = "SRC/runtime.env"' "$TEST_TMP/case-secret.json"
expect_fail "client source targets are rejected case-insensitively" "safe relative secret" "$VALIDATOR" "$TEST_TMP/case-secret.json"

mutate_fixture 'del(.services[0].healthcheck)' "$TEST_TMP/tunnel-without-health.json"
expect_fail "tunnel routes require health probes" "required fields" "$VALIDATOR" "$TEST_TMP/tunnel-without-health.json"

mutate_fixture '.cloudflare.deploy.development.migrateCommand = 42' "$TEST_TMP/non-string-command.json"
expect_fail "deploy hooks must be non-empty commands" "deploy map is invalid" "$VALIDATOR" "$TEST_TMP/non-string-command.json"

mutate_fixture '.services[0].command = "bun run dev; touch /tmp/injected"' "$TEST_TMP/shell-command.json"
expect_fail "service commands reject shell control syntax" "service values" "$VALIDATOR" "$TEST_TMP/shell-command.json"

mutate_fixture '.infisical.secretPath = "/team/../../other"' "$TEST_TMP/secret-path-traversal.json"
expect_fail "Infisical provider paths reject traversal" "safe provider path" "$VALIDATOR" "$TEST_TMP/secret-path-traversal.json"

DOTENV="$TEMPLATES/shared/templates/scripts/operations/shared/dotenv.sh"
if [[ -f "$DOTENV" ]]; then
  # shellcheck source=/dev/null
  source "$DOTENV"
  dotenv_injected="$TEST_TMP/dotenv-injected"
  # The literal substitution is the injection probe.
  # shellcheck disable=SC2016
  printf 'SAFE=$(touch %s)\n%s\n' "$dotenv_injected" 'QUOTED="hello world"' >"$TEST_TMP/.env"
  unset SAFE QUOTED
  dotenv::load "$TEST_TMP/.env"
  if [[ "$SAFE" == "\$(touch $dotenv_injected)" && "$QUOTED" == "hello world" && ! -e "$dotenv_injected" ]]; then
    ok "dotenv values are data, not shell"
  else
    not_ok "dotenv values are data, not shell"
  fi
  printf '%s\n' 'TOOLU_FILL_PRESET=from-file' >"$TEST_TMP/fill.env"
  unset TOOLU_FILL_PRESET
  # Read indirectly by dotenv::fill and the child-process export assertion.
  # shellcheck disable=SC2034
  TOOLU_FILL_PRESET="from-environment"
  dotenv::fill "$TEST_TMP/fill.env" TOOLU_FILL_PRESET
  if [[ "$(bash -c 'printf %s "${TOOLU_FILL_PRESET:-}"')" == "from-environment" ]]; then
    ok "dotenv fill exports an existing shell value"
  else
    not_ok "dotenv fill exports an existing shell value"
  fi
  unset TOOLU_FILL_PRESET
else
  not_ok "dotenv helper exists"
fi

JSON_ENV="$TEMPLATES/shared/templates/scripts/operations/shared/json-env.sh"
if [[ -f "$JSON_ENV" ]]; then
  # shellcheck source=/dev/null
  source "$JSON_ENV"
  unset JSON_PAYLOAD
  json_injected="$TEST_TMP/json-injected"
  jq -nc --arg value "\$(touch $json_injected)" '{JSON_PAYLOAD:$value}' >"$TEST_TMP/env.json"
  json_env::load "$TEST_TMP/env.json"
  if [[ "$JSON_PAYLOAD" == "\$(touch $json_injected)" && ! -e "$json_injected" ]]; then
    ok "JSON secret values are exported without shell evaluation"
  else
    not_ok "JSON secret values are exported without shell evaluation"
  fi
  if printf '%s' 'YQ$=' | json_env::__decode >/dev/null 2>&1; then
    not_ok "JSON secret decoding rejects malformed base64"
  else
    ok "JSON secret decoding rejects malformed base64"
  fi
else
  not_ok "JSON environment helper exists"
fi

FILTER="$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/filter-secrets.sh"
if [[ -x "$FILTER" ]]; then
  printf '%s' '{"APP_SECRET":"yes","CLOUDFLARE_API_TOKEN":"no","INFISICAL_URL":"no"}' \
    | "$FILTER" >"$TEST_TMP/filtered.json"
  if jq -e '. == {"APP_SECRET":"yes"}' "$TEST_TMP/filtered.json" >/dev/null; then
    ok "runtime secret filter drops bootstrap credentials"
  else
    not_ok "runtime secret filter drops bootstrap credentials"
  fi
else
  not_ok "runtime secret filter exists"
fi

TUNNEL_PLAN="$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/tunnel-plan.sh"
if [[ -x "$TUNNEL_PLAN" ]]; then
  printf '%s' '{"ingress":[]}' \
    | OPERATIONS_ROOT="$TEMPLATES/shared/templates/scripts/operations" \
      "$TUNNEL_PLAN" "$FIXTURES/valid-backend.json" >"$TEST_TMP/tunnel-plan.json"
  if jq -e '.ingress == [{"hostname":"local-api.example.com","service":"http://localhost:8787"},{"service":"http_status:404"}]' "$TEST_TMP/tunnel-plan.json" >/dev/null; then
    ok "tunnel plan comes from the manifest"
  else
    not_ok "tunnel plan comes from the manifest"
  fi
  if OPERATIONS_ROOT="$TEMPLATES/shared/templates/scripts/operations" \
      "$TUNNEL_PLAN" "$FIXTURES/valid-backend.json" \
      <"$TEST_TMP/tunnel-plan.json" >"$TEST_TMP/no-tunnel-plan" \
    && [[ ! -s "$TEST_TMP/no-tunnel-plan" ]]; then
    ok "matching tunnel ingress produces no write plan"
  else
    not_ok "matching tunnel ingress produces no write plan"
  fi
else
  not_ok "tunnel planner exists"
fi

PORTS="$TEMPLATES/local-dev/templates/scripts/operations/dev/ports.sh"
if [[ -f "$PORTS" ]]; then
  # shellcheck source=/dev/null
  source "$PORTS"
  sleep 30 &
  owned_pid=$!
  owned_fingerprint="$(dev_ports::fingerprint "$owned_pid")"
  printf '%s|%s\n' "$owned_pid" "$owned_fingerprint" >"$TEST_TMP/owned.pids"
  if dev_ports::is_owned "$owned_pid" "$TEST_TMP/owned.pids" && ! dev_ports::is_owned "$$" "$TEST_TMP/owned.pids"; then
    ok "process ownership comes from the state file"
  else
    not_ok "process ownership comes from the state file"
  fi
  printf '%s|not-the-process-start-time\n' "$owned_pid" >"$TEST_TMP/reused.pids"
  if dev_ports::is_owned "$owned_pid" "$TEST_TMP/reused.pids"; then
    not_ok "reused PIDs are not treated as owned"
  else
    ok "reused PIDs are not treated as owned"
  fi
  kill "$owned_pid" 2>/dev/null || true
  wait "$owned_pid" 2>/dev/null || true

  foreign_port=39991
  python3 -m http.server "$foreign_port" --bind 127.0.0.1 >"$TEST_TMP/http.log" 2>&1 &
  foreign_pid=$!
  for _ in $(seq 1 20); do
    [[ -n "$(dev_ports::listeners "$foreign_port")" ]] && break
    sleep 0.1
  done
  : >"$TEST_TMP/empty.pids"
  if dev_ports::assert_available "$foreign_port" "$TEST_TMP/empty.pids" >/dev/null 2>&1; then
    not_ok "foreign port owners are refused"
  elif kill -0 "$foreign_pid" 2>/dev/null; then
    ok "foreign port owners are refused without a signal"
  else
    not_ok "foreign port owners are refused without a signal"
  fi
  kill "$foreign_pid" 2>/dev/null || true
  wait "$foreign_pid" 2>/dev/null || true
else
  not_ok "port ownership helper exists"
fi

INFISICAL_DOWNLOAD="$TEMPLATES/infisical-secrets/templates/scripts/operations/infisical/download.sh"
mkdir -p "$TEST_TMP/bin" "$TEST_TMP/project/scripts/operations/shared" "$TEST_TMP/project/scripts/operations/infisical"
cp "$DOTENV" "$TEST_TMP/project/scripts/operations/shared/dotenv.sh"
cat >"$TEST_TMP/bin/infisical" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  login) printf 'test-token' ;;
  export)
    [[ -z "${INFISICAL_FAKE_FAIL:-}" ]] || exit 7
    output=""
    format="dotenv"
    for arg in "$@"; do
      case "$arg" in
        --output-file=*) output="${arg#*=}" ;;
        --format=*) format="${arg#*=}" ;;
      esac
    done
    [[ -n "$output" ]]
    if [[ "$format" == "json" ]]; then
      printf '%s\n' '{"APP_SECRET":"safe"}' >"${output}.json"
    else
      printf 'APP_SECRET=safe\n' >"${output}.env"
    fi
    ;;
  *) exit 4 ;;
esac
EOF
chmod +x "$TEST_TMP/bin/infisical"

if [[ -x "$INFISICAL_DOWNLOAD" ]]; then
  cp "$INFISICAL_DOWNLOAD" "$TEST_TMP/project/scripts/operations/infisical/download.sh"
  PATH="$TEST_TMP/bin:$PATH" \
    INFISICAL_URL="https://secrets.example.com" \
    INFISICAL_PROJECT_ID="project" \
    INFISICAL_MACHINE_IDENTITY_CLIENT_ID="client" \
    INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET="secret" \
    "$TEST_TMP/project/scripts/operations/infisical/download.sh" \
      --env local --path / --output "$TEST_TMP/project/.dev.vars" >/dev/null
  mode="$(stat -c '%a' "$TEST_TMP/project/.dev.vars" 2>/dev/null || stat -f '%Lp' "$TEST_TMP/project/.dev.vars")"
  if [[ "$(<"$TEST_TMP/project/.dev.vars")" == "APP_SECRET=safe" && "$mode" == "600" ]]; then
    ok "Infisical download atomically writes a private target"
  else
    not_ok "Infisical download atomically writes a private target"
  fi
  printf '%s\n' 'EXISTING=keep' >"$TEST_TMP/project/existing.dev.vars"
  if PATH="$TEST_TMP/bin:$PATH" \
      INFISICAL_FAKE_FAIL=1 \
      INFISICAL_URL="https://secrets.example.com" \
      INFISICAL_PROJECT_ID="project" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_ID="client" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET="secret" \
      "$TEST_TMP/project/scripts/operations/infisical/download.sh" \
        --env local --output "$TEST_TMP/project/existing.dev.vars" >/dev/null 2>&1; then
    not_ok "failed secret refresh returns nonzero"
  elif [[ "$(<"$TEST_TMP/project/existing.dev.vars")" == "EXISTING=keep" ]]; then
    ok "failed secret refresh preserves existing output"
  else
    not_ok "failed secret refresh preserves existing output"
  fi
  outside_secret="$TEST_TMP/outside-project.env"
  if PATH="$TEST_TMP/bin:$PATH" \
      INFISICAL_URL="https://secrets.example.com" \
      INFISICAL_PROJECT_ID="project" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_ID="client" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET="secret" \
      "$TEST_TMP/project/scripts/operations/infisical/download.sh" \
        --env local --output "$outside_secret" >/dev/null 2>&1; then
    not_ok "Infisical download rejects output outside the project"
  elif [[ ! -e "$outside_secret" ]]; then
    ok "Infisical download rejects output outside the project"
  else
    not_ok "Infisical download rejects output outside the project"
  fi
  if PATH="$TEST_TMP/bin:$PATH" \
      INFISICAL_URL="https://secrets.example.com" \
      INFISICAL_PROJECT_ID="project" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_ID="client" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET="secret" \
      "$TEST_TMP/project/scripts/operations/infisical/download.sh" \
        --env local --path /team/../other \
        --output "$TEST_TMP/project/path-check.env" >/dev/null 2>&1; then
    not_ok "Infisical download rejects provider path traversal"
  elif [[ ! -e "$TEST_TMP/project/path-check.env" ]]; then
    ok "Infisical download rejects provider path traversal"
  else
    not_ok "Infisical download rejects provider path traversal"
  fi
  mkdir -p "$TEST_TMP/outside-secret-dir"
  ln -s "$TEST_TMP/outside-secret-dir" "$TEST_TMP/project/linked-secret-dir"
  if PATH="$TEST_TMP/bin:$PATH" \
      INFISICAL_URL="https://secrets.example.com" \
      INFISICAL_PROJECT_ID="project" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_ID="client" \
      INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET="secret" \
      "$TEST_TMP/project/scripts/operations/infisical/download.sh" \
        --env local --output linked-secret-dir/secrets.env >/dev/null 2>&1; then
    not_ok "Infisical download rejects symlinked output parents"
  elif [[ ! -e "$TEST_TMP/outside-secret-dir/secrets.env" ]]; then
    ok "Infisical download rejects symlinked output parents"
  else
    not_ok "Infisical download rejects symlinked output parents"
  fi
else
  not_ok "Infisical downloader exists"
fi

INSTALL_RELEASE="$TEMPLATES/shared/templates/scripts/operations/shared/install-release.sh"
if [[ -f "$INSTALL_RELEASE" ]]; then
  # shellcheck source=/dev/null
  source "$INSTALL_RELEASE"
  unexpected_stage="$TEST_TMP/nested/toolu-cli.fake"
  mkdir -p "$unexpected_stage"
  operations_install::cleanup "$unexpected_stage" >"$TEST_TMP/cleanup.out" 2>&1
  if [[ -d "$unexpected_stage" ]]; then
    ok "CLI cleanup refuses a lookalike outside the staging root"
  else
    not_ok "CLI cleanup refuses a lookalike outside the staging root"
  fi
  mkdir -p "$TEST_TMP/staging"
  unsafe_stage="$(mktemp -d "$TEST_TMP/staging/toolu-cli.XXXXXX")"
  chmod 755 "$unsafe_stage"
  TMPDIR="$TEST_TMP/staging" operations_install::cleanup "$unsafe_stage" >"$TEST_TMP/unsafe-cleanup.out" 2>&1
  if [[ -d "$unsafe_stage" ]]; then
    ok "CLI cleanup refuses staging directories without private ownership mode"
  else
    not_ok "CLI cleanup refuses staging directories without private ownership mode"
  fi
else
  not_ok "release installation helper exists"
fi

# These are literal source-code assertions.
# shellcheck disable=SC2016
if grep -Fq 'INFISICAL_TOKEN="$token"' "$INFISICAL_DOWNLOAD" \
  && ! grep -Fq -- '--token="$token"' "$INFISICAL_DOWNLOAD"; then
  ok "Infisical access tokens stay out of process arguments"
else
  not_ok "Infisical access tokens stay out of process arguments"
fi

if ! grep -Fq -- '--recursive' "$INFISICAL_DOWNLOAD" \
  && ! jq -e '.infisical | has("recursive")' "$TEMPLATES/infisical-secrets/templates/operations.infisical.example.json" >/dev/null; then
  ok "secret delivery does not print recursive secret listings"
else
  not_ok "secret delivery does not print recursive secret listings"
fi

DEPLOY_PLAN="$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/deploy-plan.sh"
if [[ -x "$DEPLOY_PLAN" ]]; then
  OPERATIONS_ROOT="$TEMPLATES/shared/templates/scripts/operations" \
    "$DEPLOY_PLAN" "$FIXTURES/valid-backend.json" development >"$TEST_TMP/deploy-plan"
  expected_plan="$(printf '%s\n' \
    'download-secrets development' \
    'validate-secrets' \
    'sync-worker-secrets example-dev' \
    'deploy bun run deploy:development')"
  if [[ "$(<"$TEST_TMP/deploy-plan")" == "$expected_plan" ]]; then
    ok "deploy plan preserves secret-sync-before-code order"
  else
    not_ok "deploy plan preserves secret-sync-before-code order"
    sed 's/^/        /' "$TEST_TMP/deploy-plan"
  fi
  jq 'del(.infisical) | del(.services[].secretsTarget)' "$FIXTURES/valid-backend.json" >"$TEST_TMP/cloudflare-only.json"
  OPERATIONS_ROOT="$TEMPLATES/shared/templates/scripts/operations" \
    "$DEPLOY_PLAN" "$TEST_TMP/cloudflare-only.json" production >"$TEST_TMP/cloudflare-only-plan"
  if [[ "$(<"$TEST_TMP/cloudflare-only-plan")" == "deploy bun run deploy" ]]; then
    ok "Cloudflare-only deploy omits Infisical secret steps"
  else
    not_ok "Cloudflare-only deploy omits Infisical secret steps"
  fi
else
  not_ok "Cloudflare deploy planner exists"
fi

required_templates=(
  "$TEMPLATES/shared/templates/operations.config.json"
  "$TEMPLATES/cloudflare-infra/templates/operations.cloudflare.example.json"
  "$TEMPLATES/cloudflare-infra/templates/.env.operations.example"
  "$TEMPLATES/cloudflare-infra/templates/wrangler.operations.example.jsonc"
  "$TEMPLATES/infisical-secrets/templates/operations.infisical.example.json"
  "$TEMPLATES/shared/templates/scripts/operations/shared/json-env.sh"
  "$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/deploy.sh"
  "$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/install-cli.sh"
  "$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/tunnel.sh"
  "$TEMPLATES/cloudflare-infra/templates/.github/workflows/deploy-development.yml"
  "$TEMPLATES/cloudflare-infra/templates/.github/workflows/deploy-production.yml"
  "$TEMPLATES/infisical-secrets/templates/.env.operations.example"
  "$TEMPLATES/infisical-secrets/templates/scripts/operations/infisical/install-cli.sh"
  "$TEMPLATES/local-dev/templates/scripts/operations/dev/preflight.sh"
  "$TEMPLATES/local-dev/templates/scripts/operations/dev/start.sh"
)
missing_templates=()
for required_template in "${required_templates[@]}"; do
  [[ -f "$required_template" ]] || missing_templates+=("${required_template#"$ROOT_DIR/"}")
done
if [[ ${#missing_templates[@]} -eq 0 ]]; then
  ok "all module runtime templates exist"
else
  not_ok "all module runtime templates exist (${missing_templates[*]})"
fi

CF_INSTALL="$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/install-cli.sh"
INFISICAL_INSTALL="$TEMPLATES/infisical-secrets/templates/scripts/operations/infisical/install-cli.sh"
if [[ -x "$CF_INSTALL" && "$($CF_INSTALL --print-pin)" == "cloudflared 2026.7.3" ]]; then
  ok "Cloudflare CLI bootstrap exposes its version pin"
else
  not_ok "Cloudflare CLI bootstrap exposes its version pin"
fi

TUNNEL_RUN="$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare/tunnel.sh"
if grep -Fq -- '--data-urlencode "is_deleted=false"' "$TUNNEL_RUN" \
  && grep -Fq 'cloudflared tunnel --no-autoupdate run' "$TUNNEL_RUN"; then
  ok "tunnel runtime ignores deleted tunnels and preserves its CLI pin"
else
  not_ok "tunnel runtime ignores deleted tunnels and preserves its CLI pin"
fi
if [[ -x "$INFISICAL_INSTALL" && "$($INFISICAL_INSTALL --print-pin)" == "infisical 0.43.116" ]]; then
  ok "Infisical CLI bootstrap exposes its version pin"
else
  not_ok "Infisical CLI bootstrap exposes its version pin"
fi

if jq -e 'has("cloudflare") or has("infisical")' "$TEMPLATES/shared/templates/operations.config.json" >/dev/null; then
  not_ok "shared manifest does not select provider modules"
else
  ok "shared manifest does not select provider modules"
fi

if grep -Fq 'CLOUDFLARE_API_TOKEN=' "$TEMPLATES/cloudflare-infra/templates/.env.operations.example" \
  && ! grep -Fq 'CLOUDFLARE_' "$TEMPLATES/infisical-secrets/templates/.env.operations.example"; then
  ok "provider credential examples stay module-owned"
else
  not_ok "provider credential examples stay module-owned"
fi

workflow_installers=0
for workflow in "$TEMPLATES/cloudflare-infra/templates/.github/workflows/"deploy-*.yml; do
  grep -Fq 'scripts/operations/infisical/install-cli.sh' "$workflow" || workflow_installers=1
done
if [[ $workflow_installers -eq 0 ]]; then
  ok "deploy workflows explicitly install the optional Infisical CLI"
else
  not_ok "deploy workflows explicitly install the optional Infisical CLI"
fi

for module in cloudflare-infra infisical-secrets local-dev; do
  if [[ -f "$TEMPLATES/$module/SETUP.md" ]] && grep -Fq "skills/manage-" "$TEMPLATES/$module/SETUP.md"; then
    ok "$module setup copies its project skill"
  else
    not_ok "$module setup copies its project skill"
  fi
done

if grep -Fq "Operations modules" "$ROOT_DIR/SETUP.md" \
  && grep -Fq "conventions/SETUP.md" "$ROOT_DIR/SETUP.md"; then
  ok "root intake routes operations modules"
else
  not_ok "root intake routes operations modules"
fi

if grep -Fq "conventions/__tests__/run.sh" "$ROOT_DIR/scripts/validate-templates.sh" \
  && grep -Fq "skills/manage-" "$ROOT_DIR/scripts/validate-templates.sh"; then
  ok "kit validation includes operations modules and skills"
else
  not_ok "kit validation includes operations modules and skills"
fi

generated="$TEST_TMP/generated"
mkdir -p "$generated/scripts"
cp -R "$TEMPLATES/shared/templates/scripts/operations" "$generated/scripts/operations"
cp -R "$TEMPLATES/cloudflare-infra/templates/scripts/operations/cloudflare" "$generated/scripts/operations/cloudflare"
cp -R "$TEMPLATES/infisical-secrets/templates/scripts/operations/infisical" "$generated/scripts/operations/infisical"
cp -R "$TEMPLATES/local-dev/templates/scripts/operations/dev" "$generated/scripts/operations/dev"
cp "$FIXTURES/valid-backend.json" "$generated/operations.config.json"
if "$generated/scripts/operations/validate-config.sh" "$generated/operations.config.json" \
  && "$generated/scripts/operations/cloudflare/deploy.sh" --config "$generated/operations.config.json" --env development --plan >/dev/null \
  && "$generated/scripts/operations/dev/preflight.sh" --config "$generated/operations.config.json" --check-config >/dev/null; then
  ok "materialized modules validate without provider credentials"
else
  not_ok "materialized modules validate without provider credentials"
fi

jq 'del(.infisical) | del(.services[].secretsTarget)
  | .cloudflare.deploy.development.checkCommand = "if shopt -q login_shell; then exit 27; fi"
  | .cloudflare.deploy.development.command = "true"' \
  "$FIXTURES/valid-backend.json" >"$generated/non-login-deploy.json"
if CLOUDFLARE_API_TOKEN=test CLOUDFLARE_ACCOUNT_ID=test \
    "$generated/scripts/operations/cloudflare/deploy.sh" \
      --config "$generated/non-login-deploy.json" --env development >/dev/null 2>&1; then
  ok "configured deploy commands do not run in a login shell"
else
  not_ok "configured deploy commands do not run in a login shell"
fi

cat >"$TEST_TMP/bin/bunx" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1 $2 $3" == "wrangler secret bulk" ]]
mode="$(stat -c '%a' "$4" 2>/dev/null || stat -f '%Lp' "$4")"
[[ "$mode" == "600" ]]
printf 'checked\n' >"${BUNX_SECRET_MODE_MARKER:?}"
EOF
chmod +x "$TEST_TMP/bin/bunx"
jq '.cloudflare.deploy.development.command = "true"' \
  "$FIXTURES/valid-backend.json" >"$generated/private-secret-deploy.json"
if umask 022 && PATH="$TEST_TMP/bin:$PATH" \
    BUNX_SECRET_MODE_MARKER="$TEST_TMP/bunx-secret-mode" \
    INFISICAL_URL="https://secrets.example.com" INFISICAL_PROJECT_ID="project" \
    INFISICAL_MACHINE_IDENTITY_CLIENT_ID="client" \
    INFISICAL_MACHINE_IDENTITY_CLIENT_SECRET="secret" \
    CLOUDFLARE_API_TOKEN=test CLOUDFLARE_ACCOUNT_ID=test \
    "$generated/scripts/operations/cloudflare/deploy.sh" \
      --config "$generated/private-secret-deploy.json" --env development >/dev/null 2>&1 \
    && [[ -f "$TEST_TMP/bunx-secret-mode" ]]; then
  ok "Worker secret bulk receives a mode-600 file"
else
  not_ok "Worker secret bulk receives a mode-600 file"
fi

cat >"$TEST_TMP/bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
case "$*" in
  *'/token'*) printf '%s\n' '{"success":true,"result":"connector-token"}' ;;
  *'/configurations'*) printf '%s\n' '{"success":true,"result":{"config":{"ingress":[{"hostname":"local-api.example.com","service":"http://localhost:8787"},{"service":"http_status:404"}]}}}' ;;
  *'/dns_records'*) printf '%s\n' '{"success":true,"result":[{"id":"dns-id","type":"CNAME","content":"tunnel-id.cfargotunnel.com","proxied":true}]}' ;;
  *'/zones'*) printf '%s\n' '{"success":true,"result":[{"id":"zone-id"}]}' ;;
  *'/cfd_tunnel'*) printf '%s\n' '{"success":true,"result":[{"id":"tunnel-id"}]}' ;;
  *) exit 9 ;;
esac
EOF
cat >"$TEST_TMP/bin/cloudflared" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[[ -z "${TUNNEL_TOKEN:-}" ]]
token_file=""
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--token-file" ]]; then token_file="${2:?}"; shift 2; else shift; fi
done
[[ "$token_file" == "${TMPDIR:-/tmp}/toolu-tunnel-token."*/token && -p "$token_file" ]]
[[ "$(<"$token_file")" == "connector-token" ]]
printf '%s\n%s\n' "$$" "$token_file" >"${CLOUDFLARED_RUN_MARKER:?}"
trap 'exit 0' TERM INT
while :; do sleep 1; done
EOF
chmod +x "$TEST_TMP/bin/curl" "$TEST_TMP/bin/cloudflared"
PATH="$TEST_TMP/bin:$PATH" CLOUDFLARE_API_TOKEN=test CLOUDFLARE_ACCOUNT_ID=test \
    CLOUDFLARED_RUN_MARKER="$TEST_TMP/cloudflared-ran" \
    "$generated/scripts/operations/cloudflare/tunnel.sh" \
      --config "$generated/operations.config.json" --run >/dev/null 2>&1 &
tunnel_script_pid=$!
for _ in $(seq 1 50); do [[ -f "$TEST_TMP/cloudflared-ran" ]] && break; sleep 0.1; done
connector_pid="$(sed -n '1p' "$TEST_TMP/cloudflared-ran" 2>/dev/null)"
token_pipe="$(sed -n '2p' "$TEST_TMP/cloudflared-ran" 2>/dev/null)"
for _ in $(seq 1 50); do [[ -n "$token_pipe" && ! -e "$token_pipe" ]] && break; sleep 0.1; done
kill "$tunnel_script_pid" 2>/dev/null || true
wait "$tunnel_script_pid" 2>/dev/null || true
if [[ -n "$connector_pid" && ! -e "$token_pipe" ]] && ! kill -0 "$connector_pid" 2>/dev/null; then
  ok "tunnel connector uses an ephemeral private pipe and stops with its supervisor"
else
  not_ok "tunnel connector uses an ephemeral private pipe and stops with its supervisor"
  if [[ -n "$connector_pid" ]]; then kill "$connector_pid" 2>/dev/null || true; fi
fi

jq 'del(.infisical, .cloudflare)
  | del(.services[0].secretsTarget, .services[0].localHostname, .services[0].healthcheck)
  | .services[0].port = 39992
  | .services[0].command = "sleep 30"' \
  "$FIXTURES/valid-backend.json" >"$generated/non-login-start.json"
"$generated/scripts/operations/dev/start.sh" \
  --config "$generated/non-login-start.json" >"$TEST_TMP/non-login-start.out" 2>&1 &
start_pid=$!
sleep 1.5
if kill -0 "$start_pid" 2>/dev/null; then
  ok "local services execute without a shell command"
else
  not_ok "local services execute without a shell command"
fi
kill "$start_pid" 2>/dev/null || true
wait "$start_pid" 2>/dev/null || true

foreign_start_port=39994
python3 -m http.server "$foreign_start_port" --bind 127.0.0.1 >"$TEST_TMP/foreign-start.log" 2>&1 &
foreign_start_pid=$!
for _ in $(seq 1 20); do
  [[ -n "$(dev_ports::listeners "$foreign_start_port")" ]] && break
  sleep 0.1
done
jq --argjson port "$foreign_start_port" 'del(.infisical, .cloudflare)
  | del(.services[0].secretsTarget, .services[0].localHostname, .services[0].healthcheck)
  | .services[0].port = $port
  | .services[0].command = "sleep 30"' \
  "$FIXTURES/valid-backend.json" >"$generated/foreign-port-start.json"
if "$generated/scripts/operations/dev/start.sh" \
    --config "$generated/foreign-port-start.json" >"$TEST_TMP/foreign-port-start.out" 2>&1; then
  not_ok "local start fails when a foreign process owns a port"
elif kill -0 "$foreign_start_pid" 2>/dev/null; then
  ok "local start fails without signalling a foreign port owner"
else
  not_ok "local start fails without signalling a foreign port owner"
fi
kill "$foreign_start_pid" 2>/dev/null || true
wait "$foreign_start_pid" 2>/dev/null || true

jq 'del(.infisical, .cloudflare)
  | del(.services[0].secretsTarget, .services[0].localHostname, .services[0].healthcheck)
  | .services[0].port = 39995
  | .services[0].command = "sleep 30"' \
  "$FIXTURES/valid-backend.json" >"$generated/fingerprint-start.json"
"$generated/scripts/operations/dev/start.sh" \
  --config "$generated/fingerprint-start.json" >"$TEST_TMP/fingerprint-start.out" 2>&1 &
supervisor_pid=$!
supervisor_state="$generated/.tooling/operations/dev.pids"
for _ in $(seq 1 30); do [[ -s "$supervisor_state" ]] && break; sleep 0.1; done
service_record="$(sed -n '1p' "$supervisor_state")"
service_pid="${service_record%%|*}"
printf '%s|reused-process-fingerprint\n' "$service_pid" >"$supervisor_state"
for _ in $(seq 1 30); do
  kill -0 "$supervisor_pid" 2>/dev/null || break
  sleep 0.1
done
if ! kill -0 "$supervisor_pid" 2>/dev/null && kill -0 "$service_pid" 2>/dev/null; then
  ok "local supervisor detects PID reuse without signalling the replacement"
else
  not_ok "local supervisor detects PID reuse without signalling the replacement"
fi
kill "$supervisor_pid" 2>/dev/null || true
wait "$supervisor_pid" 2>/dev/null || true
kill "$service_pid" 2>/dev/null || true
wait "$service_pid" 2>/dev/null || true

printf '\n%s passed, %s failed\n' "$passed" "$failed"
[[ "$failed" -eq 0 ]]
