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
# BROKEN_RULE is written into the REAL rules directory by the fail-closed
# assertion. It has to come off in the trap: an interrupted run that left it
# behind would make every later run — and validate-templates.sh's verbatim-copy
# diff — fail on a file the suite created.
BROKEN_RULE=''
trap 'rm -rf "$CLEAN" "$DIRTY" "${SCRATCH:-}"; rm -f "${BROKEN_RULE:-}"' EXIT

ALL_CHECKS='folder-tree folder-readmes file-size colocated-tests test-tree no-barrels filename-case banned-deps shadow-configs required-files secrets secret-content patterns lint-suppressions'

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
  for check in folder-readmes test-tree banned-deps shadow-configs required-files secrets; do
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
  # ast-grep is Rust-only now; the TS pattern rules live in the oxlint plugin
  # and are covered by run-plugin.sh.
  if printf '%s' "$out" | grep -q 'no-direct-env-var'; then
    ok 'AC-11 patterns: no-direct-env-var fires on a rust source file'
  else
    bad 'AC-11 the rust pattern rule must fire' "$(printf '%s' "$out" | grep patterns)"
  fi
  gr_in "$CLEAN"; out=$OUT
  [ "$(count_check "$out" patterns)" -eq 0 ] \
    && ok 'AC-11 patterns: silent on a clean tree' \
    || bad 'AC-11 patterns must be silent on the clean fixture' "$out"
fi

