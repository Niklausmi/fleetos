# FleetOS — Complete Fleet Management Platform

> A full-stack GPS fleet management solution built on [Traccar](https://traccar.org) with a modern glassmorphism UI, PostgreSQL database, and React Native mobile app.

---

## What's Included

```
fleetos/
├── web/                        ← Modular frontend (HTML + CSS + JS)
│   ├── index.html              ← App shell & navigation
│   ├── css/
│   │   ├── base.css            ← Variables, reset, typography
│   │   ├── layout.css          ← Sidebar, login, app shell
│   │   ├── components.css      ← Buttons, cards, modals, tables
│   │   └── views.css           ← Page-specific layouts
│   ├── js/
│   │   ├── api.js              ← All Traccar REST API calls
│   │   ├── state.js            ← Reactive global state store
│   │   ├── auth.js             ← Login / logout / auto-login
│   │   ├── ui.js               ← Modal, Toast, Fmt helpers
│   │   ├── views.js            ← View router
│   │   ├── map.js              ← Leaflet map utilities
│   │   ├── websocket.js        ← Live WebSocket connection
│   │   └── app.js              ← Bootstrap & wiring
│   └── pages/
│       ├── dashboard.js        ← Live map + device sidebar
│       ├── events.js           ← Event monitor + vehicle popup
│       ├── playback.js         ← History playback + timeline
│       ├── reports.js          ← Summary / Trips / Stops / Events
│       ├── devices.js          ← Device CRUD + commands
│       ├── geofences.js        ← Zone drawing + management
│       ├── notifications.js    ← Alert rule configuration
│       ├── users.js            ← User management + permissions
│       ├── drivers.js          ← Driver/customer profiles
│       └── settings.js         ← Server & app settings
│
├── mobile/
│   ├── App.tsx                 ← Full React Native app (iOS + Android)
│   ├── package.json            ← Dependencies list
│   └── android-maps-key.xml   ← Google Maps API key snippet
│
├── database/
│   └── schema.sql              ← PostgreSQL schema + fleet extensions
│
├── config/
│   └── traccar.xml             ← Traccar server configuration
│
├── docs/
│   └── setup-guide.html        ← Interactive step-by-step guide
│
├── docker-compose.yml          ← Full stack: Postgres+Traccar+Web+pgAdmin
├── nginx.conf                  ← Reverse proxy + WebSocket support
├── start.sh                    ← One-command launcher
├── stop.sh                     ← Stop / full reset
├── .env.example                ← Environment variables template
└── .gitignore
```

---

## Features

### 🗺️ Live Map (dashboard.js)
- Real-time vehicle positions via WebSocket
- Color-coded markers: 🟢 Online / 🟡 Idle / 🔴 Offline
- Vehicle trail lines showing recent path
- Live stats: total online / idle / offline
- Speed tooltips on hover
- Fit-all / zoom controls
- Map style switcher: Dark → Satellite → Streets

### 🔔 Events Monitor (events.js)
- Live event feed from Traccar WebSocket
- 17 event types with icons and color coding
- Filter by event type and device
- Click any event → side panel shows:
  - Mini-map with vehicle location
  - Speed, ignition state, battery voltage
  - KM traveled today (with progress bar)
  - GPS coordinates + address
  - Device info & timestamp

### ⏮️ History Playback (playback.js)
- Select any device + date
- Load full GPS route from Traccar API
- Animated vehicle marker along the track
- Click-to-seek timeline scrubber
- Speed: 1× 2× 5× 10× 20×
- Stats: total distance, max speed, duration
- Start 🚦 and end 🏁 markers

### 📊 Reports (reports.js)
Four real report tabs using Traccar `/reports/*` API:

| Tab | API | Shows |
|-----|-----|-------|
| Summary | `/reports/summary` | KPIs per vehicle + charts |
| Trips | `/reports/trips` | All trips with distance, speeds, idle |
| Stops | `/reports/stops` | Parking events with address + duration |
| Events | `/reports/events` | Event counts by type + full log |

### 📡 Device Management (devices.js)
- Full table with live speed + last-seen
- Add / Edit / Delete via Traccar API
- Send over-the-air commands (engine stop, position, custom)
- Click → focus on live map
- Fields: name, IMEI, phone, category, group, model

### 📐 Zones / Geofences (geofences.js)
- Draw **circles** or **polygons** directly on the map
- Undo points during drawing
- Color picker per zone
- Full CRUD via Traccar `/geofences` API
- Zones rendered live on map with fill colors

### ⚡ Alert Rules (notifications.js)
- 17 configurable event types
- Apply to all devices, specific device, or group
- Optional geofence filter
- 6 notification channels: Web, Email, SMS, Telegram, Firebase, Pushover
- Enable/disable toggle per rule

### 👥 Users (users.js)
- Full CRUD via Traccar `/users` API
- Role flags: Administrator, Manager, Read Only, Disabled, Limit Commands
- Device limit + expiration date
- Permission assignment: link specific devices / groups / geofences per user

### 🧑‍✈️ Drivers / Customers (drivers.js)
- Driver profile cards with photo initials
- Driver score with color-coded bar (green/yellow/red)
- Fields: phone, email, license, vehicle, department, notes
- Performance metrics panel
- Full CRUD via Traccar `/drivers` API

### ⚙️ Settings (settings.js)
- Server URL display + WebSocket toggle
- Map style preference
- Account info with avatar
- Change password
- Server-level config (admin only): registration, readonly mode, default map center

---

## Quick Start

### Docker (Recommended — ~5 minutes)

```bash
# 1. Unzip and enter folder
unzip fleetos-complete.zip && cd fleetos

# 2. Launch everything (auto-generates password)
bash start.sh

# 3. Create your admin account at:
#    http://localhost:8082  → Register (first account = admin)

# 4. Open FleetOS:
#    http://localhost:3000  → log in with same credentials

# 5. Database manager (optional):
#    http://localhost:5050  → pgAdmin
```

### Manual

```bash
# PostgreSQL
sudo -u postgres psql -c "CREATE USER traccar WITH PASSWORD 'pass';"
sudo -u postgres psql -c "CREATE DATABASE traccar OWNER traccar;"
psql -U traccar -d traccar -f database/schema.sql

# Traccar
sudo cp config/traccar.xml /opt/traccar/conf/traccar.xml
sudo systemctl start traccar

# Web UI (any static server)
cd web && npx serve .
# → open http://localhost:3000
```

---

## Connecting GPS Devices

| Brand / Protocol | Port | Example Devices |
|---|---|---|
| GT06 / Concox | 5023 | GT06N, JM-LL301 |
| Teltonika | 5027 | FMB920, FMB140, FMC003 |
| Queclink | 5004 | GV300, GV500 |
| Sinotrack | 5036 | ST-901, ST-906 |
| Meitrack | 5020 | T399, MT90 |
| OsmAnd / Traccar Client | 5055 | Mobile phone |
| Generic NMEA | 10000 | Any NMEA 0183 |

**SMS config examples:**

```
# GT06/Concox
SERVER,0,YOUR_IP,5023,0#

# Sinotrack
804admin YOUR_IP 5036

# Teltonika — use Configurator app
GPRS → Server IP: YOUR_IP, Port: 5027
```

---

## Mobile App Setup

```bash
cd mobile

# 1. Init React Native project
npx react-native init FleetOSMobile --template react-native-template-typescript
cd FleetOSMobile

# 2. Install dependencies (see package.json)
npm install @react-navigation/native @react-navigation/bottom-tabs \
  @react-navigation/stack react-native-maps \
  @react-native-async-storage/async-storage \
  react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated

# 3. Copy app
cp ../App.tsx ./App.tsx

# 4. Add Google Maps key for Android
#    See: android-maps-key.xml for where to paste it
#    Get key: console.cloud.google.com → Maps SDK for Android

# 5. Run
# iOS:
cd ios && pod install && cd ..
npx react-native run-ios

# Android:
npx react-native run-android
```

> ⚠️ On mobile, use your machine's LAN IP (e.g. `http://192.168.1.100:8082`), not `localhost`.

---

## PostgreSQL Schema

Traccar's built-in tables (`tc_*`) are created automatically.
Additional fleet tables added by `database/schema.sql`:

| Table | Purpose |
|---|---|
| `fleet_vehicles` | Vehicle metadata: plate, make, model, driver |
| `fleet_daily_summary` | Pre-computed daily stats per device |
| `fleet_trips` | Trip records with start/end address |
| `fleet_geofence_events` | Geofence enter/exit log |
| `fleet_maintenance` | Service schedule per vehicle |
| `fleet_driver_scores` | Daily driver behavior scoring |
| `fleet_alert_rules` | Custom alert configuration |

---

## Architecture

```
GPS Devices (5023, 5027, 5036…)
        │
        ▼
┌─────────────────────────────────┐
│   Traccar Server :8082          │
│   Java · REST API · WebSocket   │
│   200+ GPS protocols supported  │
└──────────────┬──────────────────┘
               │ JDBC
        ┌──────▼──────┐
        │ PostgreSQL  │
        │   :5432     │
        └──────┬──────┘
               │
     ┌─────────┴─────────┐
     │                   │
┌────▼────┐         ┌────▼────────┐
│FleetOS  │         │ FleetOS     │
│Web UI   │         │ Mobile App  │
│:3000    │         │ iOS/Android │
└─────────┘         └─────────────┘
```

---

## Production Checklist

- [ ] Change default passwords in `.env` and `traccar.xml`
- [ ] Enable HTTPS (use Caddy: `caddy reverse-proxy --from yourdomain.com --to localhost:3000`)
- [ ] Set `web.origin` in `traccar.xml` to your actual domain
- [ ] Configure SMTP in `traccar.xml` for email alerts
- [ ] Set up PostgreSQL automated backups (`pg_dump`)
- [ ] Configure log rotation
- [ ] Set `deviceLimit` per user to control access

---

## License

Apache 2.0 — same as Traccar open source.
