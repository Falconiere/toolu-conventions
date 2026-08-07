#!/usr/bin/env bash
# Install the pinned cloudflared CLI into the project's .tooling/bin directory.
set -euo pipefail

VERSION="2026.7.3"
if [[ "${1:-}" == "--print-pin" ]]; then echo "cloudflared $VERSION"; exit 0; fi

OPERATIONS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$OPERATIONS_ROOT/../.." && pwd)"
# shellcheck source=/dev/null
source "$OPERATIONS_ROOT/shared/install-release.sh"
platform="$(operations_install::platform)" || { echo "install-cli: unsupported platform" >&2; exit 1; }
case "$platform" in
  darwin_amd64) sha="70d1c8684fa6d14b5843787ec8d1ea8e18b23650e424f4ea43d849a506487c3b" ;;
  darwin_arm64) sha="90c5a4f914d705fd70c135dba6d80b1791d254b08d6d4136301941f88330dd09" ;;
  linux_amd64) sha="9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17" ;;
  linux_arm64) sha="65259e652a7bea08bf5df603233ab22b8bf3116af8df9f9206209af6a1b955c0" ;;
  *) echo "install-cli: no cloudflared checksum for $platform" >&2; exit 1 ;;
esac

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/toolu-cli.XXXXXX")"
trap 'operations_install::cleanup "$temp_dir"' EXIT
case "$platform" in
  linux_*)
    url="https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-${platform/_/-}"
    operations_install::fetch "$url" "$temp_dir/cloudflared" "$sha"
    ;;
  darwin_*)
    url="https://github.com/cloudflare/cloudflared/releases/download/${VERSION}/cloudflared-${platform/_/-}.tgz"
    operations_install::fetch "$url" "$temp_dir/archive.tgz" "$sha"
    tar -xzf "$temp_dir/archive.tgz" -C "$temp_dir" cloudflared
    ;;
esac
operations_install::finish "$temp_dir/cloudflared" "$PROJECT_ROOT/.tooling/bin/cloudflared"
echo "installed cloudflared $VERSION in .tooling/bin"
