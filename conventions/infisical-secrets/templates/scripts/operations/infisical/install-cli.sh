#!/usr/bin/env bash
# Install the pinned Infisical CLI into the project's .tooling/bin directory.
set -euo pipefail

VERSION="0.43.116"
if [[ "${1:-}" == "--print-pin" ]]; then echo "infisical $VERSION"; exit 0; fi

OPERATIONS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$OPERATIONS_ROOT/../.." && pwd)"
# shellcheck source=/dev/null
source "$OPERATIONS_ROOT/shared/install-release.sh"
platform="$(operations_install::platform)" || { echo "install-cli: unsupported platform" >&2; exit 1; }
case "$platform" in
  darwin_amd64) sha="ffc518c780f798909f47718b0353eff2213381dfde566b4d96f40d34acde82c1" ;;
  darwin_arm64) sha="8d1612f5bf7ecaa27ab8d295760c7f6b7267ad4227df1ccde71d75ae34c36540" ;;
  linux_amd64) sha="53abc96a3bc872ade81efe156275bd30c53f9ee8b52965b0c9cb320a9c814fbc" ;;
  linux_arm64) sha="0111d8e7daa5f3c498a8cc6cb9852bde2c5c21e53c935d4738ddd80c764554cc" ;;
  *) echo "install-cli: no Infisical checksum for $platform" >&2; exit 1 ;;
esac

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/toolu-cli.XXXXXX")"
trap 'operations_install::cleanup "$temp_dir"' EXIT
url="https://github.com/Infisical/cli/releases/download/v${VERSION}/cli_${VERSION}_${platform}.tar.gz"
operations_install::fetch "$url" "$temp_dir/archive.tar.gz" "$sha"
tar -xzf "$temp_dir/archive.tar.gz" -C "$temp_dir" infisical
operations_install::finish "$temp_dir/infisical" "$PROJECT_ROOT/.tooling/bin/infisical"
echo "installed infisical $VERSION in .tooling/bin"
