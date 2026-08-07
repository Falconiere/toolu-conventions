#!/usr/bin/env bash
# Checksum-verified release installation helpers. Source this file.

[[ -n "${TOOLU_OPERATIONS_INSTALL_SOURCED:-}" ]] && return 0
TOOLU_OPERATIONS_INSTALL_SOURCED=1

operations_install::platform() {
  local os arch
  case "$(uname -s)" in Linux) os="linux" ;; Darwin) os="darwin" ;; *) return 1 ;; esac
  case "$(uname -m)" in x86_64 | amd64) arch="amd64" ;; arm64 | aarch64) arch="arm64" ;; *) return 1 ;; esac
  printf '%s_%s' "$os" "$arch"
}

operations_install::sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    echo "install-cli: sha256sum or shasum is required" >&2
    return 1
  fi
}

operations_install::fetch() {
  local url="$1" output="$2" expected="$3" actual
  curl -fsSL --retry 3 --retry-connrefused -o "$output" "$url"
  actual="$(operations_install::sha256 "$output")"
  [[ "$actual" == "$expected" ]] || {
    echo "install-cli: checksum mismatch for $url" >&2
    echo "expected $expected" >&2
    echo "actual   $actual" >&2
    return 1
  }
}

operations_install::finish() {
  local staged="$1" destination="$2"
  mkdir -p "$(dirname "$destination")"
  chmod +x "$staged"
  mv "$staged" "$destination"
}

operations_install::cleanup() {
  local directory="$1" base parent staging_root
  base="$(basename "$directory")"
  parent="$(cd -P "$(dirname "$directory")" && pwd)" || return 1
  staging_root="$(cd -P "${TMPDIR:-/tmp}" && pwd)" || return 1
  if [[ -d "$directory" && ! -L "$directory" && "$base" == toolu-cli.* \
    && "$parent" == "$staging_root" ]]; then
    rm -rf -- "$directory"
  else
    echo "install-cli: refusing to clean unexpected path $directory" >&2
  fi
}
