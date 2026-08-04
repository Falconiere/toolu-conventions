#!/usr/bin/env bash
# run-fixtures.sh — the guardrails test suite.
#
# Real data only: every assertion runs the actual run.sh against a real
# directory tree on disk, inside a real git repository built by lib/mkrepo.sh.
# Nothing is mocked — there is no filesystem stub and no faked `git`.
#
#   run-fixtures.sh                run every assertion
#   run-fixtures.sh --only a,b     only assertions tagged with those check ids
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
GR="$HERE/../run.sh"
ONLY=''
[ "${1-}" = '--only' ] && ONLY=${2-}

pass=0
fail=0

ok() { printf '  ok    %s\n' "$1"; pass=$((pass + 1)); }
bad() {
  printf '  FAIL  %s\n' "$1"
  [ -n "${2-}" ] && printf '        %s\n' "$2"
  fail=$((fail + 1))
}

# tagged <check-id> — is this assertion in scope for --only?
tagged() {
  [ -z "$ONLY" ] && return 0
  case ",$ONLY," in *",$1,"*) return 0 ;; *) return 1 ;; esac
}

# gr_in <dir> [args...] — run guardrails inside a project dir, stderr captured,
# exit status left in $STATUS.
gr_in() {
  dir=$1
  shift
  OUT=$(cd "$dir" && bash "$GR" "$@" 2>&1 </dev/null)
  STATUS=$?
}

# count_check <output> <check-id> — violations reported by one check.
count_check() {
  printf '%s\n' "$1" | grep -c "^guardrails\[$2\]" 2>/dev/null || true
}

CLEAN=$(bash "$HERE/lib/mkrepo.sh" clean)
DIRTY=$(bash "$HERE/lib/mkrepo.sh" violating)
trap 'rm -rf "$CLEAN" "$DIRTY" "${SCRATCH:-}"' EXIT

ALL_CHECKS='folder-tree file-size colocated-tests no-barrels filename-case banned-deps shadow-configs required-files secrets patterns'

echo 'guardrails fixtures'

# ---------------------------------------------------------------- AC-1
if tagged folder-tree || tagged file-size || tagged colocated-tests; then
  gr_in "$CLEAN"; out=$OUT
  if [ "$STATUS" -eq 0 ] && [ -z "$out" ]; then
    ok 'AC-1  clean fixture: exit 0, no output'
  else
    bad 'AC-1  clean fixture must be silent' "exit=$STATUS output=$out"
  fi
fi

# ---------------------------------------------------------------- AC-2, AC-3
gr_in "$DIRTY"; out=$OUT
dirty_status=$STATUS
if [ -z "$ONLY" ]; then
  [ "$dirty_status" -eq 1 ] && ok 'AC-2  violating fixture: exit 1' \
    || bad 'AC-2  violating fixture must exit 1' "exit=$dirty_status"
fi
for check in $ALL_CHECKS; do
  tagged "$check" || continue
  n=$(count_check "$out" "$check")
  if [ "$n" -eq 1 ]; then
    ok "AC-3  $check: exactly one violation"
  else
    bad "AC-3  $check: expected exactly 1 violation, got $n" \
      "$(printf '%s\n' "$out" | grep "^guardrails\[$check\]" | head -3)"
  fi
done

# Every reported line carries a remedy clause. An agent told only what is wrong
# retries blindly, which is how a guard rail becomes a loop.
if [ -z "$ONLY" ]; then
  missing=$(printf '%s\n' "$out" | grep '^guardrails\[' | grep -vc ' — ' || true)
  [ "$missing" -eq 0 ] && ok 'AC-2  every violation carries a remedy clause' \
    || bad "AC-2  $missing violation(s) have no remedy clause"
fi

