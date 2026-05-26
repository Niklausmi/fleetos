/* ═══════════════════════════════════════════
   map.js — Shared Leaflet map utilities
═══════════════════════════════════════════ */
const MapUtil = (() => {
  const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  const TILE_SAT  = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const TILE_LITE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const TILE_OSM  = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  function createMap(elId, opts = {}) {
    const m = L.map(elId, { zoomControl: false, attributionControl: false, ...opts });
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    L.tileLayer(theme === 'light' ? TILE_LITE : TILE_DARK, { maxZoom: 19 }).addTo(m);
    return m;
  }

  function setStyle(map, style) {
    const tiles = { dark: TILE_DARK, satellite: TILE_SAT, streets: TILE_OSM, lite: TILE_LITE };
    map.eachLayer(l => { if (l instanceof L.TileLayer) map.removeLayer(l); });
    L.tileLayer(tiles[style] || TILE_OSM, { maxZoom: 19 }).addTo(map);
  }

  function deviceIcon(status, category = 'default', heading = 0, speed = 0) {
    // FIX 2: color based on actual motion — grey border if speed=0
    const isMoving = speed > 0;
    const colorMap = {
      online:  isMoving ? '#10b981' : '#f59e0b',   // green if moving, amber if online+stopped
      idle:    '#f59e0b',
      offline: '#ef4444',
    };
    const color = colorMap[status] || '#ef4444';

    // Simple directional arrow SVG — works with rotation
    const arrow = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="13" fill="${color}22" stroke="${color}" stroke-width="2"/>
      <polygon points="16,6 21,22 16,18 11,22" fill="${color}" opacity="0.9"
        transform="rotate(${heading}, 16, 16)"/>
    </svg>`;

    return L.divIcon({
      className: '',
      html: `<div style="width:32px;height:32px;filter:drop-shadow(0 0 4px ${color}88)">${arrow}</div>`,
      iconSize: [32, 32], iconAnchor: [16, 16],
    });
  }

  function pinIcon(color = '#6366f1', label = '') {
    return L.divIcon({
      className: '',
      html: `<div style="
        min-width:32px;height:32px;border-radius:16px;padding:0 8px;
        background:${color};border:2px solid white;
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:700;color:#fff;white-space:nowrap;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
      ">${label}</div>`,
      iconSize: null, iconAnchor: [16, 16],
    });
  }

  function fitMarkers(map, positions, padding = [50, 50]) {
    const pts = Object.values(positions).filter(p => p?.latitude).map(p => [p.latitude, p.longitude]);
    if (pts.length > 0) { try { map.fitBounds(pts, { padding }); } catch {} }
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  return { createMap, setStyle, deviceIcon, pinIcon, fitMarkers, haversineKm };
})();

/* ── LIVE MAP MANAGER (dashboard) ────── */
const LiveMap = (() => {
  let _map = null;
  let _markers = {};
  let _trails  = {};
  let _trailLines = {};
  const TRAIL_LEN = 30;

  function init(elId) {
    _map = MapUtil.createMap(elId);
    _map.setView([30, 70], 5);
    return _map;
  }

  function getMap() { return _map; }

  function update(devices, positions) {
    devices.forEach(d => {
      const p = positions[d.id];
      if (!p?.latitude) return;
      const latlng = [p.latitude, p.longitude];
      const spd    = p.speed ? +(p.speed * 1.852).toFixed(1) : 0;
      const icon   = MapUtil.deviceIcon(d.status, d.category, p.course || 0, spd);

      // FIX 4: update tooltip immediately on every position update
      const tooltipContent = `<b>${d.name}</b><br>${spd > 0 ? spd.toFixed(0)+' km/h' : 'Stopped'}`;

      if (_markers[d.id]) {
        _markers[d.id].setLatLng(latlng).setIcon(icon);
        _markers[d.id].setTooltipContent(tooltipContent);
      } else {
        _markers[d.id] = L.marker(latlng, { icon })
          .addTo(_map)
          .bindTooltip(tooltipContent, { permanent: false, direction: 'top', offset: [0, -16] })
          .on('click', () => { Dashboard.onDeviceClick(d.id); });
      }

      // Trail breadcrumb
      if (!_trails[d.id]) _trails[d.id] = [];
      _trails[d.id].push(latlng);
      if (_trails[d.id].length > TRAIL_LEN) _trails[d.id].shift();
      if (_trailLines[d.id]) _map.removeLayer(_trailLines[d.id]);
      if (_trails[d.id].length > 1) {
        const clr = d.status === 'online' ? '#10b981' : d.status === 'idle' ? '#f59e0b' : '#ef4444';
        _trailLines[d.id] = L.polyline(_trails[d.id], {
          color: clr, weight: 2, opacity: 0.45, dashArray: '4 4',
        }).addTo(_map);
      }
    });

    // Remove stale markers
    Object.keys(_markers).forEach(id => {
      if (!devices.find(d => d.id == id)) {
        _map.removeLayer(_markers[id]);
        if (_trailLines[id]) _map.removeLayer(_trailLines[id]);
        delete _markers[id];
        delete _trails[id];
        delete _trailLines[id];
      }
    });
  }

  function focusDevice(deviceId, positions) {
    const p = positions[deviceId];
    if (p?.latitude && _map) _map.flyTo([p.latitude, p.longitude], 16, { duration: 0.8 });
  }

  function fitAll(positions) { MapUtil.fitMarkers(_map, positions); }
  function setStyle(style)   { MapUtil.setStyle(_map, style); }
  function invalidate()      { setTimeout(() => _map?.invalidateSize(), 100); }

  return { init, getMap, update, focusDevice, fitAll, setStyle, invalidate };
})();
