#!/usr/bin/env bash
set -euo pipefail

MESA_PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v node >/dev/null 2>&1 && [[ -x /tmp/cartagena-node/bin/node ]]; then
  export PATH="/tmp/cartagena-node/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22.12+ before running Mesa.' >&2
  exit 1
fi
cd -- "$MESA_PROJECT_DIR"
if [[ ! -d node_modules ]]; then npm ci; fi
exec npm run dev
