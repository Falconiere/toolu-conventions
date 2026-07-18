#!/usr/bin/env bash
# check-structure.sh — machine-enforce the house structure rules that rustfmt and
# clippy don't cover. Part of the quality gate; run as:
#   cargo fmt --check && cargo clippy --all-targets -- -D warnings \
#     && bash scripts/check-structure.sh && cargo test
# Exits nonzero (and prints each violation) when any of these fail:
#   (a) every .rs file under src/ and tests/ has a snake_case filename
#   (b) no non-test .rs file exceeds 500 code lines (blank + `//` lines excluded)
#   (c) the lefthook config is lefthook.yml, never lefthook.yaml (a .yaml shadows it)
set -u

status=0
ceiling=500

while IFS= read -r f; do
  base=${f##*/}
  if ! printf '%s' "$base" | grep -Eq '^[a-z0-9_]+\.rs$'; then
    echo "structure: non-snake_case filename: $f"
    status=1
  fi
  case "$f" in */tests/*|tests/*) continue ;; esac
  lines=$(awk '{ s=$0; sub(/^[ \t]+/, "", s); if (s != "" && s !~ /^\/\//) n++ } END { print n+0 }' "$f")
  if [ "$lines" -gt "$ceiling" ]; then
    echo "structure: $f has $lines code lines (ceiling $ceiling)"
    status=1
  fi
done < <(find src tests -name '*.rs' 2>/dev/null)

if [ -e lefthook.yaml ]; then
  echo "structure: lefthook.yaml present — rename to lefthook.yml (a .yaml shadows the .yml)"
  status=1
fi

exit "$status"
