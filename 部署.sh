#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
command -v node >/dev/null 2>&1 || { echo 'Node.js 14 or newer is required.' >&2; exit 1; }
node -e 'if (Number(process.versions.node.split(".")[0]) < 14) process.exit(1)' || { echo 'Please use Node.js 14+.' >&2; exit 1; }
case "${1:-build}" in
  install) echo 'No dependencies to install. Uses preinstalled Node.js 14+ only.' ;;
  build) node build.js ;;
  run|dev) node server.js ;;
  *) echo 'Usage: bash 部署.sh [install|build|run]' >&2; exit 1 ;;
esac
