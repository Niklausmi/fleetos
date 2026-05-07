/* ═══════════════════════════════════════════
   pages/geofences.js — Zones / Geofences
   Draw circles, polygons, lines on map
   Full CRUD via Traccar /geofences API
═══════════════════════════════════════════ */
const GeofencesView = (() => {
  let _map = null;
  let _layers = {};       // id → L.layer
  let _drawLayer = null;
  let _drawMode = null;   // 'circle' | 'polygon'
  let _drawPoints = [];
  let _tempMarkers = [];
  let _filter = '';

  function register() {
    Views.register('geofences', { init, onShow: () => _map?.invalidateSize(), onHide: cancelDraw });
  }

  function init() {
    document.getElementById('view-geofences').innerHTML = `
      <div class="split-panel" style="width:100%">
        <!-- Sidebar -->
        <div class="panel-left geofences-sidebar">
          <div class="panel-header-bar">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div class="panel-title-sm">Zones</div>
              <button class="btn btn-primary btn-sm" onclick="GeofencesView.openForm()">+ New Zone</button>
            </div>
          </div>
          <div style="padding:8px 12px 4px">
            <div class="search-wrap"><span class="search-icon">🔍</span>
              <input type="text" placeholder="Search zones…" oninput="GeofencesView.filter(this.value)">
            </div>
          </div>
          <div class="panel-scroll" id="geofence-list"></div>
        </div>
        <!-- Map -->
        <div class="geofence-map-wrap">
          <div id="geofence-map"></div>
          <div class="geofence-draw-toolbar" id="gf-toolbar" style="display:none">
            <div class="draw-btn active" id="gf-mode-label">Drawing…</div>
            <div class="draw-btn" onclick="GeofencesView.undoPoint()">↩ Undo</div>
            <div class="draw-btn" onclick="GeofencesView.finishDraw()" style="background:rgba(0,229,195,0.2);color:var(--accent);border-color:rgba(0,229,195,0.4)">✓ Finish</div>
            <div class="draw-btn" onclick="GeofencesView.cancelDraw()" style="background:rgba(255,107,107,0.15);color:var(--accent3);border-color:rgba(255,107,107,0.3)">✕ Cancel</div>
          </div>
        </div>
      </div>`;

    _map = MapUtil.createMap('geofence-map');
    _map.setView([25, 55], 6);
    _map.on('click', onMapClick);

    State.on('geofences', renderList);
    renderList();
    drawAllZones();
  }

  function filter(q) { _filter = q; renderList(); }

  function renderList() {
    const list = document.getElementById('geofence-list');
    if (!list) return;
    const zones = filterList(State.get('geofences'), _filter, ['name', 'description']);
    if (!zones.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">📐</div><div class="empty-title">No zones yet</div></div>`; return; }
    list.innerHTML = zones.map(z => {
      const color = z.attributes?.color || '#7B61FF';
      return `<div class="geofence-item" onclick="GeofencesView.focusZone(${z.id})">
        <div class="geofence-color-dot" style="background:${color}"></div>
        <div style="flex:1;min-width:0">
          <div class="geofence-item-name">${z.name}</div>
          <div class="geofence-item-type">${z.area?.startsWith('CIRCLE') ? 'Circle' : 'Polygon'} · ${z.description || ''}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GeofencesView.openForm(${z.id})">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();GeofencesView.confirmDelete(${z.id})">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  function drawAllZones() {
    State.get('geofences').forEach(z => drawZone(z));
  }

  function drawZone(z) {
    if (_layers[z.id]) { _map.removeLayer(_layers[z.id]); }
    const color = z.attributes?.color || '#7B61FF';
    const layer = parseAndDraw(z.area, color, z.name);
    if (layer) { layer.addTo(_map); _layers[z.id] = layer; }
  }

  function parseAndDraw(area, color, name) {
    if (!area) return null;
    try {
      if (area.startsWith('CIRCLE')) {
        const m = area.match(/CIRCLE\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)/);
        if (!m) return null;
        return L.circle([parseFloat(m[1]), parseFloat(m[2])], {
          radius: parseFloat(m[3]), color, fillColor: color, fillOpacity: 0.12, weight: 2,
        }).bindTooltip(name);
      }
      if (area.startsWith('POLYGON') || area.startsWith('LINESTRING')) {
        const coords = area.replace(/^[A-Z]+\s*\(+|\)+$/g, '').split(',').map(p => {
          const [lon, lat] = p.trim().split(' ').map(Number);
          return [lat, lon];
        });
        return L.polygon(coords, { color, fillColor: color, fillOpacity: 0.12, weight: 2 }).bindTooltip(name);
      }
    } catch {}
    return null;
  }

  function focusZone(id) {
    const layer = _layers[id];
    if (layer && _map) {
      try { _map.fitBounds(layer.getBounds?.() || layer.getLatLng?.(), { padding: [40, 40] }); } catch {}
    }
  }

  /* ── DRAW ──────────────────────────── */
  function startDraw(mode) {
    _drawMode = mode;
    _drawPoints = [];
    _tempMarkers.forEach(m => _map.removeLayer(m));
    _tempMarkers = [];
    if (_drawLayer) { _map.removeLayer(_drawLayer); _drawLayer = null; }
    document.getElementById('gf-toolbar').style.display = 'flex';
    document.getElementById('gf-mode-label').textContent = mode === 'circle' ? '⭕ Circle mode' : '🔺 Polygon mode';
    _map.getContainer().style.cursor = 'crosshair';
  }

  function onMapClick(e) {
    if (!_drawMode) return;
    _drawPoints.push([e.latlng.lat, e.latlng.lng]);
    const m = L.circleMarker(e.latlng, { radius: 5, color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 1 }).addTo(_map);
    _tempMarkers.push(m);
    if (_drawLayer) _map.removeLayer(_drawLayer);

    if (_drawMode === 'circle' && _drawPoints.length === 2) {
      const r = MapUtil.haversineKm(_drawPoints[0][0], _drawPoints[0][1], _drawPoints[1][0], _drawPoints[1][1]) * 1000;
      _drawLayer = L.circle(_drawPoints[0], { radius: r, color: 'var(--accent2)', fillOpacity: 0.15 }).addTo(_map);
    } else if (_drawMode === 'polygon' && _drawPoints.length >= 2) {
      _drawLayer = L.polygon(_drawPoints, { color: 'var(--accent2)', fillOpacity: 0.15 }).addTo(_map);
    }
  }

  function undoPoint() {
    if (!_drawPoints.length) return;
    _drawPoints.pop();
    const m = _tempMarkers.pop();
    if (m) _map.removeLayer(m);
    if (_drawLayer) { _map.removeLayer(_drawLayer); _drawLayer = null; }
    if (_drawPoints.length >= 2 && _drawMode === 'polygon') {
      _drawLayer = L.polygon(_drawPoints, { color: 'var(--accent2)', fillOpacity: 0.15 }).addTo(_map);
    }
  }

  function finishDraw() {
    if (!_drawPoints.length) return cancelDraw();
    let area = '';
    if (_drawMode === 'circle' && _drawPoints.length >= 2) {
      const r = MapUtil.haversineKm(_drawPoints[0][0], _drawPoints[0][1], _drawPoints[1][0], _drawPoints[1][1]) * 1000;
      area = `CIRCLE (${_drawPoints[0][0]}, ${_drawPoints[0][1]}, ${r.toFixed(0)})`;
    } else if (_drawMode === 'polygon' && _drawPoints.length >= 3) {
      const pts = [..._drawPoints, _drawPoints[0]].map(([lat, lon]) => `${lon} ${lat}`).join(', ');
      area = `POLYGON ((${pts}))`;
    } else { Toast.warn(_drawMode === 'circle' ? 'Click 2 points for circle' : 'Need at least 3 points'); return; }
    cancelDraw();
    openForm(null, area);
  }

  function cancelDraw() {
    _drawMode = null; _drawPoints = [];
    _tempMarkers.forEach(m => _map?.removeLayer(m)); _tempMarkers = [];
    if (_drawLayer) { _map?.removeLayer(_drawLayer); _drawLayer = null; }
    const tb = document.getElementById('gf-toolbar');
    if (tb) tb.style.display = 'none';
    if (_map) _map.getContainer().style.cursor = '';
  }

  /* ── FORM ──────────────────────────── */
  function openForm(id = null, preArea = '') {
    const z = id ? State.get('geofences').find(g => g.id === id) : null;
    const devices = State.get('devices');
    Modal.open({
      title: z ? `Edit Zone: ${z.name}` : 'Create New Zone',
      size: 'lg',
      body: `
        <div class="field-row cols-2">
          <div class="field"><label>Zone Name *</label><input id="gf-name" value="${z?.name || ''}" placeholder="e.g. Warehouse District"></div>
          <div class="field"><label>Color</label>
            <input type="color" id="gf-color" value="${z?.attributes?.color || '#7B61FF'}" style="height:40px;padding:4px;cursor:pointer;width:100%">
          </div>
        </div>
        <div class="field"><label>Description</label><input id="gf-desc" value="${z?.description || ''}" placeholder="Optional notes"></div>

        ${!z && !preArea ? `
        <div style="margin:16px 0 8px">
          <div class="field"><label>Draw Mode</label>
            <div style="display:flex;gap:8px">
              <button class="btn btn-secondary" onclick="Modal.close();GeofencesView.startDraw('circle')">⭕ Draw Circle</button>
              <button class="btn btn-secondary" onclick="Modal.close();GeofencesView.startDraw('polygon')">🔺 Draw Polygon</button>
            </div>
          </div>
        </div>
        <div class="field"><label>Or enter WKT manually</label>
          <input id="gf-area" value="${z?.area || ''}" placeholder="CIRCLE(lat, lon, radius) or POLYGON((lon lat, ...))">
        </div>` : `
        <div class="field"><label>Zone Area (WKT)</label>
          <input id="gf-area" value="${z?.area || preArea}" placeholder="CIRCLE(lat, lon, radius)">
        </div>`}

        <div class="field"><label>Assign to Devices (multi-select)</label>
          <select id="gf-devices" multiple style="height:90px">
            ${devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
          </select>
          <div class="field-hint">Hold Ctrl/Cmd to select multiple</div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="GeofencesView.save(${id || 'null'})">${z ? 'Save' : 'Create Zone'}</button>`,
    });
  }

  async function save(id) {
    const name  = document.getElementById('gf-name').value.trim();
    const area  = document.getElementById('gf-area').value.trim();
    const desc  = document.getElementById('gf-desc').value.trim();
    const color = document.getElementById('gf-color').value;
    if (!name) return Toast.warn('Name is required');
    if (!area) return Toast.warn('Zone area is required');
    const data = { name, description: desc, area, attributes: { color } };
    try {
      if (id) {
        const updated = await API.updateGeofence(id, { ...State.get('geofences').find(g => g.id === id), ...data });
        State.set('geofences', State.get('geofences').map(g => g.id === id ? updated : g));
        drawZone(updated);
        Toast.success('Zone updated');
      } else {
        const created = await API.createGeofence(data);
        State.set('geofences', [...State.get('geofences'), created]);
        drawZone(created);
        Toast.success('Zone created');
      }
      Modal.close();
    } catch (e) { Toast.error(e.message); }
  }

  function confirmDelete(id) {
    const z = State.get('geofences').find(g => g.id === id);
    Modal.confirm({
      title: 'Delete Zone', message: `Delete zone <b>${z?.name}</b>?`,
      confirmText: 'Delete', danger: true,
      onConfirm: async () => {
        try {
          await API.deleteGeofence(id);
          if (_layers[id]) { _map.removeLayer(_layers[id]); delete _layers[id]; }
          State.set('geofences', State.get('geofences').filter(g => g.id !== id));
          Toast.success('Zone deleted');
        } catch (e) { Toast.error(e.message); }
      },
    });
  }

  return { register, filter, focusZone, startDraw, undoPoint, finishDraw, cancelDraw, openForm, save, confirmDelete };
})();