# ---------------------------------------------------------------- AC-23
if tagged lint-suppressions; then
  gr_in "$DIRTY"; out=$OUT
  if [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && printf '%s' "$out" | grep -q 'suppressed-unused\.ts'; then
    ok 'AC-23 lint-suppressions rejects a no-unused-vars directive'
  else
    bad 'AC-23 an unused-variable suppression must fail the repo gate' "$out"
  fi

  gr_in "$DIRTY" --file src/utilities/suppressed-unused.ts; out=$OUT
  if [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ]; then
    ok 'AC-23 lint-suppressions reports in --file mode too'
  else
    bad 'AC-23 the edit hook must catch an unused-variable suppression' "exit=$STATUS out=$out"
  fi

  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  printf '// Documentation: oxlint-disable-next-line eslint/no-unused-vars is forbidden.\n' \
    > "$SC/src/utilities/suppression-notes.ts"
  gr_in "$SC" --file src/utilities/suppression-notes.ts; out=$OUT
  [ "$STATUS" -eq 0 ] && [ "$(count_check "$out" lint-suppressions)" -eq 0 ] \
    && ok 'AC-23 prose that names a directive is not mistaken for one' \
    || bad 'AC-23 only active lint directives may be rejected' "exit=$STATUS out=$out"

  printf '/* oxlint-disable */ const hidden = 1;\n' \
    > "$SC/src/utilities/blanket-disable.ts"
  gr_in "$SC" --file src/utilities/blanket-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 an inline blanket block disable is rejected' \
    || bad 'AC-23 inline blanket block disables must fail' "exit=$STATUS out=$out"

  printf '// oxlint-disable-next-line no-console -- intentional test probe\nconsole.log("probe");\n' \
    > "$SC/src/utilities/scoped-disable.ts"
  gr_in "$SC" --file src/utilities/scoped-disable.ts; out=$OUT
  [ "$STATUS" -eq 0 ] && [ "$(count_check "$out" lint-suppressions)" -eq 0 ] \
    && ok 'AC-23 a scoped disable for another rule remains available' \
    || bad 'AC-23 unrelated scoped lint directives must remain available' "exit=$STATUS out=$out"

  printf '/* oxlint-disable no-console */ console.log("probe");\n' \
    > "$SC/src/utilities/scoped-block-disable.ts"
  gr_in "$SC" --file src/utilities/scoped-block-disable.ts; out=$OUT
  [ "$STATUS" -eq 0 ] && [ "$(count_check "$out" lint-suppressions)" -eq 0 ] \
    && ok 'AC-23 a scoped block disable for another rule remains available' \
    || bad 'AC-23 unrelated scoped block directives must remain available' "exit=$STATUS out=$out"

  printf '// eslint-disable-next-line no-console, @typescript-eslint/no-unused-vars\nconst hidden = 1;\n' \
    > "$SC/src/utilities/aliased-unused-disable.ts"
  gr_in "$SC" --file src/utilities/aliased-unused-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 an aliased no-unused-vars directive in a rule list is rejected' \
    || bad 'AC-23 no-unused-vars aliases must not bypass the check' "exit=$STATUS out=$out"

  printf 'const hidden = 1;// eslint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/trailing-unused-disable.ts"
  gr_in "$SC" --file src/utilities/trailing-unused-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a trailing disable-line directive is rejected' \
    || bad 'AC-23 trailing unused-variable directives must not bypass the check' "exit=$STATUS out=$out"

  printf '#[allow(dead_code)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 Rust item-level allow(dead_code) is rejected' \
    || bad 'AC-23 Rust item-level dead-code allowances must fail' "exit=$STATUS out=$out"

  printf '#![allow(dead_code)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/allow-dead-code-crate.rs"
  gr_in "$SC" --file src/utilities/allow-dead-code-crate.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 Rust crate-level allow(dead_code) is rejected' \
    || bad 'AC-23 Rust crate-level dead-code allowances must fail' "exit=$STATUS out=$out"

  printf '#![cfg_attr(all(), allow(dead_code))]\nfn hidden() {}\n' \
    > "$SC/src/utilities/cfg-allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/cfg-allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 Rust cfg_attr allow(dead_code) is rejected' \
    || bad 'AC-23 conditional Rust dead-code allowances must fail' "exit=$STATUS out=$out"

  printf '#![\n  allow(\n    dead_code\n  )\n]\nfn hidden() {}\n' \
    > "$SC/src/utilities/multiline-allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/multiline-allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 multiline Rust allow(dead_code) is rejected' \
    || bad 'AC-23 multiline Rust dead-code allowances must fail' "exit=$STATUS out=$out"

  printf '#![allow(\n  /* policy */ dead_code\n)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/commented-allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/commented-allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 comments cannot hide a Rust allow(dead_code) attribute' \
    || bad 'AC-23 comments inside Rust attributes must not bypass the check' "exit=$STATUS out=$out"

  printf '#[r#allow(r#dead_code)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/raw-ident-allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/raw-ident-allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 Rust raw-identifier allow(dead_code) is rejected' \
    || bad 'AC-23 r#allow must not bypass the Rust attribute check' "exit=$STATUS out=$out"

  printf '#![r#cfg_attr(all(), r#allow(r#dead_code))]\nfn hidden() {}\n' \
    > "$SC/src/utilities/raw-ident-cfg-allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/raw-ident-cfg-allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 conditional Rust r#allow(dead_code) is rejected' \
    || bad 'AC-23 cfg_attr r#allow must not bypass the check' "exit=$STATUS out=$out"

  printf '#[allow(unused)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/allow-unused-group.rs"
  gr_in "$SC" --file src/utilities/allow-unused-group.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 Rust allow(unused) cannot hide dead code' \
    || bad 'AC-23 the unused lint group must not bypass dead_code deny' "exit=$STATUS out=$out"

  printf '#[warn(dead_code)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/warn-dead-code.rs"
  gr_in "$SC" --file src/utilities/warn-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 Rust warn(dead_code) cannot lower the deny level' \
    || bad 'AC-23 source warning levels must not bypass dead_code deny' "exit=$STATUS out=$out"

  printf '#[expect(dead_code)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/expect-dead-code.rs"
  gr_in "$SC" --file src/utilities/expect-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 Rust expect(dead_code) cannot consume the diagnostic' \
    || bad 'AC-23 lint expectations must not legitimize dead code' "exit=$STATUS out=$out"

  printf '#![cfg_attr(all(), r#expect(r#unused))]\nfn hidden() {}\n' \
    > "$SC/src/utilities/cfg-expect-unused-group.rs"
  gr_in "$SC" --file src/utilities/cfg-expect-unused-group.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 conditional expect(unused) cannot consume dead code' \
    || bad 'AC-23 conditional lint expectations must not bypass the policy' "exit=$STATUS out=$out"

  printf '#![cfg_attr(\n  all(),\n  doc = concat!["x"],\n  allow(dead_code)\n)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/nested-bracket-cfg-allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/nested-bracket-cfg-allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 inner macro brackets cannot end cfg_attr collection' \
    || bad 'AC-23 nested brackets must not hide cfg_attr allow(dead_code)' "exit=$STATUS out=$out"

  printf 'const QUOTE: char = '\''"'\'';\nconst BYTE: u8 = b'\''"'\'';\nfn borrow<'\''a>(value: &'\''a str) -> &'\''a str { value }\n#[allow(dead_code)]\nfn hidden() {}\n' \
    > "$SC/src/utilities/char-before-allow-dead-code.rs"
  gr_in "$SC" --file src/utilities/char-before-allow-dead-code.rs; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a Rust character literal cannot hide a later attribute' \
    || bad 'AC-23 Rust character literals must not corrupt attribute scanning' "exit=$STATUS out=$out"

  printf 'export const quoted = "/* oxlint-disable */";\nexport const example = `\n/* oxlint-disable */\n`;\n' \
    > "$SC/src/utilities/template-documentation.ts"
  gr_in "$SC" --file src/utilities/template-documentation.ts; out=$OUT
  [ "$STATUS" -eq 0 ] && [ "$(count_check "$out" lint-suppressions)" -eq 0 ] \
    && ok 'AC-23 a directive shown in a template literal is not active' \
    || bad 'AC-23 TypeScript strings must not be mistaken for lint directives' "exit=$STATUS out=$out"

  printf 'export const Example = () => <pre>/* oxlint-disable */</pre>;\nexport const Multiline = () => (\n  <pre>\n    /* oxlint-disable */\n  </pre>\n);\n' \
    > "$SC/src/utilities/jsx-documentation.tsx"
  gr_in "$SC" --file src/utilities/jsx-documentation.tsx; out=$OUT
  [ "$STATUS" -eq 0 ] && [ "$(count_check "$out" lint-suppressions)" -eq 0 ] \
    && ok 'AC-23 directive-looking JSX text is not an active comment' \
    || bad 'AC-23 JSX documentation text must remain legal' "exit=$STATUS out=$out"

  printf 'export const Example = () => <pre>(value) => /* oxlint-disable */</pre>;\n' \
    > "$SC/src/utilities/jsx-arrow-documentation.tsx"
  gr_in "$SC" --file src/utilities/jsx-arrow-documentation.tsx; out=$OUT
  [ "$STATUS" -eq 0 ] && [ "$(count_check "$out" lint-suppressions)" -eq 0 ] \
    && ok 'AC-23 arrow-looking JSX text is still documentation' \
    || bad 'AC-23 JSX text must not be mistaken for an ambiguous generic arrow' "exit=$STATUS out=$out"

  printf 'export const Example = () => <pre>{/* oxlint-disable */ null}</pre>;\n' \
    > "$SC/src/utilities/jsx-active-disable.tsx"
  gr_in "$SC" --file src/utilities/jsx-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a real lint comment inside a JSX expression is rejected' \
    || bad 'AC-23 JSX expression comments must remain visible to the check' "exit=$STATUS out=$out"

  printf 'export const identity = <T,>(value: T) => value;\nconst hidden = 1;// oxlint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/tsx-generic-active-disable.tsx"
  gr_in "$SC" --file src/utilities/tsx-generic-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a TSX generic cannot hide a later active directive' \
    || bad 'AC-23 TSX generics must remain JavaScript lexical context' "exit=$STATUS out=$out"

  printf 'export const tuple = <const T,>(value: T) => value;\nconst hidden = 1;// oxlint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/tsx-const-generic-active-disable.tsx"
  gr_in "$SC" --file src/utilities/tsx-const-generic-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a TSX const generic cannot hide a later directive' \
    || bad 'AC-23 const type parameters must remain JavaScript lexical context' "exit=$STATUS out=$out"

  printf 'export const fallback = <T = unknown>(value: T) => value;\nconst hidden = 1;// oxlint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/tsx-default-generic-active-disable.tsx"
  gr_in "$SC" --file src/utilities/tsx-default-generic-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a TSX defaulted generic cannot hide a later directive' \
    || bad 'AC-23 defaulted type parameters must remain JavaScript lexical context' "exit=$STATUS out=$out"

  printf 'export const Example = () => (\n  <div>{/[}]/.test("}") /* oxlint-disable */}</div>\n);\nconst hidden = 1;\n' \
    > "$SC/src/utilities/jsx-regex-active-disable.tsx"
  gr_in "$SC" --file src/utilities/jsx-regex-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 regex braces cannot hide a JSX expression directive' \
    || bad 'AC-23 JSX regex literals must not corrupt expression depth' "exit=$STATUS out=$out"

  printf 'export const Example = (ready: boolean, input: string) => <div>{(() => { if (ready) /}/.test(input); } /* oxlint-disable */)()}</div>;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/jsx-control-regex-active-disable.tsx"
  gr_in "$SC" --file src/utilities/jsx-control-regex-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a regex consequent cannot corrupt JSX expression depth' \
    || bad 'AC-23 regexes after control conditions must preserve JSX comments' "exit=$STATUS out=$out"

  printf 'export const example = `${/\\}/.test("}") /* oxlint-disable */}`;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/template-regex-active-disable.ts"
  gr_in "$SC" --file src/utilities/template-regex-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 regex braces cannot hide a template expression directive' \
    || bad 'AC-23 template regex literals must not corrupt expression depth' "exit=$STATUS out=$out"

  printf 'export const Example = (total: number, divisor: number) => (\n  <div>{total / divisor /* oxlint-disable */}</div>\n);\n' \
    > "$SC/src/utilities/jsx-division-active-disable.tsx"
  gr_in "$SC" --file src/utilities/jsx-division-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 division is not mistaken for a regex literal' \
    || bad 'AC-23 ordinary division must keep later comments visible' "exit=$STATUS out=$out"

  printf 'let counter = 1;\nexport const value = counter++ / 2 /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/postfix-increment-active-disable.ts"
  gr_in "$SC" --file src/utilities/postfix-increment-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 postfix increment division keeps directives visible' \
    || bad 'AC-23 postfix ++ must not turn division into a regex' "exit=$STATUS out=$out"

  printf 'let counter = 1;\nexport const value = counter-- / 2 /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/postfix-decrement-active-disable.ts"
  gr_in "$SC" --file src/utilities/postfix-decrement-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 postfix decrement division keeps directives visible' \
    || bad 'AC-23 postfix -- must not turn division into a regex' "exit=$STATUS out=$out"

  printf 'export const divide = (value: number | undefined, divisor: number) => value! / divisor /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/non-null-division-active-disable.ts"
  gr_in "$SC" --file src/utilities/non-null-division-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 non-null postfix division keeps directives visible' \
    || bad 'AC-23 postfix ! must not turn division into a regex' "exit=$STATUS out=$out"

  printf 'let counter = 1;\nexport const value = counter++ /* retain old value */ / 2 /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/commented-postfix-division-active-disable.ts"
  gr_in "$SC" --file src/utilities/commented-postfix-division-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 comment trivia after postfix increment keeps directives visible' \
    || bad 'AC-23 comment trivia must not hide postfix division' "exit=$STATUS out=$out"

  printf 'let counter = 1;\nexport const value = counter-- /* retain old value */ / 2 /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/commented-postfix-decrement-active-disable.ts"
  gr_in "$SC" --file src/utilities/commented-postfix-decrement-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 comment trivia after postfix decrement keeps directives visible' \
    || bad 'AC-23 comment trivia must not hide postfix decrement division' "exit=$STATUS out=$out"

  printf 'export const divide = (value: number | undefined) => value! /* checked */ / 2 /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/commented-non-null-division-active-disable.ts"
  gr_in "$SC" --file src/utilities/commented-non-null-division-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 comment trivia after non-null postfix keeps directives visible' \
    || bad 'AC-23 comment trivia must not hide non-null division' "exit=$STATUS out=$out"

  printf 'let counter = 1;\nexport const value = counter++ /* retain\nold value */ / 2 /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/multiline-commented-postfix-division-active-disable.ts"
  gr_in "$SC" --file src/utilities/multiline-commented-postfix-division-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 multiline comment trivia preserves postfix division context' \
    || bad 'AC-23 multiline comment trivia must not hide postfix division' "exit=$STATUS out=$out"

  printf 'export const ratio = /[}]/ /* completed regex */ / 2 /* oxlint-disable */;\nconst hidden = 1;\n' \
    > "$SC/src/utilities/regex-value-division-active-disable.ts"
  gr_in "$SC" --file src/utilities/regex-value-division-active-disable.ts; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a completed regex value keeps following division visible' \
    || bad 'AC-23 division after a regex value must not consume directives' "exit=$STATUS out=$out"

  printf 'export const matches = <T,>(\n  value: T,\n  pattern = /[)]/,\n) => pattern.test(String(value));\nconst hidden = 1;// oxlint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/tsx-generic-regex-active-disable.tsx"
  gr_in "$SC" --file src/utilities/tsx-generic-regex-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 regex parens cannot corrupt multiline generic lookahead' \
    || bad 'AC-23 generic parameter regexes must remain code context' "exit=$STATUS out=$out"

  printf 'export const identity = <T,>(value: T /* ) */) => value;\nconst hidden = 1;// oxlint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/tsx-generic-comment-active-disable.tsx"
  gr_in "$SC" --file src/utilities/tsx-generic-comment-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 comment parens cannot corrupt generic lookahead' \
    || bad 'AC-23 generic parameter comments must remain code context' "exit=$STATUS out=$out"

  printf 'export const identity = <T,>/* type boundary */(value: T)/* value boundary */=> value;\nconst hidden = 1;// oxlint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/tsx-generic-boundary-comments-active-disable.tsx"
  gr_in "$SC" --file src/utilities/tsx-generic-boundary-comments-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 comments around generic parameters remain trivia' \
    || bad 'AC-23 generic boundary comments must not create JSX context' "exit=$STATUS out=$out"

  printf 'export const pair = <T,>(ready: boolean, input: string, value: T, test = (() => { if (ready) /)/.test(input); })) => [value, test] as const;\nconst hidden = 1;// oxlint-disable-line no-unused-vars\n' \
    > "$SC/src/utilities/tsx-generic-control-regex-active-disable.tsx"
  gr_in "$SC" --file src/utilities/tsx-generic-control-regex-active-disable.tsx; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 1 ] \
    && ok 'AC-23 a control-consequent regex cannot end generic parameters' \
    || bad 'AC-23 generic lookahead must parse regex after control conditions' "exit=$STATUS out=$out"

  printf 'pub const NORMAL: &str = "#[allow(dead_code)]";\n/*\n#[allow(dead_code)]\n*/\npub const EXAMPLE: &str = r#"\n#[allow(dead_code)]\n"#;\n' \
    > "$SC/src/utilities/raw-string-documentation.rs"
  gr_in "$SC" --file src/utilities/raw-string-documentation.rs; out=$OUT
  [ "$STATUS" -eq 0 ] && [ "$(count_check "$out" lint-suppressions)" -eq 0 ] \
    && ok 'AC-23 an attribute shown in a Rust raw string is not active' \
    || bad 'AC-23 Rust strings must not be mistaken for attributes' "exit=$STATUS out=$out"

  gr_in "$SC" --only lint-suppressions; out=$OUT
  [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" lint-suppressions)" -eq 36 ] \
    && ! printf '%s\n' "$out" | grep -q 'template-documentation\|raw-string-documentation\|jsx-documentation\|jsx-arrow-documentation' \
    && ok 'AC-23 repo candidate scan reaches every active suppression form' \
    || bad 'AC-23 repo mode must find active forms without flagging strings' "exit=$STATUS out=$out"

  OUT=$(GR_DIR="$SC/missing-guardrails" bash -c \
    'gr_fatal() { printf "guardrails: %s\\n" "$1" >&2; exit 3; }; . "$1"; gr_ls_load_syntax' \
    _ "$HERE/../checks/lint-suppressions.sh" 2>&1)
  STATUS=$?
  [ "$STATUS" -eq 3 ] && printf '%s\n' "$OUT" | grep -q 'lint-syntax' \
    && ok 'AC-23 a missing syntax helper fails closed with status 3' \
    || bad 'AC-23 syntax-helper load failures must be controlled fatals' "exit=$STATUS out=$OUT"
  rm -rf "$SC"
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

