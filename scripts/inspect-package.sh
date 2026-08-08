#!/usr/bin/env bash
set -euo pipefail

package_tmp=$(mktemp -d)
cleanup() {
  case "$package_tmp" in
    /tmp/tmp.*) rm -rf -- "$package_tmp" ;;
    *) printf 'refusing to remove unexpected temporary directory: %s\n' "$package_tmp" >&2 ;;
  esac
}
trap cleanup EXIT

pack_json=$(npm pack --json --pack-destination "$package_tmp")
tarball_name=$(jq -er '.[0].filename' <<<"$pack_json")
tarball="$package_tmp/$tarball_name"
[[ -f "$tarball" ]] || { printf 'npm pack did not create %s\n' "$tarball" >&2; exit 1; }

while IFS= read -r entry; do
  case "$entry" in
    package/package.json|package/README.md|package/SETUP.md|package/DESIGN.md|package/dist/create-toolu.js) ;;
    package/schemas/*) ;;
    package/stacks/*/templates/*) ;;
    package/stacks/*/*.md) ;;
    package/guardrails/README.md|package/guardrails/run.sh|package/guardrails/lib/*|package/guardrails/checks/*|package/guardrails/patterns/*|package/guardrails/schema.json|package/guardrails/workspace.schema.json|package/guardrails/oxlint-plugin/*) ;;
    package/shared/.claude/settings.json|package/shared/README.md|package/shared/workspace/*) ;;
    package/conventions/shared/templates/*|package/conventions/cloudflare-infra/templates/*|package/conventions/infisical-secrets/templates/*|package/conventions/local-dev/templates/*) ;;
    package/conventions/SETUP.md|package/conventions/*/SETUP.md) ;;
    *) printf 'unexpected package entry: %s\n' "$entry" >&2; exit 1 ;;
  esac
done < <(tar -tzf "$tarball")

if tar -tvzf "$tarball" | awk '$1 ~ /^[lh]/ { found=1 } END { exit !found }'; then
  printf 'package contains a symbolic or hard link\n' >&2
  exit 1
fi

printf 'package inspection passed: %s\n' "$tarball_name"