# ---------------------------------------------------------------- AC-4
if tagged folder-tree; then
  gr_in "$DIRTY" --file src/features/shifts/utils/helper.ts; out=$OUT
  s=$STATUS
  if [ "$s" -eq 1 ] && [ "$(count_check "$out" folder-tree)" -ge 1 ]; then
    ok 'AC-4  --file reports the same folder-tree violation'
  else
    bad 'AC-4  --file must report the folder-tree violation' "exit=$s out=$out"
  fi
  gr_in "$DIRTY" --file src/utilities/plain.ts; out=$OUT
  if [ "$STATUS" -eq 0 ] && [ -z "$out" ]; then
    ok 'AC-4  --file on a clean file: exit 0'
  else
    bad 'AC-4  --file on a clean file must be silent' "exit=$STATUS out=$out"
  fi
  # Set-level checks must stay silent in --file mode.
  quiet=1
  for check in banned-deps shadow-configs required-files secrets; do
    [ "$(count_check "$out" "$check")" -eq 0 ] || quiet=0
  done
  [ "$quiet" -eq 1 ] && ok 'AC-4  set-level checks silent in --file mode' \
    || bad 'AC-4  a set-level check ran in --file mode'
fi

# ---------------------------------------------------------------- AC-5
if [ -z "$ONLY" ]; then
  payload=$(jq -nc --arg p "$DIRTY/src/features/shifts/utils/helper.ts" '{
    session_id: "test", hook_event_name: "PostToolUse", tool_name: "Write",
    tool_input: { file_path: $p, content: "x" },
    tool_response: { filePath: $p, success: true }
  }')
  out=$(cd "$DIRTY" && printf '%s' "$payload" | bash "$GR" --hook 2>&1)
  s=$?
  if [ "$s" -eq 2 ] && [ -n "$out" ]; then
    ok 'AC-5  --hook on a real PostToolUse payload: exit 2 with stderr'
  else
    bad 'AC-5  --hook must exit 2 (Claude Code ignores 1 from a hook)' "exit=$s out=$out"
  fi
fi

# ---------------------------------------------------------------- AC-6
if [ -z "$ONLY" ]; then
  out=$(cd "$DIRTY" && printf '{"stop_hook_active":true}' | bash "$GR" --stop 2>&1)
  [ $? -eq 0 ] && ok 'AC-6  --stop: exit 0 when stop_hook_active' \
    || bad 'AC-6  --stop must not re-block when already continuing' "$out"

  out=$(cd "$CLEAN" && printf '{}' | bash "$GR" --stop 2>&1)
  [ $? -eq 0 ] && ok 'AC-6  --stop: exit 0 when the tree is unchanged' \
    || bad 'AC-6  --stop must early-out on an unchanged tree' "$out"

  # Dirty tree with violations present must BLOCK, and with 2 rather than 1.
  printf 'export const late = 1;\n' > "$DIRTY/src/utilities/late.ts"
  out=$(cd "$DIRTY" && printf '{}' | bash "$GR" --stop 2>&1)
  s=$?
  [ "$s" -eq 2 ] && ok 'AC-6  --stop: exit 2 on a changed tree with violations' \
    || bad 'AC-6  --stop must exit 2 — a 1 leaves the Stop layer inert' "exit=$s"
  rm -f "$DIRTY/src/utilities/late.ts"
fi

# ---------------------------------------------------------------- AC-7, AC-8
if [ -z "$ONLY" ]; then
  # A PATH with the usual tools but no jq — emptying PATH entirely would also
  # remove dirname/find/git and prove nothing about the jq guard specifically.
  NOJQ=$(mktemp -d)
  for tool in bash dirname basename find awk grep sed tr cat git mktemp env; do
    p=$(command -v "$tool") && ln -sf "$p" "$NOJQ/$tool"
  done
  out=$(cd "$CLEAN" && PATH="$NOJQ" bash "$GR" 2>&1)
  s=$?
  rm -rf "$NOJQ"
  if [ "$s" -eq 3 ] && printf '%s' "$out" | grep -q 'jq'; then
    ok 'AC-7  missing jq: exit 3 naming jq'
  else
    bad 'AC-7  missing jq must exit 3, never 0 or 1' "exit=$s out=$out"
  fi

  SCRATCH=$(mktemp -d)
  jq 'del(.testDir)' "$CLEAN/guardrails.config.json" > "$SCRATCH/missing.json"
  out=$(cd "$CLEAN" && GR_CONFIG="$SCRATCH/missing.json" bash "$GR" 2>&1)
  s=$?
  if [ "$s" -eq 3 ] && printf '%s' "$out" | grep -q 'testDir'; then
    ok 'AC-8  missing required key: exit 3 naming the key'
  else
    bad 'AC-8  a missing key must fail closed' "exit=$s out=$out"
  fi

  jq '. + {"srcRoott": "src"}' "$CLEAN/guardrails.config.json" > "$SCRATCH/typo.json"
  out=$(cd "$CLEAN" && GR_CONFIG="$SCRATCH/typo.json" bash "$GR" 2>&1)
  s=$?
  if [ "$s" -eq 3 ] && printf '%s' "$out" | grep -q 'srcRoott'; then
    ok 'AC-8  unknown key (typo): exit 3 naming the key'
  else
    bad 'AC-8  a typo must fail closed, not silently disable a rule' "exit=$s out=$out"
  fi
