#!/usr/bin/env bash
# check-structure.sh — machine-enforces the STRUCTURE.md folder rules that oxlint
# can't see: the allowed top-level src/ directories, a README in each (except
# src/app), no barrel (index.ts/tsx) files outside src/app, colocated tests (no
# centralized test dirs; every *.test.ts(x) lives in a sibling __tests__/), and
# no shadowing lefthook.yaml. Part of `bun run check`. Exits nonzero on any
# violation.
set -u

fail=0
allowed="app ui features api utilities providers constants types"

# 1. Only the sanctioned top-level dirs may live under src/.
for d in src/*/; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  case " $allowed " in
    *" $name "*) ;;
    *) echo "STRUCTURE: unexpected top-level src/ dir: src/$name (allowed: $allowed)"; fail=1 ;;
  esac
done

# 2. Every top-level src/ dir except app carries a README.md.
for name in $allowed; do
  [ "$name" = "app" ] && continue
  if [ -d "src/$name" ] && [ ! -f "src/$name/README.md" ]; then
    echo "STRUCTURE: missing README.md in src/$name"; fail=1
  fi
done

# 3. No barrel files: index.ts/index.tsx anywhere under src/ except src/app/**.
barrels=$(find src -type f \( -name 'index.ts' -o -name 'index.tsx' \) -not -path 'src/app/*' 2>/dev/null)
if [ -n "$barrels" ]; then
  echo "STRUCTURE: barrel files not allowed (index.ts/tsx outside src/app):"
  echo "$barrels" | sed 's/^/  - /'
  fail=1
fi

# 4. Tests are colocated — no centralized test dirs.
for centralized in src/__tests__ src/tests tests test; do
  if [ -d "$centralized" ]; then
    echo "STRUCTURE: centralized test dir not allowed: $centralized/ — colocate tests in a sibling __tests__/"; fail=1
  fi
done

# 5. Every *.test.ts(x) under src/ lives inside a sibling __tests__/ folder.
stray_tests=$(find src -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -not -path '*/__tests__/*' 2>/dev/null)
if [ -n "$stray_tests" ]; then
  echo "STRUCTURE: test files must live in a sibling __tests__/ folder:"
  echo "$stray_tests" | sed 's/^/  - /'
  fail=1
fi

# 6. Lefthook config must be lefthook.yml — a lefthook.yaml is shadowed by the 2.x installer.
if [ -f lefthook.yaml ]; then
  echo "STRUCTURE: found lefthook.yaml — rename to lefthook.yml (lefthook 2.x installer shadows .yaml)"; fail=1
fi

exit "$fail"
