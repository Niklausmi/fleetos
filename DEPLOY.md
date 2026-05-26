# FleetOS — Linux Server Deployment Guide

> **Environment:** Ubuntu 22.04 LTS (also works on 20.04 / Debian 12)
> **Assumption:** Another PostgreSQL instance is already running on port **5432**

---

## 1. Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

---

## 2. Clone the Project

```bash
cd /opt
sudo git clone https://github.com/Niklausmi/fleetos.git
sudo chown -R $USER:$USER /opt/fleetos
cd /opt/fleetos
```

---

## 3. PostgreSQL — Zero Port Conflict

FleetOS Postgres has **no `ports:` block** — it is completely invisible to the
host machine. It only exists on the internal Docker `fleetos-net` network.

```
Your existing Postgres:   host:5432          ← completely untouched
FleetOS Postgres:         no host port at all ← zero conflict
Traccar connects via:     fleetos-postgres:5432  (Docker internal DNS)
```

No changes needed. Just deploy and it works alongside any existing Postgres.

**To manage the database via pgAdmin** (add a new server in pgAdmin UI):
```
Host:     fleetos-postgres
Port:     5432
Username: traccar
Password: (your POSTGRES_PASSWORD from .env)
Database: traccar
```
pgAdmin runs inside the same Docker network so it resolves the container
name directly — no host port needed.

---

## 4. Set Environment Variables

Create a `.env` file so secrets aren't hardcoded:

```bash
cat > /opt/fleetos/.env << 'EOF'
POSTGRES_PASSWORD=YourStrongPasswordHere
PGADMIN_PASSWORD=YourPgAdminPassword
TZ=Asia/Karachi
EOF
chmod 600 /opt/fleetos/.env
```

---

## 5. Open Firewall Ports

### 5a. UFW (Ubuntu default firewall)

```bash
# Web interfaces
sudo ufw allow 3000/tcp   comment 'FleetOS Web UI'
sudo ufw allow 8082/tcp   comment 'Traccar API'
sudo ufw allow 5050/tcp   comment 'pgAdmin (restrict this later)'

# ── GPS DEVICE PORTS ──────────────────────────────────────
# Teltonika FMB series (FMB920, FMB140, FMB003, etc.)
sudo ufw allow 5027/tcp   comment 'Teltonika protocol'

# GT06 / Concox / Coban TK-series
sudo ufw allow 5023/tcp   comment 'GT06 / Concox protocol'

# Queclink GV-series
sudo ufw allow 5004/tcp   comment 'Queclink GL200 protocol'

# Sinotrack ST-901 / ST-906
sudo ufw allow 5036/tcp   comment 'Sinotrack protocol'

# Meitrack
sudo ufw allow 5020/tcp   comment 'Meitrack protocol'

# OsmAnd mobile app / Traccar Client app
sudo ufw allow 5055/tcp   comment 'OsmAnd / Traccar Client'

# Enable and verify
sudo ufw enable
sudo ufw status verbose
```

### 5b. Cloud provider security groups (AWS / DigitalOcean / Hetzner / Azure)

If you're on a cloud VPS, also open these **Inbound TCP** rules in your
provider's control panel / security group:

| Port  | Protocol | Source      | Purpose                       |
|-------|----------|-------------|-------------------------------|
| 3000  | TCP      | 0.0.0.0/0   | FleetOS Web UI                |
| 8082  | TCP      | 0.0.0.0/0   | Traccar REST API + WebSocket  |
| 5027  | TCP      | 0.0.0.0/0   | **Teltonika devices**         |
| 5023  | TCP      | 0.0.0.0/0   | **GT06 / Concox devices**     |
| 5004  | TCP      | 0.0.0.0/0   | Queclink devices              |
| 5036  | TCP      | 0.0.0.0/0   | Sinotrack devices             |
| 5020  | TCP      | 0.0.0.0/0   | Meitrack devices              |
| 5055  | TCP      | 0.0.0.0/0   | OsmAnd / Traccar mobile app   |
| 5050  | TCP      | your IP only | pgAdmin (admin only)          |

> **Security tip:** Keep pgAdmin (5050) restricted to
> your own IP only. Never expose them to 0.0.0.0/0.

### 5c. Device Configuration

Program each GPS device with:

**Teltonika FMB series:**
```
Server IP:   YOUR_SERVER_IP
Server Port: 5027
Protocol:    TCP
```

**GT06 / Concox:**
```
SERVER,1,YOUR_SERVER_IP,5023,0#
```
Send as SMS to the device SIM, or via device configuration software.

---

## 6. Configure Traccar for Your Domain / IP

Edit `config/traccar.xml`:

```bash
nano /opt/fleetos/config/traccar.xml
```

Update the CORS origin to your actual server IP or domain:
```xml
<!-- Allow FleetOS frontend (change to your domain in production) -->
<entry key='web.origin'>http://YOUR_SERVER_IP:3000</entry>
```

