/* ═══════════════════════════════════════════
   pages/dashboard.js — Live Map
   All fixes + FAMS vehicle card + ⋮ options menu
═══════════════════════════════════════════ */
const Dashboard = (() => {
  let _filter        = '';
  let _selectedId    = null;
  let _statusFilter  = '';
  let _vehicleCardId = null;
  let _menuOpenId    = null;
  let _refreshTimer  = null;

  function register() {
    Views.register('dashboard', { init, onShow, onHide });
  }

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */
  function init() {
    document.getElementById('view-dashboard').innerHTML = `

      <!-- KPI ROW -->
      <div class="dash-kpi-row">
        <div class="kpi-card-v kpi-online">
          <div class="kpi-card-top"><div class="kpi-card-label">Online</div></div>
          <div class="kpi-card-value" id="kpi-online">0</div>
        </div>
        <div class="kpi-card-v kpi-idle">
          <div class="kpi-card-top"><div class="kpi-card-label">Idle</div></div>
          <div class="kpi-card-value" id="kpi-idle">0</div>
        </div>
        <div class="kpi-card-v kpi-offline">
          <div class="kpi-card-top"><div class="kpi-card-label">Offline</div></div>
          <div class="kpi-card-value" id="kpi-offline">0</div>
        </div>
        <div class="kpi-card-v kpi-total">
          <div class="kpi-card-top"><div class="kpi-card-label">Total Fleet</div></div>
          <div class="kpi-card-value" id="kpi-total">0</div>
        </div>
      </div>

      <!-- BODY: MAP + FLEET PANEL -->
      <div class="dash-body">

        <!-- MAP CARD -->
        <div class="map-card">
          <div class="map-card-header">
            <div class="map-card-title">
              <span class="live-pulse"></span>Live Tracking
            </div>
            <div class="map-ctrl-btns">
              <button class="map-ctrl-btn active" onclick="Dashboard.cycleMapStyle()">🗺️ Map</button>
              <button class="map-ctrl-btn" onclick="LiveMap.fitAll(State.get('positions'))">⊡ Fit All</button>
              <button class="map-ctrl-btn" id="btn-online-filter" onclick="Dashboard.toggleOnlineFilter()">🟢 Online</button>
            </div>
          </div>
          <div style="position:relative;flex:1;overflow:hidden">
            <div id="main-map" style="width:100%;height:100%"></div>

            <!-- Sensor panel -->
            <div class="attr-panel" id="attr-panel" style="display:none">
              <div class="attr-panel-top">
                <div class="attr-panel-name" id="attr-name">—</div>
                <div class="attr-panel-meta" id="attr-meta">—</div>
                <div class="attr-panel-status" id="attr-status"></div>
                <div style="margin-left:auto;display:flex;gap:5px;align-items:center">
                  <button class="btn btn-icon btn-sm" title="Vehicle Card"
                          onclick="Dashboard.openVehicleCard(Dashboard._getSelected())">🪪</button>
                  <button class="btn btn-icon btn-sm" title="Playback"
                          onclick="Dashboard._goPlayback()">⏮️</button>
                  <button class="btn btn-icon btn-sm" style="border-color:var(--border)"
                          title="Close" onclick="Dashboard.closeAttrPanel()">×</button>
                </div>
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
        </div>
      </div>

      <!-- VEHICLE CARD OVERLAY -->
      <div class="vc-overlay" id="vc-overlay" onclick="Dashboard.closeVehicleCard()">
        <div class="vc-card" id="vc-card" onclick="event.stopPropagation()">
          <div class="vc-header" id="vc-header"></div>
          <div class="vc-body"   id="vc-body"></div>
        </div>
      </div>

      <!-- OPTIONS MENU DROPDOWN -->
      <div class="dev-menu" id="dev-menu" style="display:none">
        <div class="dev-menu-item" onclick="Dashboard._menuAction('history-hour')">
          🕐 Show history (last hour)
        </div>
        <div class="dev-menu-item" onclick="Dashboard._menuAction('history-today')">
          📅 Show history (today)
        </div>
        <div class="dev-menu-item" onclick="Dashboard._menuAction('history-yesterday')">
          📆 Show history (yesterday)
        </div>
        <div class="dev-menu-divider"></div>
        <div class="dev-menu-item" onclick="Dashboard._menuAction('focus')">
          🗺️ Focus on Map
        </div>
        <div class="dev-menu-item" onclick="Dashboard._menuAction('sensors')">
          📡 Sensor Data
        </div>
        <div class="dev-menu-item" onclick="Dashboard._menuAction('card')">
          🪪 Vehicle Card
        </div>
        <div class="dev-menu-divider"></div>
        <div class="dev-menu-item" onclick="Dashboard._menuAction('command')">
          📡 Send Command
        </div>
        <div class="dev-menu-item" onclick="Dashboard._menuAction('edit')">
          ✏️ Edit Device
        </div>
        <div class="dev-menu-item dev-menu-danger" onclick="Dashboard._menuAction('delete')">
          🗑️ Delete
        </div>
      </div>`;

    LiveMap.init('main-map');

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dev-menu') && !e.target.closest('.dev-menu-btn')) {
        closeMenu();
      }
    });

    State.on('devices',   () => { renderDeviceList(); updateKPIs(); });
    State.on('positions', () => {
      LiveMap.update(State.get('devices'), State.get('positions'));
      renderDeviceList();
      updateKPIs();
      if (_selectedId) refreshAttrPanel(_selectedId);
    });

    LiveMap.update(State.get('devices'), State.get('positions'));
    renderDeviceList();
    updateKPIs();

    _refreshTimer = setInterval(() => {
      if (_selectedId) refreshAttrPanel(_selectedId);
    }, 5000);
  }

  function onShow() { LiveMap.invalidate(); }
  function onHide() {
    closeAttrPanel();
    closeVehicleCard();
    closeMenu();
    clearInterval(_refreshTimer);
  }

  /* ── Map style ────────────────────────── */
  let _mapStyleIdx = 0;
  const _styles = ['lite', 'dark', 'satellite', 'streets'];
  function cycleMapStyle() {
    _mapStyleIdx = (_mapStyleIdx + 1) % _styles.length;
    LiveMap.setStyle(_styles[_mapStyleIdx]);
  }

  let _onlineFilter = false;
  function toggleOnlineFilter() {
    _onlineFilter = !_onlineFilter;
    setStatusFilter(_onlineFilter ? 'online' : '');
    document.getElementById('btn-online-filter')?.classList.toggle('active', _onlineFilter);
  }

  /* ─────────────────────────────────────────
     OPTIONS MENU (⋮ button)
  ───────────────────────────────────────── */
  function openMenu(id, btn) {
    // Toggle off if same
    if (_menuOpenId === id) { closeMenu(); return; }
    _menuOpenId = id;

    const menu = document.getElementById('dev-menu');
    if (!menu) return;

    // Position near button
    const rect = btn.getBoundingClientRect();
    const mapRect = document.getElementById('main-area')?.getBoundingClientRect() || { left:0, top:0 };
    menu.style.top  = (rect.bottom + 4) + 'px';
    menu.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    menu.style.display = 'block';
  }

  function closeMenu() {
    _menuOpenId = null;
    const menu = document.getElementById('dev-menu');
    if (menu) menu.style.display = 'none';
  }

  function _menuAction(action) {
    const id = _menuOpenId;
    closeMenu();
    if (!id) return;

    const now  = new Date();
    const pad  = n => String(n).padStart(2,'0');
    const toISO = d => d.toISOString();

    switch (action) {
      case 'focus':
        selectDevice(id);
        break;

      case 'sensors':
        selectDevice(id);
        break;

      case 'card':
        openVehicleCard(id);
        break;

      case 'history-hour': {
        const from = new Date(Date.now() - 3600000);
        _goPlaybackRange(id, toISO(from), toISO(now));
        break;
      }
      case 'history-today': {
        const from = new Date(now);
        from.setHours(0,0,0,0);
        _goPlaybackRange(id, toISO(from), toISO(now));
        break;
      }
      case 'history-yesterday': {
        const from = new Date(now);
        from.setDate(from.getDate()-1); from.setHours(0,0,0,0);
        const to   = new Date(now);
        to.setHours(0,0,0,0); to.setMilliseconds(-1);
        _goPlaybackRange(id, toISO(from), toISO(to));
        break;
      }

      case 'command':
        DevicesView.openCommand(id);
        break;

      case 'edit':
        Views.show('devices');
        setTimeout(() => DevicesView.openForm(id), 300);
        break;

      case 'delete':
        DevicesView.confirmDelete(id);
        break;
    }
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

    let items = devices.filter(d =>
      !_filter ||
      (d.name||'').toLowerCase().includes(_filter.toLowerCase()) ||
      (d.uniqueId||'').toLowerCase().includes(_filter.toLowerCase())
    );
    if (_statusFilter) items = items.filter(d => d.status === _statusFilter);

    if (!items.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📡</div>
        <div class="empty-title">No vehicles found</div></div>`;
      return;
    }

    list.innerHTML = items.map(d => {
      const p   = positions[d.id] || {};
      const a   = d.attributes || {};
      const s   = d.status || 'offline';
      const spd = p.speed ? +(p.speed * 1.852).toFixed(1) : 0;

      const spdLabel = spd > 0 ? `${spd.toFixed(0)} km/h`
                     : s === 'online' ? 'Stopped'
                     : s === 'idle'   ? 'Idle'
                     : 'Offline';
      const spdColor = spd > 0 ? 'var(--success)'
                     : s === 'offline' ? 'var(--danger)' : 'var(--muted)';

      const lastUpdate  = p.fixTime ? Fmt.ago(p.fixTime) : 'No data';
      const isSel       = _selectedId === d.id;

      return `
        <div class="device-item ${isSel ? 'selected' : ''}"
             onclick="Dashboard.selectDevice(${d.id})">
          <div class="status-dot ${s}" style="margin-top:3px;flex-shrink:0"></div>
          <div class="device-item-info">
            <div class="device-item-name">${d.name}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px">${lastUpdate}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
            <div style="font-size:12px;font-weight:600;color:${spdColor}">${spdLabel}</div>
            <button class="contact-btn dev-menu-btn" title="Options"
                    onclick="event.stopPropagation();Dashboard.openMenu(${d.id}, this)">⋮</button>
          </div>
        </div>`;
    }).join('');
  }

  /* ─────────────────────────────────────────
     SELECT + ATTR PANEL
  ───────────────────────────────────────── */
  function selectDevice(id) {
    _selectedId = id;
    State.set('selectedDevice', id);
    LiveMap.focusDevice(id, State.get('positions'));
    renderDeviceList();
    openAttrPanel(id);
  }

  function onDeviceClick(id) { selectDevice(id); }
  function _getSelected()    { return _selectedId; }

  function _goPlayback() {
    if (_selectedId) State.set('selectedDevice', _selectedId);
    Views.show('playback');
  }

  function _goPlaybackFor(id) {
    State.set('selectedDevice', id);
    Views.show('playback');
  }

  function _goPlaybackRange(id, from, to) {
    State.set('selectedDevice', id);
    State.set('playbackFrom', from);
    State.set('playbackTo',   to);
    Views.show('playback');
  }

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
    if (metaEl) metaEl.textContent =
      `${d.uniqueId||''} · ${p.fixTime ? Fmt.ago(p.fixTime) : 'No data'}`;

    if (statusEl) {
      const s      = d.status || 'offline';
      const pcls   = s==='online' ? 'attr-pill-on' : s==='idle' ? 'attr-pill-warn' : 'attr-pill-off';
      const dot    = s==='online' ? '●' : s==='idle' ? '◐' : '○';
      statusEl.innerHTML = `<span class="attr-pill ${pcls}">${dot} ${s}</span>`;
    }

    const metrics = [];
    metrics.push(M('Speed',
      spd > 0 ? spd.toFixed(0) : '—',
      spd > 0 ? 'km/h' : (d.status!=='offline' ? 'Stopped' : 'Offline'),
      spd > 0 ? spdClr(spd) : 'var(--muted)',
      spd > 0 ? 'lg' : ''
    ));

    if (p.course !== undefined) metrics.push(M('Heading', headingLabel(p.course),'','',''));
    if (a.ignition !== undefined) metrics.push(M('Ignition', null,'','','',a.ignition));
    if (a.motion   !== undefined) metrics.push(M('Motion', a.motion?'Moving':'Stopped','',a.motion?'move':'',''));

    const bat = a.battery ?? a.externalBattery ?? a.power ?? a.voltage;
    if (bat !== undefined) metrics.push(M('Battery', (+bat).toFixed(2),'V',batClr(bat),''));

    const fuel = a.fuel ?? a.fuelLevel;
    if (fuel !== undefined) metrics.push(M('Fuel',(+fuel).toFixed(1),fuel>10?'L':'%',fuel>20?'var(--success)':'var(--warn)',''));

    const sat = a.satellites ?? a.sat;
    if (sat !== undefined) metrics.push(M('Satellites', sat,'',sat>=6?'var(--success)':sat>=3?'var(--warn)':'var(--danger)',''));

    if (a.rpm !== undefined) metrics.push(M('RPM', Math.round(a.rpm),'','',''));
    if (a.coolantTemp !== undefined) metrics.push(M('Coolant',(+a.coolantTemp).toFixed(1),'°C',a.coolantTemp>100?'var(--danger)':'',''));
    if (a.totalDistance !== undefined) metrics.push(M('Odometer',(a.totalDistance/1000).toFixed(0),'km','var(--primary)',''));
    if (p.latitude) metrics.push(M('Location',`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,'','','mono'));

    const KNOWN = new Set(['ignition','motion','battery','externalBattery','power','voltage',
      'fuel','fuelLevel','rpm','coolantTemp','throttle','obdSpeed','hours','totalDistance',
      'distance','satellites','sat','hdop','pdop','rssi','charge','alarm','driverUniqueId',
      'driver','battery2','internalBattery','temp','temperature','temp1','index','event']);

    const chips = [];
    if (a.hdop !== undefined)         chips.push(chip('HDOP',(+a.hdop).toFixed(2)));
    if (p.accuracy && p.accuracy > 0) chips.push(chip('Acc',(+p.accuracy).toFixed(0)+'m'));
    if (p.altitude && p.altitude!==0) chips.push(chip('Alt',(+p.altitude).toFixed(0)+'m'));
    if (a.rssi !== undefined)         chips.push(chip('Signal',a.rssi+'dBm'));
    if (a.alarm)                      chips.push(chip('Alarm',a.alarm,true));
    if (a.obdSpeed !== undefined)     chips.push(chip('OBD Spd',(+a.obdSpeed).toFixed(0)+'km/h'));
    if (a.throttle !== undefined)     chips.push(chip('Throttle',(+a.throttle).toFixed(0)+'%'));
    if (a.hours !== undefined)        chips.push(chip('Eng.Hrs',(a.hours/3600).toFixed(1)+'h'));

    Object.entries(a).forEach(([k,v]) => {
      if (KNOWN.has(k)||v===undefined||v===null||String(v).trim()==='') return;
      const cls = v===true?'ev-true':v===false?'ev-false':typeof v==='number'?'ev-num':'';
      chips.push(`<span class="attr-extra-chip"><span class="ek">${k}</span><span class="ev ${cls}">${v}</span></span>`);
    });

    scroll.innerHTML = `
      <div class="attr-metrics">${metrics.join('')}</div>
      ${chips.length ? `<div class="attr-extras">${chips.join('')}</div>` : ''}`;
  }

  function M(label, value, unit, color, size, ignition) {
    if (ignition !== undefined) {
      const cls = ignition ? 'attr-pill-on' : 'attr-pill-off';
      return `<div class="attr-metric">
        <div class="attr-metric-label">${label}</div>
        <span class="attr-pill ${cls}">${ignition?'● ON':'○ OFF'}</span>
      </div>`;
    }
    const valClass = 'attr-metric-value'+(size?' '+size:'');
    return `<div class="attr-metric">
      <div class="attr-metric-label">${label}</div>
      <div class="${valClass}"${color?` style="color:${color}"`:''}>${value}</div>
      ${unit?`<div class="attr-metric-unit">${unit}</div>`:''}
    </div>`;
  }

  function chip(label, value, danger=false) {
    return `<span class="attr-extra-chip">
      <span class="ek">${label}</span>
      <span class="ev${danger?' ev-true':''}"> ${value}</span>
    </span>`;
  }

  function spdClr(s) {
    return s<60?'var(--success)':s<100?'var(--warn)':'var(--danger)';
  }
  function batClr(v) {
    const n=parseFloat(v);
    return n>=12.4?'var(--success)':n>=11.8?'var(--warn)':'var(--danger)';
  }
  function headingLabel(deg) {
    const dirs=['N','NE','E','SE','S','SW','W','NW'];
    return dirs[Math.round((deg||0)/45)%8]+' '+(deg||0).toFixed(0)+'°';
  }

  /* ─────────────────────────────────────────
     VEHICLE CARD — Full FAMS fields (tabbed)
  ───────────────────────────────────────── */
  function openVehicleCard(id) {
    if (!id) return;
    _vehicleCardId = id;

    const d  = State.getDevice(id) || {};
    const p  = State.getPosition(id) || {};
    const a  = d.attributes || {};
    const pa = p.attributes || {};

    const s      = d.status || 'offline';
    const spd    = p.speed ? +(p.speed * 1.852).toFixed(1) : 0;
    const spdLbl = spd > 0 ? `${spd.toFixed(0)} km/h` : (s!=='offline'?'Stopped':'—');
    const pcls   = s==='online'?'attr-pill-on':s==='idle'?'attr-pill-warn':'attr-pill-off';

    const overlay = document.getElementById('vc-overlay');
    const header  = document.getElementById('vc-header');
    const body    = document.getElementById('vc-body');
    if (!overlay||!header||!body) return;

    header.innerHTML = `
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--text)">${d.name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;font-family:var(--font-mono)">${d.uniqueId||''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="attr-pill ${pcls}">● ${s}</span>
        <button class="modal-close" onclick="Dashboard.closeVehicleCard()">×</button>
      </div>`;

    // Tabs
    body.innerHTML = `
      <div class="tab-bar" style="margin-bottom:14px">
        <button class="tab-btn active" onclick="Dashboard._vcTab('live',this)">Live Data</button>
        <button class="tab-btn"        onclick="Dashboard._vcTab('vehicle',this)">Vehicle Info</button>
        <button class="tab-btn"        onclick="Dashboard._vcTab('customer',this)">Customer</button>
      </div>

      <!-- LIVE DATA TAB -->
      <div id="vct-live">
        <div class="vc-stats-grid">
          ${vcStat('Speed', spdLbl, spd>0?spdClr(spd):'var(--muted)')}
          ${vcStat('Heading', pa.course!==undefined?headingLabel(pa.course):p.course!==undefined?headingLabel(p.course):'—')}
          ${vcStat('Ignition', pa.ignition!==undefined?(pa.ignition?'ON':'OFF'):'—',
              pa.ignition===true?'var(--success)':pa.ignition===false?'var(--danger)':'var(--muted)')}
          ${vcStat('Motion', pa.motion!==undefined?(pa.motion?'Moving':'Stopped'):'—')}
          ${vcStat('Satellites', (pa.satellites??pa.sat??'—').toString())}
          ${vcStat('Battery', (pa.battery??pa.externalBattery)!==undefined ? (+( pa.battery??pa.externalBattery)).toFixed(2)+' V':'—')}
          ${vcStat('Odometer', pa.totalDistance?(pa.totalDistance/1000).toFixed(0)+' km':'—', 'var(--primary)')}
          ${vcStat('Last Update', p.fixTime?Fmt.ago(p.fixTime):'—')}
        </div>
        ${p.latitude ? `
        <div class="vc-section-title" style="margin-top:12px">Location</div>
        <div class="vc-location">
          ${d.lastAddress||`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}
          <a href="https://maps.google.com/?q=${p.latitude},${p.longitude}"
             target="_blank" style="color:var(--primary);font-size:11px;margin-left:8px">Open in Maps ↗</a>
        </div>` : ''}
      </div>

      <!-- VEHICLE INFO TAB -->
      <div id="vct-vehicle" style="display:none">
        <div class="vc-info-grid">
          ${vcRow('Plate / VRN',  a.plate||a.vrn||'—')}
          ${vcRow('Make',         a.make||'—')}
          ${vcRow('Model',        a.model||d.model||'—')}
          ${vcRow('Colour',       a.colour||a.color||'—')}
          ${vcRow('Vehicle Type', a.vehicleType||'—')}
          ${vcRow('Engine Type',  a.engineType||'—')}
          ${vcRow('VIN / Chassis',a.vin||a.chassisNo||'—')}
          ${vcRow('Reg. No.',     a.registrationNo||'—')}
          ${vcRow('Device Model', a.deviceModel||'—')}
          ${vcRow('SIM No.',      a.simNumber||'—')}
          ${vcRow('MSISDN',       a.msisdn||'—')}
          ${vcRow('SIM Activation',a.simActivationDate||'—')}
          ${vcRow('SIM Expiry',   a.simExpirationDate||'—')}
          ${vcRow('Install Date', a.installationDate||'—')}
          ${vcRow('Owner / Manager', a.objectOwner||d.contact||'—')}
          ${vcRow('Corporate',    a.corporateName||'—')}
          ${vcRow('Category',     d.category||'—')}
          ${vcRow('IMEI',         d.uniqueId||'—', true)}
        </div>
      </div>

      <!-- CUSTOMER TAB -->
      <div id="vct-customer" style="display:none">
        <div class="vc-info-grid">
          ${vcRow('Customer Name',    a.customerName||'—')}
          ${vcRow('Mobile 1',         a.mobile1||d.phone||'—')}
          ${vcRow('Mobile 2',         a.mobile2||'—')}
          ${vcRow('Driver / Secondary', a.secondaryDriver||'—')}
          ${vcRow('Emergency 1',      a.emergencyContact1||'—')}
          ${vcRow('Emergency 2',      a.emergencyContact2||'—')}
          ${vcRow('NIC No.',          a.nicNo||'—')}
          ${vcRow('Date of Birth',    a.dateOfBirth||'—')}
          ${vcRow('Mother Name',      a.motherName||'—')}
          ${vcRow('Address',          a.address||'—')}
          ${vcRow('Normal Password',  a.normalPassword||'—')}
          ${vcRow('Emergency Pass',   a.emergencyPassword||'—')}
          ${vcRow('Instructions',     a.instructions||'—')}
        </div>
      </div>

      <!-- Actions -->
      <div class="vc-actions" style="margin-top:14px">
        <button class="btn btn-primary btn-sm"
                onclick="Dashboard.selectDevice(${id});Dashboard.closeVehicleCard()">
          🗺️ Focus
        </button>
        <button class="btn btn-secondary btn-sm"
                onclick="Dashboard._goPlaybackFor(${id});Dashboard.closeVehicleCard()">
          ⏮️ Playback
        </button>
        <button class="btn btn-secondary btn-sm"
                onclick="DevicesView.openForm(${id});Dashboard.closeVehicleCard()">
          ✏️ Edit
        </button>
      </div>`;

    overlay.style.display = 'flex';
  }

  function _vcTab(name, btn) {
    ['live','vehicle','customer'].forEach(t => {
      const el = document.getElementById('vct-'+t);
      if (el) el.style.display = t===name ? '' : 'none';
    });
    document.querySelectorAll('.vc-card .tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  function vcStat(label, value, color='') {
    return `<div class="vc-stat">
      <div class="vc-stat-lbl">${label}</div>
      <div class="vc-stat-val"${color?` style="color:${color}"`:''}>${value}</div>
    </div>`;
  }

  function vcRow(label, value, mono=false) {
    return `<div class="vc-info-row">
      <span class="vc-info-lbl">${label}</span>
      <span class="vc-info-val${mono?' mono':''}">${value}</span>
    </div>`;
  }

  function closeVehicleCard() {
    _vehicleCardId = null;
    const overlay = document.getElementById('vc-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  /* ─────────────────────────────────────────
     KPI CARDS
  ───────────────────────────────────────── */
  function updateKPIs() {
    const c     = State.statusCounts();
    const total = State.get('devices').length;
    const set   = (id, v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
    set('kpi-online',  c.online);
    set('kpi-idle',    c.idle);
    set('kpi-offline', c.offline);
    set('kpi-total',   total);
  }

  return {
    register, filterDevices, setStatusFilter,
    selectDevice, onDeviceClick, cycleMapStyle, toggleOnlineFilter,
    openMenu, closeMenu, _menuAction,
    openVehicleCard, closeVehicleCard, _vcTab,
    closeAttrPanel,
    _getSelected, _goPlayback, _goPlaybackFor,
  };
})();
