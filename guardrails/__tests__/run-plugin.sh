#!/usr/bin/env bash
# run-plugin.sh — the oxlint house plugin's test suite.
#
# Real data, same as the bash suite: a real project tree on disk, the stack's
# REAL guardrails.config.json, and a real oxlint invocation. Nothing is stubbed —
# if oxlint's plugin API changes under us, this goes red rather than quietly
# enforcing nothing.
#
# The silent-on-clean half matters most. These rules run on every file an agent
# writes, so a false positive is far more expensive than a missed one.
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OXLINT=${OXLINT:-"bunx --bun oxlint@latest"}

pass=0
fail=0
ok() { printf '  ok    %s\n' "$1"; pass=$((pass + 1)); }
bad() { printf '  FAIL  %s\n' "$1"; [ -n "${2-}" ] && printf '        %s\n' "$2"; fail=$((fail + 1)); }

TREE=$(mktemp -d)
trap 'rm -rf "$TREE"' EXIT

cp "$ROOT/stacks/console/templates/guardrails.config.json" "$TREE/"
cp -R "$ROOT/guardrails/oxlint-plugin" "$TREE/oxlint-plugin"
cat > "$TREE/.oxlintrc.json" <<'JSON'
{
  "jsPlugins": ["./oxlint-plugin/index.js"],
  "rules": {
    "house/folder-tree": "error",
    "house/colocated-tests": "error",
    "house/no-barrels": "error",
    "house/no-bare-fetch": "error",
    "house/no-hardcoded-hex": "error"
  }
}
JSON

mkdir -p "$TREE/src/features/shifts"/{screens,components,__tests__} \
         "$TREE/src/features/shifts/utils" \
         "$TREE/src/ui/theme" "$TREE/src/utilities" "$TREE/src/app"

# --- files that must stay SILENT ---------------------------------------------
printf 'export const Route = 1;\n'                        > "$TREE/src/app/index.tsx"
printf 'export const colors = { primary: "#0a84ff" };\n'  > "$TREE/src/ui/theme/colors.ts"
printf 'export const get = (u: string) => fetch(u);\n'    > "$TREE/src/utilities/http.ts"
printf 'export const S = () => null;\n'                   > "$TREE/src/features/shifts/screens/shifts-screen.tsx"
printf 'export const t = 1;\n'                            > "$TREE/src/features/shifts/__tests__/s.test.tsx"

# --- exactly one violation per rule ------------------------------------------
printf 'export const h = 1;\n'                            > "$TREE/src/features/shifts/utils/helper.ts"
printf 'export const stray = 1;\n'                        > "$TREE/src/features/shifts/stray.test.ts"
printf 'export const load = () => fetch("/shifts");\n'    > "$TREE/src/features/shifts/screens/bad.tsx"
printf 'export const c = "#ff0000";\n'                    > "$TREE/src/features/shifts/screens/color.ts"
printf 'export * from "./shifts-screen";\n'               > "$TREE/src/features/shifts/components/index.ts"

out=$(cd "$TREE" && $OXLINT . 2>&1)

echo 'oxlint house plugin'

for rule in folder-tree colocated-tests no-barrels no-bare-fetch no-hardcoded-hex; do
  n=$(printf '%s\n' "$out" | grep -c "house($rule)" || true)
  if [ "$n" -eq 1 ]; then
    ok "$rule: exactly one violation"
  else
    bad "$rule: expected exactly 1, got $n" "$(printf '%s\n' "$out" | grep "house($rule)" | head -2)"
  fi
done

# The exemptions are the whole reason these are rules and not greps.
# Match the REPORTED PATH at line start — a remedy message may legitimately name
# an exempt file (no-hardcoded-hex points you at ui/theme/colors.ts), and a
# substring search over the whole output mistakes that for a violation.
for clean in \
  'src/utilities/http.ts' \
  'src/ui/theme/colors.ts' \
  'src/app/index.tsx' \
  'src/features/shifts/__tests__/s.test.tsx'; do
  if printf '%s\n' "$out" | grep -q "^$clean:"; then
    bad "clean file reported: $clean" "$(printf '%s\n' "$out" | grep "^$clean:" | head -1)"
  else
    ok "silent on $clean"
  fi
done

# A broken plugin must fail the run, not pass it quietly.
printf 'throw new Error("boom");\n' > "$TREE/oxlint-plugin/index.js"
(cd "$TREE" && $OXLINT . >/dev/null 2>&1)
if [ $? -ne 0 ]; then
  ok 'a plugin that throws fails the lint run (fails closed)'
else
  bad 'a broken plugin must not report success'
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
