# lint-suppressions.sh — dead code must be removed or wired, never hidden.
#
# The compiler/linter owns finding dead declarations. This check owns the
# independent fact that source code must not turn that enforcement off:
#
# - a blanket eslint/oxlint disable can silence no-unused-vars along with every
#   other rule;
# - a scoped no-unused-vars disable hides exactly the dead code this convention
#   exists to expose;
# - Rust's #[allow(dead_code)] and #![allow(dead_code)] override Cargo's
#   workspace-level `dead_code = "deny"`.
#
# Script and Rust paths are scanned separately. An oxlint directive in Rust is
# just prose, and a Rust attribute-like string in TypeScript is not an
# attribute; applying all patterns to all languages would invent violations.

GR_LS_BLANKET='(^|[[:space:]])(//|/\*|\*)[[:space:]]*(oxlint|eslint)-disable(-next-line|-line)?[[:space:]]*(--[^[:cntrl:]]*)?(\*/)?[[:space:]]*$'
GR_LS_UNUSED='(^|[[:space:]])(//|/\*|\*)[[:space:]]*(oxlint|eslint)-disable(-next-line|-line)?[[:space:]]+([^,[:space:]]+[[:space:]]*,[[:space:]]*)*((eslint|typescript|@typescript-eslint)/)?no-unused-vars([[:space:],*]|$)'
GR_LS_RUST_UNUSED='^[[:space:]]*#!?\[[[:space:]]*allow[[:space:]]*\([[:space:]]*([^,)]*[[:space:]]*,[[:space:]]*)*dead_code([[:space:]]*,[^)]*)?\)[[:space:]]*\]'

# gr_ls_scan <path> — file/hook mode. Read in Bash instead of launching grep:
# this path runs after every edit, and one process per check is measurable once
# workspace dispatch has already re-execed the package guardrail. Repo mode
# still uses one batched grep for the whole tree below.
gr_ls_scan() {
  local path kind line matched
  path=$1
  case "$path" in
    *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs|*.astro) kind=script ;;
    *.rs) kind=rust ;;
    *) return 0 ;;
  esac
  [ -f "$path" ] || return 0
  [ -r "$path" ] || gr_fatal "lint-suppressions cannot read $path"

  matched=0
  while IFS= read -r line || [ -n "$line" ]; do
    if [ "$kind" = 'script' ]; then
      if [[ $line =~ $GR_LS_BLANKET ]] || [[ $line =~ $GR_LS_UNUSED ]]; then
        matched=1
        break
      fi
    elif [[ $line =~ $GR_LS_RUST_UNUSED ]]; then
      matched=1
      break
    fi
  done < "$path" || gr_fatal "lint-suppressions scan failed on $path"
  [ "$matched" -eq 1 ] || return 0
  gr_violation lint-suppressions "$path" \
    'dead-code lint enforcement is disabled' \
    'delete the unused code or wire it into the program; do not suppress the lint'
}

# gr_ls_repo_lists <script-list> <rust-list> — inventory live source files,
# including untracked edits, while pruning dependencies and generated output.
# Lists are NUL-delimited because filenames may contain spaces, colons, or
# newlines; the rest of guardrails already makes the same path-safety promise.
gr_ls_repo_lists() {
  local script_list rust_list path
  script_list=$1
  rust_list=$2
  while IFS= read -r -d '' path; do
    path=${path#./}
    # Match extensions inline: a helper call through command substitution would
    # fork once per source file, adding almost a second on the latency tree.
    case "$path" in
      *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs|*.astro)
        printf '%s\0' "$path" >> "$script_list"
        ;;
      *.rs) printf '%s\0' "$path" >> "$rust_list" ;;
    esac
  done < <(find . \
    \( -path './.git' -o -path './node_modules' -o -path './dist' \
       -o -path './build' -o -path './out' -o -path './coverage' \
       -o -path './.wrangler' -o -path './.next' -o -path './.expo' \
       -o -path './target' -o -path './vendor' \) -prune \
    -o -type f -print0 2>/dev/null)
}

# gr_ls_scan_batch <nul-list> <kind> — one grep process per language family,
# then one violation per matching file. The sh wrapper absorbs grep's normal
# no-match status (1) but preserves real failures through xargs.
gr_ls_scan_batch() {
  local list kind hitfile errfile status errtext path
  list=$1
  kind=$2
  [ -s "$list" ] || return 0
  hitfile=$(mktemp)
  errfile=$(mktemp)
  if [ "$kind" = 'script' ]; then
    xargs -0 sh -c 'p1=$1; p2=$2; shift 2; grep -E -I -l -Z -e "$p1" -e "$p2" -- "$@" || [ $? -eq 1 ]' \
      sh "$GR_LS_BLANKET" "$GR_LS_UNUSED" < "$list" > "$hitfile" 2>"$errfile"
  else
    xargs -0 sh -c 'p1=$1; shift; grep -E -I -l -Z -e "$p1" -- "$@" || [ $? -eq 1 ]' \
      sh "$GR_LS_RUST_UNUSED" < "$list" > "$hitfile" 2>"$errfile"
  fi
  status=$?
  errtext=$(cat "$errfile")
  rm -f "$errfile"
  if [ -n "$errtext" ] || [ "$status" -ne 0 ]; then
    rm -f "$hitfile"
    gr_fatal "lint-suppressions $kind repo scan failed: ${errtext:-batch exited $status}"
  fi
  while IFS= read -r -d '' path; do
    gr_violation lint-suppressions "$path" \
      'dead-code lint enforcement is disabled' \
      'delete the unused code or wire it into the program; do not suppress the lint'
  done < "$hitfile"
  rm -f "$hitfile"
}

gr_check_lint_suppressions() {
  local mode path script_list rust_list
  mode=$1
  path=${2-}
  if [ "$mode" = 'file' ]; then
    gr_ls_scan "$path"
    return 0
  fi

  script_list=$(mktemp)
  rust_list=$(mktemp)
  gr_ls_repo_lists "$script_list" "$rust_list"
  gr_ls_scan_batch "$script_list" script
  gr_ls_scan_batch "$rust_list" rust
  rm -f "$script_list" "$rust_list"
}
