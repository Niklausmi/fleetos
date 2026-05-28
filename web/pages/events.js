/* ═══════════════════════════════════════════
   pages/events.js — Events Monitor
   - Map shows exact event location (from event position, not latest)
   - Customer details panel from device attributes
   - Event position fetched from Traccar /api/positions?id=X
═══════════════════════════════════════════ */
const EventsView = (() => {
  let _filter    = '';
  let _eMap      = null;
  let _eMarker   = null;
  let _selectedIdx = null;

  const TYPE_META = {
    deviceOverspeed: { icon: '⚡', color: '#f59e0b', label: 'Overspeed'      },
    geofenceEnter:   { icon: '📍', color: '#8b5cf6', label: 'Geofence Entry' },
    geofenceExit:    { icon: '🚪', color: '#8b5cf6', label: 'Geofence Exit'  },
    ignitionOn:      { icon: '🔑', color: '#10b981', label: 'Ignition ON'    },
    ignitionOff:     { icon: '🔒', color: '#64748b', label: 'Ignition OFF'   },
    deviceOnline:    { icon: '✅', color: '#10b981', label: 'Device Online'  },
    deviceOffline:   { icon: '❌', color: '#ef4444', label: 'Device Offline' },
    alarm:           { icon: '🚨', color: '#ef4444', label: 'Alarm'          },
    deviceStopped:   { icon: '🛑', color: '#f59e0b', label: 'Stopped'        },
    deviceMoving:    { icon: '🏃', color: '#10b981', label: 'Moving'         },
    deviceUnknown:   { icon: 'ℹ️', color: '#64748b', label: 'Unknown'        },
    driverChanged:   { icon: '🧑', color: '#8b5cf6', label: 'Driver Changed' },
    maintenance:     { icon: '🔧', color: '#f59e0b', label: 'Maintenance'    },
    lowBattery:      { icon: '🔋', color: '#ef4444', label: 'Low Battery'    },
  };

  function meta(type) {
    return TYPE_META[type] || { icon: 'ℹ️', color: '#64748b', label: type || 'Event' };
  }

  function register() {
    Views.register('events', { init, onShow, onHide });
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    document.getElementById('view-events').innerHTML = `
      <div style="display:flex;flex:1;height:100%;overflow:hidden;min-height:0">

        <!-- LEFT: event list -->
        <div style="width:340px;min-width:340px;display:flex;flex-direction:column;
                    background:var(--bg2);border-right:1px solid var(--border-s);overflow:hidden">

          <div style="padding:14px 14px 10px;border-bottom:1px solid var(--border-s);flex-shrink:0">
            <div style="font-size:13px;font-weight:600;margin-bottom:10px">Events Monitor</div>
            <div class="search-wrap" style="margin-bottom:8px">
              <span class="search-icon">🔍</span>
              <input type="text" id="event-search" placeholder="Search vehicle, type…"
                     oninput="EventsView.filter(this.value)">
            </div>
            <div style="display:flex;gap:6px">
              <select id="event-type-filter"
                      style="flex:1;font-size:11px;padding:5px 8px"
                      onchange="EventsView.filter()">
                <option value="">All types</option>
                ${Object.entries(TYPE_META).map(([k,v]) =>
                  `<option value="${k}">${v.label}</option>`
                ).join('')}
              </select>
              <select id="event-device-filter"
                      style="flex:1;font-size:11px;padding:5px 8px"
                      onchange="EventsView.filter()">
                <option value="">All vehicles</option>
              </select>
            </div>
          </div>

          <div class="panel-scroll" id="events-list"></div>
        </div>

        <!-- RIGHT: map (top) + detail panel (bottom) -->
        <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;width:0">

          <!-- MAP — fixed height, stretches full width -->
          <div style="position:relative;height:300px;flex-shrink:0;border-bottom:1px solid var(--border-s);width:100%">
            <div id="event-mini-map" style="position:absolute;inset:0"></div>

            <!-- Empty state overlay before any event selected -->
            <div id="map-empty-overlay" style="
              position:absolute;inset:0;z-index:500;
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              background:var(--bg2);gap:8px;pointer-events:none">
              <div style="font-size:36px;opacity:0.25">🗺️</div>
              <div style="font-size:13px;font-weight:500;color:var(--text-2)">Select an event</div>
              <div style="font-size:11.5px;color:var(--muted)">The event location will appear here</div>
            </div>
          </div>

          <!-- DETAIL PANEL — fills remaining height, full width, scrollable -->
          <div id="event-detail-body"
               style="flex:1;overflow-y:auto;overflow-x:hidden;
                      padding:16px 20px;
                      display:flex;flex-direction:column;gap:14px;
                      min-height:0;width:100%;box-sizing:border-box">
          </div>
        </div>
      </div>`;

    // Init map immediately (always visible)
    _eMap = MapUtil.createMap('event-mini-map');
    _eMap.setView([30, 70], 5);
    // Force Leaflet to measure correct dimensions after render
    setTimeout(() => _eMap?.invalidateSize(), 50);

    State.on('events',  renderList);
    State.on('devices', () => { populateDeviceFilter(); renderList(); });
    populateDeviceFilter();
    renderList();
  }

  function onShow() {
    setTimeout(() => _eMap?.invalidateSize(), 120);
  }
  function onHide() {}

  /* ─────────────────────────────────────────
     LIST
  ───────────────────────────────────────── */
  function populateDeviceFilter() {
    const sel = document.getElementById('event-device-filter');
    if (!sel) return;
    sel.innerHTML = '<option value="">All vehicles</option>' +
      State.get('devices').map(d =>
        `<option value="${d.id}">${d.name}</option>`
      ).join('');
  }

  function filter(q) {
    if (q !== undefined) _filter = q;
    renderList();
  }

  function renderList() {
    const list = document.getElementById('events-list');
    if (!list) return;

    const typeF   = document.getElementById('event-type-filter')?.value   || '';
    const deviceF = document.getElementById('event-device-filter')?.value || '';
    let events    = [...(State.get('events') || [])].reverse(); // newest first

    if (_filter) {
      const q = _filter.toLowerCase();
      events = events.filter(e => {
        const d = State.getDevice(e.deviceId);
        return (d?.name||'').toLowerCase().includes(q) ||
               (e.type||'').toLowerCase().includes(q);
      });
    }
    if (typeF)   events = events.filter(e => e.type === typeF);
    if (deviceF) events = events.filter(e => e.deviceId == deviceF);

    if (!events.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🔔</div>
        <div class="empty-title">No events</div>
        <div class="empty-sub">Events appear here as devices trigger alerts</div>
      </div>`;
      return;
    }

    list.innerHTML = events.slice(0, 150).map((e, i) => {
      const m = meta(e.type);
      const d = State.getDevice(e.deviceId);
      const a = d?.attributes || {};
      const plate = a.plate || a.vrn || '';
      const isSel = _selectedIdx === i;

      return `<div class="event-item ${isSel ? 'selected' : ''}"
                   onclick="EventsView.showDetail(${i}, ${JSON.stringify(e).replace(/"/g,'&quot;')})">
        <div class="event-type-icon" style="background:${m.color}22;color:${m.color}">
          ${m.icon}
        </div>
        <div class="event-item-body">
          <div class="event-item-title">${m.label}</div>
          <div class="event-item-device">
            ${d?.name || 'Unknown'}${plate ? ` · ${plate}` : ''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;min-width:80px">
          <div class="event-item-time">${Fmt.time(e.serverTime)}</div>
          <div style="font-size:9px;color:var(--muted2);margin-top:2px">${Fmt.date(e.serverTime)}</div>
        </div>
      </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────
     DETAIL — map + full info panel
  ───────────────────────────────────────── */
  async function showDetail(idx, evtObj) {
    _selectedIdx = idx;
    renderList(); // highlight selected row

    const events = [...(State.get('events') || [])].reverse();
    const e = evtObj || events[idx];
    if (!e) return;

    const m = meta(e.type);
    const d = State.getDevice(e.deviceId);
    const a = d?.attributes || {};  // FAMS attributes

    // Hide map overlay
    const overlay = document.getElementById('map-empty-overlay');
    if (overlay) overlay.style.display = 'none';
    // Force Leaflet to recalculate size now overlay is hidden
    setTimeout(() => _eMap?.invalidateSize(), 50);

    // Show loading state in detail body
    const body = document.getElementById('event-detail-body');
    if (body) body.innerHTML = `
      <div style="color:var(--muted);font-size:13px;padding:20px 0">Loading event location…</div>`;

    /* ── Fetch event position ────────────── */
    let evtPos = null;

    // 1. Try event.positionId (Traccar attaches this to events)
    if (e.positionId) {
      try {
        const res = await fetch(
          `${API.getBase()}/positions?id=${e.positionId}`,
          { headers: { Authorization: API.getAuth() }, credentials: 'include' }
        );
        if (res.ok) {
          const arr = await res.json();
          if (arr?.length) evtPos = arr[0];
        }
      } catch {}
    }

    // 2. Fallback: use device's current position
    if (!evtPos) evtPos = State.getPosition(e.deviceId) || {};

    /* ── Place marker on map at EVENT location ── */
    if (evtPos?.latitude) {
      if (_eMarker) { try { _eMap.removeLayer(_eMarker); } catch {} }

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:${m.color};border:3px solid #fff;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;box-shadow:0 2px 12px ${m.color}55">
          ${m.icon}
        </div>`,
        iconSize: [36, 36], iconAnchor: [18, 18],
      });

      _eMarker = L.marker([evtPos.latitude, evtPos.longitude], { icon })
        .addTo(_eMap)
        .bindPopup(`
          <div style="font-family:sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:4px">
              ${m.icon} ${m.label}
            </div>
            <div style="font-size:11px;color:#64748b;margin-bottom:6px">
              ${Fmt.datetime(e.serverTime)}
            </div>
            <div style="font-family:monospace;font-size:11px;color:#6366f1">
              ${evtPos.latitude.toFixed(6)}, ${evtPos.longitude.toFixed(6)}
            </div>
            ${evtPos.address ? `<div style="font-size:11px;color:#475569;margin-top:5px;line-height:1.4">${evtPos.address}</div>` : ''}
            ${evtPos.speed ? `<div style="font-size:12px;font-weight:600;color:#10b981;margin-top:5px">${+(evtPos.speed*1.852).toFixed(0)} km/h</div>` : ''}
          </div>`, { maxWidth: 280 }
        ).openPopup();

      _eMap.flyTo([evtPos.latitude, evtPos.longitude], 15, { duration: 0.8 });
    } else {
      _eMap.setView([30, 70], 5);
    }

    _eMap.invalidateSize();

    /* ── Build detail body ─────────────────── */
    const pa   = evtPos?.attributes || {};
    const spd  = evtPos?.speed ? +(evtPos.speed * 1.852).toFixed(1) : 0;
    const bat  = pa.battery ?? pa.externalBattery ?? pa.power ?? null;
    const ign  = pa.ignition;
    const sat  = pa.satellites ?? pa.sat;
    const dist = pa.totalDistance ? (pa.totalDistance / 1000).toFixed(1) : null;

    // Customer details from FAMS attributes
    const hasCustomer = a.customerName || a.mobile1 || a.mobile2 || a.secondaryDriver;
    const hasVehicle  = a.plate || a.make || a.model || a.colour || a.simNumber;

    if (body) body.innerHTML = `

      <!-- Event header -->
      <div style="display:flex;align-items:center;gap:12px;padding-bottom:12px;
                  border-bottom:1px solid var(--border-s)">
        <div style="width:44px;height:44px;border-radius:var(--radius);flex-shrink:0;
                    background:${m.color}20;border:1px solid ${m.color}40;
                    display:flex;align-items:center;justify-content:center;font-size:22px">
          ${m.icon}
        </div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700;color:var(--text)">${m.label}</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:2px">
            ${d?.name || 'Unknown'} · ${Fmt.datetime(e.serverTime)}
          </div>
        </div>
        <span class="badge badge-${Fmt.statusClass(d?.status)}">${d?.status||'offline'}</span>
      </div>

      <!-- Location -->
      ${evtPos?.latitude ? `
      <div>
        <div class="vc-section-title">📍 Event Location</div>
        <div style="background:var(--bg3);border:1px solid var(--border-s);border-radius:var(--radius-sm);padding:11px 13px;margin-top:8px">
          <div style="font-family:var(--font-mono);font-size:11.5px;color:var(--primary);margin-bottom:4px">
            ${evtPos.latitude.toFixed(6)}, ${evtPos.longitude.toFixed(6)}
          </div>
          ${evtPos.address ? `<div style="font-size:12px;color:var(--muted);line-height:1.5">${evtPos.address}</div>` : ''}
          <a href="https://maps.google.com/?q=${evtPos.latitude},${evtPos.longitude}"
             target="_blank"
             style="display:inline-block;margin-top:6px;font-size:11px;color:var(--primary)">
            Open in Google Maps ↗
          </a>
        </div>
      </div>` : `
      <div class="note note-warn">
        <span class="note-icon">⚠️</span>
        No location data available for this event.
      </div>`}

      <!-- Live sensor data -->
      <div>
        <div class="vc-section-title">⚡ Sensor Data at Event Time</div>
        <div class="vc-stats-grid" style="margin-top:8px;grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
          ${vcStat('Speed',    spd > 0 ? spd.toFixed(0) + ' km/h' : 'Stopped',
                               spd > 0 ? '#10b981' : 'var(--muted)')}
          ${vcStat('Ignition', ign !== undefined ? (ign ? 'ON' : 'OFF') : '—',
                               ign === true ? '#10b981' : ign === false ? '#ef4444' : 'var(--muted)')}
          ${vcStat('Satellites', sat !== undefined ? sat.toString() : '—')}
          ${vcStat('Battery',  bat !== null ? (+bat).toFixed(2) + ' V' : '—',
                               bat !== null ? (bat >= 12.4 ? '#10b981' : bat >= 11.8 ? '#f59e0b' : '#ef4444') : 'var(--muted)')}
          ${vcStat('Odometer', dist ? dist + ' km' : '—', '#6366f1')}
          ${vcStat('Heading',  evtPos?.course !== undefined ? headingLabel(evtPos.course) : '—')}
        </div>
      </div>

      <!-- Vehicle info -->
      ${hasVehicle ? `
      <div>
        <div class="vc-section-title">🚗 Vehicle Information</div>
        <div class="vc-info-grid" style="margin-top:8px">
          ${a.plate    ? vcRow('Plate / VRN',  a.plate || a.vrn) : ''}
          ${a.make     ? vcRow('Make',         a.make) : ''}
          ${a.model    ? vcRow('Model',        a.model || d?.model) : ''}
          ${a.colour   ? vcRow('Colour',       a.colour || a.color) : ''}
          ${a.vehicleType ? vcRow('Type',      a.vehicleType) : ''}
          ${a.engineType  ? vcRow('Engine',    a.engineType) : ''}
          ${a.simNumber   ? vcRow('SIM No.',   a.simNumber) : ''}
          ${d?.uniqueId   ? vcRow('IMEI',      d.uniqueId, true) : ''}
        </div>
      </div>` : ''}

      <!-- Customer details -->
      ${hasCustomer ? `
      <div>
        <div class="vc-section-title">👤 Customer Details</div>
        <div class="vc-info-grid" style="margin-top:8px">
          ${a.customerName    ? vcRow('Customer Name',  a.customerName) : ''}
          ${a.mobile1||d?.phone ? vcRow('Mobile 1', a.mobile1||d?.phone) : ''}
          ${a.mobile2         ? vcRow('Mobile 2',       a.mobile2) : ''}
          ${a.secondaryDriver ? vcRow('Driver',         a.secondaryDriver) : ''}
          ${a.emergencyContact1 ? vcRow('Emergency 1',  a.emergencyContact1) : ''}
          ${a.emergencyContact2 ? vcRow('Emergency 2',  a.emergencyContact2) : ''}
          ${a.address         ? vcRow('Address',        a.address) : ''}
          ${a.nicNo           ? vcRow('NIC No.',        a.nicNo) : ''}
        </div>
      </div>` : `
      <div class="note">
        <span class="note-icon">ℹ️</span>
        No customer details — add them in Devices → Edit → Customer Details tab.
      </div>`}

      <!-- Quick actions -->
      <div class="vc-actions" style="padding-bottom:4px">
        <button class="btn btn-primary btn-sm"
                onclick="Dashboard.selectDevice(${e.deviceId});Views.show('dashboard')">
          🗺️ Track Live
        </button>
        <button class="btn btn-secondary btn-sm"
                onclick="PlaybackView._goPlaybackFor?.(${e.deviceId}) || (State.set('selectedDevice',${e.deviceId}),Views.show('playback'))">
          ⏮️ Playback
        </button>
        <button class="btn btn-secondary btn-sm"
                onclick="DevicesView.openForm(${e.deviceId})">
          ✏️ Edit Device
        </button>
      </div>`;
  }

  /* ── Helpers ─────────────────────────── */
  function vcStat(label, value, color = '') {
    return `<div class="vc-stat">
      <div class="vc-stat-lbl">${label}</div>
      <div class="vc-stat-val"${color ? ` style="color:${color}"` : ''}>${value}</div>
    </div>`;
  }

  function vcRow(label, value, mono = false) {
    return `<div class="vc-info-row">
      <span class="vc-info-lbl">${label}</span>
      <span class="vc-info-val${mono ? ' mono' : ''}">${value}</span>
    </div>`;
  }

  function headingLabel(deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round((deg||0)/45)%8] + ' ' + (deg||0).toFixed(0)+'°';
  }

  return { register, filter, showDetail };
})();
