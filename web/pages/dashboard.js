/* ═══════════════════════════════════════════
   pages/dashboard.js — Live Map
   ✦ Device attribute strip (ignition, battery,
     voltage, speed, satellites, fuel, RPM…)
   ✦ Vehicle contact popup from sidebar
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
      <div class="split-panel" style="width:100%">

        <!-- ═══ SIDEBAR ═══ -->
        <div class="panel-left dash-sidebar">
          <div class="panel-header-bar" style="padding:14px 14px 10px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="panel-title-sm">Live Fleet</div>
              <div class="dash-filter-pills">
                <button class="filter-pill active" data-s="" onclick="Dashboard.setStatusFilter('')">All</button>
                <button class="filter-pill" data-s="online"  onclick="Dashboard.setStatusFilter('online')">🟢</button>
                <button class="filter-pill" data-s="idle"    onclick="Dashboard.setStatusFilter('idle')">🟡</button>
                <button class="filter-pill" data-s="offline" onclick="Dashboard.setStatusFilter('offline')">🔴</button>
              </div>
            </div>
            <div class="panel-sub-sm" id="fleet-summary" style="margin-top:6px">Loading…</div>
          </div>
          <div style="padding:8px 12px 4px">
            <div class="search-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" placeholder="Search vehicles…"
                     id="device-search" oninput="Dashboard.filterDevices(this.value)">
            </div>
          </div>
          <div class="panel-scroll" id="device-list"></div>

          <!-- Contact popup (inline at bottom of sidebar) -->
          <div class="contact-popup" id="contact-popup" style="display:none">
            <div class="contact-popup-header">
              <div class="contact-popup-title" id="cp-title">Vehicle Contact</div>
              <button class="contact-popup-close" onclick="Dashboard.closeContact()">×</button>
            </div>
            <div class="contact-popup-body" id="cp-body"></div>
          </div>
        </div>

        <!-- ═══ MAP ═══ -->
        <div class="panel-right" style="position:relative">
          <div id="main-map" style="width:100%;height:100%"></div>

          <!-- Top stat strip -->
          <div class="fleet-stat-strip">
            <div class="fleet-stat-chip"><div class="lbl">Online</div><div class="val c-online" id="s-online">0</div></div>
            <div class="fleet-stat-chip"><div class="lbl">Idle</div><div class="val c-idle" id="s-idle">0</div></div>
            <div class="fleet-stat-chip"><div class="lbl">Offline</div><div class="val c-offline" id="s-offline">0</div></div>
            <div class="fleet-stat-chip"><div class="lbl">Fleet</div><div class="val" id="s-total">0</div></div>
          </div>

          <!-- Device Attribute Panel -->
          <div class="attr-panel" id="attr-panel" style="display:none">
            <div class="attr-panel-top">
              <div>
                <div class="attr-panel-name" id="attr-name">—</div>
                <div class="attr-panel-meta" id="attr-meta">—</div>
              </div>
              <button class="attr-panel-close" onclick="Dashboard.closeAttrPanel()">×</button>
            </div>
            <div class="attr-scroll">
              <div class="attr-grid" id="attr-grid"></div>
            </div>
          </div>

          <!-- FABs -->
          <div class="map-fab-group">
            <button class="map-fab" title="Fit all" onclick="LiveMap.fitAll(State.get('positions'))">⊡</button>
            <button class="map-fab" onclick="LiveMap.getMap()?.setZoom(LiveMap.getMap().getZoom()+1)">+</button>
            <button class="map-fab" onclick="LiveMap.getMap()?.setZoom(LiveMap.getMap().getZoom()-1)">−</button>
            <button class="map-fab" onclick="Dashboard.cycleMapStyle()">🗺️</button>
          </div>
        </div>

      </div>`;

    LiveMap.init('main-map');

    State.on('devices',   () => { renderDeviceList(); updateStats(); });
    State.on('positions', () => {
      renderDeviceList(); updateStats();
      LiveMap.update(State.get('devices'), State.get('positions'));
      if (_selectedId) refreshAttrPanel(_selectedId);
    });

    LiveMap.update(State.get('devices'), State.get('positions'));
    renderDeviceList();
    updateStats();
  }

  function onShow() { LiveMap.invalidate(); }
  function onHide() { closeAttrPanel(); closeContact(); }

  /* ─────────────────────────────────────────
     MAP STYLE CYCLE
  ───────────────────────────────────────── */
  let _mapStyleIdx = 0;
  const _styles = ['dark', 'satellite', 'streets'];
  function cycleMapStyle() {
    _mapStyleIdx = (_mapStyleIdx + 1) % _styles.length;
    LiveMap.setStyle(_styles[_mapStyleIdx]);
  }

  /* ─────────────────────────────────────────
     DEVICE LIST
  ───────────────────────────────────────── */
  function setStatusFilter(s) {
    _statusFilter = s;
    document.querySelectorAll('.filter-pill').forEach(b =>
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
      const spd   = p.speed ? Fmt.speed(p.speed) : '—';
      const ago   = Fmt.ago(p.fixTime);
      const ign   = attrs.ignition;
      const bat   = attrs.battery ?? attrs.power;
      const sat   = attrs.satellites ?? attrs.sat;
      const isSel = _selectedId === d.id;
      const isCon = _contactOpenId === d.id;

      const badges = [];
      if (ign !== undefined)
        badges.push(`<span class="mini-badge ${ign ? 'mb-green' : 'mb-red'}">${ign ? '🔑 ON' : '🔒 OFF'}</span>`);
      if (bat !== undefined)
        badges.push(`<span class="mini-badge mb-yellow">⚡ ${parseFloat(bat).toFixed(1)}V</span>`);
      if (sat !== undefined)
        badges.push(`<span class="mini-badge mb-blue">🛰 ${sat}</span>`);

      return `
        <div class="device-item ${isSel ? 'selected' : ''}"
             onclick="Dashboard.selectDevice(${d.id})">
          <div class="status-dot ${s}"></div>
          <div class="device-item-info">
            <div class="device-item-name">${d.name}</div>
            <div class="device-item-meta-row">
              <span class="device-item-ago">${ago}</span>
              ${badges.join('')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <div class="device-item-speed">${spd}</div>
            <button class="contact-btn ${isCon ? 'contact-btn-active' : ''}"
                    title="Vehicle contact & details"
                    onclick="event.stopPropagation();Dashboard.openContact(${d.id})">👤</button>
          </div>
        </div>`;
    }).join('');

    const on = devices.filter(d => d.status === 'online').length;
    const summary = document.getElementById('fleet-summary');
    if (summary) summary.textContent = `${on} online · ${devices.length} total vehicles`;
  }

  /* ─────────────────────────────────────────
     SELECT DEVICE → open attr panel
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

    const nameEl = document.getElementById('attr-name');
    const metaEl = document.getElementById('attr-meta');
    const grid   = document.getElementById('attr-grid');
    if (!nameEl || !grid) return;

    nameEl.textContent = d.name;
    metaEl.textContent = `${d.uniqueId || ''}  ·  Updated ${Fmt.ago(p.fixTime)}`;

    const a   = p.attributes || {};
    const spd = p.speed    ? +(p.speed * 1.852).toFixed(1) : 0;
    const alt = p.altitude ? +p.altitude.toFixed(0)        : 0;
    const acc = p.accuracy ? +p.accuracy.toFixed(0)        : null;

    const cards = [];

    // ── Always-visible core ──
    cards.push(AC('🚀', 'Speed',   spd,                   'km/h', spdClr(spd),   true));
    cards.push(AC('🧭', 'Heading', (p.course||0).toFixed(0)+'°','', 'var(--accent2)', true));
    cards.push(AC('📍', 'Location',
      p.latitude ? `${Fmt.coord(p.latitude)}<br>${Fmt.coord(p.longitude)}` : '—',
      '', 'var(--text)', true, 'sm'));

    // ── Ignition / motion ──
    if (a.ignition !== undefined)
      cards.push(AC(a.ignition?'🔑':'🔒', 'Ignition', a.ignition?'ON':'OFF', '',
        a.ignition?'var(--accent)':'var(--accent3)', true));
    if (a.motion !== undefined)
      cards.push(AC(a.motion?'🏃':'🛑', 'Motion', a.motion?'Moving':'Stopped', '',
        a.motion?'var(--accent)':'var(--idle)', false));

    // ── Power ──
    const bat  = a.battery      ?? a.externalBattery;
    const pwr  = a.power        ?? a.voltage;
    const bat2 = a.battery2     ?? a.internalBattery;
    if (bat  !== undefined) cards.push(AC('🔋','Battery',   (+bat).toFixed(2), 'V', batClr(bat), false));
    if (pwr  !== undefined && pwr !== bat)
      cards.push(AC('⚡','Ext. Power', (+pwr).toFixed(2),  'V', batClr(pwr), false));
    if (bat2 !== undefined)
      cards.push(AC('🔋','Int. Batt',  (+bat2).toFixed(1), '%',
        bat2>30?'var(--accent)':'var(--accent3)', false));
    if (a.charge !== undefined)
      cards.push(AC('⚡','Charging', a.charge?'Yes':'No', '',
        a.charge?'var(--accent)':'var(--muted)', false));

    // ── Fuel ──
    if (a.fuel !== undefined || a.fuelLevel !== undefined) {
      const f = a.fuel ?? a.fuelLevel;
      cards.push(AC('⛽','Fuel', (+f).toFixed(1), f>10?'L':'%',
        f>20?'var(--accent)':'var(--accent3)', false));
    }

    // ── Engine ──
    if (a.rpm !== undefined)
      cards.push(AC('⚙️','RPM',       Math.round(a.rpm), '', 'var(--accent2)', false));
    if (a.coolantTemp !== undefined)
      cards.push(AC('🌡️','Coolant',  (+a.coolantTemp).toFixed(1), '°C',
        a.coolantTemp>100?'var(--accent3)':'var(--accent)', false));
    if (a.throttle !== undefined)
      cards.push(AC('🎚️','Throttle', (+a.throttle).toFixed(1), '%', 'var(--warn)', false));
    if (a.obdSpeed !== undefined)
      cards.push(AC('🏎️','OBD Speed',(+a.obdSpeed).toFixed(0), 'km/h', spdClr(a.obdSpeed), false));
    if (a.hours !== undefined)
      cards.push(AC('⏱️','Eng. Hrs', (a.hours/3600).toFixed(1), 'h', 'var(--text)', false));

    // ── GPS quality ──
    const sat  = a.satellites ?? a.sat;
    if (sat !== undefined)
      cards.push(AC('🛰️','Satellites', sat, '',
        sat>=6?'var(--accent)':sat>=3?'var(--warn)':'var(--accent3)', false));
    if (a.hdop !== undefined)
      cards.push(AC('📶','HDOP', (+a.hdop).toFixed(2), '',
        a.hdop<=1.5?'var(--accent)':a.hdop<=3?'var(--warn)':'var(--accent3)', false));
    if (a.rssi !== undefined)
      cards.push(AC('📡','Signal', a.rssi, 'dBm', 'var(--accent2)', false));
    if (acc !== null && acc > 0)
      cards.push(AC('🎯','Accuracy', acc, 'm',
        acc<=10?'var(--accent)':acc<=50?'var(--warn)':'var(--accent3)', false));
    if (alt !== 0)
      cards.push(AC('⛰️','Altitude', alt, 'm', 'var(--muted)', false));

    // ── Trip / odometer ──
    if (a.totalDistance !== undefined)
      cards.push(AC('🛣️','Total KM', (a.totalDistance/1000).toFixed(0), 'km', 'var(--accent)', false));
    if (a.distance !== undefined)
      cards.push(AC('📏','Trip KM', (a.distance/1000).toFixed(2), 'km', 'var(--text)', false));

    // ── Environment ──
    const tmp = a.temp ?? a.temperature ?? a.temp1;
    if (tmp !== undefined)
      cards.push(AC('🌡️','Temp', (+tmp).toFixed(1), '°C',
        tmp>40?'var(--accent3)':'var(--accent)', false));

    // ── Driver ──
    if (a.driverUniqueId || a.driver)
      cards.push(AC('🧑‍✈️','Driver ID', a.driverUniqueId||a.driver, '', 'var(--accent2)', false, 'sm'));

    // ── Alarm ──
    if (a.alarm)
      cards.push(AC('🚨','Alarm', a.alarm, '', 'var(--accent3)', false, 'sm'));

    // ── Unknown extras ──
    const KNOWN = new Set([
      'ignition','motion','battery','externalBattery','power','voltage',
      'fuel','fuelLevel','rpm','coolantTemp','throttle','obdSpeed','hours',
      'totalDistance','distance','satellites','sat','hdop','pdop','rssi',
      'signalStrength','charge','alarm','driverUniqueId','driver','io',
      'battery2','internalBattery','temp','temperature','temp1',
      'index','event','bleTemperature',
    ]);
    Object.entries(a).forEach(([k, v]) => {
      if (!KNOWN.has(k) && v !== undefined && v !== null && String(v).trim() !== '')
        cards.push(AC('📌', k, String(v), '', 'var(--muted)', false, 'sm'));
    });

    grid.innerHTML = cards.join('');
  }

  // Attribute Card builder
  function AC(icon, label, value, unit, color, primary=false, size='md') {
    const vClass = size==='sm' ? 'attr-val-sm' : primary ? 'attr-val-lg' : 'attr-val';
    return `<div class="attr-card${primary?' attr-card-primary':''}">
      <div class="attr-icon">${icon}</div>
      <div class="attr-label">${label}</div>
      <div class="${vClass}" style="color:${color}">${value}</div>
      ${unit?`<div class="attr-unit">${unit}</div>`:''}
    </div>`;
  }

  function spdClr(s) {
    if (!s||s===0) return 'var(--muted)';
    if (s<80)      return 'var(--accent)';
    if (s<110)     return 'var(--warn)';
    return 'var(--accent3)';
  }
  function batClr(v) {
    const n = parseFloat(v);
    if (n>=12.4) return 'var(--accent)';
    if (n>=11.8) return 'var(--warn)';
    return 'var(--accent3)';
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
      <!-- ── Vehicle card ── -->
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

      <!-- ── Contact rows ── -->
      <div class="cp-contact-rows">
        ${phone   ?cpRow('📞','Vehicle Phone', phone,  `tel:${phone}`)  :''}
        ${contact ?cpRow('👤','Contact',       contact, null)           :''}
        ${driver  ?cpRow('🧑‍✈️','Driver',     driver,  null)           :''}
        ${dPhone  ?cpRow('📱','Driver Phone',  dPhone, `tel:${dPhone}`) :''}
        ${!phone&&!contact&&!driver?`<div style="font-size:12px;color:var(--muted);padding:4px 0">No contact info — add it in Device settings</div>`:''}
      </div>

      <!-- ── Details grid ── -->
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

      <!-- ── Actions ── -->
      <div class="cp-actions">
        <button class="btn btn-secondary btn-sm"
                onclick="Dashboard.selectDevice(${id});Dashboard.closeContact()">
          🗺️ Focus
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Views.show('playback')">
          ⏮️ History
        </button>
        <button class="btn btn-secondary btn-sm" onclick="Views.show('devices')">
          ✏️ Edit
        </button>
      </div>`;

    popup.style.display = 'flex';
    renderDeviceList(); // refresh to highlight contact-btn
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
     STATS
  ───────────────────────────────────────── */
  function updateStats() {
    const c  = State.statusCounts();
    const el = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    el('s-online',  c.online);
    el('s-idle',    c.idle);
    el('s-offline', c.offline);
    el('s-total',   State.get('devices').length);
  }

  return {
    register, filterDevices, setStatusFilter,
    selectDevice, onDeviceClick, cycleMapStyle,
    openContact, closeContact, closeAttrPanel,
  };
})();