# ---------------------------------------------------------------- AC-21
if tagged secret-content; then
  gr_in "$DIRTY"; out=$OUT
  printf '%s' "$out" | grep -q 'leaked-key\.ts.*committed secret value (AWS access key id)' \
    && ok 'AC-21 secret-content fires on a committed AWS access key id' \
    || bad 'AC-21 secret-content must fire on a leaked AWS key' "$out"
  gr_in "$CLEAN"; out=$OUT
  [ "$(count_check "$out" secret-content)" -eq 0 ] \
    && ok 'AC-21 secret-content silent on the clean fixture' \
    || bad 'AC-21 secret-content must not fire on the clean fixture' "$out"

  gr_in "$DIRTY" --file src/utilities/leaked-key.ts; out=$OUT
  if [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" secret-content)" -eq 1 ]; then
    ok 'AC-21 secret-content reports in --file mode too'
  else
    bad 'AC-21 secret-content must be file-addressable for the hook' "exit=$STATUS out=$out"
  fi
  gr_in "$DIRTY" --file src/utilities/plain.ts; out=$OUT
  [ "$(count_check "$out" secret-content)" -eq 0 ] \
    && ok 'AC-21 secret-content silent on a clean file' \
    || bad 'AC-21 secret-content fired on a clean file' "$out"

  # Repo-mode regression: a dash-prefixed tracked filename must not be parsed
  # as grep OPTIONS (which drains the `git ls-files` loop's own input and ends
  # the scan early), and a non-ASCII filename must not be silently skipped
  # because plain `git ls-files` C-quotes it under core.quotepath=true and the
  # quoted string then fails `[ -f "$path" ]`. Built inline, not from a
  # committed fixture — git refuses to store a filename this way portably
  # across the repo's own .gitattributes, so the three files are created and
  # added here, the same "real repo, built at test time" approach mkrepo.sh
  # uses. `git ls-files` sorts by path byte order, so naming them
  # `-decoy.ts` / `café.ts` / `zzz-clean.ts` already puts the dash-prefixed
  # decoy BEFORE the non-ASCII target and the clean file AFTER it, without
  # needing to force the order any other way.
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  printf 'export const decoy = 1;\n' > "$SC/src/utilities/-decoy.ts"
  printf "export const leaked = 'AKIAIOSFODNN7EXAMPLE';\n" > "$SC/src/utilities/café.ts"
  printf 'export const clean2 = 1;\n' > "$SC/src/utilities/zzz-clean.ts"
  git -C "$SC" add -A
  git -C "$SC" -c user.email=fixture@example.com -c user.name=fixture commit -qm 'secret-content regression' >/dev/null 2>&1
  gr_in "$SC" --only secret-content; out=$OUT
  if [ "$(count_check "$out" secret-content)" -eq 1 ] \
    && printf '%s' "$out" | grep -q 'café\.ts.*committed secret value (AWS access key id)'; then
    ok 'AC-21 secret-content: dash-prefixed + non-ASCII filenames do not break the repo scan'
  else
    bad 'AC-21 a dash-prefixed or non-ASCII filename must not drain/bypass the repo scan' "exit=$STATUS out=$out"
  fi
  rm -rf "$SC"

  # Repo-mode regression: a COLON in a tracked filename must not corrupt the
  # reported path. The batch pass hands filenames back NUL-delimited (-l -Z)
  # precisely because "path:line:content" text is ambiguous — a colon is legal
  # in both the filename and the matched content — so the full name, colon
  # included, must survive into the violation line. Colons are legal on
  # Linux/macOS filesystems but not on Windows, hence built inline like the
  # dash/non-ASCII repo above rather than committed as a fixture.
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  printf "export const leaked = 'AKIAIOSFODNN7EXAMPLE';\n" > "$SC/src/utilities/weird:name.ts"
  git -C "$SC" add -A
  git -C "$SC" -c user.email=fixture@example.com -c user.name=fixture commit -qm 'secret-content colon regression' >/dev/null 2>&1
  gr_in "$SC" --only secret-content; out=$OUT
  if [ "$(count_check "$out" secret-content)" -eq 1 ] \
    && printf '%s' "$out" | grep -q 'weird:name\.ts.*committed secret value (AWS access key id)'; then
    ok 'AC-21 secret-content: a colon in a tracked filename keeps the full path in the report'
  else
    bad 'AC-21 a colon-named tracked file must be reported under its full path' "exit=$STATUS out=$out"
  fi
  rm -rf "$SC"
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

