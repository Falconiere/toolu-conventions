#!/usr/bin/env bash
# check-structure.sh — machine-enforce the STRUCTURE.md folder rules the linter
# can't see. Run from the project root; exits nonzero on the first violation set.
set -u

status=0
fail() { echo "STRUCTURE: $1" >&2; status=1; }

# Only these top-level src/ dirs are allowed; each must carry a README.md index.
allowed="ui features api utilities providers constants types"
for dir in src/*/; do
  [ -d "$dir" ] || continue
  name=$(basename "$dir")
  case " $allowed " in *" $name "*) ;; *) fail "unexpected src/ dir: $name (allowed: $allowed)" ;; esac
  [ -f "${dir}README.md" ] || fail "missing README.md in src/$name/"
done

# No barrel files under src/ (app/ is exempt — Expo Router needs index routes).
while IFS= read -r f; do fail "barrel file not allowed: $f"; done \
  < <(find src -type f \( -name 'index.ts' -o -name 'index.tsx' \) 2>/dev/null)

# Tests colocate in a sibling __tests__/ — never a centralized test dir.
for d in src/__tests__ src/tests tests test; do
  [ -d "$d" ] && fail "centralized test dir not allowed: $d (colocate in a sibling __tests__/)"
done

# Every *.test.* under src/ must live inside a __tests__/ directory.
while IFS= read -r f; do fail "test not colocated in __tests__/: $f"; done \
  < <(find src -type f -name '*.test.*' -not -path '*/__tests__/*' 2>/dev/null)

# Lefthook config must be lefthook.yml — a .yaml is silently shadowed on install.
[ -f lefthook.yaml ] && fail "lefthook.yaml present — rename to lefthook.yml"

exit "$status"
