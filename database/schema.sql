-- ============================================================
-- FleetOS PostgreSQL Schema
-- Works alongside Traccar's built-in schema
-- Configure Traccar to use PostgreSQL in traccar.xml
-- ============================================================

-- Traccar config (traccar.xml) snippet:
-- <entry key='database.driver'>org.postgresql.Driver</entry>
-- <entry key='database.url'>jdbc:postgresql://localhost:5432/traccar</entry>
-- <entry key='database.user'>traccar</entry>
-- <entry key='database.password'>your_password</entry>

-- 1. Create database & user
-- CREATE USER traccar WITH PASSWORD 'your_secure_password';
-- CREATE DATABASE traccar OWNER traccar;
-- GRANT ALL PRIVILEGES ON DATABASE traccar TO traccar;

-- ============================================================
-- FLEET EXTENSIONS (custom tables beyond Traccar defaults)
-- ============================================================

-- Fleet-level metadata for vehicles
CREATE TABLE IF NOT EXISTS fleet_vehicles (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL UNIQUE,   -- references tc_devices.id
  plate           VARCHAR(32),
  make            VARCHAR(64),
  model           VARCHAR(64),
  year            INTEGER,
  color           VARCHAR(32),
  fuel_type       VARCHAR(32) DEFAULT 'petrol',
  tank_capacity   NUMERIC(6,2),              -- liters
  assigned_driver VARCHAR(128),
  department      VARCHAR(128),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Daily mileage summaries (pre-computed for dashboards)
CREATE TABLE IF NOT EXISTS fleet_daily_summary (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL,
  summary_date    DATE NOT NULL,
  total_distance  NUMERIC(10,2) DEFAULT 0,   -- km
  total_trips     INTEGER DEFAULT 0,
  moving_duration INTEGER DEFAULT 0,          -- seconds
  idle_duration   INTEGER DEFAULT 0,          -- seconds
  max_speed       NUMERIC(6,2) DEFAULT 0,     -- km/h
  avg_speed       NUMERIC(6,2) DEFAULT 0,     -- km/h
  overspeed_count INTEGER DEFAULT 0,
  fuel_consumed   NUMERIC(8,2),               -- liters estimated
  first_seen      TIMESTAMPTZ,
  last_seen       TIMESTAMPTZ,
  UNIQUE (device_id, summary_date)
);

-- Trip records
CREATE TABLE IF NOT EXISTS fleet_trips (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  start_lat       NUMERIC(10,7),
  start_lon       NUMERIC(10,7),
  end_lat         NUMERIC(10,7),
  end_lon         NUMERIC(10,7),
  start_address   TEXT,
  end_address     TEXT,
  distance        NUMERIC(10,2),              -- km
  max_speed       NUMERIC(6,2),               -- km/h
  avg_speed       NUMERIC(6,2),               -- km/h
  duration        INTEGER,                    -- seconds
  idle_time       INTEGER,                    -- seconds
  driver_name     VARCHAR(128),
  score           INTEGER                     -- driver score 0-100
);

-- Geofences extended (Traccar has tc_geofences but we extend)
CREATE TABLE IF NOT EXISTS fleet_geofence_events (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL,
  geofence_id     INTEGER NOT NULL,
  geofence_name   VARCHAR(128),
  event_type      VARCHAR(16) NOT NULL,       -- 'enter' or 'exit'
  event_time      TIMESTAMPTZ NOT NULL,
  latitude        NUMERIC(10,7),
  longitude       NUMERIC(10,7),
  speed           NUMERIC(6,2)
);

-- Maintenance schedules
CREATE TABLE IF NOT EXISTS fleet_maintenance (
  id              SERIAL PRIMARY KEY,
  device_id       INTEGER NOT NULL,
  service_type    VARCHAR(128) NOT NULL,      -- 'oil_change', 'tire', etc.
  last_service_km NUMERIC(10,2),
  next_service_km NUMERIC(10,2),
  last_service_date DATE,
  next_service_date DATE,
  notes           TEXT,
  status          VARCHAR(32) DEFAULT 'ok'    -- 'ok', 'due_soon', 'overdue'
);

-- Driver performance scores
CREATE TABLE IF NOT EXISTS fleet_driver_scores (
  id              SERIAL PRIMARY KEY,
  driver_name     VARCHAR(128) NOT NULL,
  score_date      DATE NOT NULL,
  overall_score   INTEGER,                    -- 0-100
  speed_score     INTEGER,
  braking_score   INTEGER,
  idle_score      INTEGER,
  distance_km     NUMERIC(10,2),
  trips           INTEGER,
  UNIQUE (driver_name, score_date)
);

-- Alert configuration
CREATE TABLE IF NOT EXISTS fleet_alert_rules (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(128) NOT NULL,
  device_id       INTEGER,                    -- NULL = all devices
  alert_type      VARCHAR(64) NOT NULL,       -- 'overspeed', 'geofence', etc.
  threshold       NUMERIC(10,2),              -- speed limit, etc.
  enabled         BOOLEAN DEFAULT TRUE,
  notify_email    VARCHAR(256),
  notify_webhook  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fleet_daily_device_date ON fleet_daily_summary (device_id, summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_trips_device_time ON fleet_trips (device_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_geofence_device ON fleet_geofence_events (device_id, event_time DESC);

-- ============================================================
-- VIEWS (useful for dashboard queries)
-- ============================================================

-- Today's fleet overview
CREATE OR REPLACE VIEW v_fleet_today AS
SELECT
  d.device_id,
  d.plate,
  d.make,
  d.model,
  s.total_distance,
  s.total_trips,
  s.max_speed,
  s.avg_speed,
  s.overspeed_count,
  s.moving_duration / 3600.0 AS moving_hours
FROM fleet_vehicles d
LEFT JOIN fleet_daily_summary s
  ON d.device_id = s.device_id AND s.summary_date = CURRENT_DATE;

-- ============================================================
-- SAMPLE DATA (for testing without real devices)
-- ============================================================
INSERT INTO fleet_vehicles (device_id, plate, make, model, year, color, fuel_type, tank_capacity, assigned_driver, department)
VALUES
  (1, 'DXB-A-12345', 'Toyota', 'Land Cruiser', 2022, 'White', 'petrol', 93, 'Ahmed Al-Rashid', 'Operations'),
  (2, 'DXB-B-67890', 'Ford', 'F-150', 2023, 'Black', 'petrol', 98, 'Mohammed Khalil', 'Logistics'),
  (3, 'AUH-C-11111', 'Nissan', 'Patrol', 2021, 'Silver', 'petrol', 95, 'Sara Johnson', 'Management'),
  (4, 'DXB-D-22222', 'Mercedes', 'Sprinter', 2022, 'White', 'diesel', 75, 'Ravi Kumar', 'Delivery'),
  (5, 'SHJ-E-33333', 'Mitsubishi', 'L200', 2020, 'Blue', 'diesel', 75, 'Carlos Mendez', 'Field Ops')
ON CONFLICT (device_id) DO NOTHING;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Compute haversine distance between two points (km)
CREATE OR REPLACE FUNCTION haversine_km(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
DECLARE
  R FLOAT := 6371;
  dlat FLOAT;
  dlon FLOAT;
  a FLOAT;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  RETURN R * 2 * atan2(sqrt(a), sqrt(1-a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