# ------------------------------------------------- crate-root test exemption
# Rust's integration surface is tests/<file>.rs at the crate root — no leading
# slash, so it does not match the nested */tests/* pattern and was NOT exempt
# from the size ceiling. Caught by the CI reviewer.
if tagged file-size || [ -z "$ONLY" ]; then
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  jq '.testDir = "tests" | .fileSize.max = 20 | .fileSize.skipExtensions = []' \
    "$SC/guardrails.config.json" > "$SC/t" && mv "$SC/t" "$SC/guardrails.config.json"
  mkdir -p "$SC/tests" "$SC/src/mod/tests"
  { for i in $(seq 1 40); do echo "line $i;"; done; } > "$SC/tests/cli.rs"
  { for i in $(seq 1 40); do echo "line $i;"; done; } > "$SC/src/mod/tests/unit.rs"
  gr_in "$SC" --file tests/cli.rs; out=$OUT
  [ "$(count_check "$out" file-size)" -eq 0 ] \
    && ok 'AC-10 crate-root tests/<f> is exempt from the size ceiling' \
    || bad 'AC-10 a crate-root integration test must be exempt' "$out"
  gr_in "$SC" --file src/mod/tests/unit.rs; out=$OUT
  [ "$(count_check "$out" file-size)" -eq 0 ] \
    && ok 'AC-10 nested tests/<f> is exempt too' \
    || bad 'AC-10 a nested colocated test must be exempt' "$out"
  rm -rf "$SC"
