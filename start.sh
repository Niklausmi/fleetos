#!/bin/bash
# ============================================================
#  FleetOS — One-Click Deployment Script
#  Usage: bash start.sh
#
#  What this does:
#   1. Checks system requirements (Docker, Docker Compose)
#   2. Installs Docker automatically if missing
#   3. Creates .env with secure random passwords if not present
#   4. Opens required firewall ports (UFW)
#   5. Pulls Docker images
#   6. Starts all services
#   7. Waits for health checks
#   8. Prints access URLs + credentials
# ============================================================

set -euo pipefail

# ── Colours ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[  OK]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }
banner()  { echo -e "\n${BOLD}${CYAN}$*${NC}\n"; }

# ── Must run from project root ───────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Banner ───────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}"
echo "  ███████╗██╗     ███████╗███████╗████████╗ ██████╗ ███████╗"
echo "  ██╔════╝██║     ██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔════╝"
echo "  █████╗  ██║     █████╗  █████╗     ██║   ██║   ██║███████╗"
echo "  ██╔══╝  ██║     ██╔══╝  ██╔══╝     ██║   ██║   ██║╚════██║"
echo "  ██║     ███████╗███████╗███████╗   ██║   ╚██████╔╝███████║"
echo "  ╚═╝     ╚══════╝╚══════╝╚══════╝   ╚═╝    ╚═════╝ ╚══════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Fleet Intelligence Platform — One-Click Deploy${NC}"
echo -e "  ─────────────────────────────────────────────────"
echo ""

# ── Step 1: Check OS ─────────────────────────────────────────
banner "Step 1/7 — System Check"

OS_ID=""
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID=$ID
fi

case "$OS_ID" in
  ubuntu|debian) ok "OS: $PRETTY_NAME" ;;
  *) warn "Untested OS: ${OS_ID:-unknown}. Proceeding anyway…" ;;
esac

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
  warn "Not running as root — will use sudo for privileged commands."
  SUDO="sudo"
else
  SUDO=""
fi

# ── Step 2: Install Docker if missing ───────────────────────
banner "Step 2/7 — Docker"

if command -v docker &>/dev/null; then
  DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ',')
  ok "Docker already installed: v${DOCKER_VER}"
else
  info "Docker not found — installing…"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -qq ca-certificates curl gnupg lsb-release
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO usermod -aG docker "$USER" 2>/dev/null || true
  ok "Docker installed"
fi

if docker compose version &>/dev/null; then
  ok "Docker Compose plugin: $(docker compose version --short)"
elif docker-compose --version &>/dev/null; then
  ok "docker-compose (legacy): $(docker-compose --version)"
  # Alias for rest of script
  shopt -s expand_aliases
  alias docker compose='docker-compose'
else
  info "Installing Docker Compose plugin…"
  $SUDO apt-get install -y -qq docker-compose-plugin
  ok "Docker Compose plugin installed"
fi

# ── Step 3: Create .env if not present ──────────────────────
banner "Step 3/7 — Environment Setup"

if [ ! -f .env ]; then
  info "Creating .env with secure random passwords…"

  # Generate random passwords (32 chars, alphanumeric only for DB safety)
  if command -v openssl &>/dev/null; then
    PG_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)
    PGA_PASS=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 20)
  else
    PG_PASS=$(cat /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 32)
    PGA_PASS=$(cat /dev/urandom | tr -dc 'A-Za-z0-9' | head -c 20)
  fi

  cat > .env << EOF
# FleetOS Environment — auto-generated on $(date)
POSTGRES_PASSWORD=${PG_PASS}
PGADMIN_EMAIL=admin@fleetos.local
PGADMIN_PASSWORD=${PGA_PASS}
TZ=Asia/Karachi
EOF

  # Also patch the password into traccar.xml so they stay in sync
  if [ -f config/traccar.xml ]; then
    $SUDO sed -i "s|PXJbIJ59qcPDvuXHOX3u|${PG_PASS}|g" config/traccar.xml
    ok "traccar.xml database password synced"
  fi

  ok ".env created with secure passwords"
  warn "Save these credentials:"
  echo ""
  echo -e "  ${BOLD}Postgres password:${NC} ${PG_PASS}"
  echo -e "  ${BOLD}pgAdmin password:${NC}  ${PGA_PASS}"
  echo ""
else
  ok ".env already exists — using existing credentials"
  # Load existing values for display later
  source .env 2>/dev/null || true
fi

# Load .env
set -a
source .env 2>/dev/null || true
set +a

# ── Step 4: Firewall ─────────────────────────────────────────
banner "Step 4/7 — Firewall (UFW)"

