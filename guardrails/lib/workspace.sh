# workspace.sh — monorepo dispatch: fan every mode out across the packages.
#
# The shape of the problem: all three wired invocations run with the working
# directory at the REPO ROOT — PostToolUse and Stop from .claude/settings.json,
# and lefthook's {staged_files}. A workspace root has no guardrails.config.json,
# so without this module gr_load_config would exit 3 on every one of them and
# enforcement layers 2 and 3 would be dead while looking correctly wired up.
#
# Why re-exec instead of a loop in this process: gr_cache_config reads every
# value ONCE into plain shell globals (GR_FILE_MAX, GR_TOPLEVEL, …). A second
# package handled in the same process would inherit the first one's ceilings and
# allowlists — and ownedByLinter differs per package, so the wrong checks would
# be skipped too. A child process starts from nothing, which is exactly the
# isolation we need. The cost is one fork per package; run-latency.sh holds it
# to the same budget as a single-root tree.
#
# The checks themselves are untouched. Each child runs with its working
# directory INSIDE its package, which is the single-root case they were written
# for.

# The root subset. Only the checks that read repo-level facts rather than a
# source tree — there is no srcRoot at a workspace root for the others to walk.
GR_WS_ROOT_CHECKS='banned-deps shadow-configs required-files secrets'

# gr_ws_owner <repo-relative-path> — the listed package containing this path,
# or empty. Longest match wins, so nested package dirs resolve to the innermost.
gr_ws_owner() {
  gr_ws_path=$1
  gr_ws_best=''
  for gr_ws_pkg in $GR_WS_PACKAGES; do
    case "$gr_ws_path" in
      "$gr_ws_pkg"/*)
        [ "${#gr_ws_pkg}" -gt "${#gr_ws_best}" ] && gr_ws_best=$gr_ws_pkg
        ;;
    esac
  done
  printf '%s' "$gr_ws_best"
}

# gr_ws_exec <package> [args…] — run the whole module inside one package.
#
# GR_CONFIG is cleared so the child resolves its own guardrails.config.json from
# its new working directory, and so gr_is_workspace refuses to recurse. Nesting
# is not supported and silently recursing would be worse than refusing.
# GR_PATH_PREFIX is what puts the package back into the reported path.
gr_ws_exec() {
  gr_ws_pkg=$1
  shift
  (
    cd "$gr_ws_pkg" || exit 3
    GR_CONFIG='' GR_PATH_PREFIX="$gr_ws_pkg/" exec "$GR_DIR/run.sh" "$@"
  )
}

# gr_ws_worst <current> <incoming> — 3 beats everything (a broken guard rail
# must never be mistakable for a clean run), then 2, then 1.
gr_ws_worst() {
  case "$1:$2" in
    3:*|*:3) printf '3' ;;
    2:*|*:2) printf '2' ;;
    1:*|*:1) printf '1' ;;
    *) printf '0' ;;
  esac
}

# gr_ws_run_root — the repo-level checks, against the manifest, in this process.
gr_ws_run_root() {
  for check in $GR_WS_ROOT_CHECKS; do
    gr_selected "$check" || continue
    gr_call "$check" repo
  done
}

# gr_ws_require_listed — no package may exist outside the manifest.
#
# Repo mode walks the packages the manifest names, so a package it forgot is
# not "clean", it is unvisited — and the gate reports green over a source tree
# nobody checked. A stray guardrails.config.json is the evidence that such a
# tree exists, and it is the one signal that cannot be produced by accident:
# somebody scaffolded a package and never wired it up.
gr_ws_require_listed() {
  while IFS= read -r gr_ws_found; do
    gr_ws_found=${gr_ws_found#./}
    gr_ws_dir=${gr_ws_found%/guardrails.config.json}
    [ -n "$(gr_ws_owner "$gr_ws_found")" ] && continue
    gr_fatal \
      "\"$gr_ws_dir\" has a guardrails.config.json but is not listed in $GR_WS_FILE — add it to packages, or delete the config; an unlisted package is never checked and the gate still reports green"
  done < <(find . -name guardrails.config.json -not -path '*/node_modules/*' 2>/dev/null)
}

# gr_ws_run_repo — every package, plus the root. Used by both repo and stop mode.
gr_ws_run_repo() {
  gr_ws_require_listed
  gr_ws_status=0
  for gr_ws_pkg in $GR_WS_PACKAGES; do
    gr_ws_exec "$gr_ws_pkg"
    gr_ws_status=$(gr_ws_worst "$gr_ws_status" "$?")
  done
  gr_ws_run_root
  [ "$GR_FAIL" -eq 0 ] || gr_ws_status=$(gr_ws_worst "$gr_ws_status" 1)
  return "$gr_ws_status"
}

# gr_ws_run_paths <path…> — bucket by owning package, then one child per bucket.
#
# Bucketing rather than one child per path: lefthook expands {staged_files} to
# every staged file at once, and a fork per file would pay the startup cost N
# times on the commit hook. Paths are rewritten package-relative because that is
# what the child's checks expect.
gr_ws_run_paths() {
  gr_ws_status=0
  for gr_ws_pkg in $GR_WS_PACKAGES; do
    gr_ws_bucket=()
    for gr_ws_p in "$@"; do
      [ "$(gr_ws_owner "$gr_ws_p")" = "$gr_ws_pkg" ] || continue
      gr_ws_bucket+=("${gr_ws_p#"$gr_ws_pkg"/}")
    done
    [ "${#gr_ws_bucket[@]}" -gt 0 ] || continue
    gr_ws_exec "$gr_ws_pkg" --file "${gr_ws_bucket[@]}"
    gr_ws_status=$(gr_ws_worst "$gr_ws_status" "$?")
  done
  return "$gr_ws_status"
}

# gr_ws_require_owned <path…> — every path must belong to a listed package.
#
# Fails closed. A file outside every package is not "nothing to check": it is a
# source tree the manifest forgot, and passing it silently is how a whole
# package stays unguarded for months.
gr_ws_require_owned() {
  for gr_ws_p in "$@"; do
    [ -n "$(gr_ws_owner "$gr_ws_p")" ] || gr_fatal \
      "\"$gr_ws_p\" is under no package listed in $GR_WS_FILE — add its package to the manifest, or move the file into one"
  done
}