fi

# ---------------------------------------------------------------- AC-9
if tagged folder-tree; then
  gr_in "$DIRTY"; out=$OUT
  printf '%s' "$out" | grep -q 'utils.*not an allowed directory' \
    && ok 'AC-9  folder-tree fires on an unsanctioned intra-domain directory' \
    || bad 'AC-9  folder-tree must reject src/features/shifts/utils/'

  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  rm -f "$SC/src/features/shifts/README.md"
  gr_in "$SC"; out=$OUT
  printf '%s' "$out" | grep -q 'domain folder has no README' \
    && ok 'AC-9  folder-tree fires on a domain folder with no README' \
    || bad 'AC-9  a domain folder without a README must fail' "$out"
  rm -rf "$SC"
fi

# ---------------------------------------------------------------- AC-10
if tagged file-size; then
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  jq '.fileSize.max = 300' "$SC/guardrails.config.json" > "$SC/tmp" && mv "$SC/tmp" "$SC/guardrails.config.json"
  { for i in $(seq 1 250); do echo "export const v$i = $i;"; done
    for i in $(seq 1 150); do echo; echo "// filler $i"; done; } > "$SC/src/utilities/mostly-docs.ts"
  gr_in "$SC"; out=$OUT
  [ "$(count_check "$out" file-size)" -eq 0 ] \
    && ok 'AC-10 250 code lines + 150 blank/comment lines passes at max 300' \
    || bad 'AC-10 blanks and comments must not count' "$out"

  { for i in $(seq 1 301); do echo "export const w$i = $i;"; done; } > "$SC/src/utilities/too-big.ts"
  gr_in "$SC"; out=$OUT
  printf '%s' "$out" | grep -q '301 code lines' \
    && ok 'AC-10 301 code lines fails at max 300' \
    || bad 'AC-10 the ceiling must fire on code lines' "$out"
  rm -rf "$SC"
fi

# ---------------------------------------------------------------- AC-11
if tagged patterns; then
  gr_in "$DIRTY"; out=$OUT
  if printf '%s' "$out" | grep -q 'no-bare-fetch.*bad.tsx' \
    || printf '%s' "$out" | grep -q 'bad.tsx.*no-bare-fetch'; then
    ok 'AC-11 patterns: no-bare-fetch fires in a feature file'
  else
    bad 'AC-11 no-bare-fetch must fire on a feature file' "$(printf '%s' "$out" | grep patterns)"
  fi
  gr_in "$CLEAN"; out=$OUT
  [ "$(count_check "$out" patterns)" -eq 0 ] \
    && ok 'AC-11 patterns: silent on fetch inside utilities/http.ts' \
    || bad 'AC-11 the http client must be exempt from no-bare-fetch' "$out"
fi

# ---------------------------------------------------------------- AC-16
if tagged required-files; then
  gr_in "$DIRTY"; out=$OUT
  printf '%s' "$out" | grep -q 'wrangler.jsonc.*required file is missing' \
    && ok 'AC-16 required-files fires on a missing wrangler.jsonc' \
    || bad 'AC-16 a missing required file must fail'
fi

