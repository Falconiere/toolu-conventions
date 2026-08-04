#!/usr/bin/env bash
# run-latency.sh — the guardrails latency budget.
#
# Measured against a GENERATED tree of 500 source files across 20 feature
# folders, not against the fixtures: a fixture-sized tree proves nothing about a
# real repo, and the whole point of the budget is that a slow gate gets routed
# around. The generator lives here so the number is reproducible.
#
#   repo mode   < 2000ms   (runs on every `bun run check` and every Stop hook)
#   --file mode <  250ms   (runs on every single Edit/Write the agent makes)
set -u

HERE=$(cd "$(dirname "$0")" && pwd)
GR="$HERE/../run.sh"
REPO_BUDGET_MS=2000
FILE_BUDGET_MS=250

TREE=$(mktemp -d)
trap 'rm -rf "$TREE"' EXIT

cp "$HERE/fixtures/clean/guardrails.config.json" "$TREE/"
cp "$HERE/fixtures/clean/package.json" "$TREE/"
cp "$HERE/fixtures/clean/wrangler.jsonc" "$TREE/"
cp "$HERE/fixtures/clean/lefthook.yml" "$TREE/"

mkdir -p "$TREE/src/ui/theme" "$TREE/src/api" "$TREE/src/utilities" "$TREE/src/app"
for d in ui features api utilities; do
  mkdir -p "$TREE/src/$d"
  printf '# %s\n' "$d" > "$TREE/src/$d/README.md"
done
printf 'export const get = (u: string) => fetch(u);\n' > "$TREE/src/utilities/http.ts"

# 20 domains × 25 files = 500.
for i in $(seq 1 20); do
  domain="$TREE/src/features/domain-$i"
  mkdir -p "$domain/screens" "$domain/components" "$domain/hooks" "$domain/__tests__"
  printf '# domain-%s\n' "$i" > "$domain/README.md"
  for j in $(seq 1 8); do
    printf '// component %s\nexport const C%s = () => null;\n' "$j" "$j" > "$domain/components/part-$j.tsx"
    printf '// hook %s\nexport const useH%s = () => null;\n' "$j" "$j" > "$domain/hooks/use-h$j.ts"
    printf '// test %s\nexport const t%s = %s;\n' "$j" "$j" "$j" > "$domain/__tests__/part-$j.test.tsx"
  done
  printf '// screen\nexport const Screen%s = () => null;\n' "$i" > "$domain/screens/domain-screen.tsx"
done

count=$(find "$TREE/src" -type f | wc -l)
printf 'generated tree: %s files\n' "$count"

# Measure the real deployment shape. @ast-grep/cli is a devDependency on the TS
# stacks, so a scaffolded project runs the NATIVE binary out of node_modules/.bin.
# Falling back to `bunx` adds ~200ms of package resolution to every invocation
# and would have us tuning a budget against an install mode no project uses.
mkdir -p "$TREE/node_modules/.bin"
native=$(command -v ast-grep 2>/dev/null)
if [ -z "$native" ]; then
  native=$(find "${HOME}/.bun/install/cache" -path '*ast-grep*cli-*' -name 'ast-grep' -type f 2>/dev/null | head -1)
fi
if [ -n "$native" ]; then
  ln -sf "$native" "$TREE/node_modules/.bin/ast-grep"
  printf 'ast-grep: native binary (the devDependency layout)\n'
else
  printf 'ast-grep: NOT FOUND — pattern timings will reflect bunx resolution, not a real project\n'
fi

now_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }

fail=0
measure() {
  label=$1
  budget=$2
  shift 2
  start=$(now_ms)
  (cd "$TREE" && bash "$GR" "$@" >/dev/null 2>&1)
  elapsed=$(( $(now_ms) - start ))
  if [ "$elapsed" -le "$budget" ]; then
    printf '  ok    %-12s %5sms (budget %sms)\n' "$label" "$elapsed" "$budget"
  else
    printf '  FAIL  %-12s %5sms exceeds budget %sms\n' "$label" "$elapsed" "$budget"
    fail=1
  fi
}

measure 'repo mode' "$REPO_BUDGET_MS"
measure '--file' "$FILE_BUDGET_MS" --file src/features/domain-7/components/part-3.tsx

exit "$fail"
