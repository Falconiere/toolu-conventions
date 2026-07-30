#!/usr/bin/env bash
# check-structure.sh — machine-enforces the STRUCTURE.md rules that oxlint can't
# see: the allowed top-level src/ directories, a README in each (except
# src/pages), no barrel files, colocated tests, a real 404 page, no shadowing
# lefthook.yaml, and no banned dependency.
# Part of `bun run check`. Exits nonzero on any violation.
set -u

fail=0
allowed="pages layouts ui sections content utilities constants types"

# 1. Only the sanctioned top-level dirs may live under src/.
for d in src/*/; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  case " $allowed " in
    *" $name "*) ;;
    *) echo "STRUCTURE: unexpected top-level src/ dir: src/$name (allowed: $allowed)"; fail=1 ;;
  esac
done

# 2. Every top-level src/ dir except pages carries a README.md. (src/pages is
#    the URL map — its structure IS the documentation.)
for name in $allowed; do
  [ "$name" = "pages" ] && continue
  if [ -d "src/$name" ] && [ ! -f "src/$name/README.md" ]; then
    echo "STRUCTURE: missing README.md in src/$name"; fail=1
  fi
done

# 3. No barrel files anywhere under src/.
barrels=$(find src -type f \( -name 'index.ts' -o -name 'index.js' \) 2>/dev/null)
if [ -n "$barrels" ]; then
  echo "STRUCTURE: barrel files not allowed (index.ts/js under src/):"
  echo "$barrels" | sed 's/^/  - /'
  fail=1
fi

# 4. Tests are colocated — no centralized test dirs.
for centralized in src/__tests__ src/tests tests test; do
  if [ -d "$centralized" ]; then
    echo "STRUCTURE: centralized test dir not allowed: $centralized/ — colocate tests in a sibling __tests__/"; fail=1
  fi
done

# 5. Every *.test.ts under src/ lives inside a sibling __tests__/ folder.
stray_tests=$(find src -type f -name '*.test.ts' -not -path '*/__tests__/*' 2>/dev/null)
if [ -n "$stray_tests" ]; then
  echo "STRUCTURE: test files must live in a sibling __tests__/ folder:"
  echo "$stray_tests" | sed 's/^/  - /'
  fail=1
fi

# 6. A real 404 page. wrangler.jsonc serves it with a 404 status
#    (not_found_handling: "404-page"); without the page, dead URLs 200 with an
#    empty body and search engines index them.
if [ ! -f src/pages/404.astro ]; then
  echo "STRUCTURE: missing src/pages/404.astro — wrangler.jsonc serves it for unmatched paths"; fail=1
fi

# 7. Lefthook config must be lefthook.yml — a lefthook.yaml is shadowed by the 2.x installer.
if [ -f lefthook.yaml ]; then
  echo "STRUCTURE: found lefthook.yaml — rename to lefthook.yml (lefthook 2.x installer shadows .yaml)"; fail=1
fi

# 8. Banned dependencies — the same set .oxlintrc.json blocks at import time, so a
#    package cannot be installed here and merely go unimported. One validator
#    (CORE rule 13) and one HTTP client. See LIBRARIES.md for the reasoning.
if [ -f package.json ]; then
  for banned in axios yup joi valibot superstruct ajv; do
    if grep -q "\"$banned\"[[:space:]]*:" package.json; then
      echo "STRUCTURE: banned dependency in package.json: $banned (one HTTP client: src/utilities/http.ts; one validator: zod)"; fail=1
    fi
  done
fi

exit "$fail"
