#!/bin/bash
# Provision Filla IQ database on Hydrogen's Azure PostgreSQL Flexible Server
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Access to the Hydrogen subscription
#
# Usage:
#   ./scripts/provision-azure-db.sh

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
PG_SERVER="hydrogen-db"
PG_RESOURCE_GROUP="hydrogen-prod-rg"
AZ_SUBSCRIPTION="Microsoft Azure Sponsorship"
NEW_DB="fillaiq"
NEW_USER="fillaiqadmin"

echo "=== Filla IQ Database Provisioning ==="
echo "Server: ${PG_SERVER}.postgres.database.azure.com"
echo "Database: $NEW_DB"
echo "User: $NEW_USER"
echo ""

# ── Step 1: Verify server exists ──────────────────────────────
echo "Step 1: Verifying server exists..."
az postgres flexible-server show \
  --name "$PG_SERVER" \
  --resource-group "$PG_RESOURCE_GROUP" --subscription "$AZ_SUBSCRIPTION" \
  --query "{name:name, state:state, location:location}" \
  --output table

# ── Step 2: Create the fillaiq database ───────────────────────
echo ""
echo "Step 2: Creating database '$NEW_DB'..."
az postgres flexible-server db create \
  --server-name "$PG_SERVER" \
  --resource-group "$PG_RESOURCE_GROUP" --subscription "$AZ_SUBSCRIPTION" \
  --database-name "$NEW_DB" \
  --charset "UTF8" \
  --collation "en_US.utf8" \
  2>/dev/null && echo "Database '$NEW_DB' created." || echo "Database '$NEW_DB' already exists."

# ── Step 3: Create user and grant permissions ─────────────────
echo ""
echo "Step 3: Creating user '$NEW_USER'..."
echo ""
echo "NOTE: Azure PostgreSQL Flexible Server requires creating users via SQL."
echo "Run the following SQL commands as the server admin (hydrogen user):"
echo ""
echo "  psql \"host=${PG_SERVER}.postgres.database.azure.com port=5432 dbname=${NEW_DB} user=hydrogen sslmode=require\""
echo ""
echo "  CREATE ROLE ${NEW_USER} WITH LOGIN PASSWORD '<choose-a-strong-password>';"
echo "  GRANT ALL PRIVILEGES ON DATABASE ${NEW_DB} TO ${NEW_USER};"
echo "  ALTER DATABASE ${NEW_DB} OWNER TO ${NEW_USER};"
echo "  \\c ${NEW_DB}"
echo "  GRANT ALL ON SCHEMA public TO ${NEW_USER};"
echo ""

# ── Step 4: Verify VNet access ────────────────────────────────
echo "Step 4: Checking VNet integration..."
az postgres flexible-server show \
  --name "$PG_SERVER" \
  --resource-group "$PG_RESOURCE_GROUP" --subscription "$AZ_SUBSCRIPTION" \
  --query "{vnet:network.delegatedSubnetResourceId, privateDnsZone:network.privateDnsZoneArmResourceId}" \
  --output table

echo ""
echo "If the server uses VNet integration, AKS pods in the same VNet"
echo "should already have access (Hydrogen uses this server)."
echo ""

# ── Step 5: Verify firewall rules ─────────────────────────────
echo "Step 5: Checking firewall rules..."
az postgres flexible-server firewall-rule list \
  --name "$PG_SERVER" \
  --resource-group "$PG_RESOURCE_GROUP" --subscription "$AZ_SUBSCRIPTION" \
  --output table 2>/dev/null || echo "No firewall rules (VNet-integrated servers don't use firewall rules)"

echo ""
echo "=== Provisioning complete ==="
echo ""
echo "Connection string for Helm deployment:"
echo "  postgresql://${NEW_USER}:<password>@${PG_SERVER}.postgres.database.azure.com:5432/${NEW_DB}?sslmode=require"
echo ""
echo "Add to GitHub Secrets:"
echo "  POSTGRES_PASSWORD=<the password you chose>"
