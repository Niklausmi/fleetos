#!/bin/bash
# ============================================================
# FleetOS Quick Start Script
# Usage: bash start.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}  ███████╗██╗     ███████╗███████╗████████╗ ██████╗ ███████╗${NC}"
echo -e "${CYAN}  ██╔════╝██║     ██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔════╝${NC}"
echo -e "${CYAN}  █████╗  ██║     █████╗  █████╗     ██║   ██║   ██║███████╗${NC}"
echo -e "${CYAN}  ██╔══╝  ██║     ██╔══╝  ██╔══╝     ██║   ██║   ██║╚════██║${NC}"
echo -e "${CYAN}  ██║     ███████╗███████╗███████╗   ██║   ╚██████╔╝███████║${NC}"
echo -e "${CYAN}  ╚═╝     ╚══════╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚══════╝${NC}"
echo ""
echo -e "  ${GREEN}Traccar Fleet Intelligence Platform${NC}"
echo ""

# ── Check Docker ────────────────────────────────────────────
echo -e "${YELLOW}[1/4]${NC} Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Install from: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi
if ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Install Docker Desktop or 'docker-compose-plugin'.${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"

# ── Setup .env ──────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/4]${NC} Setting up environment..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        # Generate a random password
        RAND_PASS=$(cat /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 20)
        sed -i "s/change_me_secure_password/${RAND_PASS}/" .env
        # Update traccar.xml with same password
        sed -i "s/YOUR_SECURE_PASSWORD_HERE/${RAND_PASS}/" config/traccar.xml
        echo -e "  ${GREEN}✓ Created .env with auto-generated password${NC}"
        echo -e "  ${CYAN}  Password: ${RAND_PASS}${NC}"
    else
        echo -e "${RED}✗ .env.example not found. Are you in the fleetos/ directory?${NC}"
        exit 1
    fi
else
    echo -e "  ${GREEN}✓ .env already exists${NC}"
fi

# ── Launch ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/4]${NC} Launching FleetOS stack..."
docker compose pull --quiet
docker compose up -d

# ── Wait for Traccar ────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/4]${NC} Waiting for Traccar to start..."
TRIES=0
MAX=30
while [ $TRIES -lt $MAX ]; do
    if curl -s http://localhost:8082/api/server > /dev/null 2>&1; then
        break
    fi
    printf "."
    sleep 2
    TRIES=$((TRIES+1))
done
echo ""

if [ $TRIES -ge $MAX ]; then
    echo -e "${YELLOW}⚠ Traccar is taking longer than expected. Check: docker compose logs traccar${NC}"
else
    echo -e "  ${GREEN}✓ Traccar is ready!${NC}"
fi

# ── Done ────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          FleetOS is running! 🚀           ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  Web UI     →  ${CYAN}http://localhost:3000${NC}      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Traccar    →  ${CYAN}http://localhost:8082${NC}      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  pgAdmin    →  ${CYAN}http://localhost:5050${NC}      ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Setup docs →  ${CYAN}docs/setup-guide.html${NC}      ${GREEN}║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  ${YELLOW}First run:${NC} open Traccar at :8082,       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  register an account, then log in       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  to FleetOS at :3000 with same creds.  ${GREEN}║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
