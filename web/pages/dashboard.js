/* ═══════════════════════════════════════════
   pages/dashboard.js — Live Map  (v4 layout)
   Axion Track-style: KPI strip + map + fleet panel
═══════════════════════════════════════════ */
const Dashboard = (() => {
  let _filter = '';
  let _selectedId = null;
  let _contactOpenId = null;
  let _statusFilter = '';

  function register() {
    Views.register('dashboard', { init, onShow, onHide });
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    document.getElementById('view-dashboard').innerHTML = `

      <!-- ═══ KPI ROW ═══ -->
      <div class="dash-kpi-row">
        <div class="kpi-card-v kpi-online">
          <div class="kpi-card-top">
            <div class="kpi-card-label">Online</div>
            <div class="kpi-card-trend up" id="kpi-trend-online" style="display:none"></div>
          </div>
          <div class="kpi-card-value" id="kpi-online">0</div>
        </div>
        <div class="kpi-card-v kpi-idle">
          <div class="kpi-card-top">
            <div class="kpi-card-label">Idle</div>
            <div class="kpi-card-trend" id="kpi-trend-idle" style="display:none"></div>
          </div>
          <div class="kpi-card-value" id="kpi-idle">0</div>
        </div>
        <div class="kpi-card-v kpi-offline">
          <div class="kpi-card-top">
            <div class="kpi-card-label">Offline</div>
            <div class="kpi-card-trend" id="kpi-trend-offline" style="display:none"></div>
          </div>
          <div class="kpi-card-value" id="kpi-offline">0</div>
        </div>
        <div class="kpi-card-v kpi-total">
          <div class="kpi-card-top">
            <div class="kpi-card-label">Total Fleet</div>
          </div>
          <div class="kpi-card-value" id="kpi-total">0</div>
        </div>
      </div>

      <!-- ═══ BODY: MAP + FLEET PANEL ═══ -->
      <div class="dash-body">

        <!-- MAP CARD -->
        <div class="map-card">
          <div class="map-card-header">
            <div class="map-card-title">
              <span class="live-pulse"></span>
              Live Tracking
            </div>
            <div class="map-ctrl-btns">
              <button class="map-ctrl-btn active" onclick="Dashboard.cycleMapStyle()">🗺️ Map</button>
              <button class="map-ctrl-btn" onclick="LiveMap.fitAll(State.get('positions'))">⊡ Fit</button>
              <button class="map-ctrl-btn" id="btn-online-filter"
                onclick="Dashboard.toggleOnlineFilter()">🟢 Online</button>
            </div>
          </div>
          <div style="position:relative;flex:1;overflow:hidden">
            <div id="main-map" style="width:100%;height:100%"></div>

            <!-- Device Attribute Panel -->
            <div class="attr-panel" id="attr-panel" style="display:none">
              <div class="attr-panel-top">
                <div class="attr-panel-name" id="attr-name">—</div>
                <div class="attr-panel-meta" id="attr-meta">—</div>
                <div class="attr-panel-status" id="attr-status"></div>
                <button class="attr-panel-close" onclick="Dashboard.closeAttrPanel()">×</button>
              </div>
              <div class="attr-scroll" id="attr-scroll"></div>
            </div>
          </div>
        </div>

        <!-- FLEET STATUS PANEL -->
        <div class="fleet-panel">
          <div class="fleet-panel-header">
            <div class="fleet-panel-title">Fleet Status</div>
            <div class="filter-tabs">
              <button class="filter-tab active" data-s="" onclick="Dashboard.setStatusFilter('')">All</button>
              <button class="filter-tab" data-s="online"  onclick="Dashboard.setStatusFilter('online')">Online</button>
              <button class="filter-tab" data-s="offline" onclick="Dashboard.setStatusFilter('offline')">Offline</button>
            </div>
          </div>
          <div class="fleet-list" id="device-list"></div>

          <!-- Contact popup at bottom of fleet panel -->
          <div class="contact-popup" id="contact-popup" style="display:none">
            <div class="contact-popup-header">
              <div class="contact-popup-title" id="cp-title">Vehicle Contact</div>
              <button class="contact-popup-close" onclick="Dashboard.closeContact()">×</button>
            </div>
            <div class="contact-popup-body" id="cp-body"></div>
          </div>
        </div>

      </div>`;

    LiveMap.init('main-map');

    State.on('devices',   () => { renderDeviceList(); updateKPIs(); });
    State.on('positions', () => {
      renderDeviceList(); updateKPIs();
      LiveMap.update(State.get('devices'), State.get('positions'));
      if (_selectedId) refreshAttrPanel(_selectedId);
    });

    LiveMap.update(State.get('devices'), State.get('positions'));
    renderDeviceList();
    updateKPIs();
  }

  function onShow() { LiveMap.invalidate(); }
  function onHide() { closeAttrPanel(); closeContact(); }

  /* ─────────────────────────────────────────
     MAP STYLE / FILTER
  ───────────────────────────────────────── */
  let _mapStyleIdx = 0;
  const _styles = ['dark', 'satellite', 'streets'];
  function cycleMapStyle() {
    _mapStyleIdx = (_mapStyleIdx + 1) % _styles.length;
    LiveMap.setStyle(_styles[_mapStyleIdx]);
  }

  let _onlineFilter = false;
  function toggleOnlineFilter() {
    _onlineFilter = !_onlineFilter;
    setStatusFilter(_onlineFilter ? 'online' : '');
    const btn = document.getElementById('btn-online-filter');
    if (btn) btn.classList.toggle('active', _onlineFilter);
  }

  /* ─────────────────────────────────────────
     DEVICE LIST
  ───────────────────────────────────────── */
  function setStatusFilter(s) {
    _statusFilter = s;
    document.querySelectorAll('.filter-tab').forEach(b =>
      b.classList.toggle('active', b.dataset.s === s));
    renderDeviceList();
  }

  function filterDevices(q) { _filter = q; renderDeviceList(); }

  function renderDeviceList() {
    const devices   = State.get('devices');
    const positions = State.get('positions');
    const list      = document.getElementById('device-list');
    if (!list) return;

    let items = filterList(devices, _filter, ['name', 'uniqueId']);
    if (_statusFilter) items = items.filter(d => d.status === _statusFilter);

    if (!items.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📡</div>
        <div class="empty-title">No vehicles found</div></div>`;
      return;
    }

    list.innerHTML = items.map(d => {
      const p     = positions[d.id] || {};
      const attrs = p.attributes || {};
      const s     = Fmt.statusClass(d.status);
      const spd   = p.speed ? Fmt.speed(p.speed) : (d.status === 'idle' ? 'Idle' : 'Offline');
      const driver = (d.attributes||{}).driverName || d.contact || '—';
      const loc    = d.lastAddress || ((p.latitude) ? `${Fmt.coord(p.latitude)}, ${Fmt.coord(p.longitude)}` : '—');
      const isSel  = _selectedId === d.id;
      const isCon  = _contactOpenId === d.id;

      return `
        <div class="device-item ${isSel ? 'selected' : ''}"
             onclick="Dashboard.selectDevice(${d.id})">
          <div class="status-dot ${s}"></div>
          <div class="device-item-info">
            <div class="device-item-name">${d.name}</div>
            <div class="device-item-meta">${driver} | ${loc}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <div class="device-item-speed ${s}">${spd}</div>
            <button class="contact-btn ${isCon ? 'contact-btn-active' : ''}"
                    title="Vehicle details"
                    onclick="event.stopPropagation();Dashboard.openContact(${d.id})">👤</button>
          </div>
        </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────
     SELECT DEVICE
  ───────────────────────────────────────── */
  function selectDevice(id) {
    _selectedId = id;
    State.set('selectedDevice', id);
    LiveMap.focusDevice(id, State.get('positions'));
    renderDeviceList();
    openAttrPanel(id);
  }

  function onDeviceClick(id) { selectDevice(id); }

  /* ─────────────────────────────────────────
     ATTRIBUTE PANEL
  ───────────────────────────────────────── */
  function openAttrPanel(id) {
    const panel = document.getElementById('attr-panel');
    if (panel) panel.style.display = 'flex';
    refreshAttrPanel(id);
  }

  function closeAttrPanel() {
    _selectedId = null;
    State.set('selectedDevice', null);
    const panel = document.getElementById('attr-panel');
    if (panel) panel.style.display = 'none';
    renderDeviceList();
  }

  function refreshAttrPanel(id) {
    const d = State.getDevice(id);
    const p = State.getPosition(id) || {};
    if (!d) return;

    const nameEl   = document.getElementById('attr-name');
    const metaEl   = document.getElementById('attr-meta');
    const statusEl = document.getElementById('attr-status');
    const scroll   = document.getElementById('attr-scroll');
    if (!nameEl || !scroll) return;

    const a   = p.attributes || {};
    const spd = p.speed ? +(p.speed * 1.852).toFixed(1) : 0;

    nameEl.textContent = d.name;
    if (metaEl) metaEl.textContent = `${d.uniqueId || ''} · ${Fmt.ago(p.fixTime)}`;

    // Status pill in header
    if (statusEl) {
      const s = d.status || 'offline';
      const pillCls = s==='online' ? 'attr-pill-on' : s==='idle' ? 'attr-pill-warn' : 'attr-pill-off';
      const dot = s==='online' ? '●' : s==='idle' ? '◐' : '○';
      statusEl.innerHTML = `<span class="attr-pill ${pillCls}">${dot} ${s}</span>`;
    }

    /* ── PRIMARY METRICS ─────────────────── */
    const metrics = [];

    // Speed — always first, highlighted
    metrics.push(M('Speed', spdFmt(spd), 'km/h', spd > 0 ? spdClr(spd) : '', spd > 0 ? 'lg' : ''));

    // Heading
    if (p.course !== undefined)
      metrics.push(M('Heading', headingLabel(p.course), '', '', ''));

    // Ignition — pill style
    if (a.ignition !== undefined)
      metrics.push(M('Ignition', null, '', '', '', a.ignition));

    // Motion
    if (a.motion !== undefined)
      metrics.push(M('Motion', a.motion ? 'Moving' : 'Stopped', '', '', a.motion ? 'move' : ''));

    // Battery / power
    const bat = a.battery ?? a.externalBattery ?? a.power ?? a.voltage;
    if (bat !== undefined)
      metrics.push(M('Battery', (+bat).toFixed(2), 'V', batClr(bat), ''));

    // Fuel
    const fuel = a.fuel ?? a.fuelLevel;
    if (fuel !== undefined)
      metrics.push(M('Fuel', (+fuel).toFixed(1), fuel > 10 ? 'L' : '%',
        fuel > 20 ? 'var(--success)' : 'var(--warn)', ''));

    // Satellites
    const sat = a.satellites ?? a.sat;
    if (sat !== undefined)
      metrics.push(M('Satellites', sat, '', sat>=6?'var(--success)':sat>=3?'var(--warn)':'var(--danger)', ''));

    // RPM
    if (a.rpm !== undefined)
      metrics.push(M('RPM', Math.round(a.rpm), '', '', ''));

    // Coolant temp
    if (a.coolantTemp !== undefined)
      metrics.push(M('Coolant', (+a.coolantTemp).toFixed(1), '°C',
        a.coolantTemp>100 ? 'var(--danger)' : '', ''));

    // Odometer
    if (a.totalDistance !== undefined)
      metrics.push(M('Odometer', (a.totalDistance/1000).toFixed(0), 'km', 'var(--primary)', ''));

    // Location coords — compact
    if (p.latitude)
      metrics.push(M('Location', `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`, '', '', 'mono'));

    /* ── EXTRA CHIPS (unknown / secondary attrs) ── */
    const KNOWN = new Set(['ignition','motion','battery','externalBattery','power','voltage',
      'fuel','fuelLevel','rpm','coolantTemp','throttle','obdSpeed','hours','totalDistance',
      'distance','satellites','sat','hdop','pdop','rssi','charge','alarm','driverUniqueId',
      'driver','battery2','internalBattery','temp','temperature','temp1','index','event',
      'bleTemperature','io']);

    const chips = [];
    // HDOP, accuracy — useful but secondary
    if (a.hdop !== undefined)
      chips.push(chip('HDOP', (+a.hdop).toFixed(2)));
    if (p.accuracy && p.accuracy > 0)
      chips.push(chip('Acc', (+p.accuracy).toFixed(0)+'m'));
    if (p.altitude && p.altitude !== 0)
      chips.push(chip('Alt', (+p.altitude).toFixed(0)+'m'));
    if (a.rssi !== undefined)
      chips.push(chip('Signal', a.rssi+'dBm'));
    if (a.driverUniqueId || a.driver)
      chips.push(chip('Driver', a.driverUniqueId||a.driver));
    if (a.alarm)
      chips.push(chip('Alarm', a.alarm, true));
    if (a.obdSpeed !== undefined)
      chips.push(chip('OBD Spd', (+a.obdSpeed).toFixed(0)+'km/h'));
    if (a.throttle !== undefined)
      chips.push(chip('Throttle', (+a.throttle).toFixed(0)+'%'));
    if (a.hours !== undefined)
      chips.push(chip('Eng.Hrs', (a.hours/3600).toFixed(1)+'h'));
    // Unknown extras
    Object.entries(a).forEach(([k, v]) => {
      if (KNOWN.has(k) || v === undefined || v === null || String(v).trim() === '') return;
      const cls = v === true ? 'ev-true' : v === false ? 'ev-false'
        : typeof v === 'number' ? 'ev-num' : '';
      chips.push(`<span class="attr-extra-chip"><span class="ek">${k}</span><span class="ev ${cls}">${v}</span></span>`);
    });

    scroll.innerHTML = `
      <div class="attr-metrics">${metrics.join('')}</div>
      ${chips.length ? `<div class="attr-extras">${chips.join('')}</div>` : ''}
    `;
  }

  /* Build a metric cell */
  function M(label, value, unit, color, size, ignition) {
    if (ignition !== undefined) {
      const cls = ignition ? 'attr-pill-on' : 'attr-pill-off';
      const txt = ignition ? '● ON' : '○ OFF';
      return `<div class="attr-metric">
        <div class="attr-metric-label">${label}</div>
        <span class="attr-pill ${cls}">${txt}</span>
      </div>`;
    }
    const valClass = 'attr-metric-value' + (size ? ' '+size : '');
    return `<div class="attr-metric">
      <div class="attr-metric-label">${label}</div>
      <div class="${valClass}"${color?` style="color:${color}"`:''}>${value}</div>
      ${unit ? `<div class="attr-metric-unit">${unit}</div>` : ''}
    </div>`;
  }

  /* Build a chip for extras row */
  function chip(label, value, danger=false) {
    return `<span class="attr-extra-chip">
      <span class="ek">${label}</span>
      <span class="ev${danger?' ev-true':''}"> ${value}</span>
    </span>`;
  }

  function spdFmt(s) { return s > 0 ? s.toFixed(0) : '0'; }
  function spdClr(s) {
    if (s < 60)  return 'var(--success)';
    if (s < 100) return 'var(--warn)';
    return 'var(--danger)';
  }
  function batClr(v) {
    const n = parseFloat(v);
    if (n >= 12.4) return 'var(--success)';
    if (n >= 11.8) return 'var(--warn)';
    return 'var(--danger)';
  }
  function headingLabel(deg) {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round((deg||0)/45)%8] + ' ' + (deg||0).toFixed(0)+'°';
  }

  /* ─────────────────────────────────────────
     CONTACT POPUP
  ───────────────────────────────────────── */
  function openContact(id) {
    if (_contactOpenId === id) { closeContact(); return; }
    _contactOpenId = id;

    const d   = State.getDevice(id) || {};
    const p   = State.getPosition(id) || {};
    const fv  = (State.get('fleetVehicles')||[]).find(v=>v.device_id===id) || {};
    const a   = d.attributes || {};

    const popup   = document.getElementById('contact-popup');
    const titleEl = document.getElementById('cp-title');
    const bodyEl  = document.getElementById('cp-body');
    if (!popup) return;

    titleEl.textContent = d.name || 'Vehicle Contact';

    const plate   = fv.plate       || a.plate      || '—';
    const make    = fv.make        || d.model       || '—';
    const model2  = fv.model       || '';
    const colour  = fv.color       || '—';
    const dept    = fv.department  || a.department  || '—';
    const phone   = d.phone        || fv.phone      || a.phone || '';
    const contact = d.contact      || fv.contact    || '';
    const driver  = fv.driver_name || '';
    const dPhone  = fv.driver_phone|| '';
    const vin     = fv.vin         || a.vin         || '';
    const fuel    = fv.fuel_type   || '—';
    const cat     = d.category     || '—';
    const regExp  = fv.registration_expiry ? Fmt.date(fv.registration_expiry) : '—';
    const insExp  = fv.insurance_expiry    ? Fmt.date(fv.insurance_expiry)    : '—';
    const notes   = fv.notes || a.notes || '';

    bodyEl.innerHTML = `
      <div class="cp-vehicle-hero">
        <div class="cp-plate-badge">${plate}</div>
        <div class="cp-veh-name">${make}${model2?' '+model2:''}</div>
        <div class="cp-veh-tags">
          ${colour!=='—'?`<span class="cp-tag">🎨 ${colour}</span>`:''}
          ${dept  !=='—'?`<span class="cp-tag">🏢 ${dept}</span>`:''}
          <span class="cp-tag ${d.status==='online'?'cp-tag-green':d.status==='idle'?'cp-tag-yellow':'cp-tag-red'}">
            ● ${d.status||'offline'}
          </span>
        </div>
      </div>
      <div class="cp-contact-rows">
        ${phone   ?cpRow('📞','Vehicle Phone',phone,  `tel:${phone}`)  :''}
        ${contact ?cpRow('👤','Contact',      contact, null)           :''}
        ${driver  ?cpRow('🧑‍✈️','Driver',   driver,  null)           :''}
        ${dPhone  ?cpRow('📱','Driver Phone', dPhone, `tel:${dPhone}`) :''}
        ${!phone&&!contact&&!driver?`<div style="font-size:12px;color:var(--muted);padding:4px 0">No contact info stored</div>`:''}
      </div>
      <div class="cp-details-grid">
        <div class="cp-detail"><span class="cp-det-lbl">IMEI</span>
          <span class="cp-det-val mono">${d.uniqueId||'—'}</span></div>
        ${vin?`<div class="cp-detail"><span class="cp-det-lbl">VIN</span>
          <span class="cp-det-val mono">${vin}</span></div>`:''}
        <div class="cp-detail"><span class="cp-det-lbl">Fuel</span>
          <span class="cp-det-val">${fuel}</span></div>
        <div class="cp-detail"><span class="cp-det-lbl">Category</span>
          <span class="cp-det-val">${cat}</span></div>
        ${regExp!=='—'?`<div class="cp-detail"><span class="cp-det-lbl">Reg. Expiry</span>
          <span class="cp-det-val${_expSoon(fv.registration_expiry)?' warn-text':''}">${regExp}</span></div>`:''}
        ${insExp!=='—'?`<div class="cp-detail"><span class="cp-det-lbl">Ins. Expiry</span>
          <span class="cp-det-val${_expSoon(fv.insurance_expiry)?' warn-text':''}">${insExp}</span></div>`:''}
      </div>
      ${notes?`<div class="cp-notes">📝 ${notes}</div>`:''}
      <div class="cp-actions">
        <button class="btn btn-secondary btn-sm"
                onclick="Dashboard.selectDevice(${id});Dashboard.closeContact()">🗺️ Focus</button>
        <button class="btn btn-secondary btn-sm" onclick="Views.show('playback')">⏮️ History</button>
        <button class="btn btn-secondary btn-sm" onclick="Views.show('devices')">✏️ Edit</button>
      </div>`;

    popup.style.display = 'flex';
    renderDeviceList();
  }

  function cpRow(icon, label, value, href) {
    return `<div class="cp-row">
      <span class="cp-row-icon">${icon}</span>
      <div class="cp-row-body">
        <div class="cp-row-label">${label}</div>
        ${href
          ? `<a class="cp-row-val cp-row-link" href="${href}">${value}</a>`
          : `<div class="cp-row-val">${value}</div>`}
      </div>
    </div>`;
  }

  function _expSoon(dateStr) {
    if (!dateStr) return false;
    return (new Date(dateStr) - new Date()) / 86400000 < 30;
  }

  function closeContact() {
    _contactOpenId = null;
    const popup = document.getElementById('contact-popup');
    if (popup) popup.style.display = 'none';
    renderDeviceList();
  }

  /* ─────────────────────────────────────────
     KPI CARDS
  ───────────────────────────────────────── */
  function updateKPIs() {
    const c = State.statusCounts();
    const total = State.get('devices').length;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('kpi-online',  c.online);
    set('kpi-idle',    c.idle);
    set('kpi-offline', c.offline);
    set('kpi-total',   total);
    set('kpi-trend-online',  `↑ ${c.online}`);
    set('kpi-trend-idle',    `${c.idle}`);
    set('kpi-trend-offline', `${c.offline}`);
    set('kpi-trend-total',   `+${total}`);
  }

  return {
    register, filterDevices, setStatusFilter,
    selectDevice, onDeviceClick, cycleMapStyle, toggleOnlineFilter,
    openContact, closeContact, closeAttrPanel,
  };
})();
