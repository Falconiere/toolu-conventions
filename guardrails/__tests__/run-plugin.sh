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
# Pinned, not @latest. validate-templates.sh runs this suite, so an upstream
# oxlint release would otherwise turn the kit's CI red with no change in the repo
# — and the plugin API these rules use is exactly what such a release moves.
OXLINT=${OXLINT:-"bunx --bun oxlint@1.77.0"}

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
    "house/no-hardcoded-hex": "error",
    "house/no-module-scope-database": "error"
  }
}
JSON

mkdir -p "$TREE/src/features/shifts"/{screens,components,__tests__} \
         "$TREE/src/features/shifts/utils" "$TREE/src/features/shifts/hooks" \
         "$TREE/src/ui/theme/tokens" "$TREE/src/utilities" "$TREE/src/app/shifts"

# --- files that must stay SILENT ---------------------------------------------
# The two NESTED entries are the ones that matter: barrelExempt is "src/app/**"
# and the hex exemption is "**/ui/theme/**", and a glob translation that stops at
# one segment exempts only the direct children — which is every route past the
# first in a real TanStack Router tree.
printf 'export const Route = 1;\n'                        > "$TREE/src/app/index.tsx"
printf 'export const Route = 1;\n'                        > "$TREE/src/app/shifts/index.tsx"
printf 'export const colors = { primary: "#0a84ff" };\n'  > "$TREE/src/ui/theme/colors.ts"
printf 'export const dark = "#0a84ff";\n'                 > "$TREE/src/ui/theme/tokens/dark.ts"
printf 'export const get = (u: string) => fetch(u);\n'    > "$TREE/src/utilities/http.ts"
printf 'export const S = () => null;\n'                   > "$TREE/src/features/shifts/screens/shifts-screen.tsx"
printf 'export const t = 1;\n'                            > "$TREE/src/features/shifts/__tests__/s.test.tsx"
# The point of no-module-scope-database: this is the SAME call as the violating
# one, inside a function. A textual rule cannot tell them apart.
printf 'export const load = () => createDatabase({ url: "x" });\n' \
  > "$TREE/src/features/shifts/hooks/use-database.ts"
# createClient is the constructor name for supabase, redis, urql and others.
# Module scope, but nothing to do with a database — must stay silent.
printf 'import { createClient } from "urql";\nexport const gql = createClient({ url: "/graphql" });\n' \
  > "$TREE/src/features/shifts/hooks/urql-client.ts"

# --- exactly one violation per rule ------------------------------------------
VIOLATING="$TREE/src/features/shifts/utils/helper.ts
$TREE/src/features/shifts/stray.test.ts
$TREE/src/features/shifts/screens/bad.tsx
$TREE/src/features/shifts/screens/color.ts
$TREE/src/features/shifts/components/index.ts
$TREE/src/features/shifts/components/module-db.ts
$TREE/src/features/shifts/components/static-db.ts"
printf 'export const h = 1;\n'                            > "$TREE/src/features/shifts/utils/helper.ts"
printf 'export const stray = 1;\n'                        > "$TREE/src/features/shifts/stray.test.ts"
printf 'export const load = () => fetch("/shifts");\n'    > "$TREE/src/features/shifts/screens/bad.tsx"
printf 'export const c = "#ff0000";\n'                    > "$TREE/src/features/shifts/screens/color.ts"
printf 'export * from "./shifts-screen";\n'               > "$TREE/src/features/shifts/components/index.ts"
printf 'export const db = createDatabase({ url: "x" });\n' > "$TREE/src/features/shifts/components/module-db.ts"
printf 'export class Repo {\n  static db = createDatabase({ url: "x" });\n}\n' \
  > "$TREE/src/features/shifts/components/static-db.ts"

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

# Two for this one: a module-scope const AND a static class field, which runs at
# module load just the same. The ClassBody early-return used to exempt it.
n=$(printf '%s\n' "$out" | grep -c "house(no-module-scope-database)" || true)
[ "$n" -eq 2 ] && ok 'no-module-scope-database: const and static field both flagged' \
  || bad "no-module-scope-database: expected 2, got $n" "$(printf '%s\n' "$out" | grep 'house(no-module-scope-database)' | head -3)"

# The exemptions are the whole reason these are rules and not greps.
# Match the REPORTED PATH at line start — a remedy message may legitimately name
# an exempt file (no-hardcoded-hex points you into ui/theme/), and a
# substring search over the whole output mistakes that for a violation.
for clean in \
  'src/utilities/http.ts' \
  'src/ui/theme/colors.ts' \
  'src/ui/theme/tokens/dark.ts' \
  'src/app/index.tsx' \
  'src/app/shifts/index.tsx' \
  'src/features/shifts/__tests__/s.test.tsx' \
  'src/features/shifts/hooks/use-database.ts' \
  'src/features/shifts/hooks/urql-client.ts'; do
  if printf '%s\n' "$out" | grep -q "^$clean:"; then
    bad "clean file reported: $clean" "$(printf '%s\n' "$out" | grep "^$clean:" | head -1)"
  else
    ok "silent on $clean"
  fi
done

# A broken plugin must fail the run, not pass it quietly — which can only be
# proven on a tree the WORKING plugin passes. Asserting it while the five seeded
# violations were still on disk proved nothing: oxlint exits nonzero either way.
printf '%s\n' "$VIOLATING" | while IFS= read -r f; do rm -f "$f"; done
if (cd "$TREE" && $OXLINT . >/dev/null 2>&1); then
  ok 'the working plugin passes a clean tree (the control for the next assertion)'
else
  bad 'the clean tree must lint green, or the fail-closed assertion is vacuous' \
    "$(cd "$TREE" && $OXLINT . 2>&1 | head -3)"
fi

printf 'throw new Error("boom");\n' > "$TREE/oxlint-plugin/index.js"
if (cd "$TREE" && $OXLINT . >/dev/null 2>&1); then
  bad 'a broken plugin must not report success'
else
  ok 'a plugin that throws fails the lint run (fails closed)'
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
