# patterns.sh — contextual code patterns, via ast-grep.
#
# This is the check oxlint cannot supply: it has no no-restricted-syntax, and
# every rule worth writing here is contextual. "Bare fetch, EXCEPT inside
# utilities/http.ts" is not a grep — text matching would flag the one correct
# call site along with the wrong ones, and a rule that cries wolf on correct
# code gets disabled.
#
# ast-grep also gives one rule syntax across TS, TSX and Rust, so the Rust stack
# gets pattern enforcement it can never get from a JavaScript linter.

# gr_pat_bin — the ast-grep invocation, or empty when unavailable.
# Prefer the locally installed binary. @ast-grep/cli is a devDependency on the
# TypeScript stacks, and node_modules/.bin/ast-grep starts in milliseconds where
# `bunx` pays a package-resolution cost on every single invocation — which
# matters because the PostToolUse hook runs this on every edit.
gr_pat_bin() {
  if [ -x node_modules/.bin/ast-grep ]; then
    printf 'node_modules/.bin/ast-grep'
  elif command -v ast-grep >/dev/null 2>&1; then
    printf 'ast-grep'
  elif command -v bunx >/dev/null 2>&1; then
    printf 'bunx --bun @ast-grep/cli'
  fi
}

gr_check_patterns() {
  mode=$1
  path=${2-}
  rules="$GR_DIR/patterns"
  [ -f "$rules/sgconfig.yml" ] || return 0

  bin=$(gr_pat_bin)
  if [ -z "$bin" ]; then
    # Not a violation and not a silent pass: the gate must say what it skipped.
    gr_warn 'ast-grep not found — pattern checks skipped (add @ast-grep/cli as a devDependency, or install the binary)'
    return 0
  fi

  if [ "$mode" = 'file' ]; then
    target=$path
  else
    target=$(gr_cfg '.srcRoot')
    [ -d "$target" ] || return 0
  fi

  # ast-grep's exit codes: 0 = nothing matched, 1 = a rule matched, anything
  # else = ast-grep itself failed (8 = unparseable rule, 6 = missing config).
  # That distinction has to be honoured. Swallowing a nonzero exit here made a
  # single malformed rule file silence EVERY pattern check while the gate still
  # reported green — a guard rail that fails open is worse than none, because
  # you stop looking at it.
  output=$($bin scan -c "$rules/sgconfig.yml" --json=compact "$target" 2>/dev/null)
  status=$?
  case "$status" in
    0 | 1) ;;
    *) gr_fatal "ast-grep exited $status scanning $target — a rule in $rules is malformed or unreadable; the pattern checks did NOT run" ;;
  esac
  [ -n "$output" ] && [ "$output" != '[]' ] || return 0

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    rule=${line%%|*}
    rest=${line#*|}
    file=${rest%%|*}
    msg=${rest#*|}
    gr_violation patterns "$file" "$rule" "$msg"
  done < <(printf '%s' "$output" | jq -r '.[] | "\(.ruleId)|\(.file)|\(.message)"')
}
