#!/bin/sh
# Installs the traits standalone executable from the GitHub release this script was published with:
#
#   curl -fsSL https://github.com/crosshatch/traits/releases/latest/download/install.sh | sh
#
# TRAITS_INSTALL_DIR sets the destination directory; it is ~/.local/bin by default.
set -eu

fail() {
  echo "traits install: $1" >&2
  exit 1
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}

# Everything runs from one function, so a partially downloaded script does nothing.
main() {
  # The release workflow replaces this with the version of the release it uploads the script to.
  version="__TRAITS_VERSION__"
  case "$version" in
    __*) fail "This copy is not from a release. Use the install.sh attached to a GitHub release." ;;
  esac

  install_dir="${TRAITS_INSTALL_DIR:-$HOME/.local/bin}"
  base_url="${TRAITS_DOWNLOAD_URL:-https://github.com/crosshatch/traits/releases/download/traits@$version}"
  npm_hint="Install the npm package instead: npm install --save-dev traits"

  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) fail "There is no executable for $(uname -s). $npm_hint" ;;
  esac
  case "$(uname -m)" in
    arm64 | aarch64) arch=arm64 ;;
    x86_64 | amd64) arch=x64 ;;
    *) fail "There is no executable for $(uname -m). $npm_hint" ;;
  esac

  if [ "$os" = darwin ] && [ "$arch" = x64 ]; then
    # A shell running under Rosetta reports x86_64 on Apple silicon.
    if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
      arch=arm64
    else
      fail "There is no executable for Intel Macs. $npm_hint"
    fi
  fi
  if [ "$os" = linux ] && { [ -f /etc/alpine-release ] || ldd --version 2>&1 | grep -qi musl; }; then
    fail "There is no executable for musl-based Linux such as Alpine. $npm_hint"
  fi

  archive="traits-$os-$arch.tar.gz"
  directory=$(mktemp -d)
  trap 'rm -rf "$directory"' EXIT

  echo "Downloading traits $version for $os-$arch"
  curl -fsSL "$base_url/$archive" -o "$directory/$archive" || fail "Could not download $base_url/$archive"
  curl -fsSL "$base_url/checksums.txt" -o "$directory/checksums.txt" ||
    fail "Could not download $base_url/checksums.txt"

  expected=$(awk -v file="$archive" '$2 == file { print $1 }' "$directory/checksums.txt")
  [ -n "$expected" ] || fail "checksums.txt has no entry for $archive"
  actual=$(sha256 "$directory/$archive")
  [ "$actual" = "$expected" ] || fail "Checksum mismatch for $archive: expected $expected, got $actual"

  tar -xzf "$directory/$archive" -C "$directory"
  mkdir -p "$install_dir"
  mv "$directory/traits" "$install_dir/traits"
  chmod +x "$install_dir/traits"

  echo "Installed traits $version to $install_dir/traits"
  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *) echo "Add $install_dir to your PATH to run it as traits." ;;
  esac
}

main "$@"
