/* ═══════════════════════════════════════════
   pages/playback.js — History Playback
═══════════════════════════════════════════ */
const PlaybackView = (() => {
  let _map = null, _marker = null, _polyline = null;
  let _positions = [];
  let _idx = 0, _playing = false, _timer = null;

  function register() {
    Views.register('playback', { init, onShow: () => _map?.invalidateSize(), onHide: stop });
  }

  function init() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('view-playback').innerHTML = `
      <div class="playback-map-wrap">
        <div id="playback-map"></div>
      </div>
      <div class="playback-controls-bar">
        <div class="pb-top-row">
          <div class="pb-title">History Playback</div>
          <select id="pb-device" style="width:160px"></select>
          <input type="date" id="pb-from" value="${today}" style="width:145px;font-family:var(--font-mono);font-size:12px">
          <button class="btn btn-primary btn-sm" onclick="PlaybackView.load()">Load Track</button>
          <div class="pb-stats-strip">
            <div class="pb-stat"><div class="pb-stat-val" id="pb-dist">—</div><div class="pb-stat-lbl">Distance</div></div>
            <div class="pb-stat"><div class="pb-stat-val" id="pb-maxspd">—</div><div class="pb-stat-lbl">Max Speed</div></div>
            <div class="pb-stat"><div class="pb-stat-val" id="pb-dur">—</div><div class="pb-stat-lbl">Duration</div></div>
          </div>
        </div>
        <div class="timeline-track" id="pb-timeline" onclick="PlaybackView.seek(event)">
          <div class="timeline-fill" id="pb-fill" style="width:0%"></div>
        </div>
        <div class="pb-btn-row">
          <button class="btn btn-icon" onclick="PlaybackView.step(-10)">⏮</button>
          <button class="btn btn-icon pb-play" id="pb-play" onclick="PlaybackView.togglePlay()">▶</button>
          <button class="btn btn-icon" onclick="PlaybackView.step(10)">⏭</button>
          <select id="pb-speed" style="width:70px;font-family:var(--font-mono);font-size:12px">
            <option value="1">1×</option><option value="2">2×</option>
            <option value="5" selected>5×</option><option value="10">10×</option><option value="20">20×</option>
          </select>
          <div class="pb-time-disp" id="pb-time">-- : -- : --</div>
        </div>
      </div>`;

    _map = MapUtil.createMap('playback-map');
    _map.setView([25, 55], 5);
    populateDevices();
    State.on('devices', populateDevices);
  }

  function populateDevices() {
    const sel = document.getElementById('pb-device');
    if (!sel) return;
    sel.innerHTML = State.get('devices').map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  async function load() {
    const deviceId = document.getElementById('pb-device')?.value;
    const date     = document.getElementById('pb-from')?.value;
    if (!deviceId || !date) return Toast.warn('Select a device and date');

    const from = date + 'T00:00:00.000Z';
    const to   = date + 'T23:59:59.999Z';
    try {
      _positions = await API.getReportRoute(deviceId, from, to);
    } catch (e) { Toast.error('Failed: ' + e.message); return; }

    if (!_positions.length) { Toast.warn('No position data for this day'); return; }
    _idx = 0; stop(); drawTrack(); updateStats();
    Toast.success(`Loaded ${_positions.length} points`);
  }

  function drawTrack() {
    _map.eachLayer(l => { if (!(l instanceof L.TileLayer)) _map.removeLayer(l); });
    const pts = _positions.map(p => [p.latitude, p.longitude]);
    _polyline = L.polyline(pts, { color: 'var(--accent)', weight: 3, opacity: 0.6 }).addTo(_map);
    if (pts.length > 1) {
      L.marker(pts[0], { icon: MapUtil.pinIcon('var(--accent)', '🚦') }).addTo(_map);
      L.marker(pts[pts.length-1], { icon: MapUtil.pinIcon('var(--accent3)', '🏁') }).addTo(_map);
    }
    _map.fitBounds(pts, { padding: [50, 50] });
    updateMarker();
  }

  function updateMarker() {
    const p = _positions[_idx];
    if (!p) return;
    if (_marker) _map.removeLayer(_marker);
    _marker = L.marker([p.latitude, p.longitude], { icon: MapUtil.pinIcon('var(--accent2)', '🚗') }).addTo(_map);
    const pct = _positions.length > 1 ? (_idx / (_positions.length - 1)) * 100 : 0;
    const fill = document.getElementById('pb-fill');
    if (fill) fill.style.width = pct + '%';
    const t = document.getElementById('pb-time');
    if (t) t.textContent = Fmt.time(p.fixTime || p.deviceTime);
  }

  function updateStats() {
    if (!_positions.length) return;
    let dist = 0, maxSpd = 0;
    for (let i = 1; i < _positions.length; i++) {
      const a = _positions[i-1], b = _positions[i];
      dist += MapUtil.haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
      if (b.speed > maxSpd) maxSpd = b.speed;
    }
    const dur = (new Date(_positions[_positions.length-1].fixTime) - new Date(_positions[0].fixTime)) / 1000;
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('pb-dist',   dist.toFixed(1) + ' km');
    el('pb-maxspd', Fmt.speed(maxSpd));
    el('pb-dur',    Fmt.duration(dur));
  }

  function togglePlay() {
    _playing ? stop() : play();
  }

  function play() {
    if (!_positions.length) return;
    _playing = true;
    document.getElementById('pb-play').textContent = '⏸';
    const spd = parseInt(document.getElementById('pb-speed')?.value || 5);
    clearInterval(_timer);
    _timer = setInterval(() => {
      _idx += spd;
      if (_idx >= _positions.length - 1) { _idx = _positions.length - 1; stop(); return; }
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
    _idx = Math.max(0, Math.min(_positions.length - 1, _idx + n));
    updateMarker();
  }

  function seek(e) {
    if (!_positions.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    _idx = Math.floor(pct * (_positions.length - 1));
    updateMarker();
  }

  return { register, load, togglePlay, step, seek };
})();
