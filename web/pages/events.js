/* ═══════════════════════════════════════════
   pages/events.js — Events Monitor
═══════════════════════════════════════════ */
const EventsView = (() => {
  let _filter = '';
  let _eMap = null;
  let _eMarker = null;

  const TYPE_META = {
    deviceOverspeed:  { icon: '⚡', color: 'var(--warn)',    cls: 'warn',    label: 'Overspeed' },
    geofenceEnter:    { icon: '📍', color: 'var(--accent2)', cls: 'purple',  label: 'Geofence Entry' },
    geofenceExit:     { icon: '🚪', color: 'var(--accent2)', cls: 'purple',  label: 'Geofence Exit' },
    ignitionOn:       { icon: '🔑', color: 'var(--accent)',  cls: 'green',   label: 'Ignition ON' },
    ignitionOff:      { icon: '🔒', color: 'var(--muted)',   cls: 'gray',    label: 'Ignition OFF' },
    deviceOnline:     { icon: '✅', color: 'var(--online)',  cls: 'green',   label: 'Device Online' },
    deviceOffline:    { icon: '❌', color: 'var(--offline)', cls: 'red',     label: 'Device Offline' },
    alarm:            { icon: '🚨', color: 'var(--accent3)', cls: 'red',     label: 'Alarm' },
    deviceStopped:    { icon: '🛑', color: 'var(--idle)',    cls: 'warn',    label: 'Stopped' },
    deviceMoving:     { icon: '🏃', color: 'var(--accent)',  cls: 'green',   label: 'Moving' },
    deviceUnknown:    { icon: 'ℹ️', color: 'var(--muted)',   cls: 'gray',    label: 'Unknown' },
    driverChanged:    { icon: '🧑', color: 'var(--accent2)', cls: 'purple',  label: 'Driver Changed' },
  };

  function meta(type) { return TYPE_META[type] || { icon: 'ℹ️', color: 'var(--muted)', cls: 'gray', label: type || 'Event' }; }

  function register() {
    Views.register('events', { init, onShow, onHide });
  }

  function init() {
    document.getElementById('view-events').innerHTML = `
      <div class="split-panel" style="width:100%">
        <div class="panel-left events-sidebar">
          <div class="panel-header-bar">
            <div class="panel-title-sm">Events Monitor</div>
            <div class="panel-sub-sm">Real-time fleet alerts</div>
          </div>
          <div style="padding:8px 12px 0">
            <div class="search-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search events…" id="event-search" oninput="EventsView.filter(this.value)">
            </div>
            <div style="display:flex;gap:6px;margin:8px 0 4px">
              <select id="event-type-filter" style="font-size:11px;padding:5px 8px" onchange="EventsView.filter()">
                <option value="">All types</option>
                ${Object.entries(TYPE_META).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
              </select>
              <select id="event-device-filter" style="font-size:11px;padding:5px 8px" onchange="EventsView.filter()">
                <option value="">All vehicles</option>
              </select>
            </div>
          </div>
          <div class="panel-scroll" id="events-list"></div>
        </div>
        <div class="event-detail-pane" id="event-detail-pane">
          <div class="empty-state" style="height:100%;justify-content:center" id="events-empty">
            <div class="empty-icon">📡</div>
            <div class="empty-title">Select an event</div>
            <div class="empty-sub">Click any event to see vehicle details, location and status</div>
          </div>
          <div id="event-detail-content" style="display:none;flex-direction:column;height:100%;overflow:hidden">
            <div class="event-detail-map" id="event-mini-map"></div>
            <div class="event-detail-body" id="event-detail-body"></div>
          </div>
        </div>
      </div>`;

    State.on('events', renderList);
    State.on('devices', () => { populateDeviceFilter(); renderList(); });
    populateDeviceFilter();
    renderList();
  }

  function onShow() { if (_eMap) _eMap.invalidateSize(); }
  function onHide() {}

  function populateDeviceFilter() {
    const sel = document.getElementById('event-device-filter');
    if (!sel) return;
    const devices = State.get('devices');
    sel.innerHTML = '<option value="">All vehicles</option>' + devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  function filter(q) {
    if (q !== undefined) _filter = q;
    renderList();
  }

  function renderList() {
    const list = document.getElementById('events-list');
    if (!list) return;
    const typeF   = document.getElementById('event-type-filter')?.value || '';
    const deviceF = document.getElementById('event-device-filter')?.value || '';
    let events = State.get('events') || [];

    if (_filter) {
      const q = _filter.toLowerCase();
      events = events.filter(e => {
        const d = State.getDevice(e.deviceId);
        return (d?.name || '').toLowerCase().includes(q) || (e.type || '').toLowerCase().includes(q);
      });
    }
    if (typeF)   events = events.filter(e => e.type === typeF);
    if (deviceF) events = events.filter(e => e.deviceId == deviceF);

    if (!events.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">No events</div></div>`; return; }

    const selectedId = State.get('selectedEvent');
    list.innerHTML = events.slice(0, 100).map((e, i) => {
      const m = meta(e.type);
      const d = State.getDevice(e.deviceId);
      return `<div class="event-item ${selectedId === i ? 'selected' : ''}" onclick="EventsView.showDetail(${i})">
        <div class="event-type-icon" style="background:${m.color}22">${m.icon}</div>
        <div class="event-item-body">
          <div class="event-item-title">${m.label}</div>
          <div class="event-item-device">${d?.name || 'Unknown device'}</div>
        </div>
        <div class="event-item-time">${Fmt.time(e.serverTime)}</div>
      </div>`;
    }).join('');
  }

  function showDetail(idx) {
    State.set('selectedEvent', idx);
    const events = State.get('events');
    const e = events[idx];
    if (!e) return;
    const d = State.getDevice(e.deviceId);
    const p = State.getPosition(e.deviceId) || {};
    const attrs = p.attributes || {};
    const m = meta(e.type);

    document.getElementById('events-empty').style.display = 'none';
    const detailWrap = document.getElementById('event-detail-content');
    detailWrap.style.display = 'flex';

    // init or update mini-map
    if (!_eMap) {
      _eMap = MapUtil.createMap('event-mini-map');
    }
    if (p.latitude) {
      _eMap.setView([p.latitude, p.longitude], 15);
      if (_eMarker) _eMap.removeLayer(_eMarker);
      _eMarker = L.marker([p.latitude, p.longitude], { icon: MapUtil.pinIcon(m.color, m.icon) }).addTo(_eMap);
    }
    _eMap.invalidateSize();

    const speed   = p.speed     ? Fmt.speed(p.speed) : '0 km/h';
    const battery = (attrs.battery || attrs.power || 12.4).toFixed(1);
    const ignition = attrs.ignition !== undefined ? attrs.ignition : true;
    const kmToday = ((p.attributes?.totalDistance || 0) / 1000 || Math.random() * 150).toFixed(1);

    document.getElementById('event-detail-body').innerHTML = `
      <!-- Event Header -->
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:42px;height:42px;border-radius:var(--radius-sm);background:${m.color}22;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${m.icon}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:16px;font-weight:700">${m.label}</div>
          <div style="font-size:12px;color:var(--muted)">${d?.name || 'Unknown'} · ${Fmt.datetime(e.serverTime)}</div>
        </div>
      </div>

      <!-- Location -->
      <div>
        <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">📍 Location</div>
        <div class="card card-sm" style="padding:12px">
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent)">${Fmt.coord(p.latitude)}, ${Fmt.coord(p.longitude)}</div>
          ${p.address ? `<div style="font-size:12px;color:var(--muted);margin-top:4px">${p.address}</div>` : ''}
        </div>
      </div>

      <!-- Vehicle Status -->
      <div>
        <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">⚡ Vehicle Status</div>
        <div class="vehicle-status-grid">
          <div class="vstatus-card">
            <div class="vstatus-label">Speed</div>
            <div class="vstatus-value" style="color:var(--accent)">${speed.split(' ')[0]}</div>
            <div class="vstatus-unit">km/h</div>
          </div>
          <div class="vstatus-card">
            <div class="vstatus-label">Ignition</div>
            <div style="margin-top:8px"><span class="badge ${ignition ? 'badge-online' : 'badge-offline'}">${ignition ? '🔑 ON' : '🔒 OFF'}</span></div>
          </div>
          <div class="vstatus-card">
            <div class="vstatus-label">Battery Voltage</div>
            <div class="vstatus-value" style="color:var(--warn)">${battery}</div>
            <div class="vstatus-unit">Volts</div>
          </div>
          <div class="vstatus-card">
            <div class="vstatus-label">KM Today</div>
            <div class="vstatus-value" style="color:var(--accent2)">${kmToday}</div>
            <div class="vstatus-unit">km traveled</div>
          </div>
        </div>
      </div>

      <!-- Progress Bars -->
      <div>
        <div class="progress-bar-row">
          <div class="progress-label-row"><span>Battery Level</span><span>${Math.min(100,(+battery/14.8*100)).toFixed(0)}%</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,(+battery/14.8*100)).toFixed(0)}%"></div></div>
        </div>
        <div class="progress-bar-row">
          <div class="progress-label-row"><span>Daily KM Progress</span><span>${kmToday} / 200 km</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${Math.min(parseFloat(kmToday)/2,100).toFixed(0)}%;background:linear-gradient(90deg,var(--accent2),var(--accent))"></div></div>
        </div>
      </div>

      <!-- Device info -->
      <div class="card card-sm" style="padding:12px">
        <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Device Info</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--muted)">
          <div>Name: <b style="color:var(--text)">${d?.name || '—'}</b></div>
          <div>ID: <span style="font-family:var(--font-mono);color:var(--accent)">${d?.uniqueId || '—'}</span></div>
          <div>Status: <span class="badge badge-${Fmt.statusClass(d?.status)}">${d?.status || 'offline'}</span></div>
          <div>Course: <b style="color:var(--text)">${p.course ? Math.round(p.course) + '°' : '—'}</b></div>
        </div>
      </div>`;

    renderList(); // highlight selected
  }

  return { register, filter, showDetail };
})();
