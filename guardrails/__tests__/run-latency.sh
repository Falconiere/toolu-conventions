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
measure_once() {
  dir=$1
  shift
  start=$(now_ms)
  (cd "$dir" && bash "$GR" "$@" >/dev/null 2>&1)
  GR_LATENCY_ELAPSED=$(( $(now_ms) - start ))
}

measure_in() {
  label=$1
  budget=$2
  dir=$3
  shift 3
  measure_once "$dir" "$@"
  elapsed=$GR_LATENCY_ELAPSED
  samples=$elapsed
  if [ "$elapsed" -gt "$budget" ]; then
    # Shared CI hosts occasionally pause every process long enough to turn an
    # otherwise healthy 150ms file check into 300ms. Retry only a failed sample
    # and judge the median: one scheduling outlier cannot fail the gate, while
    # two over-budget measurements still expose a real regression.
    measure_once "$dir" "$@"; second=$GR_LATENCY_ELAPSED
    measure_once "$dir" "$@"; third=$GR_LATENCY_ELAPSED
    samples="$elapsed,$second,$third"
    if [ "$elapsed" -gt "$second" ]; then swap=$elapsed; elapsed=$second; second=$swap; fi
    if [ "$second" -gt "$third" ]; then swap=$second; second=$third; third=$swap; fi
    if [ "$elapsed" -gt "$second" ]; then swap=$elapsed; elapsed=$second; second=$swap; fi
    elapsed=$second
  fi
  if [ "$elapsed" -le "$budget" ]; then
    printf '  ok    %-12s %5sms (budget %sms; samples %s)\n' "$label" "$elapsed" "$budget" "$samples"
  else
    printf '  FAIL  %-12s %5sms exceeds budget %sms (samples %s)\n' "$label" "$elapsed" "$budget" "$samples"
    fail=1
  fi
}

measure_in 'repo mode' "$REPO_BUDGET_MS" "$TREE"
measure_in '--file' "$FILE_BUDGET_MS" "$TREE" --file src/features/domain-7/components/part-3.tsx

# ---------------------------------------------------------------- workspace
#
# Workspace mode re-execs run.sh once per package, so it pays a fork and a
# fresh jq config read that a single-root run does not. The budget does not get
# to grow for that: the SAME 500 files are split across two packages, so this
# measures the overhead of the split, not a bigger tree. If it regresses, the
# dispatch is serializing independent packages or doing per-package work that
# belongs in the parent.
WS=$(mktemp -d)
trap 'rm -rf "$TREE" "$WS"' EXIT

mkdir -p "$WS/packages/api" "$WS/packages/database"
cp "$TREE/package.json" "$WS/"
cat > "$WS/guardrails.workspace.json" <<'EOF'
{
  "version": 1,
  "packages": ["packages/api", "packages/database"],
  "bannedDeps": ["axios"],
  "secrets": { "neverTracked": [".dev.vars"] },
  "shadowConfigs": []
}
EOF
for pkg in api database; do
  dest="$WS/packages/$pkg"
  cp "$TREE/guardrails.config.json" "$TREE/package.json" "$TREE/wrangler.jsonc" "$TREE/lefthook.yml" "$dest/"
  mkdir -p "$dest/src/ui/theme" "$dest/src/api" "$dest/src/utilities" "$dest/src/app" "$dest/src/features"
  for d in ui features api utilities; do printf '# %s\n' "$d" > "$dest/src/$d/README.md"; done
  cp "$TREE/src/utilities/http.ts" "$dest/src/utilities/http.ts"
done
# 10 domains each — the same 500 files, split down the middle.
half=0
for i in $(seq 1 20); do
  half=$(( half + 1 ))
  [ "$half" -le 10 ] && pkg=api || pkg=database
  cp -R "$TREE/src/features/domain-$i" "$WS/packages/$pkg/src/features/domain-$i"
done
ln -sf "$native" "$WS/packages/api/node_modules/.bin/ast-grep" 2>/dev/null || {
  mkdir -p "$WS/packages/api/node_modules/.bin" "$WS/packages/database/node_modules/.bin"
  [ -n "$native" ] && ln -sf "$native" "$WS/packages/api/node_modules/.bin/ast-grep"
  [ -n "$native" ] && ln -sf "$native" "$WS/packages/database/node_modules/.bin/ast-grep"
}

ws_count=$(find "$WS/packages" -path '*/src/*' -type f | wc -l)
printf 'workspace tree: %s files across 2 packages\n' "$ws_count"

measure_in 'ws repo' "$REPO_BUDGET_MS" "$WS"
measure_in 'ws --file' "$FILE_BUDGET_MS" "$WS" --file packages/api/src/features/domain-7/components/part-3.tsx

exit "$fail"
