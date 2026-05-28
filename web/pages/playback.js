/* ═══════════════════════════════════════════
   pages/playback.js — History + Trips v3
   Fixes:
   - duration is ms from Traccar → divide by 1000
   - clickable packet dots on polyline
   - layer switcher button on map
═══════════════════════════════════════════ */
const PlaybackView = (() => {
  let _map        = null;
  let _marker     = null;
  let _polyline   = null;
  let _dotLayer   = null;   // L.LayerGroup for packet dots
  let _tripLayers = [];
  let _positions  = [];
  let _trips      = [];
  let _stops      = [];
  let _idx = 0, _playing = false, _timer = null;
  let _deviceId = null;
  let _fromISO  = null;
  let _toISO    = null;
  let _showDots = true;

  const TILE_STYLES = [
    { key: 'dark',      label: '🌑 Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
    { key: 'light',     label: '🗺️ Map',       url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
    { key: 'satellite', label: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
    { key: 'streets',   label: '🛣️ Streets',   url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  ];
  let _tileIdx = 1; // start on light map

  function register() {
    Views.register('playback', { init, onShow, onHide: stop });
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('view-playback').innerHTML = `
      <div style="display:flex;height:100%;overflow:hidden">

        <!-- LEFT: Controls + trips list -->
        <div style="width:320px;min-width:320px;display:flex;flex-direction:column;
                    background:var(--bg2);border-right:1px solid var(--border-s);overflow:hidden">

          <div style="padding:14px 16px;border-bottom:1px solid var(--border-s);flex-shrink:0">
            <div style="font-size:13px;font-weight:600;margin-bottom:12px">History Playback</div>
            <div class="field" style="margin-bottom:8px">
              <label>Device</label>
              <select id="pb-device" style="width:100%"></select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
              <div class="field" style="margin-bottom:0">
                <label>From Date</label>
                <input type="date" id="pb-from" value="${today}"
                       style="font-family:var(--font-mono);font-size:12px">
              </div>
              <div class="field" style="margin-bottom:0">
                <label>From Time</label>
                <input type="time" id="pb-from-time" value="00:00"
                       style="font-family:var(--font-mono);font-size:12px">
              </div>
              <div class="field" style="margin-bottom:0">
                <label>To Date</label>
                <input type="date" id="pb-to" value="${today}"
                       style="font-family:var(--font-mono);font-size:12px">
              </div>
              <div class="field" style="margin-bottom:0">
                <label>To Time</label>
                <input type="time" id="pb-to-time" value="23:59"
                       style="font-family:var(--font-mono);font-size:12px">
              </div>
            </div>
            <button class="btn btn-primary btn-full" onclick="PlaybackView.load()">
              Show History
            </button>
          </div>

          <!-- Summary -->
          <div id="pb-summary" style="display:none;padding:10px 16px;
               border-bottom:1px solid var(--border-s);flex-shrink:0;
               display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
            <div style="text-align:center">
              <div style="font-size:16px;font-weight:700;color:var(--primary)" id="pb-dist">—</div>
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Distance</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:16px;font-weight:700;color:var(--warn)" id="pb-maxspd">—</div>
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Max Speed</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:16px;font-weight:700;color:var(--text)" id="pb-dur">—</div>
              <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)">Drive Time</div>
            </div>
          </div>

          <!-- Trips list -->
          <div id="pb-trip-list" style="flex:1;overflow-y:auto">
            <div class="empty-state" style="padding:40px 20px">
              <div class="empty-icon">⏮️</div>
              <div class="empty-title">Select a device and date</div>
              <div class="empty-sub">Click Show History to load route and trips</div>
            </div>
          </div>
        </div>

        <!-- RIGHT: Map + controls -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;min-width:0">
          <div id="playback-map" style="flex:1;min-height:0"></div>

          <!-- Floating map controls (top-right of map) -->
          <div id="pb-map-btns" style="
            position:absolute;top:12px;right:12px;z-index:600;
            display:flex;flex-direction:column;gap:5px">
            <button class="map-fab" id="pb-layer-btn"
                    onclick="PlaybackView.cycleLayer()" title="Change map layer">
              🗺️
            </button>
            <button class="map-fab" id="pb-dots-btn"
                    onclick="PlaybackView.toggleDots()" title="Toggle packet dots"
                    style="font-size:10px;font-weight:700">
              ●●
            </button>
            <button class="map-fab" onclick="PlaybackView.fitTrack()" title="Fit track">
              ⊡
            </button>
          </div>

          <!-- Playback controls bar -->
          <div class="playback-controls-bar" id="pb-controls" style="display:none">
            <div class="timeline-track" id="pb-timeline" onclick="PlaybackView.seek(event)">
              <div class="timeline-fill" id="pb-fill" style="width:0%"></div>
            </div>
            <div class="pb-btn-row">
              <button class="btn btn-icon" onclick="PlaybackView.step(-1)" title="−1">⏮</button>
              <button class="btn btn-icon" onclick="PlaybackView.step(-20)" title="−20">◀</button>
              <button class="btn btn-icon pb-play" id="pb-play"
                      onclick="PlaybackView.togglePlay()">▶</button>
              <button class="btn btn-icon" onclick="PlaybackView.step(20)" title="+20">▶</button>
              <button class="btn btn-icon" onclick="PlaybackView.step(1)" title="+1">⏭</button>
              <select id="pb-speed" style="width:64px;font-family:var(--font-mono);font-size:12px">
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="5" selected>5×</option>
                <option value="10">10×</option>
                <option value="20">20×</option>
              </select>
              <div class="pb-time-disp" id="pb-time">—</div>
              <div style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--muted)" id="pb-pos-count"></div>
            </div>
          </div>
        </div>
      </div>`;

    // Init map with light tiles
    _map = L.map('playback-map', { zoomControl: true, attributionControl: false });
    _tileIdx = document.documentElement.getAttribute('data-theme') === 'dark' ? 0 : 1;
    L.tileLayer(TILE_STYLES[_tileIdx].url, { maxZoom: 19 }).addTo(_map);
    _map.setView([30, 70], 5);

    _dotLayer = L.layerGroup().addTo(_map);

    populateDevices();
    State.on('devices', populateDevices);
  }

  function onShow() {
    setTimeout(() => _map?.invalidateSize(), 100);
    const fromISO = State.get('playbackFrom');
    if (fromISO) {
      const fromDt = new Date(fromISO);
      const toDt   = new Date(State.get('playbackTo') || fromISO);
      const pad    = n => String(n).padStart(2,'0');
      const fe = document.getElementById('pb-from');
      const ft = document.getElementById('pb-from-time');
      const te = document.getElementById('pb-to');
      const tt = document.getElementById('pb-to-time');
      if (fe) fe.value = fromDt.toISOString().slice(0,10);
      if (ft) ft.value = `${pad(fromDt.getHours())}:${pad(fromDt.getMinutes())}`;
      if (te) te.value = toDt.toISOString().slice(0,10);
      if (tt) tt.value = `${pad(toDt.getHours())}:${pad(toDt.getMinutes())}`;
      State.set('playbackFrom', null);
      State.set('playbackTo',   null);
      setTimeout(() => load(), 300);
    }
  }

  /* ─────────────────────────────────────────
     MAP CONTROLS
  ───────────────────────────────────────── */
  function cycleLayer() {
    _tileIdx = (_tileIdx + 1) % TILE_STYLES.length;
    _map.eachLayer(l => { if (l instanceof L.TileLayer) _map.removeLayer(l); });
    L.tileLayer(TILE_STYLES[_tileIdx].url, { maxZoom: 19 }).addTo(_map);
    const btn = document.getElementById('pb-layer-btn');
    if (btn) btn.title = TILE_STYLES[_tileIdx].label;
  }

  function toggleDots() {
    _showDots = !_showDots;
    const btn = document.getElementById('pb-dots-btn');
    if (_dotLayer) {
      if (_showDots) _dotLayer.addTo(_map);
      else _map.removeLayer(_dotLayer);
    }
    if (btn) btn.style.opacity = _showDots ? '1' : '0.45';
  }

  function fitTrack() {
    if (!_positions.length) return;
    const pts = _positions.map(p => [p.latitude, p.longitude]);
    try { _map.fitBounds(pts, { padding: [40,40] }); } catch {}
  }

  /* ─────────────────────────────────────────
     POPULATE DEVICES
  ───────────────────────────────────────── */
  function populateDevices() {
    const sel = document.getElementById('pb-device');
    if (!sel) return;
    sel.innerHTML = State.get('devices').map(d =>
      `<option value="${d.id}">${d.name}</option>`
    ).join('');
    const pre = State.get('selectedDevice');
    if (pre) sel.value = pre;
  }

  /* ─────────────────────────────────────────
     LOAD
  ───────────────────────────────────────── */
  async function load() {
    const btn = document.querySelector('[onclick="PlaybackView.load()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

    _deviceId      = document.getElementById('pb-device')?.value;
    const fromDate = document.getElementById('pb-from')?.value;
    const toDate   = document.getElementById('pb-to')?.value   || fromDate;
    const fromTime = document.getElementById('pb-from-time')?.value || '00:00';
    const toTime   = document.getElementById('pb-to-time')?.value   || '23:59';

    if (!_deviceId || !fromDate) {
      Toast.warn('Select a device and date');
      if (btn) { btn.disabled = false; btn.textContent = 'Show History'; }
      return;
    }

    const fromLocal = new Date(`${fromDate}T${fromTime}:00`);
    const toLocal   = new Date(`${toDate}T${toTime}:59`);

    if (isNaN(fromLocal) || isNaN(toLocal)) {
      Toast.warn('Invalid date or time');
      if (btn) { btn.disabled = false; btn.textContent = 'Show History'; }
      return;
    }
    if (fromLocal >= toLocal) {
      Toast.warn('From must be before To');
      if (btn) { btn.disabled = false; btn.textContent = 'Show History'; }
      return;
    }

    _fromISO = fromLocal.toISOString();
    _toISO   = toLocal.toISOString();

    clearMapLayers();
    stop();

    try {
      const [routeRes, tripsRes, stopsRes] = await Promise.allSettled([
        API.getReportRoute(_deviceId, _fromISO, _toISO),
        API.getReportTrips([parseInt(_deviceId)], [], _fromISO, _toISO),
        API.getReportStops([parseInt(_deviceId)], [], _fromISO, _toISO),
      ]);
      _positions = routeRes.status === 'fulfilled' ? (routeRes.value || []) : [];
      _trips     = tripsRes.status === 'fulfilled' ? (tripsRes.value || []) : [];
      _stops     = stopsRes.status === 'fulfilled' ? (stopsRes.value || []) : [];
    } catch (e) {
      Toast.error('Load failed: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Show History'; }
      return;
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Show History'; }

    if (!_positions.length && !_trips.length) {
      Toast.warn('No data for this period');
      renderTripList();
      return;
    }

    drawFullTrack();
    drawPacketDots();
    renderTripList();
    updateStats();

    if (_positions.length) {
      document.getElementById('pb-controls').style.display = '';
      const countEl = document.getElementById('pb-pos-count');
      if (countEl) countEl.textContent = `${_positions.length} pts`;
      _idx = 0;
      updateMarker();
    }

    Toast.success(
      `${_trips.length} trip${_trips.length!==1?'s':''}, ${_positions.length} points`
    );
  }

  /* ─────────────────────────────────────────
     DRAW POLYLINE
  ───────────────────────────────────────── */
  function drawFullTrack() {
    if (!_positions.length) return;
    const pts = _positions.map(p => [p.latitude, p.longitude]);

    _polyline = L.polyline(pts, {
      color: '#3b82f6', weight: 4, opacity: 0.85,
      lineJoin: 'round', lineCap: 'round',
    }).addTo(_map);

    // Start marker
    L.marker(pts[0], { icon: MapUtil.pinIcon('#10b981', 'Start') })
      .addTo(_map)
      .bindPopup(packetPopup('Journey Start', _positions[0]));

    // End marker
    if (pts.length > 1) {
      L.marker(pts[pts.length-1], { icon: MapUtil.pinIcon('#ef4444', 'End') })
        .addTo(_map)
        .bindPopup(packetPopup('Journey End', _positions[_positions.length-1]));
    }

    // Parking stop P markers
    _stops.forEach((s, i) => {
      if (!s.latitude) return;
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:50%;
          background:#f59e0b;border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:700;color:#000;
          box-shadow:0 2px 6px rgba(0,0,0,0.4)">P</div>`,
        iconSize: [22,22], iconAnchor: [11,11],
      });
      L.marker([s.latitude, s.longitude], { icon })
        .addTo(_map)
        .bindPopup(stopPopup(s, i));
    });

    _map.fitBounds(pts, { padding: [40,40] });
  }

  /* ─────────────────────────────────────────
     PACKET DOTS — clickable circle per GPS point
  ───────────────────────────────────────── */
  function drawPacketDots() {
    _dotLayer.clearLayers();
    if (!_positions.length) return;

    // Downsample if too many points (>500 → show every Nth)
    const MAX_DOTS = 500;
    const step  = _positions.length > MAX_DOTS
      ? Math.ceil(_positions.length / MAX_DOTS) : 1;

    _positions.forEach((pos, i) => {
      if (i % step !== 0 && i !== _positions.length - 1) return;
      if (!pos.latitude) return;

      const spd   = pos.speed ? +(pos.speed * 1.852).toFixed(0) : 0;
      // Color dot by speed: green < 60, amber < 100, red >= 100
      const clr   = spd === 0 ? '#94a3b8'
                  : spd < 60  ? '#10b981'
                  : spd < 100 ? '#f59e0b'
                  :              '#ef4444';

      const dot = L.circleMarker([pos.latitude, pos.longitude], {
        radius:      spd > 0 ? 4 : 3,
        fillColor:   clr,
        color:       '#fff',
        weight:      1.5,
        opacity:     1,
        fillOpacity: 0.9,
      });

      dot.bindPopup(packetPopup(`Packet #${i+1}`, pos), {
        maxWidth: 280,
        className: 'pb-packet-popup',
      });

      // Click → also jump playback to this index
      dot.on('click', () => {
        _idx = i;
        updateMarker();
      });

      _dotLayer.addLayer(dot);
    });

    if (_showDots) _dotLayer.addTo(_map);
  }

  /* ─────────────────────────────────────────
     POPUP HTML
  ───────────────────────────────────────── */
  function packetPopup(label, pos) {
    const spd  = pos.speed ? +(pos.speed * 1.852).toFixed(1) : 0;
    const a    = pos.attributes || {};
    const ign  = a.ignition;
    const bat  = a.battery ?? a.externalBattery ?? a.power;
    const sat  = a.satellites ?? a.sat;
    const alt  = pos.altitude ? pos.altitude.toFixed(0) + ' m' : null;

    const spdClr = spd === 0 ? '#94a3b8' : spd < 60 ? '#10b981' : spd < 100 ? '#f59e0b' : '#ef4444';

    return `
      <div style="font-family:sans-serif;min-width:200px;max-width:270px">
        <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:5px">${label}</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:5px">
          ${Fmt.datetime(pos.fixTime||pos.deviceTime)}
        </div>
        <div style="font-family:monospace;font-size:10.5px;color:#6366f1;margin-bottom:8px">
          ${pos.latitude?.toFixed(6)}, ${pos.longitude?.toFixed(6)}
        </div>
        ${pos.address ? `<div style="font-size:11px;color:#475569;margin-bottom:8px;line-height:1.4">${pos.address}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <div style="background:#f8fafc;border-radius:5px;padding:5px 7px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Speed</div>
            <div style="font-size:13px;font-weight:700;color:${spdClr}">${spd > 0 ? spd.toFixed(0)+' km/h' : 'Stopped'}</div>
          </div>
          ${ign !== undefined ? `<div style="background:#f8fafc;border-radius:5px;padding:5px 7px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Ignition</div>
            <div style="font-size:13px;font-weight:700;color:${ign?'#10b981':'#ef4444'}">${ign?'ON':'OFF'}</div>
          </div>` : ''}
          ${sat !== undefined ? `<div style="background:#f8fafc;border-radius:5px;padding:5px 7px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Satellites</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b">${sat}</div>
          </div>` : ''}
          ${bat !== undefined ? `<div style="background:#f8fafc;border-radius:5px;padding:5px 7px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Battery</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b">${(+bat).toFixed(2)} V</div>
          </div>` : ''}
          ${alt ? `<div style="background:#f8fafc;border-radius:5px;padding:5px 7px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Altitude</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b">${alt}</div>
          </div>` : ''}
          ${pos.course !== undefined ? `<div style="background:#f8fafc;border-radius:5px;padding:5px 7px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Heading</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b">${headingLabel(pos.course)}</div>
          </div>` : ''}
        </div>
      </div>`;
  }

  function stopPopup(s, idx) {
    // FIX: Traccar duration is in ms — divide by 1000
    const durSec = (s.duration || 0) > 10000 ? Math.round(s.duration/1000) : (s.duration||0);
    const dur    = fmtDur(durSec);
    const dist   = s.distance ? (s.distance/1000).toFixed(2) + ' km' : null;
    const addr   = s.address || `${s.latitude?.toFixed(5)}, ${s.longitude?.toFixed(5)}`;

    return `
      <div style="font-family:sans-serif;min-width:220px">
        <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px">
          Parking Stop #${idx+1}
        </div>
        <div style="font-size:11px;color:#64748b;margin-bottom:6px">${fmtTime(s.startTime)}</div>
        ${addr ? `<div style="font-size:11px;color:#475569;line-height:1.4;margin-bottom:8px">${addr}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <div style="background:#f8fafc;border-radius:5px;padding:5px 8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Duration</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b">${dur}</div>
          </div>
          ${dist ? `<div style="background:#f8fafc;border-radius:5px;padding:5px 8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Distance</div>
            <div style="font-size:13px;font-weight:700;color:#6366f1">${dist}</div>
          </div>` : ''}
        </div>
      </div>`;
  }

  function tripPopup(trip) {
    // FIX: Traccar duration is in ms
    const durSec = (trip.duration||0) > 10000 ? Math.round(trip.duration/1000) : (trip.duration||0);
    const dur    = fmtDur(durSec);
    const dist   = trip.distance ? (trip.distance/1000).toFixed(2)+' km' : '—';
    const maxSpd = trip.maxSpeed ? +(trip.maxSpeed*1.852).toFixed(0)+' km/h' : '—';
    const avgSpd = trip.averageSpeed ? +(trip.averageSpeed*1.852).toFixed(0)+' km/h' : '—';
    const addr   = trip.startAddress || '';

    return `
      <div style="font-family:sans-serif;min-width:240px">
        <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px">Driving</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:6px">${fmtTime(trip.startTime)}</div>
        ${addr ? `<div style="font-size:11px;color:#475569;margin-bottom:8px;line-height:1.4">${addr}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
          <div style="background:#f8fafc;border-radius:5px;padding:5px 8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Duration</div>
            <div style="font-size:13px;font-weight:700;color:#1e293b">${dur}</div>
          </div>
          <div style="background:#f8fafc;border-radius:5px;padding:5px 8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Distance</div>
            <div style="font-size:13px;font-weight:700;color:#6366f1">${dist}</div>
          </div>
          <div style="background:#f8fafc;border-radius:5px;padding:5px 8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Max Speed</div>
            <div style="font-size:13px;font-weight:700;color:#ef4444">${maxSpd}</div>
          </div>
          <div style="background:#f8fafc;border-radius:5px;padding:5px 8px">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Avg Speed</div>
            <div style="font-size:13px;font-weight:700;color:#10b981">${avgSpd}</div>
          </div>
        </div>
      </div>`;
  }

  /* ─────────────────────────────────────────
     TRIP LIST
  ───────────────────────────────────────── */
  function renderTripList() {
    const el = document.getElementById('pb-trip-list');
    if (!el) return;

    if (!_trips.length && !_stops.length && !_positions.length) {
      el.innerHTML = `<div class="empty-state" style="padding:40px 20px">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No trips found</div>
        <div class="empty-sub">No movement data for this period</div>
      </div>`;
      return;
    }

    const entries = [];

    if (_positions.length)
      entries.push({ _kind:'start', time: _positions[0].fixTime });

    const all = [
      ..._trips.map(t => ({...t, _kind:'trip'})),
      ..._stops.map(s => ({...s, _kind:'stop'})),
    ].sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

    all.forEach(e => entries.push(e));

    if (_positions.length > 1)
      entries.push({ _kind:'end', time: _positions[_positions.length-1].fixTime });

    el.innerHTML = entries.map((e, i) => {
      if (e._kind === 'start') {
        return `<div class="pb-trip-entry pb-entry-start" onclick="PlaybackView.jumpTo(0)">
          <div class="pb-entry-icon" style="background:#10b981;color:#fff">▼</div>
          <div class="pb-entry-body">
            <div class="pb-entry-time">${fmtTime(e.time)}</div>
            <div class="pb-entry-label" style="color:#10b981">Journey Start</div>
          </div>
        </div>`;
      }
      if (e._kind === 'end') {
        return `<div class="pb-trip-entry pb-entry-end" onclick="PlaybackView.jumpTo(${_positions.length-1})">
          <div class="pb-entry-icon" style="background:#ef4444;color:#fff">⚑</div>
          <div class="pb-entry-body">
            <div class="pb-entry-time">${fmtTime(e.time)}</div>
            <div class="pb-entry-label" style="color:#ef4444">Journey End</div>
          </div>
        </div>`;
      }
      if (e._kind === 'stop') {
        // FIX: ms → sec
        const durSec = (e.duration||0) > 10000 ? Math.round(e.duration/1000) : (e.duration||0);
        const addr   = e.address || `${e.latitude?.toFixed(4)}, ${e.longitude?.toFixed(4)}`;
        return `<div class="pb-trip-entry"
                     onclick="PlaybackView.focusStop(${e.latitude},${e.longitude})">
          <div class="pb-entry-icon" style="background:#f59e0b;color:#000">P</div>
          <div class="pb-entry-body">
            <div class="pb-entry-time">${fmtTime(e.startTime)}</div>
            <div class="pb-entry-dur" style="color:var(--warn)">${fmtDur(durSec)}</div>
          </div>
          <div class="pb-entry-addr">${addr}</div>
        </div>`;
      }
      if (e._kind === 'trip') {
        // FIX: ms → sec
        const durSec = (e.duration||0) > 10000 ? Math.round(e.duration/1000) : (e.duration||0);
        const dur    = fmtDur(durSec);
        const dist   = e.distance ? (e.distance/1000).toFixed(1)+' km' : '';
        const maxSpd = e.maxSpeed ? +(e.maxSpeed*1.852).toFixed(0)+' km/h' : '';
        return `<div class="pb-trip-entry"
                     onclick="PlaybackView.focusTrip(${JSON.stringify(e).replace(/"/g,'&quot;')})">
          <div class="pb-entry-icon" style="background:#3b82f6;color:#fff">D</div>
          <div class="pb-entry-body">
            <div class="pb-entry-time">${fmtTime(e.startTime)}</div>
            <div class="pb-entry-dur">${dur}${dist?' · '+dist:''}</div>
          </div>
          ${maxSpd ? `<div class="pb-entry-spd">${maxSpd}</div>` : ''}
        </div>`;
      }
      return '';
    }).join('');
  }

  /* ─────────────────────────────────────────
     STATS — FIX duration ms → sec
  ───────────────────────────────────────── */
  function updateStats() {
    const el = document.getElementById('pb-summary');
    if (el) el.style.display = 'grid';

    const set = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };

    if (_trips.length) {
      const totalDist = _trips.reduce((s,t) => s+(t.distance||0), 0) / 1000;
      // FIX: Traccar trip.duration is in ms
      const totalDurMs = _trips.reduce((s,t) => s+(t.duration||0), 0);
      const totalDurSec = totalDurMs > 10000 ? Math.round(totalDurMs/1000) : totalDurMs;
      const maxSpd     = Math.max(..._trips.map(t => t.maxSpeed||0));

      set('pb-dist',   totalDist.toFixed(1)+' km');
      set('pb-maxspd', maxSpd ? +(maxSpd*1.852).toFixed(0)+' km/h' : '—');
      set('pb-dur',    fmtDur(totalDurSec));
    } else if (_positions.length > 1) {
      let dist=0, maxSpd=0;
      for (let i=1; i<_positions.length; i++) {
        const a=_positions[i-1], b=_positions[i];
        dist += MapUtil.haversineKm(a.latitude,a.longitude,b.latitude,b.longitude);
        if (b.speed > maxSpd) maxSpd = b.speed;
      }
      const dur = (new Date(_positions[_positions.length-1].fixTime) -
                   new Date(_positions[0].fixTime)) / 1000;
      set('pb-dist',   dist.toFixed(1)+' km');
      set('pb-maxspd', maxSpd ? +(maxSpd*1.852).toFixed(0)+' km/h' : '—');
      set('pb-dur',    fmtDur(dur));
    }
  }

  /* ─────────────────────────────────────────
     FOCUS ACTIONS
  ───────────────────────────────────────── */
  function jumpTo(idx) {
    _idx = Math.max(0, Math.min(_positions.length-1, idx));
    updateMarker();
    const p = _positions[_idx];
    if (p && _map) _map.setView([p.latitude, p.longitude], 16);
  }

  function focusStop(lat, lon) {
    if (!lat||!lon) return;
    _map.setView([lat,lon], 17);
    _map.eachLayer(l => {
      if (l instanceof L.Marker) {
        const ll = l.getLatLng();
        if (Math.abs(ll.lat-lat)<0.0002 && Math.abs(ll.lng-lon)<0.0002) l.openPopup();
      }
    });
  }

  function focusTrip(trip) {
    if (!trip) return;
    if (trip.startTime && _positions.length) {
      const t = new Date(trip.startTime).getTime();
      let closest=0, minDiff=Infinity;
      _positions.forEach((p,i) => {
        const diff = Math.abs(new Date(p.fixTime).getTime()-t);
        if (diff<minDiff) { minDiff=diff; closest=i; }
      });
      jumpTo(closest);
    }
    if (trip.startLat && trip.startLon) {
      L.popup({ closeButton: true, maxWidth: 280 })
        .setLatLng([trip.startLat, trip.startLon])
        .setContent(tripPopup(trip))
        .openOn(_map);
    }
  }

  /* ─────────────────────────────────────────
     PLAYBACK
  ───────────────────────────────────────── */
  function updateMarker() {
    const p = _positions[_idx];
    if (!p) return;
    if (_marker) _map.removeLayer(_marker);
    const spd = p.speed ? +(p.speed*1.852).toFixed(0) : 0;
    const clr = spd===0?'#94a3b8':spd<60?'#10b981':spd<100?'#f59e0b':'#ef4444';
    _marker = L.marker([p.latitude, p.longitude], {
      icon: MapUtil.pinIcon(clr, spd > 0 ? spd+'' : '●'),
      zIndexOffset: 1000,
    }).addTo(_map).bindPopup(packetPopup(`Position ${_idx+1}/${_positions.length}`, p));

    const pct  = _positions.length>1 ? (_idx/(_positions.length-1))*100 : 0;
    const fill = document.getElementById('pb-fill');
    if (fill) fill.style.width = pct+'%';
    const t = document.getElementById('pb-time');
    if (t) t.textContent = fmtTime(p.fixTime||p.deviceTime);
  }

  function togglePlay() { _playing ? stop() : play(); }

  function play() {
    if (!_positions.length) return;
    _playing = true;
    document.getElementById('pb-play').textContent = '⏸';
    const spd = parseInt(document.getElementById('pb-speed')?.value||5);
    clearInterval(_timer);
    _timer = setInterval(() => {
      _idx += spd;
      if (_idx >= _positions.length-1) { _idx=_positions.length-1; stop(); return; }
      updateMarker();
    }, 150);
  }

  function stop() {
    _playing = false;
    clearInterval(_timer);
    const btn = document.getElementById('pb-play');
    if (btn) btn.textContent = '▶';
  }

  function step(n) {
    stop();
    _idx = Math.max(0, Math.min(_positions.length-1, _idx+n));
    updateMarker();
  }

  function seek(e) {
    if (!_positions.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX-rect.left)/rect.width));
    _idx = Math.floor(pct*(_positions.length-1));
    updateMarker();
  }

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */
  function clearMapLayers() {
    _dotLayer?.clearLayers();
    _tripLayers.forEach(l => { if(l&&_map) try{_map.removeLayer(l);}catch{} });
    _tripLayers = [];
    if (_polyline) { try{_map.removeLayer(_polyline);}catch{} _polyline=null; }
    if (_marker)   { try{_map.removeLayer(_marker);  }catch{} _marker=null;   }
    _map.eachLayer(l => {
      if (l instanceof L.Marker || (l instanceof L.Polyline && !(l instanceof L.CircleMarker)))
        try{_map.removeLayer(l);}catch{}
    });
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = n => String(n).padStart(2,'0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()}`;
  }

  function fmtDur(secs) {
    if (!secs || secs < 0) return '—';
    const h = Math.floor(secs/3600);
    const m = Math.floor((secs%3600)/60);
    const s = Math.floor(secs%60);
    if (h>0) return `${h}h ${m}min ${s}s`;
    if (m>0) return `${m}min ${s}s`;
    return `${s}s`;
  }

  function headingLabel(deg) {
    const dirs=['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round((deg||0)/45)%8]+' '+(deg||0).toFixed(0)+'°';
  }

  return {
    register, load, togglePlay, step, seek,
    jumpTo, focusStop, focusTrip,
    cycleLayer, toggleDots, fitTrack,
  };
})();
