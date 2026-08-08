#!/usr/bin/env bash
set -euo pipefail

EVAL_ROOT="$(mktemp -d /tmp/toolu-expo-cli-eval.XXXXXX)"

cleanup() {
  case "$EVAL_ROOT" in
    /tmp/toolu-expo-cli-eval.??????) ;;
    *)
      echo "refusing to remove unexpected eval directory: $EVAL_ROOT" >&2
      return 1
      ;;
  esac
  if [[ ! -d "$EVAL_ROOT" || -L "$EVAL_ROOT" ]]; then
    echo "refusing to remove missing or linked eval directory: $EVAL_ROOT" >&2
    return 1
  fi
  rm -rf -- "$EVAL_ROOT"
}
trap cleanup EXIT

node dist/create-toolu.js "$EVAL_ROOT/base" \
  --stack expo \
  --name verified-expo

test -f "$EVAL_ROOT/base/bun.lock"
test -x "$EVAL_ROOT/base/.git/hooks/pre-commit"
test -f "$EVAL_ROOT/base/toolu.scaffold.json"

node dist/create-toolu.js "$EVAL_ROOT/maximal" \
  --stack expo \
  --name maximal-expo \
  --integration api \
  --integration auth \
  --integration async-storage \
  --operation local-dev \
  --theme chalk

test -f "$EVAL_ROOT/maximal/bun.lock"
test -x "$EVAL_ROOT/maximal/.git/hooks/pre-commit"
test -f "$EVAL_ROOT/maximal/toolu.scaffold.json"
test -f "$EVAL_ROOT/maximal/operations.config.json"

echo "Expo CLI end-to-end evals passed"
