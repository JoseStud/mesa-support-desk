#!/usr/bin/env bash
set -euo pipefail

MESA_PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v node >/dev/null 2>&1 && [[ -x /tmp/cartagena-node/bin/node ]]; then
  export PATH="/tmp/cartagena-node/bin:$PATH"
fi
cd -- "$MESA_PROJECT_DIR"
MESA_PYTHON="${MESA_API_PYTHON:-$MESA_PROJECT_DIR/backend/.venv/bin/python}"
if [[ ! -x "$MESA_PYTHON" ]]; then
  printf '%s\n' 'Create backend/.venv and install backend/requirements.txt before starting the server.' >&2
  exit 1
fi
if [[ ! -d node_modules ]]; then npm ci; fi
"$MESA_PYTHON" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 &
MESA_BACKEND_PID=$!
trap 'kill "$MESA_BACKEND_PID" 2>/dev/null || true' EXIT
trap 'exit 130' INT TERM
for MESA_READY_ATTEMPT in {1..40}; do
  if ! kill -0 "$MESA_BACKEND_PID" 2>/dev/null; then
    wait "$MESA_BACKEND_PID"
    exit 1
  fi
  if "$MESA_PYTHON" -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=0.5).read()' 2>/dev/null; then
    break
  fi
  sleep 0.25
done
if ! "$MESA_PYTHON" -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8000/api/health", timeout=1).read()' 2>/dev/null; then
  printf '%s\n' 'The backend did not become ready on 127.0.0.1:8000.' >&2
  exit 1
fi
npm run dev:api
