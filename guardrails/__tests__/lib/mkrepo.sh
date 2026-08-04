#!/usr/bin/env bash
# mkrepo.sh <fixture-name> — copy a fixture to a temp dir and make it a REAL git
# repository, printing the path.
#
# secrets.sh shells out to `git ls-files`, so its test needs a real repo. The
# fixture cannot simply ship one: git refuses to track a nested .git ("adding
# embedded git repository") and leaves the directory untracked, so a committed
# fixture repo would never survive a clone. Building it here keeps the test on
# real data — a real repository, really constructed — with nothing mocked.
#
# `git add -A` honours .gitignore, which is what makes the two fixtures differ:
# clean/ gitignores .dev.vars so it stays untracked, violating/ has no .gitignore
# so the secret gets tracked and secrets.sh fires.
set -eu

fixture=$1
tests_dir=$(cd "$(dirname "$0")/.." && pwd)
dest=$(mktemp -d)

cp -R "$tests_dir/fixtures/$fixture/." "$dest/"
git -C "$dest" init -q
git -C "$dest" add -A
git -C "$dest" -c user.email=fixture@example.com -c user.name=fixture \
  commit -qm 'fixture' >/dev/null 2>&1 || true

printf '%s\n' "$dest"
