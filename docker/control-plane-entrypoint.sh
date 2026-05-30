#!/bin/sh
set -eu

run_migrations="${CONTROL_PLANE_MIGRATE_ON_START:-true}"
run_indexer="${CONTROL_PLANE_INDEXER_ENABLED:-true}"
run_projections="${CONTROL_PLANE_PROJECTIONS_ENABLED:-true}"

if [ "$run_migrations" = "true" ] || [ "$run_migrations" = "1" ]; then
  node -r dotenv/config dist/scripts/migrate.js
fi

pids=""

shutdown() {
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
}

trap 'shutdown; exit 130' INT
trap 'shutdown; exit 143' TERM

node -r dotenv/config dist/main.js &
pids="$pids $!"

if [ "$run_indexer" = "true" ] || [ "$run_indexer" = "1" ]; then
  node -r dotenv/config dist/scripts/indexer.js &
  pids="$pids $!"
fi

if [ "$run_projections" = "true" ] || [ "$run_projections" = "1" ]; then
  node -r dotenv/config dist/scripts/projections.js &
  pids="$pids $!"
fi

while :; do
  for pid in $pids; do
    if ! kill -0 "$pid" 2>/dev/null; then
      set +e
      wait "$pid"
      status="$?"
      set -e
      shutdown
      exit "$status"
    fi
  done
  sleep 2
done
