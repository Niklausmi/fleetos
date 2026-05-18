/* ═══════════════════════════════════════════
   map.js — Shared Leaflet map utilities
═══════════════════════════════════════════ */
const MapUtil = (() => {
  const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const TILE_SAT  = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const TILE_LITE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const TILE_OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  function createMap(elId, opts = {}) {
    const m = L.map(elId, { zoomControl: false, attributionControl: false, ...opts });
    L.tileLayer(TILE_DARK, { maxZoom: 19 }).addTo(m);
    return m;
  }

 

// Update your setStyle mapping
function setStyle(map, style) {
  const tiles = { 
    dark: TILE_DARK, 
    satellite: TILE_SAT, 
    streets: TILE_OSM, // Use OSM for "streets" instead of Lite
    lite: TILE_LITE 
  };
  
  map.eachLayer(l => { if (l instanceof L.TileLayer) map.removeLayer(l); });
  
  L.tileLayer(tiles[style] || TILE_OSM, { 
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

  function deviceIcon(status, category = 'car', heading = 0) {
    const emoji = { truck: '🚛', bus: '🚌', motorcycle: '🏍️', bicycle: '🚲', boat: '⛵', plane: '✈️', car: '🚗' }[category] || '🚗';
    const color = status === 'online' ? 'var(--online)' : status === 'idle' ? 'var(--idle)' : 'var(--offline)';
    return L.divIcon({
      className: '',
      html: `<div style="
        width:34px;height:34px;border-radius:50%;
        background:${color}22;border:2px solid ${color};
        display:flex;align-items:center;justify-content:center;
        font-size:14px;box-shadow:0 0 10px ${color}55;
        transform:rotate(${heading}deg);
      ">${emoji}</div>`,
      iconSize: [34, 34], iconAnchor: [17, 17],
    });
  }

  function pinIcon(color = '#00E5C3', emoji = '📍') {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:${color}22;border:2px solid ${color};
        display:flex;align-items:center;justify-content:center;font-size:14px;
      ">${emoji}</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16],
    });
  }

  function fitMarkers(map, positions, padding = [50, 50]) {
    const pts = Object.values(positions).filter(p => p?.latitude).map(p => [p.latitude, p.longitude]);
    if (pts.length > 0) {
      try { map.fitBounds(pts, { padding }); } catch {}
    }
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return { createMap, setStyle, deviceIcon, pinIcon, fitMarkers, haversineKm };
})();

/* ── LIVE MAP MANAGER (dashboard) ────── */
const LiveMap = (() => {
  let _map = null;
  let _markers = {};
  let _trails = {};
  const TRAIL_LEN = 20;

  function init(elId) {
    _map = MapUtil.createMap(elId);
    _map.setView([25, 55], 5);
    return _map;
  }

  function getMap() { return _map; }

  function update(devices, positions) {
    devices.forEach(d => {
      const p = positions[d.id];
      if (!p?.latitude) return;
      const latlng = [p.latitude, p.longitude];
      const icon = MapUtil.deviceIcon(d.status, d.category, p.course);
      if (_markers[d.id]) {
        _markers[d.id].setLatLng(latlng).setIcon(icon);
      } else {
        _markers[d.id] = L.marker(latlng, { icon })
          .addTo(_map)
          .bindTooltip(`<b>${d.name}</b><br>${Fmt.speed(p.speed || 0)}`, { permanent: false })
          .on('click', () => { State.set('selectedDevice', d.id); Dashboard.onDeviceClick(d.id); });
      }

      // trail
      if (!_trails[d.id]) _trails[d.id] = [];
      _trails[d.id].push(latlng);
      if (_trails[d.id].length > TRAIL_LEN) _trails[d.id].shift();
      if (_trails[d.id + '_line']) _map.removeLayer(_trails[d.id + '_line']);
      if (_trails[d.id].length > 1) {
        _trails[d.id + '_line'] = L.polyline(_trails[d.id], { color: Fmt.statusColor(d.status), weight: 2, opacity: 0.5 }).addTo(_map);
      }
    });

    // remove stale markers
    Object.keys(_markers).forEach(id => {
      if (!devices.find(d => d.id == id)) {
        _map.removeLayer(_markers[id]);
        delete _markers[id];
      }
    });
  }

  function focusDevice(deviceId, positions) {
    const p = positions[deviceId];
    if (p?.latitude && _map) _map.flyTo([p.latitude, p.longitude], 15, { duration: 0.8 });
  }

  function fitAll(positions) { MapUtil.fitMarkers(_map, positions); }

  function setStyle(style) { MapUtil.setStyle(_map, style); }

  function invalidate() { _map?.invalidateSize(); }

  return { init, getMap, update, focusDevice, fitAll, setStyle, invalidate };
})();
