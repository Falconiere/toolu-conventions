#!/usr/bin/env bash
# check-structure.sh — enforces the STRUCTURE.md folder rules the linter can't see.
# Part of `bun run check`; run from the project root. Exits non-zero on any violation.
set -u

fail=0
err() {
  echo "structure: $1" >&2
  fail=1
}

allowed_dirs="rpc routes services utilities constants types"
allowed_root_files="app.ts index.ts"

for path in src/*; do
  [ -e "$path" ] || continue
  name=${path##*/}
  if [ -d "$path" ]; then
    case " $allowed_dirs " in
      *" $name "*) [ -f "$path/README.md" ] || err "src/$name/ is missing README.md" ;;
      *) err "unexpected src/ directory: $name (allowed: $allowed_dirs)" ;;
    esac
  else
    case " $allowed_root_files " in
      *" $name "*) ;;
      *) err "unexpected file at src/ root: $name (allowed: $allowed_root_files)" ;;
    esac
  fi
done

# No barrel files: an index.ts anywhere under src/ except the sanctioned entry.
while IFS= read -r f; do
  [ "$f" = "src/index.ts" ] && continue
  err "barrel/index file not allowed: $f"
done < <(find src -type f -name 'index.ts' 2>/dev/null)

# Tests colocate: no centralized test dirs.
for d in src/__tests__ src/tests tests test; do
  [ -d "$d" ] && err "centralized test dir not allowed: $d/ (colocate in a sibling __tests__/)"
done

# Tests colocate: every *.test.* under src/ must sit inside a __tests__/ directory.
while IFS= read -r f; do
  err "test file outside __tests__/: $f (colocate in a sibling __tests__/)"
done < <(find src -type f -name '*.test.*' -not -path '*/__tests__/*' 2>/dev/null)

# Lefthook config must be .yml — a .yaml is shadowed by the install stub (hooks silently skip).
[ -e lefthook.yaml ] && err "lefthook.yaml present — rename to lefthook.yml (lefthook 2.x shadows it)"

# Wrangler config must exist and must be the .jsonc the kit ships. Two configs is
# the classic way to deploy one thing and test another.
[ -f wrangler.jsonc ] || err "missing wrangler.jsonc — the Worker has no deploy config"
[ -e wrangler.toml ] && err "wrangler.toml present — this kit uses wrangler.jsonc; delete one"

# A secret must never be committed. .dev.vars is local-only; .dev.vars.example is
# the tracked template.
if [ -d .git ] && git ls-files --error-unmatch .dev.vars >/dev/null 2>&1; then
  err ".dev.vars is tracked by git — it holds secrets; untrack it and add it to .gitignore"
fi

# Banned dependencies — the same set .oxlintrc.json blocks at import time, so a
# package cannot be installed here and merely go unimported. fetch is built into
# the Workers runtime, and zod is the one validator (CORE rule 13).
if [ -f package.json ]; then
  for banned in axios yup joi valibot superstruct ajv; do
    if grep -q "\"$banned\"[[:space:]]*:" package.json; then
      err "banned dependency in package.json: $banned (fetch is built in; zod is the one validator)"
    fi
  done
fi

exit "$fail"
