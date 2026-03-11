#!/bin/bash
# Publish a firmware binary to Azure Blob Storage and update the manifest.
#
# Usage: ./scripts/publish-firmware.sh <sku> <version> [channel]
#   sku:     e.g. scan-station, shelf-station
#   version: e.g. 1.0.3
#   channel: stable (default), beta, dev
#
# Expects the binary at: firmware/<sku>/.pio/build/scan_station/firmware.bin
# Uploads to: https://fillaiqfw.blob.core.windows.net/firmware/<sku>-<version>.bin

set -euo pipefail

SKU="${1:?Usage: $0 <sku> <version> [channel]}"
VERSION="${2:?Usage: $0 <sku> <version> [channel]}"
CHANNEL="${3:-stable}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_PATH="$REPO_ROOT/firmware/$SKU/.pio/build/scan_station/firmware.bin"
BLOB_NAME="$SKU-$VERSION.bin"
MANIFEST="$REPO_ROOT/web/public/firmware/manifest.json"

STORAGE_ACCOUNT="fillaiqfw"
CONTAINER="firmware"

if [ ! -f "$BIN_PATH" ]; then
    echo "Error: Binary not found at $BIN_PATH"
    echo "Build first: cd firmware/$SKU && pio run -e scan_station"
    exit 1
fi

# Get MD5 and size
MD5=$(md5 -q "$BIN_PATH")
SIZE=$(wc -c < "$BIN_PATH" | tr -d ' ')
DATE=$(date +%Y-%m-%d)

echo "Publishing $SKU v$VERSION to $CHANNEL channel"
echo "  Binary: $BIN_PATH"
echo "  Size:   $SIZE bytes"
echo "  MD5:    $MD5"
echo "  Blob:   $BLOB_NAME"
echo ""

# Upload to blob storage
echo "Uploading to Azure Blob Storage..."
az storage blob upload \
    --account-name "$STORAGE_ACCOUNT" \
    --container-name "$CONTAINER" \
    --name "$BLOB_NAME" \
    --file "$BIN_PATH" \
    --overwrite \
    --only-show-errors

# Verify upload
echo "Verifying upload..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER/$BLOB_NAME")
if [ "$HTTP_CODE" != "200" ]; then
    echo "Error: Upload verification failed (HTTP $HTTP_CODE)"
    exit 1
fi

echo "Upload verified (HTTP $HTTP_CODE)"
echo ""
echo "Blob URL: https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER/$BLOB_NAME"
echo ""
echo "Update the manifest at: $MANIFEST"
echo "  version: $VERSION"
echo "  file:    $BLOB_NAME"
echo "  md5:     $MD5"
echo "  size:    $SIZE"
echo "  date:    $DATE"
echo "  channel: $CHANNEL"
echo ""
echo "Then commit and push to deploy."
