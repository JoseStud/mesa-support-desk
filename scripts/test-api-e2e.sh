#!/usr/bin/env bash
set -euo pipefail

MESA_PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v node >/dev/null 2>&1 && [[ -x /tmp/cartagena-node/bin/node ]]; then
  export PATH="/tmp/cartagena-node/bin:$PATH"
fi
cd -- "$MESA_PROJECT_DIR"
npm run build:api
MESA_TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mesa-api-e2e.XXXXXX")"
trap 'rm -rf -- "$MESA_TEST_DIR"' EXIT
export MESA_DB_PATH="$MESA_TEST_DIR/mesa.sqlite3"
npx playwright test --config playwright.api.config.ts "$@"
