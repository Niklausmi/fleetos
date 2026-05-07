#!/bin/bash
# ============================================================
# FleetOS Stop / Reset Script
# Usage:
#   bash stop.sh         — stop containers (data kept)
#   bash stop.sh --reset — stop AND delete all data (fresh start)
# ============================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$1" == "--reset" ]; then
    echo -e "${RED}⚠ RESET: this will delete ALL fleet data, positions, and events.${NC}"
    read -p "Are you sure? Type YES to confirm: " CONFIRM
    if [ "$CONFIRM" != "YES" ]; then
        echo "Aborted."
        exit 0
    fi
    docker compose down -v
    echo -e "${GREEN}✓ All containers and volumes removed. Run ./start.sh for a fresh start.${NC}"
else
    docker compose down
    echo -e "${GREEN}✓ FleetOS stopped. Your data is safe. Run ./start.sh to restart.${NC}"
fi
