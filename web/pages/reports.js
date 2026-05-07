/* ═══════════════════════════════════════════
   pages/reports.js — Fleet Reports
   Uses /reports/summary, /reports/trips,
         /reports/stops, /reports/events
═══════════════════════════════════════════ */
const ReportsView = (() => {
  let _activeTab = 'summary';

  function register() {
    Views.register('reports', { init, onShow: () => {}, onHide: () => {} });
  }

  function init() {
    document.getElementById('view-reports').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Fleet Reports</h2>
          <div class="page-sub">Powered by Traccar reporting engine</div>
        </div>
        <div class="page-actions">
          <select id="rep-device" style="width:160px"></select>
          <select id="rep-period" style="width:130px">
            <option value="today">Today</option>
            <option value="week" selected>This Week</option>
            <option value="month">This Month</option>
          </select>
          <button class="btn btn-primary" onclick="ReportsView.run()">⚡ Generate</button>
        </div>
      </div>
      <div style="padding:0 24px 10px;flex-shrink:0">
        <div class="tab-bar" id="report-tabs">
          <button class="tab-btn active" onclick="ReportsView.switchTab('summary')">Summary</button>
          <button class="tab-btn" onclick="ReportsView.switchTab('trips')">Trips</button>
          <button class="tab-btn" onclick="ReportsView.switchTab('stops')">Stops</button>
          <button class="tab-btn" onclick="ReportsView.switchTab('events')">Events</button>
        </div>
      </div>
      <div class="page-scroll" id="report-body">
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">Select period and click Generate</div>
        </div>
      </div>`;

    populateDeviceSel();
    State.on('devices', populateDeviceSel);
  }

  function populateDeviceSel() {
    const sel = document.getElementById('rep-device');
    if (!sel) return;
    const devices = State.get('devices');
    sel.innerHTML = '<option value="">All Devices</option>' + devices.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('#report-tabs .tab-btn').forEach((b, i) => {
      b.classList.toggle('active', ['summary','trips','stops','events'][i] === tab);
    });
    run();
  }

  async function run() {
    const body   = document.getElementById('report-body');
    const period = document.getElementById('rep-period')?.value || 'week';
    const devSel = document.getElementById('rep-device')?.value;
    const { from, to } = rangeForPeriod(period);
    const deviceIds = devSel ? [parseInt(devSel)] : State.get('devices').map(d => d.id);

    body.innerHTML = `<div class="empty-state"><div style="font-size:28px;animation:spin 1s linear infinite">⏳</div><div class="empty-title">Loading…</div></div>`;

    try {
      if (_activeTab === 'summary') await renderSummary(deviceIds, from, to);
      else if (_activeTab === 'trips') await renderTrips(deviceIds, from, to);
      else if (_activeTab === 'stops') await renderStops(deviceIds, from, to);
      else if (_activeTab === 'events') await renderEvents(deviceIds, from, to);
    } catch (e) {
      body.innerHTML = `<div class="note note-danger"><span class="note-icon">❌</span>Failed to load: ${e.message}</div>`;
    }
  }

  async function renderSummary(deviceIds, from, to) {
    const body = document.getElementById('report-body');
    const rows = await API.getReportSummary(deviceIds, [], from, to);

    // Aggregate totals
    const total = rows.reduce((a, r) => ({
      distance:        a.distance        + (r.distance || 0),
      averageSpeed:    a.averageSpeed    + (r.averageSpeed || 0),
      maxSpeed:        Math.max(a.maxSpeed, r.maxSpeed || 0),
      engineHours:     a.engineHours     + (r.engineHours || 0),
      spentFuel:       a.spentFuel       + (r.spentFuel || 0),
      count: a.count + 1,
    }), { distance: 0, averageSpeed: 0, maxSpeed: 0, engineHours: 0, spentFuel: 0, count: 0 });

    const avgSpd = total.count ? total.averageSpeed / total.count : 0;

    body.innerHTML = `
      <div class="kpi-strip">
        <div class="kpi-card">
          <div class="kpi-icon">🛣️</div>
          <div class="kpi-value" style="color:var(--accent)">${(total.distance/1000).toFixed(1)}</div>
          <div class="kpi-label">Total km</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">⚡</div>
          <div class="kpi-value" style="color:var(--accent2)">${(avgSpd*1.852).toFixed(0)}</div>
          <div class="kpi-label">Avg Speed (km/h)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🏎️</div>
          <div class="kpi-value" style="color:var(--warn)">${(total.maxSpeed*1.852).toFixed(0)}</div>
          <div class="kpi-label">Max Speed (km/h)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">⏱️</div>
          <div class="kpi-value">${(total.engineHours/3600000).toFixed(1)}</div>
          <div class="kpi-label">Engine Hours</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">⛽</div>
          <div class="kpi-value" style="color:var(--accent3)">${total.spentFuel.toFixed(1)}</div>
          <div class="kpi-label">Fuel Spent (L)</div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-title">Distance per Vehicle (km)</div>
          <div class="bar-chart" id="dist-chart"></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Fleet Status</div>
          <div class="donut-chart-wrap" id="status-donut"></div>
        </div>
      </div>

      <div class="card" style="overflow:hidden">
        <div class="card-header">
          <div class="card-title">Per-Vehicle Summary</div>
          <span style="font-size:12px;color:var(--muted)">${rows.length} vehicles</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Vehicle</th><th>Distance</th><th>Avg Speed</th><th>Max Speed</th><th>Engine Hours</th><th>Fuel</th>
            </tr></thead>
            <tbody>
              ${rows.map(r => {
                const d = State.getDevice(r.deviceId);
                return `<tr>
                  <td><b>${d?.name || r.deviceId}</b></td>
                  <td class="td-mono">${(r.distance/1000).toFixed(1)} km</td>
                  <td class="td-mono">${(r.averageSpeed*1.852).toFixed(0)} km/h</td>
                  <td class="td-mono" style="color:var(--warn)">${(r.maxSpeed*1.852).toFixed(0)} km/h</td>
                  <td class="td-mono">${(r.engineHours/3600000).toFixed(1)} h</td>
                  <td class="td-mono">${r.spentFuel?.toFixed(1) || '—'} L</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // Bar chart
    const max = Math.max(...rows.map(r => r.distance || 0), 1);
    const chart = document.getElementById('dist-chart');
    if (chart) {
      chart.innerHTML = rows.slice(0,12).map(r => {
        const d = State.getDevice(r.deviceId);
        const h = Math.max(4, ((r.distance || 0) / max) * 90);
        return `<div class="bar-col">
          <div class="bar-fill" style="height:${h}px" title="${(r.distance/1000).toFixed(1)} km"></div>
          <div class="bar-lbl">${(d?.name || '').slice(0,6)}</div>
        </div>`;
      }).join('');
    }

    // Donut
    const c = State.statusCounts();
    const tot = c.online + c.idle + c.offline || 1;
    const pctOn  = Math.round(c.online  / tot * 100);
    const pctIdl = Math.round(c.idle    / tot * 100);
    const pctOff = Math.round(c.offline / tot * 100);
    const circ   = 251;
    const onArc  = (pctOn  / 100 * circ).toFixed(0);
    const idlArc = (pctIdl / 100 * circ).toFixed(0);
    const offArc = (pctOff / 100 * circ).toFixed(0);
    document.getElementById('status-donut').innerHTML = `
      <svg width="110" height="110" viewBox="0 0 110 110" style="transform:rotate(-90deg)">
        <circle cx="55" cy="55" r="40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="14"/>
        <circle cx="55" cy="55" r="40" fill="none" stroke="var(--online)"  stroke-width="14" stroke-dasharray="${onArc} ${circ}"/>
        <circle cx="55" cy="55" r="40" fill="none" stroke="var(--idle)"    stroke-width="14" stroke-dasharray="${idlArc} ${circ}" stroke-dashoffset="-${onArc}"/>
        <circle cx="55" cy="55" r="40" fill="none" stroke="var(--offline)" stroke-width="14" stroke-dasharray="${offArc} ${circ}" stroke-dashoffset="-${+onArc + +idlArc}"/>
      </svg>
      <div class="donut-legend">
        <div class="donut-leg-item"><div class="donut-leg-dot" style="background:var(--online)"></div>Online ${pctOn}%</div>
        <div class="donut-leg-item"><div class="donut-leg-dot" style="background:var(--idle)"></div>Idle ${pctIdl}%</div>
        <div class="donut-leg-item"><div class="donut-leg-dot" style="background:var(--offline)"></div>Offline ${pctOff}%</div>
      </div>`;
  }

  async function renderTrips(deviceIds, from, to) {
    const body = document.getElementById('report-body');
    const rows = await API.getReportTrips(deviceIds, [], from, to);
    if (!rows.length) { body.innerHTML = `<div class="empty-state"><div class="empty-icon">🚗</div><div class="empty-title">No trips found</div></div>`; return; }

    body.innerHTML = `
      <div class="card" style="overflow:hidden">
        <div class="card-header">
          <div class="card-title">Trip Report</div>
          <span style="font-size:12px;color:var(--muted)">${rows.length} trips</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Vehicle</th><th>Driver</th><th>Start</th><th>End</th>
              <th>Distance</th><th>Avg Speed</th><th>Max Speed</th><th>Duration</th><th>Idle Time</th>
            </tr></thead>
            <tbody>
              ${rows.map(r => {
                const d = State.getDevice(r.deviceId);
                return `<tr>
                  <td><b>${d?.name || r.deviceId}</b></td>
                  <td>${r.driverName || '—'}</td>
                  <td class="td-mono">${Fmt.datetime(r.startTime)}</td>
                  <td class="td-mono">${Fmt.datetime(r.endTime)}</td>
                  <td class="td-mono">${(r.distance/1000).toFixed(1)} km</td>
                  <td class="td-mono">${(r.averageSpeed*1.852).toFixed(0)} km/h</td>
                  <td class="td-mono" style="color:var(--warn)">${(r.maxSpeed*1.852).toFixed(0)} km/h</td>
                  <td class="td-mono">${Fmt.duration(r.duration/1000)}</td>
                  <td class="td-mono">${Fmt.duration((r.idleTime||0)/1000)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderStops(deviceIds, from, to) {
    const body = document.getElementById('report-body');
    const rows = await API.getReportStops(deviceIds, [], from, to);
    if (!rows.length) { body.innerHTML = `<div class="empty-state"><div class="empty-icon">🛑</div><div class="empty-title">No stops found</div></div>`; return; }

    body.innerHTML = `
      <div class="card" style="overflow:hidden">
        <div class="card-header">
          <div class="card-title">Stops Report</div>
          <span style="font-size:12px;color:var(--muted)">${rows.length} stops</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Vehicle</th><th>Address</th><th>Start</th><th>End</th><th>Duration</th><th>Engine Hours</th><th>Fuel</th></tr></thead>
            <tbody>
              ${rows.map(r => {
                const d = State.getDevice(r.deviceId);
                return `<tr>
                  <td><b>${d?.name || r.deviceId}</b></td>
                  <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--muted)">${r.address || '—'}</td>
                  <td class="td-mono">${Fmt.datetime(r.startTime)}</td>
                  <td class="td-mono">${Fmt.datetime(r.endTime)}</td>
                  <td class="td-mono">${Fmt.duration((r.duration||0)/1000)}</td>
                  <td class="td-mono">${((r.engineHours||0)/3600000).toFixed(2)} h</td>
                  <td class="td-mono">${r.spentFuel?.toFixed(2) || '—'} L</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function renderEvents(deviceIds, from, to) {
    const body = document.getElementById('report-body');
    const rows = await API.getEvents(from, to, deviceIds);
    if (!rows.length) { body.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><div class="empty-title">No events</div></div>`; return; }

    // Count by type
    const counts = rows.reduce((a, e) => { a[e.type] = (a[e.type] || 0) + 1; return a; }, {});

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        ${Object.entries(counts).sort(([,a],[,b]) => b-a).map(([type, count]) => `
          <div class="kpi-card">
            <div style="font-size:18px;margin-bottom:6px">${EventsView ? '🔔' : '🔔'}</div>
            <div class="kpi-value">${count}</div>
            <div class="kpi-label">${type}</div>
          </div>`).join('')}
      </div>
      <div class="card" style="overflow:hidden">
        <div class="card-header"><div class="card-title">Events Log</div><span style="font-size:12px;color:var(--muted)">${rows.length} events</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Type</th><th>Vehicle</th><th>Time</th><th>Attributes</th></tr></thead>
            <tbody>
              ${rows.slice(0,200).map(r => {
                const d = State.getDevice(r.deviceId);
                const attrs = Object.entries(r.attributes || {}).map(([k,v]) => `${k}: ${v}`).join(', ');
                return `<tr>
                  <td>${r.type}</td>
                  <td><b>${d?.name || r.deviceId}</b></td>
                  <td class="td-mono">${Fmt.datetime(r.serverTime)}</td>
                  <td style="font-size:11px;color:var(--muted)">${attrs || '—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  return { register, run, switchTab };
})();
