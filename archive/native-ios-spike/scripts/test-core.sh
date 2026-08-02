#!/bin/zsh

set -euo pipefail

script_dir="${0:A:h}"
project_root="${script_dir:h}"
local_cache_root="${project_root}/.cache"

mkdir -p \
  "${local_cache_root}/clang/module-cache" \
  "${local_cache_root}/swiftpm/cache" \
  "${local_cache_root}/swiftpm/config" \
  "${local_cache_root}/swiftpm/security"

export CLANG_MODULE_CACHE_PATH="${local_cache_root}/clang/module-cache"
export SWIFTPM_MODULECACHE_OVERRIDE="${local_cache_root}/swiftpm/module-cache"

exec swift run \
  --disable-sandbox \
  --package-path "${project_root}/core" \
  --cache-path "${local_cache_root}/swiftpm/cache" \
  --config-path "${local_cache_root}/swiftpm/config" \
  --security-path "${local_cache_root}/swiftpm/security" \
  --scratch-path "${project_root}/core/.build" \
  UkeTuneCoreChecks \
  "$@"
