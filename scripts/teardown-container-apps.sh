#!/bin/bash
# Teardown old Filla IQ Azure Container Apps infrastructure
#
# Run this AFTER verifying the new k8s deployment is working correctly.
#
# Prerequisites:
#   - Azure CLI installed and logged in to the fillaiq subscription
#   - Confirmed that the new k8s deployment is stable
#
# Usage:
#   ./scripts/teardown-container-apps.sh

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
RESOURCE_GROUP="fillaiq-rg"
WEB_APP="fillaiq-web"
MQTT_APP="fillaiq-mqtt"
ENVIRONMENT="fillaiq-env"
ACR_NAME="fillaiqacr"
OLD_DB_SERVER="fillaiq-db"

echo "=== Filla IQ Container Apps Teardown ==="
echo ""
echo "This will delete the following resources:"
echo "  - Container App: $WEB_APP"
echo "  - Container App: $MQTT_APP"
echo "  - Container Apps Environment: $ENVIRONMENT"
echo "  - Container Registry: $ACR_NAME"
echo "  - PostgreSQL Server: $OLD_DB_SERVER (OPTIONAL - keep as backup)"
echo ""
echo "Resource Group: $RESOURCE_GROUP"
echo ""
echo "WARNING: This is irreversible. Press Enter to continue or Ctrl+C to abort..."
read -r

# ── Step 1: Delete Container Apps ─────────────────────────────
echo ""
echo "Step 1: Deleting container apps..."

echo "Deleting $WEB_APP..."
az containerapp delete \
  --name "$WEB_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --yes 2>/dev/null && echo "Deleted $WEB_APP" || echo "$WEB_APP not found or already deleted"

echo "Deleting $MQTT_APP..."
az containerapp delete \
  --name "$MQTT_APP" \
  --resource-group "$RESOURCE_GROUP" \
  --yes 2>/dev/null && echo "Deleted $MQTT_APP" || echo "$MQTT_APP not found or already deleted"

# ── Step 2: Delete Container Apps Environment ─────────────────
echo ""
echo "Step 2: Deleting container apps environment..."
az containerapp env delete \
  --name "$ENVIRONMENT" \
  --resource-group "$RESOURCE_GROUP" \
  --yes 2>/dev/null && echo "Deleted $ENVIRONMENT" || echo "$ENVIRONMENT not found or already deleted"

# ── Step 3: Delete Container Registry ─────────────────────────
echo ""
echo "Step 3: Deleting container registry..."
az acr delete \
  --name "$ACR_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --yes 2>/dev/null && echo "Deleted $ACR_NAME" || echo "$ACR_NAME not found or already deleted"

# ── Step 4: Old database server (optional) ────────────────────
echo ""
echo "Step 4: Old PostgreSQL server ($OLD_DB_SERVER)"
echo ""
echo "The old database server has NOT been deleted automatically."
echo "Keep it as a backup for at least 7 days after migration."
echo ""
echo "To delete it manually when ready:"
echo "  az postgres flexible-server delete \\"
echo "    --name $OLD_DB_SERVER \\"
echo "    --resource-group $RESOURCE_GROUP \\"
echo "    --yes"

# ── Step 5: Check remaining resources ─────────────────────────
echo ""
echo "Step 5: Remaining resources in $RESOURCE_GROUP:"
az resource list \
  --resource-group "$RESOURCE_GROUP" \
  --query "[].{name:name, type:type}" \
  --output table 2>/dev/null || echo "Resource group may be empty or deleted"

echo ""
echo "=== Teardown complete ==="
echo ""
echo "If the resource group is empty (except the old DB), you can delete it:"
echo "  az group delete --name $RESOURCE_GROUP --yes"
