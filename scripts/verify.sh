#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== check-env =="
DEMO_MODE=true npm run check-env -w @artemis/server

echo "== unit tests =="
DEMO_MODE=true npm run test -w @artemis/server

echo "== fixture =="
DEMO_MODE=true npm run demo:fixture -w @artemis/server

echo "== health (server must be up on :3001, optional) =="
if curl -sf http://127.0.0.1:3001/health >/tmp/artemis-health.json 2>/dev/null; then
  cat /tmp/artemis-health.json
  echo
else
  echo "(skipped — start with DEMO_MODE=true npm run dev:server)"
fi

echo "verify ok"
