#!/bin/zsh

set -euo pipefail

script_dir="${0:A:h}"
project_root="${script_dir:h}"
pinned_version="$(tr -d '[:space:]' < "${project_root}/.xcode-version")"
default_xcode_app="${project_root}/.toolchains/Xcode-${pinned_version}.app"
project_xcode_app="${UKETUNE_XCODE_APP:-${default_xcode_app}}"

if [[ ! -d "${project_xcode_app}/Contents/Developer" ]]; then
  print -u2 "UkeTune requires Xcode ${pinned_version}."
  print -u2 "Expected: ${default_xcode_app}"
  print -u2 "Or set UKETUNE_XCODE_APP to an existing Xcode ${pinned_version} app."
  exit 2
fi

if (( $# == 0 )); then
  print -u2 "Usage: scripts/with-project-xcode.sh <command> [arguments...]"
  exit 2
fi

export DEVELOPER_DIR="${project_xcode_app}/Contents/Developer"
exec "$@"

