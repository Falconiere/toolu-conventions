# config.sh — locates, validates and reads guardrails.config.json.
#
# The config is the single source of truth for every ceiling and allowlist. It
# fails CLOSED: a missing key, an unknown key, or absent jq all exit 3 rather
# than falling back to a default. A guard rail that silently stops enforcing is
# worse than no guard rail, because you stop looking at it.

# Bumped when a change to the scripts requires a config change. run.sh warns
# (never fails) when a project's copied config trails this.
GR_SCRIPTS_VERSION=1

GR_REQUIRED_KEYS='version srcRoot src fileSize functionSize testDir testGlob barrelNames bannedDeps shadowConfigs'
GR_OPTIONAL_KEYS='$schema barrelExempt requiredFiles secrets filenameCase ownedByLinter'

gr_require_jq() {
  command -v jq >/dev/null 2>&1 || gr_fatal \
    'jq is required to read guardrails.config.json but was not found on PATH — install it (apt-get install jq · brew install jq · apk add jq)'
}

# gr_load_config — resolves the config path, validates it, exports GR_CONFIG_FILE.
# Honours $GR_CONFIG so the test suite can point at a fixture.
gr_load_config() {
  GR_CONFIG_FILE=${GR_CONFIG:-guardrails.config.json}
  [ -f "$GR_CONFIG_FILE" ] || gr_fatal \
    "no config at $GR_CONFIG_FILE — copy guardrails.config.json from the stack kit, or set GR_CONFIG"
  jq -e . "$GR_CONFIG_FILE" >/dev/null 2>&1 || gr_fatal \
    "$GR_CONFIG_FILE is not valid JSON — fix the syntax; the gate cannot run without it"

  for key in $GR_REQUIRED_KEYS; do
    jq -e --arg k "$key" 'has($k)' "$GR_CONFIG_FILE" >/dev/null 2>&1 || gr_fatal \
      "$GR_CONFIG_FILE is missing required key: $key"
  done

  # An unknown key is almost always a typo, and a typo'd key means the rule it
  # was meant to configure silently stops applying. Reject it.
  known=" $GR_REQUIRED_KEYS $GR_OPTIONAL_KEYS "
  while IFS= read -r key; do
    case "$known" in
      *" $key "*) ;;
      *) gr_fatal "$GR_CONFIG_FILE has unknown key: $key (typo? known keys:$known)" ;;
    esac
  done < <(jq -r 'keys[]' "$GR_CONFIG_FILE")

  config_version=$(jq -r '.version' "$GR_CONFIG_FILE")
  if [ "$config_version" -lt "$GR_SCRIPTS_VERSION" ] 2>/dev/null; then
    gr_warn "guardrails.config.json is version $config_version but these scripts are version $GR_SCRIPTS_VERSION — re-copy scripts/guardrails/ and guardrails.config.json from the kit"
  fi
}

# gr_cache_config — read every value ONCE into shell variables.
#
# This is a performance requirement, not a tidiness one. Reading through jq
# per file turned a 500-file tree into 17 seconds of process spawns, and a gate
# that slow is a gate people route around. One jq call, then pure bash.
#
# Map-shaped values are flattened to "key|v1 v2;key2|v3;" and parsed with case
# rather than an associative array, which bash 3.2 (still the system bash on
# macOS) does not have.
gr_cache_config() {
  {
    read -r GR_SRC_ROOT
    read -r GR_FILE_MAX
    read -r GR_FN_MAX
    read -r GR_TEST_DIR
    read -r GR_TEST_GLOB
    read -r GR_TOPLEVEL_SET
    read -r GR_TOPLEVEL
    read -r GR_REQUIRE_README
    read -r GR_BARREL_NAMES
    read -r GR_BARREL_EXEMPT
    read -r GR_BANNED_DEPS
    read -r GR_SKIP_EXT
    read -r GR_SECRET_FILES
    read -r GR_SECRET_SCAN_EXEMPT
    read -r GR_NESTED_MAP
    read -r GR_SIZE_OVERRIDES
    read -r GR_FILENAME_CASE
    read -r GR_OWNED_BY_LINTER
  } < <(jq -r '
    [ .srcRoot,
      (.fileSize.max | tostring),
      (.functionSize.max | tostring),
      .testDir,
      .testGlob,
      (if (.src.topLevel == null) then "no" else "yes" end),
      ((.src.topLevel // []) | join(" ")),
      ((.src.requireReadme // []) | join(" ")),
      (.barrelNames | join(" ")),
      ((.barrelExempt // []) | join(" ")),
      (.bannedDeps | join(" ")),
      ((.fileSize.skipExtensions // []) | join(" ")),
      ((.secrets.neverTracked // []) | join(" ")),
      ((.secrets.scanExempt // []) | join(" ")),
      ((.src.nested // {}) | to_entries | map("\(.key)|\(.value | join(" "))") | join(";")),
      ((.fileSize.overrides // {}) | to_entries | map("\(.key)|\(.value)") | join(";")),
      ((.filenameCase // []) | map("\(.glob)|\(.regex)|\(.describe)") | join(";")),
      ((.ownedByLinter // []) | join(" "))
    ] | .[]
  ' "$GR_CONFIG_FILE")
}

# Deliberately no gr_cfg / gr_cfg_arr / gr_cfg_has / gr_match_glob helpers here.
# Every value is read once by gr_cache_config above and every check reads the
# cached variable, so a second jq-per-call accessor has no caller — and the
# "omitted vs empty array" distinction those helpers existed to express is
# already carried by GR_TOPLEVEL_SET. This directory is copied verbatim into
# every project, so an unused helper is not free: it is five more copies of code
# nothing exercises, in the one module whose whole point is that copies do not
# rot.