Update email settings if you want email alerts:
```xml
<entry key='mail.smtp.host'>smtp.gmail.com</entry>
<entry key='mail.smtp.port'>587</entry>
<entry key='mail.smtp.from'>your-fleet@gmail.com</entry>
<entry key='mail.smtp.username'>your-fleet@gmail.com</entry>
<entry key='mail.smtp.password'>YOUR_GMAIL_APP_PASSWORD</entry>
```

> For Gmail: enable 2FA → Google Account → Security → App Passwords →
> generate a 16-character app password.

---

## 7. Start the Stack

```bash
cd /opt/fleetos

# Pull images first
docker compose pull

# Start all services in background
docker compose up -d

# Watch startup logs
docker compose logs -f --tail=50
```

Wait about 30–60 seconds for Traccar to initialize the database schema.

---

## 8. Verify Everything is Running

```bash
# Check all containers are Up
docker compose ps

# Expected output:
# fleetos-postgres   running (healthy)
# fleetos-traccar    running
# fleetos-web        running
# fleetos-pgadmin    running
```

Test each endpoint from your browser:
```
http://YOUR_SERVER_IP:3000     → FleetOS Web UI
http://YOUR_SERVER_IP:8082     → Traccar API (should return JSON)
http://YOUR_SERVER_IP:5050     → pgAdmin
```

Test Traccar API directly:
```bash
curl -s http://localhost:8082/api/server | python3 -m json.tool
```

---

## 9. Update FleetOS Web UI Server URL

Open the FleetOS web UI at `http://YOUR_SERVER_IP:3000` and on the login screen
set the Server URL to:
```
http://YOUR_SERVER_IP:8082
```

Or hardcode it in `web/index.html` so users don't need to type it:
```bash
nano /opt/fleetos/web/index.html
```
Change:
```html
<input type="text" id="login-server" value="http://localhost:8082" ...>
```
To:
```html
<input type="text" id="login-server" value="http://YOUR_SERVER_IP:8082" ...>
```

---

## 10. HTTPS Setup with Nginx + Let's Encrypt (Recommended)

If you have a domain name, add SSL so devices can connect securely:

```bash
# Install Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d fleetos.yourdomain.com

# Create Nginx reverse proxy config
sudo nano /etc/nginx/sites-available/fleetos
```

Paste:
```nginx
server {
    listen 80;
    server_name fleetos.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name fleetos.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/fleetos.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fleetos.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # FleetOS Web UI
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Traccar API + WebSocket
    location /api/ {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fleetos /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Then update `traccar.xml` CORS:
```xml
<entry key='web.origin'>https://fleetos.yourdomain.com</entry>
```

And update `web/index.html` server URL default to:
```
https://fleetos.yourdomain.com/api
```

---

## 11. Auto-start on Server Reboot

Docker containers are set to `restart: unless-stopped` which handles this
automatically after:
```bash
sudo systemctl enable docker
```

---

## 12. Maintenance Commands

```bash
# View live logs
docker compose logs -f traccar
docker compose logs -f postgres

# Restart a single service
docker compose restart traccar

# Stop everything
docker compose down

# Stop and wipe all data (destructive!)
docker compose down -v

# Update Traccar to latest version
docker compose pull traccar
docker compose up -d traccar

# Backup the database
docker exec fleetos-postgres pg_dump -U traccar traccar > backup_$(date +%Y%m%d).sql

# Restore a backup
cat backup_20260525.sql | docker exec -i fleetos-postgres psql -U traccar traccar
```

---

## 13. Troubleshooting

**Traccar won't start — database connection refused:**
```bash
docker compose logs traccar | grep -i "error\|exception\|failed"
# Usually means postgres isn't ready yet — wait 30s and try:
docker compose restart traccar
```

**Devices not connecting on port 5027/5023:**
```bash
# Verify port is actually listening
sudo ss -tlnp | grep '5027\|5023'

# Test TCP reachability from another machine
nc -zv YOUR_SERVER_IP 5027

# Check Traccar is receiving data
docker compose logs traccar | grep -i "teltonika\|gt06\|connected"
```

**FleetOS UI shows CORS error:**
```bash
# Update traccar.xml web.origin to match your actual frontend URL
nano /opt/fleetos/config/traccar.xml
docker compose restart traccar
```

---

## Quick Reference — All Ports

| Port | Service | Exposed to |
|------|---------|-----------|
| 3000 | FleetOS Web UI (Nginx) | Public |
| 8082 | Traccar API + WS | Public |
| **5027** | **Teltonika TCP** | **Public — GPS devices** |
| **5023** | **GT06 / Concox TCP** | **Public — GPS devices** |
| 5004 | Queclink TCP | Public — GPS devices |
| 5036 | Sinotrack TCP | Public — GPS devices |
| 5020 | Meitrack TCP | Public — GPS devices |
| 5055 | OsmAnd / Traccar App | Public — GPS devices |
| 5433 | PostgreSQL (host) | Restrict to admin IP |
| 5050 | pgAdmin | Restrict to admin IP |