fi

# ---------------------------------------------------------------- fail-closed
# A malformed rule file must not silence the pattern checks while the gate still
# reports green. This is the regression test for exactly that bug.
if tagged patterns || [ -z "$ONLY" ]; then
  SC=$(bash "$HERE/lib/mkrepo.sh" violating)
  BROKEN_RULE="$HERE/../patterns/rust/zz-broken.yml"
  printf 'id: zz-broken\nlanguage: rust\nrule:\n  pattern: "((("\n' > "$BROKEN_RULE"
  gr_in "$SC" --only patterns; out=$OUT
  s=$STATUS
  rm -f "$BROKEN_RULE"; BROKEN_RULE=''
  if [ "$s" -eq 3 ] && printf '%s' "$out" | grep -q 'ast-grep exited'; then
    ok 'AC-19 a malformed ast-grep rule exits 3, never a silent green'
  else
    bad 'AC-19 patterns must fail CLOSED on a broken rule' "exit=$s out=$out"
  fi
  rm -rf "$SC"
fi

# ------------------------------------------------------ ownedByLinter scoping
# A check id is the unit of ownership, so an id may not straddle what the linter
# can see and what it cannot. folder-tree and colocated-tests used to carry the
# README rules and the centralized-directory scan — neither of which any oxlint
# rule enforces — so every TypeScript stack, all of which declare those two
# linter-owned, silently stopped enforcing them in BOTH places.
if [ -z "$ONLY" ]; then
  SC=$(bash "$HERE/lib/mkrepo.sh" violating)
  jq '.ownedByLinter = ["folder-tree","colocated-tests","no-barrels","filename-case","patterns"]' \
    "$SC/guardrails.config.json" > "$SC/t" && mv "$SC/t" "$SC/guardrails.config.json"
  gr_in "$SC"; out=$OUT
  silent=1
  for check in folder-tree colocated-tests no-barrels filename-case patterns; do
    [ "$(count_check "$out" "$check")" -eq 0 ] || silent=0
  done
  [ "$silent" -eq 1 ] && ok 'AC-20 ownedByLinter skips exactly the checks it names' \
    || bad 'AC-20 a linter-owned check must not also run here' "$out"

  kept=1
  for check in folder-readmes test-tree; do
    [ "$(count_check "$out" "$check")" -eq 1 ] || kept=0
  done
  [ "$kept" -eq 1 ] && ok 'AC-20 rules no linter enforces survive ownedByLinter' \
    || bad 'AC-20 folder-readmes/test-tree must still fire on a linter-owned stack' "$out"
  rm -rf "$SC"
