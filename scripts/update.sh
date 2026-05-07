#!/bin/bash
# ============================================================
# FleetOS — Update Script
# Pulls latest Traccar image and restarts
# Usage: bash scripts/update.sh
# ============================================================

set -e

echo "🔄 Pulling latest Traccar image..."
docker compose pull traccar

echo "♻️  Restarting Traccar..."
docker compose up -d traccar

echo "✓ Update complete. Traccar is restarting..."
docker compose logs -f traccar --tail=20