# ---------------------------------------------------------------- AC-17
if tagged secrets; then
  gr_in "$DIRTY"; out=$OUT
  printf '%s' "$out" | grep -q '\.dev\.vars.*tracked by git' \
    && ok 'AC-17 secrets fires on a tracked .dev.vars' \
    || bad 'AC-17 a tracked secret must fail'
  gr_in "$CLEAN"; out=$OUT
  [ "$(count_check "$out" secrets)" -eq 0 ] \
    && ok 'AC-17 secrets silent when .dev.vars exists but is gitignored' \
    || bad 'AC-17 an untracked secret must not fail'
fi

# ---------------------------------------------------------------- AC-18
if [ -z "$ONLY" ]; then
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  jq '.version = 0' "$SC/guardrails.config.json" > "$SC/tmp" && mv "$SC/tmp" "$SC/guardrails.config.json"
  gr_in "$SC"; out=$OUT
  s=$STATUS
  if [ "$s" -eq 0 ] && printf '%s' "$out" | grep -q 'warning.*version'; then
    ok 'AC-18 a trailing config version warns without failing'
  else
    bad 'AC-18 a stale copy must nag, not block' "exit=$s out=$out"
  fi
  rm -rf "$SC"
fi

# ---------------------------------------------------------------- variadic --file
# Lefthook expands {staged_files} to EVERY staged file at once, so --file has to
# take a list. A single-path flag would have broken every multi-file commit.
if [ -z "$ONLY" ]; then
  gr_in "$DIRTY" --file src/ui/index.ts src/features/shifts/utils/helper.ts; out=$OUT
  if [ "$STATUS" -eq 1 ] \
    && [ "$(count_check "$out" no-barrels)" -eq 1 ] \
    && [ "$(count_check "$out" folder-tree)" -ge 1 ]; then
    ok 'AC-4  --file accepts several paths and reports each'
  else
    bad 'AC-4  --file must handle the Lefthook multi-file shape' "exit=$STATUS out=$out"
  fi

  # A PostToolUse hook fires on EVERY Edit/Write, including prose and config.
  # ast-grep has no grammar for these, and that must read as "nothing to say"
  # rather than as a broken scan.
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  printf '# notes\n' > "$SC/src/utilities/notes.md"
  printf 'key: value\n' > "$SC/src/utilities/data.yaml"
  gr_in "$SC" --file src/utilities/notes.md src/utilities/data.yaml; out=$OUT
  if [ "$STATUS" -eq 0 ] && [ -z "$out" ]; then
    ok 'AC-4  --file on files no rule can parse: silent exit 0'
  else
    bad 'AC-4  a .md/.yaml edit must not trip the hook' "exit=$STATUS out=$out"
  fi
  rm -rf "$SC"
fi

# ---------------------------------------------------------------- filename-case
if tagged filename-case || [ -z "$ONLY" ]; then
  gr_in "$DIRTY" --file src/utilities/BadName.ts; out=$OUT
  if [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" filename-case)" -eq 1 ]; then
    ok 'AC-4  filename-case reports in --file mode too'
  else
    bad 'AC-4  filename-case must be file-addressable for the hook' "exit=$STATUS out=$out"
  fi
  gr_in "$DIRTY" --file src/utilities/plain.ts; out=$OUT
  [ "$(count_check "$out" filename-case)" -eq 0 ] \
    && ok 'AC-4  filename-case silent on a correctly named file' \
    || bad 'AC-4  filename-case fired on a kebab-case name' "$out"
fi

# ---------------------------------------------------------------- fail-closed
# A malformed rule file must not silence the pattern checks while the gate still
# reports green. This is the regression test for exactly that bug.
if tagged patterns || [ -z "$ONLY" ]; then
  SC=$(bash "$HERE/lib/mkrepo.sh" violating)
  broken="$HERE/../patterns/ts/zz-broken.yml"
  printf 'id: zz-broken\nlanguage: tsx\nrule:\n  pattern: "((("\n' > "$broken"
  gr_in "$SC" --only patterns; out=$OUT
  s=$STATUS
  rm -f "$broken"
  if [ "$s" -eq 3 ] && printf '%s' "$out" | grep -q 'ast-grep exited'; then
    ok 'AC-19 a malformed ast-grep rule exits 3, never a silent green'
  else
    bad 'AC-19 patterns must fail CLOSED on a broken rule' "exit=$s out=$out"
  fi
  rm -rf "$SC"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