fi

# ------------------------------------------------------- paths with a space
# Lefthook hands {staged_files} straight through, and a filename may hold a
# space. Word-splitting the list dropped the violation entirely — the worst
# possible failure for a gate, because it reads as a pass.
if [ -z "$ONLY" ]; then
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  printf 'export const spaced = 1;\n' > "$SC/src/utilities/Bad Name.ts"
  gr_in "$SC" --file 'src/utilities/Bad Name.ts'; out=$OUT
  if [ "$STATUS" -eq 1 ] && [ "$(count_check "$out" filename-case)" -eq 1 ]; then
    ok 'AC-4  --file handles a path containing a space'
  else
    bad 'AC-4  a spaced path must not be split into nonexistent paths' "exit=$STATUS out=$out"
  fi
  rm -rf "$SC"
fi

# ------------------------------------------------------------- workspace mode
#
# A monorepo root has no guardrails.config.json, and all three wired
# invocations (PostToolUse, Stop, lefthook's {staged_files}) run from there. So
# every assertion below drives the REAL root of a real two-package git repo —
# the same way the hooks will.
#
# The two fixtures are built to make the isolation provable rather than
# plausible: `packages/api` has fileSize.max 300 and owns nothing by linter,
# `packages/database` has fileSize.max 20 and declares folder-tree
# ownedByLinter. wide-service.ts and wide-table.ts are the SAME 40-line file in
# both packages, and src/nope/ exists in both.
if [ -z "$ONLY" ]; then
  WS_CLEAN=$(bash "$HERE/lib/mkrepo.sh" workspace)
  WS_DIRTY=$(bash "$HERE/lib/mkrepo.sh" workspace-violating)

  gr_in "$WS_CLEAN"; out=$OUT
  if [ "$STATUS" -eq 0 ] && [ -z "$out" ]; then
    ok 'AC-1  clean workspace: exit 0, no output'
  else
    bad 'AC-1  clean workspace must be silent' "exit=$STATUS output=$out"
  fi

  gr_in "$WS_DIRTY"; ws_out=$OUT
  [ "$STATUS" -eq 1 ] && ok 'AC-1  violating workspace: exit 1' \
    || bad 'AC-1  violating workspace must exit 1' "exit=$STATUS"

  # Every path is reported through GR_PATH_PREFIX, or a person cannot tell
  # which package to open.
  unprefixed=$(printf '%s\n' "$ws_out" | grep '^guardrails\[' | grep -c ' src/' || true)
  [ "$unprefixed" -eq 0 ] && ok 'AC-1  workspace paths carry their package prefix' \
    || bad "AC-1  $unprefixed violation(s) reported an unprefixed src/ path" "$ws_out"

  # The heart of it: same file, same length, two ceilings. If the re-exec ever
  # became an in-process loop, gr_cache_config's globals would leak and this
  # would fire twice or not at all.
  if printf '%s\n' "$ws_out" | grep -q 'packages/database/src/schema/wide-table.ts' \
    && ! printf '%s\n' "$ws_out" | grep -q 'packages/api/src/services/wide-service.ts'; then
    ok 'AC-6  each package is held to its OWN fileSize ceiling'
  else
    bad 'AC-6  a 40-line file must break max 20 and pass max 300' "$ws_out"
  fi

  # Same directory name in both packages; only the one whose config does NOT
  # declare folder-tree ownedByLinter may report it.
  if printf '%s\n' "$ws_out" | grep -q 'packages/api/src/nope' \
    && ! printf '%s\n' "$ws_out" | grep -q 'packages/database/src/nope'; then
    ok 'AC-8  ownedByLinter is honoured per package, not per run'
  else
    bad 'AC-8  the linter-owned package must skip folder-tree, the other must not' "$ws_out"
  fi

  # Root-level checks read the manifest, which has no source tree of its own.
  # Package secrets are each package's own business — listing them at the root
  # too made every one report twice.
  if [ "$(count_check "$ws_out" banned-deps)" -eq 1 ] \
    && [ "$(count_check "$ws_out" secrets)" -eq 2 ]; then
    ok 'AC-7  root manifest checks the root, packages check themselves'
  else
    bad 'AC-7  expected 1 banned-deps and 2 secrets (root + package), no duplicates' "$ws_out"
  fi

  # Lefthook expands {staged_files} across the whole commit, so one --file call
  # routinely spans packages.
  gr_in "$WS_DIRTY" --file packages/database/src/schema/wide-table.ts packages/api/src/nope/README.md
  out=$OUT
  if [ "$STATUS" -eq 1 ] \
    && printf '%s\n' "$out" | grep -q 'packages/database/src/schema/wide-table.ts' \
    && printf '%s\n' "$out" | grep -q 'packages/api/src/nope'; then
    ok 'AC-3  --file spanning two packages runs both'
  else
    bad 'AC-3  a staged set spanning packages must check every package' "exit=$STATUS out=$out"
  fi

  # Exit 2, not 1: Claude Code ignores a 1 from a hook, so a 1 here would leave
  # enforcement layer 2 inert while looking wired up. The parent consumes the
  # payload and hands the child --file, because a child cannot re-read stdin.
  OUT=$(cd "$WS_DIRTY" && printf '{"tool_input":{"file_path":"%s/packages/database/src/schema/wide-table.ts"}}' "$WS_DIRTY" \
    | bash "$GR" --hook 2>&1)
  STATUS=$?
  if [ "$STATUS" -eq 2 ] && printf '%s\n' "$OUT" | grep -q 'packages/database/src/schema/wide-table.ts'; then
    ok 'AC-4  --hook from a workspace root exits 2 and names the file'
  else
    bad 'AC-4  --hook must exit 2 with the prefixed path' "exit=$STATUS out=$OUT"
  fi

  # An absolute path outside the workspace survives the ${edited#$PWD/} strip
  # unchanged, and every check works repo-relative — so it would be tested as a
  # relative path that does not exist and exit 0. An edit we cannot place is not
  # an edit we can vouch for.
  OUT=$(cd "$WS_CLEAN" && printf '{"tool_input":{"file_path":"/etc/hosts"}}' \
    | bash "$GR" --hook 2>&1)
  STATUS=$?
  [ "$STATUS" -eq 3 ] && ok 'AC-4  --hook on a path outside the workspace exits 3' \
    || bad 'AC-4  an unplaceable edit must not pass silently' "exit=$STATUS out=$OUT"

  touch "$WS_DIRTY/dirty.txt" "$WS_CLEAN/dirty.txt"
  OUT=$(cd "$WS_DIRTY" && printf '{}' | bash "$GR" --stop 2>&1); STATUS=$?
  [ "$STATUS" -eq 2 ] && ok 'AC-5  --stop blocks on a dirty violating workspace' \
    || bad 'AC-5  --stop must exit 2 to block' "exit=$STATUS"
  OUT=$(cd "$WS_CLEAN" && printf '{}' | bash "$GR" --stop 2>&1); STATUS=$?
  [ "$STATUS" -eq 0 ] && ok 'AC-5  --stop passes a dirty CLEAN workspace' \
    || bad 'AC-5  --stop must not block a clean tree' "exit=$STATUS out=$OUT"

  # Fail closed, five ways. Each of these is a configuration a person could
  # plausibly write, and every one of them would otherwise leave a source tree
  # unguarded while the gate reported green.
  ws_fatal() { # <label> <mutation-applied-to-$WS>
    WS=$(bash "$HERE/lib/mkrepo.sh" workspace)
    eval "$2"
    OUT=$(cd "$WS" && bash "$GR" 2>&1); STATUS=$?
    [ "$STATUS" -eq 3 ] && ok "AC-2  $1 exits 3" \
      || bad "AC-2  $1 must exit 3, not be skipped" "exit=$STATUS out=$OUT"
    rm -rf "$WS"
  }
  ws_fatal 'a package with no guardrails.config.json' 'rm "$WS/packages/database/guardrails.config.json"'
  ws_fatal 'a listed package directory that is absent'  'rm -rf "$WS/packages/database"'
  ws_fatal 'an empty packages array' \
    'python3 -c "import json,sys;p=sys.argv[1];d=json.load(open(p));d[\"packages\"]=[];json.dump(d,open(p,\"w\"))" "$WS/guardrails.workspace.json"'
  ws_fatal 'both a config and a manifest at the root' \
    'cp "$WS/packages/api/guardrails.config.json" "$WS/guardrails.config.json"'
  # An unlisted package is the repo-mode version of the same hazard: repo mode
  # only walks what the manifest names, so a forgotten package is unvisited, not
  # clean. Its stray config is the evidence.
  ws_fatal 'a package that exists but is not listed' \
    'mkdir -p "$WS/packages/worker/src" && cp "$WS/packages/api/guardrails.config.json" "$WS/packages/worker/"'
  ws_fatal 'a package path containing ..' \
    'python3 -c "import json,sys;p=sys.argv[1];d=json.load(open(p));d[\"packages\"]=[\"packages/../../elsewhere\"];json.dump(d,open(p,\"w\"))" "$WS/guardrails.workspace.json"'

  # Exit-code precedence across packages. One package merely violates (1), the
  # other is misconfigured (3). 3 has to win: a broken guard rail reported as a
  # violation looks like something a developer can fix by editing their code,
  # and they will "fix" it by deleting the file it points at.
  WS=$(bash "$HERE/lib/mkrepo.sh" workspace-violating)
  printf 'not json at all\n' > "$WS/packages/api/guardrails.config.json"
  OUT=$(cd "$WS" && bash "$GR" 2>&1); STATUS=$?
  [ "$STATUS" -eq 3 ] && ok 'AC-2  a misconfigured package outranks a violating one (3 beats 1)' \
    || bad 'AC-2  3 must beat 1 when packages disagree' "exit=$STATUS out=$OUT"
  rm -rf "$WS"

  OUT=$(bash -c '. "$1"; a=$(gr_ws_worst 0 137); b=$(gr_ws_worst 1 137); [ "$a:$b" = 3:3 ]' \
    _ "$HERE/../lib/workspace.sh" 2>&1); STATUS=$?
  [ "$STATUS" -eq 0 ] \
    && ok 'AC-2  an abnormal workspace child exit maps to fatal status 3' \
    || bad 'AC-2  workspace aggregation must fail closed on abnormal child exits' "exit=$STATUS out=$OUT"

  # In --file mode an unowned path is one of two very different things, and
  # conflating them breaks the commit hook. lefthook expands {staged_files}
  # across whatever the commit touched, so staging a ROOT file must not block
  # it — there is no file-addressable check at a workspace root to run anyway.
  WS=$(bash "$HERE/lib/mkrepo.sh" workspace)
  OUT=$(cd "$WS" && bash "$GR" --file package.json guardrails.workspace.json 2>&1); STATUS=$?
  [ "$STATUS" -eq 0 ] && ok 'AC-3  --file on workspace-root files does not block the commit' \
    || bad 'AC-3  staging a root file must not exit nonzero' "exit=$STATUS out=$OUT"

  # A file inside a package the manifest forgot is the other thing, and it is
  # still fatal: its ancestor's guardrails.config.json is the evidence.
  mkdir -p "$WS/packages/worker/src"
  cp "$WS/packages/api/guardrails.config.json" "$WS/packages/worker/"
  printf 'export const stray = 1;\n' > "$WS/packages/worker/src/stray.ts"
  OUT=$(cd "$WS" && bash "$GR" --file packages/worker/src/stray.ts 2>&1); STATUS=$?
  [ "$STATUS" -eq 3 ] && ok 'AC-3  --file inside an unlisted package still exits 3' \
    || bad 'AC-3  a file in an unlisted package must exit 3' "exit=$STATUS out=$OUT"
  rm -rf "$WS"

  rm -rf "$WS_CLEAN" "$WS_DIRTY"
