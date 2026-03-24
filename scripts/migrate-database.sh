#!/bin/bash
# Migrate Filla IQ data from old Azure PostgreSQL to Hydrogen's server
#
# Prerequisites:
#   - pg_dump and psql installed (PostgreSQL client tools)
#   - Network access to both source and target servers
#
# Usage:
#   ./scripts/migrate-database.sh

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
SOURCE_HOST="fillaiq-db.postgres.database.azure.com"
SOURCE_DB="fillaiq"
SOURCE_USER="fillaiqadmin"

TARGET_HOST="hydrogen-db.postgres.database.azure.com"
TARGET_DB="fillaiq"
TARGET_USER="fillaiqadmin"

DUMP_FILE="/tmp/fillaiq-migration-$(date +%Y%m%d-%H%M%S).sql"

echo "=== Filla IQ Database Migration ==="
echo "Source: ${SOURCE_USER}@${SOURCE_HOST}/${SOURCE_DB}"
echo "Target: ${TARGET_USER}@${TARGET_HOST}/${TARGET_DB}"
echo ""

# ── Step 1: Prompt for passwords ──────────────────────────────
echo "Enter SOURCE database password (old server):"
read -rs SOURCE_PASSWORD
echo ""

echo "Enter TARGET database password (new server):"
read -rs TARGET_PASSWORD
echo ""

export PGPASSWORD="$SOURCE_PASSWORD"

# ── Step 2: Verify source connection ─────────────────────────
echo "Step 2: Verifying source connection..."
psql "host=$SOURCE_HOST dbname=$SOURCE_DB user=$SOURCE_USER sslmode=require" \
  -c "SELECT current_database(), current_user, version();" || {
  echo "ERROR: Cannot connect to source database"
  exit 1
}

# ── Step 3: Get source table counts ──────────────────────────
echo ""
echo "Step 3: Source table row counts:"
psql "host=$SOURCE_HOST dbname=$SOURCE_DB user=$SOURCE_USER sslmode=require" \
  -c "SELECT schemaname, relname AS table_name, n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;"

# ── Step 4: Dump source database ─────────────────────────────
echo ""
echo "Step 4: Dumping source database to $DUMP_FILE..."
pg_dump "host=$SOURCE_HOST dbname=$SOURCE_DB user=$SOURCE_USER sslmode=require" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  > "$DUMP_FILE"

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "Dump complete: $DUMP_FILE ($DUMP_SIZE)"

# ── Step 5: Verify target connection ─────────────────────────
export PGPASSWORD="$TARGET_PASSWORD"

echo ""
echo "Step 5: Verifying target connection..."
psql "host=$TARGET_HOST dbname=$TARGET_DB user=$TARGET_USER sslmode=require" \
  -c "SELECT current_database(), current_user;" || {
  echo "ERROR: Cannot connect to target database"
  exit 1
}

# ── Step 6: Restore to target ────────────────────────────────
echo ""
echo "Step 6: Restoring to target database..."
echo "WARNING: This will overwrite existing data in the target database."
echo "Press Enter to continue or Ctrl+C to abort..."
read -r

psql "host=$TARGET_HOST dbname=$TARGET_DB user=$TARGET_USER sslmode=require" \
  < "$DUMP_FILE"

echo "Restore complete."

# ── Step 7: Verify target table counts ───────────────────────
echo ""
echo "Step 7: Target table row counts (verify against source):"
psql "host=$TARGET_HOST dbname=$TARGET_DB user=$TARGET_USER sslmode=require" \
  -c "SELECT schemaname, relname AS table_name, n_live_tup AS row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC;"

# ── Cleanup ───────────────────────────────────────────────────
echo ""
echo "=== Migration complete ==="
echo "Dump file retained at: $DUMP_FILE"
echo "Review the row counts above to verify data integrity."
echo ""
echo "Next steps:"
echo "  1. Update GitHub Secrets with the new POSTGRES_PASSWORD"
echo "  2. Deploy to the new k8s environment"
echo "  3. Verify the application works with the new database"
echo "  4. Run scripts/teardown-container-apps.sh to remove old infra"

unset PGPASSWORD
