#!/bin/sh
set -e

if [ ! -f "$SQLITE_PATH" ]; then
  echo "[entrypoint] no database found at $SQLITE_PATH, creating and seeding it..."
  ./node_modules/.bin/tsx src/init-sqlite.ts
  ./node_modules/.bin/tsx src/seed.ts
fi

case "${TIER2_PRIVATE_IMPORT_ENABLED:-}" in
  1|true|yes|on)
    echo "[entrypoint] importing authorized private Tier II files..."
    ./node_modules/.bin/tsx src/import-tier2-private.ts
    ;;
  "")
    if [ -n "${TIER2_FACILITY_FILE:-}${TIER2_DETAIL_FILE:-}" ]; then
      echo "[entrypoint] Tier II private file paths are set but TIER2_PRIVATE_IMPORT_ENABLED is not enabled" >&2
      exit 1
    fi
    echo "[entrypoint] no private Tier II dataset configured; manual facility entry remains available"
    ;;
  *)
    echo "[entrypoint] TIER2_PRIVATE_IMPORT_ENABLED must be true or unset" >&2
    exit 1
    ;;
esac

exec ./node_modules/.bin/tsx src/index.ts