fi

# ------------------------------------------------------ mod.rs barrel (Rust)
# barrelNames is stack-specific; the Rust template sets it to ["mod.rs"] with
# its own remedy (no knip, no "import the concrete file" — Rust's fix is
# renaming the file up a level, not adding an import). Nothing exercised that
# wiring or the remedy branch until this block.
if tagged no-barrels || [ -z "$ONLY" ]; then
  SC=$(bash "$HERE/lib/mkrepo.sh" clean)
  jq '.barrelNames = ["mod.rs"]' "$SC/guardrails.config.json" > "$SC/t" && mv "$SC/t" "$SC/guardrails.config.json"
  mkdir -p "$SC/src/store"
  printf 'pub mod shift_store;\n' > "$SC/src/store/mod.rs"
  gr_in "$SC" --file src/store/mod.rs; out=$OUT
  if [ "$(count_check "$out" no-barrels)" -eq 1 ] && printf '%s' "$out" | grep -q 'sibling file'; then
    ok 'AC-22 barrelNames=["mod.rs"] fires with the Rust-specific remedy'
  else
    bad 'AC-22 mod.rs must be caught with a Rust remedy, not the knip/index.ts text' "$out"
  fi
  rm -rf "$SC"
fi

# ------------------------------------------------------ the check-count guard
# Workspace support is DISPATCH, not a new check. If this number moves, either a
# check was added (update the docs and validate-templates.sh) or dispatch grew a
# check id it should not have.
if [ -z "$ONLY" ]; then
  listed=$(bash "$GR" --list | wc -l | tr -d ' ')
  [ "$listed" -eq 14 ] && ok 'AC-9  --list still reports exactly 14 checks' \
    || bad "AC-9  expected 14 check ids, got $listed"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
