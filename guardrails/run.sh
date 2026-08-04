#!/usr/bin/env bash
# run.sh — the agent-guardrails entry point.
#
# Enforces the structural rules that a linter structurally cannot see: the
# folder tree, per-domain shape, colocated tests, barrels, banned dependencies,
# required files, committed secrets, and contextual code patterns. Anything
# oxlint / oxfmt / clippy / rustfmt already enforces stays with them — two
# enforcers of one rule is how ceilings drift apart.
#
#   run.sh                  repo mode  — every check, whole tree. The gate.
#   run.sh --file <path>…   scoped     — file-addressable checks for those paths
#   run.sh --hook           PostToolUse — reads hook JSON on stdin, then --file
#   run.sh --stop           Stop hook  — repo mode behind two early-outs
#   run.sh --only a,b       run only the named checks (used by the test suite)
#   run.sh --list           print every check id, one per line
#
# Exit: 0 clean · 1 violations · 2 violations in a hook mode · 3 misconfigured.
# Exit 2 in the hook modes is mandatory, not stylistic: Claude Code ignores a 1
# from a hook. Only 2 shows stderr to the agent on PostToolUse, and only 2
# blocks on Stop. A --stop that exited 1 would leave the whole layer inert while
# looking correctly wired up.
set -u

GR_DIR=$(cd "$(dirname "$0")" && pwd)
. "$GR_DIR/lib/report.sh"
. "$GR_DIR/lib/config.sh"

# Order is the order they run in. File-addressable checks first so --file mode
# short-circuits cheaply.
GR_CHECKS_FILE='folder-tree file-size colocated-tests no-barrels filename-case patterns'
GR_CHECKS_REPO='banned-deps shadow-configs required-files secrets'
GR_CHECKS_ALL="$GR_CHECKS_FILE $GR_CHECKS_REPO"

gr_list() {
  for check in $GR_CHECKS_ALL; do printf '%s\n' "$check"; done
}

# gr_selected <check> — honours --only, and skips whatever the linter owns.
#
# ownedByLinter is how "one rule, one enforcer" survives the split: oxlint's
# house plugin enforces the per-file rules on the TypeScript stacks, so this
# module must NOT also enforce them. The Rust stack lists nothing, because
# oxlint cannot parse Rust at all — there every check still runs here.
gr_selected() {
  case " $GR_OWNED_BY_LINTER " in *" $1 "*) return 1 ;; esac
  [ -z "$GR_ONLY" ] && return 0
  case ",$GR_ONLY," in *",$1,"*) return 0 ;; *) return 1 ;; esac
}

gr_run_checks() {
  mode=$1
  path=${2-}
  case "$mode" in
    repo) set_of_checks=$GR_CHECKS_ALL ;;
    file) set_of_checks=$GR_CHECKS_FILE ;;
  esac
  for check in $set_of_checks; do
    gr_selected "$check" || continue
    "gr_check_$(printf '%s' "$check" | tr '-' '_')" "$mode" "$path"
  done
}

GR_MODE=repo
GR_PATHS=''
GR_ONLY=''

while [ $# -gt 0 ]; do
  case "$1" in
    --list) gr_list; exit 0 ;;
    # --file takes one or more paths: Lefthook expands {staged_files} to every
    # staged file at once, so a single-path flag would break any real commit.
    --file)
      GR_MODE=file
      shift
      while [ $# -gt 0 ]; do
        case "$1" in --*) break ;; esac
        GR_PATHS="$GR_PATHS $1"
        shift
      done
      [ -n "$GR_PATHS" ] || gr_fatal '--file needs at least one path'
      ;;
    --hook) GR_MODE=hook; shift ;;
    --stop) GR_MODE=stop; shift ;;
    --only) GR_ONLY=${2-}; [ -n "$GR_ONLY" ] || gr_fatal '--only needs a comma-separated check list'; shift 2 ;;
    *) gr_fatal "unknown flag: $1 (try --list)" ;;
  esac
done

gr_require_jq
gr_load_config
gr_cache_config
for check in $GR_CHECKS_ALL; do
  . "$GR_DIR/checks/$check.sh"
done

case "$GR_MODE" in
  repo)
    gr_run_checks repo
    [ "$GR_FAIL" -eq 0 ] && exit 0 || exit 1
    ;;

  file)
    for target in $GR_PATHS; do
      gr_run_checks file "$target"
    done
    [ "$GR_FAIL" -eq 0 ] && exit 0 || exit 1
    ;;

  hook)
    # PostToolUse payload on stdin. An Edit/Write that touched nothing we can
    # resolve is not an error — exit 0 and stay out of the way.
    payload=$(cat)
    edited=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
    [ -n "$edited" ] || exit 0
    # Hooks receive absolute paths; every check works repo-relative.
    edited=${edited#"$PWD"/}
    [ -e "$edited" ] || exit 0
    gr_run_checks file "$edited"
    [ "$GR_FAIL" -eq 0 ] && exit 0 || exit 2
    ;;

  stop)
    payload=$(cat 2>/dev/null || printf '{}')
    # Already continuing from a previous block — re-blocking on the same finding
    # just burns turns against the harness's 8-block ceiling.
    active=$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null)
    [ "$active" = 'true' ] && exit 0
    # Nothing changed this turn: a conversational turn should never pay for the
    # gate. --porcelain rather than `git diff --quiet HEAD` on purpose — diff
    # ignores untracked files, and a brand-new file is exactly the case that
    # most needs checking.
    if git rev-parse --git-dir >/dev/null 2>&1; then
      [ -z "$(git status --porcelain 2>/dev/null)" ] && exit 0
    fi
    gr_run_checks repo
    [ "$GR_FAIL" -eq 0 ] && exit 0 || exit 2
    ;;
esac
