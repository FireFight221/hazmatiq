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
    if [ -z "${TIER2_FACILITY_FILE:-}" ] || [ -z "${TIER2_DETAIL_FILE:-}" ]; then
      echo "[entrypoint] Tier II private import requires both configured Secret Files" >&2
      exit 1
    fi

    tier2_stage_dir=""
    cleanup_tier2_stage() {
      if [ -n "$tier2_stage_dir" ]; then
        rm -rf -- "$tier2_stage_dir"
        tier2_stage_dir=""
      fi
    }
    stage_tier2_input() {
      source_path="$1"
      destination_path="$2"
      label="$3"

      case "$source_path" in
        /etc/secrets/*) ;;
        *)
          echo "[entrypoint] $label must be configured under /etc/secrets" >&2
          return 1
          ;;
      esac
      secret_name=${source_path#/etc/secrets/}
      case "$secret_name" in
        ""|*/*)
          echo "[entrypoint] $label must be a direct file under /etc/secrets" >&2
          return 1
          ;;
      esac
      if [ ! -r "$source_path" ]; then
        echo "[entrypoint] $label is not readable" >&2
        return 1
      fi
      if ! resolved_source=$(readlink -f -- "$source_path"); then
        echo "[entrypoint] $label could not be resolved" >&2
        return 1
      fi
      if [ ! -f "$resolved_source" ] || [ ! -r "$resolved_source" ]; then
        echo "[entrypoint] $label must resolve to a readable regular file" >&2
        return 1
      fi

      cp -- "$resolved_source" "$destination_path"
      chmod 600 "$destination_path"
    }

    tier2_stage_dir=$(mktemp -d /tmp/emergenz-tier2.XXXXXX)
    chmod 700 "$tier2_stage_dir"
    trap cleanup_tier2_stage EXIT
    stage_tier2_input "$TIER2_FACILITY_FILE" "$tier2_stage_dir/Tier2-Facilities.csv" "Tier II facility input"
    stage_tier2_input "$TIER2_DETAIL_FILE" "$tier2_stage_dir/Tier2-Details.csv" "Tier II detail input"
    ./node_modules/.bin/tsx src/import-tier2-private.ts \
      --facility-file "$tier2_stage_dir/Tier2-Facilities.csv" \
      --detail-file "$tier2_stage_dir/Tier2-Details.csv"
    cleanup_tier2_stage
    trap - EXIT
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