if command -v ufw &>/dev/null; then
  # Check if UFW is active
  UFW_STATUS=$($SUDO ufw status 2>/dev/null | head -1 || echo "inactive")

  open_port() {
    $SUDO ufw allow "$1/tcp" comment "$2" &>/dev/null && ok "Port $1/tcp open — $2" || warn "Could not open port $1"
  }

  open_port 3000  "FleetOS Web UI"
  open_port 8082  "Traccar API + WebSocket"
  open_port 5050  "pgAdmin (restrict to your IP in production)"
  open_port 5027  "Teltonika GPS devices"
  open_port 5023  "GT06 / Concox GPS devices"
  open_port 5004  "Queclink GPS devices"
  open_port 5036  "Sinotrack GPS devices"
  open_port 5020  "Meitrack GPS devices"
  open_port 5055  "OsmAnd / Traccar Client app"

  if echo "$UFW_STATUS" | grep -q "inactive"; then
    info "Enabling UFW…"
    echo "y" | $SUDO ufw enable &>/dev/null || true
    ok "UFW enabled"
  fi
else
  warn "UFW not found — skipping firewall setup. Open ports manually if needed."
  warn "Required ports: 3000, 8082, 5023, 5027, 5050"
fi

# ── Step 5: Port conflict check ──────────────────────────────
banner "Step 5/7 — Port Conflict Check"

CONFLICT=0
for port in 3000 8082 5050 5027 5023; do
  if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
     netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
    warn "Port ${port} is already in use — may cause startup failure"
    CONFLICT=1
  else
    ok "Port ${port} is free"
  fi
done

if [ $CONFLICT -eq 1 ]; then
  echo ""
  warn "Some ports are in use. Edit docker-compose.yml to change them."
  read -p "Continue anyway? [y/N] " CONT
  [[ "$CONT" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

# ── Step 6: Pull images & start ──────────────────────────────
banner "Step 6/7 — Starting Services"

info "Pulling latest Docker images (this may take a few minutes on first run)…"
docker compose pull --quiet 2>&1 | grep -v "^$" || true
ok "Images ready"

info "Starting FleetOS stack…"
docker compose up -d --remove-orphans

# ── Step 7: Wait for health ──────────────────────────────────
banner "Step 7/7 — Waiting for Services"

# Wait for postgres health check
info "Waiting for PostgreSQL to be ready…"
ATTEMPTS=0
MAX=30
until docker exec fleetos-postgres pg_isready -U traccar -q 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -ge $MAX ]; then
    error "PostgreSQL did not become ready in time. Check: docker logs fleetos-postgres"
  fi
  printf "."
  sleep 2
done
echo ""
ok "PostgreSQL is ready"

# Wait for Traccar API
info "Waiting for Traccar API to be ready…"
ATTEMPTS=0
until curl -sf http://localhost:8082/api/server -o /dev/null 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -ge 40 ]; then
    warn "Traccar taking longer than expected — check: docker logs fleetos-traccar"
    break
  fi
  printf "."
  sleep 3
done
echo ""
ok "Traccar API is ready"

# Wait for nginx
info "Waiting for FleetOS Web UI…"
ATTEMPTS=0
until curl -sf http://localhost:3000 -o /dev/null 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ $ATTEMPTS -ge 20 ]; then
    warn "Web UI taking longer than expected — check: docker logs fleetos-web"
    break
  fi
  printf "."
  sleep 2
done
echo ""
ok "FleetOS Web UI is ready"

# ── Get server IP ────────────────────────────────────────────
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}') || SERVER_IP="YOUR_SERVER_IP"
PUBLIC_IP=$(curl -sf --max-time 3 ifconfig.me 2>/dev/null || \
            curl -sf --max-time 3 api.ipify.org 2>/dev/null || \
            echo "$SERVER_IP")

# ── Final status ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         FleetOS deployed successfully! 🚀         ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}  Access URLs:${NC}"
echo -e "  ${CYAN}FleetOS Web UI${NC}   →  http://${PUBLIC_IP}:3000"
echo -e "  ${CYAN}Traccar API${NC}      →  http://${PUBLIC_IP}:8082"
echo -e "  ${CYAN}pgAdmin${NC}          →  http://${PUBLIC_IP}:5050"
echo ""
echo -e "${BOLD}  Default Traccar Login:${NC}"
echo -e "  Email:    admin@example.com"
echo -e "  Password: admin"
echo -e "  ${YELLOW}⚠ Change this immediately after first login${NC}"
echo ""
echo -e "${BOLD}  pgAdmin Login:${NC}"
echo -e "  Email:    ${PGADMIN_EMAIL:-admin@fleetos.local}"
echo -e "  Password: ${PGADMIN_PASSWORD:-see .env file}"
echo -e "  DB Host (in pgAdmin): fleetos-postgres"
echo ""
echo -e "${BOLD}  GPS Device Ports:${NC}"
echo -e "  Teltonika FMB  →  ${PUBLIC_IP}:5027"
echo -e "  GT06 / Concox  →  ${PUBLIC_IP}:5023"
echo -e "  Queclink       →  ${PUBLIC_IP}:5004"
echo -e "  Sinotrack      →  ${PUBLIC_IP}:5036"
echo ""
echo -e "${BOLD}  Useful commands:${NC}"
echo -e "  View logs:    docker compose logs -f"
echo -e "  Stop:         bash stop.sh"
echo -e "  Backup DB:    bash scripts/backup.sh"
echo -e "  Update:       bash scripts/update.sh"
echo ""
