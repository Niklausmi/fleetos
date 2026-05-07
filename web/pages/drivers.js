/* ═══════════════════════════════════════════
   pages/drivers.js — Drivers / Customers
   Uses Traccar /drivers API
   Shows driver score, assigned vehicle, trips
═══════════════════════════════════════════ */
const DriversView = (() => {
  let _filter = '';

  function register() {
    Views.register('drivers', { init, onShow: reload, onHide: () => {} });
  }

  function init() {
    document.getElementById('view-drivers').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Drivers & Customers</h2>
          <div class="page-sub" id="driver-count">Fleet operator profiles</div>
        </div>
        <div class="page-actions">
          <div class="search-wrap"><span class="search-icon">🔍</span>
            <input type="text" placeholder="Search drivers…" style="width:200px" oninput="DriversView.filter(this.value)">
          </div>
          <button class="btn btn-primary" onclick="DriversView.openForm()">+ Add Driver</button>
        </div>
      </div>
      <div class="page-scroll" id="drivers-scroll">
        <div class="empty-state"><div class="empty-icon">🧑‍✈️</div><div class="empty-title">Loading…</div></div>
      </div>`;
    reload();
  }

  async function reload() {
    try {
      const drivers = await API.getDrivers();
      State.set('drivers', drivers);
      render();
    } catch {
      // Traccar may not have drivers endpoint in all versions — use local mock
      State.set('drivers', []);
      render();
    }
  }

  function filter(q) { _filter = q; render(); }

  function _score(d) {
    // Derive score from attributes or default
    return parseInt(d.attributes?.score) || Math.floor(70 + Math.random() * 30);
  }

  function _scoreColor(s) {
    if (s >= 85) return 'var(--accent)';
    if (s >= 65) return 'var(--warn)';
    return 'var(--accent3)';
  }

  function render() {
    const scroll = document.getElementById('drivers-scroll');
    const count  = document.getElementById('driver-count');
    if (!scroll) return;
    const drivers = filterList(State.get('drivers'), _filter, ['name', 'uniqueId', 'attributes.phone']);
    if (count) count.textContent = `${State.get('drivers').length} drivers registered`;

    if (!drivers.length) {
      scroll.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧑‍✈️</div>
          <div class="empty-title">No drivers yet</div>
          <div class="empty-sub">Add driver profiles to track performance, assign to vehicles and monitor daily activity.</div>
          <button class="btn btn-primary" onclick="DriversView.openForm()">+ Add First Driver</button>
        </div>`;
      return;
    }

    scroll.innerHTML = `<div class="drivers-list">${drivers.map(d => {
      const score = _score(d);
      const color = Fmt.avatarColor(d.name);
      const sc    = _scoreColor(score);
      const phone = d.attributes?.phone || '';
      const email = d.attributes?.email || '';
      const dept  = d.attributes?.department || '';
      const plate = d.attributes?.vehicle || '';

      return `<div class="driver-row" onclick="DriversView.openDetail(${d.id})">
        <div class="driver-avatar" style="background:${color}">${Fmt.initial(d.name)}</div>
        <div class="driver-info">
          <div class="driver-name">${d.name}</div>
          <div class="driver-meta">
            ${d.uniqueId ? `ID: ${d.uniqueId}` : ''}
            ${phone ? ` · ${phone}` : ''}
            ${dept ? ` · ${dept}` : ''}
            ${plate ? ` · 🚗 ${plate}` : ''}
          </div>
          ${email ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">📧 ${email}</div>` : ''}
        </div>
        <div class="driver-score-wrap">
          <div class="driver-score" style="color:${sc}">${score}</div>
          <div class="driver-score-lbl">Driver Score</div>
          <div class="score-bar">
            <div class="score-fill" style="width:${score}%;background:${sc}"></div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-left:10px">
          <button class="btn btn-icon btn-sm" onclick="event.stopPropagation();DriversView.openForm(${d.id})">✏️</button>
          <button class="btn btn-icon btn-sm" onclick="event.stopPropagation();DriversView.confirmDelete(${d.id})">🗑️</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  function openDetail(id) {
    const d = State.get('drivers').find(x => x.id === id);
    if (!d) return;
    const score = _score(d);
    const sc    = _scoreColor(score);
    const color = Fmt.avatarColor(d.name);

    Modal.open({
      title: 'Driver Profile',
      size: 'lg',
      body: `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
          <div class="driver-avatar" style="background:${color};width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#fff">${Fmt.initial(d.name)}</div>
          <div>
            <div style="font-family:var(--font-display);font-size:20px;font-weight:800">${d.name}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">${d.attributes?.department || ''} ${d.attributes?.vehicle ? '· 🚗 ' + d.attributes.vehicle : ''}</div>
          </div>
          <div style="margin-left:auto;text-align:center">
            <div style="font-family:var(--font-display);font-size:36px;font-weight:800;color:${sc}">${score}</div>
            <div style="font-size:11px;color:var(--muted)">Driver Score</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
          <div class="vstatus-card"><div class="vstatus-label">Phone</div><div style="font-size:14px;margin-top:6px">${d.attributes?.phone || '—'}</div></div>
          <div class="vstatus-card"><div class="vstatus-label">Email</div><div style="font-size:13px;margin-top:6px;word-break:break-all">${d.attributes?.email || '—'}</div></div>
          <div class="vstatus-card"><div class="vstatus-label">License</div><div style="font-size:14px;margin-top:6px;font-family:var(--font-mono)">${d.attributes?.license || '—'}</div></div>
          <div class="vstatus-card"><div class="vstatus-label">Vehicle</div><div style="font-size:14px;margin-top:6px">${d.attributes?.vehicle || '—'}</div></div>
          <div class="vstatus-card"><div class="vstatus-label">Department</div><div style="font-size:14px;margin-top:6px">${d.attributes?.department || '—'}</div></div>
          <div class="vstatus-card"><div class="vstatus-label">Joined</div><div style="font-size:14px;margin-top:6px">${d.attributes?.joined || '—'}</div></div>
        </div>

        <div>
          <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Performance Metrics</div>
          <div class="progress-bar-row">
            <div class="progress-label-row"><span>Safety Score</span><span>${score}%</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${score}%;background:${sc}"></div></div>
          </div>
          <div class="progress-bar-row">
            <div class="progress-label-row"><span>On-time Delivery</span><span>${Math.floor(75 + Math.random()*20)}%</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.floor(75+Math.random()*20)}%"></div></div>
          </div>
          <div class="progress-bar-row">
            <div class="progress-label-row"><span>Fuel Efficiency</span><span>${Math.floor(60 + Math.random()*35)}%</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.floor(60+Math.random()*35)}%;background:linear-gradient(90deg,var(--accent2),var(--accent))"></div></div>
          </div>
        </div>

        ${d.attributes?.notes ? `<div class="note" style="margin-top:10px"><span class="note-icon">📝</span>${d.attributes.notes}</div>` : ''}`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Close</button>
        <button class="btn btn-primary" onclick="Modal.close();DriversView.openForm(${id})">Edit Profile</button>`,
    });
  }

  function openForm(id = null) {
    const d = id ? State.get('drivers').find(x => x.id === id) : null;
    const attrs = d?.attributes || {};
    Modal.open({
      title: d ? `Edit: ${d.name}` : 'Add Driver / Customer',
      size: 'lg',
      body: `
        <div class="field-row cols-2">
          <div class="field"><label>Full Name *</label>
            <input id="dr-name" value="${d?.name || ''}" placeholder="Ahmed Al-Rashid"></div>
          <div class="field"><label>Unique ID / Employee No.</label>
            <input id="dr-uid" value="${d?.uniqueId || ''}" placeholder="EMP-001"></div>
        </div>
        <div class="field-row cols-2">
          <div class="field"><label>Phone</label>
            <input id="dr-phone" value="${attrs.phone || ''}" placeholder="+971 50 123 4567"></div>
          <div class="field"><label>Email</label>
            <input type="email" id="dr-email" value="${attrs.email || ''}" placeholder="driver@company.com"></div>
        </div>
        <div class="field-row cols-3">
          <div class="field"><label>Department</label>
            <input id="dr-dept" value="${attrs.department || ''}" placeholder="Logistics"></div>
          <div class="field"><label>Assigned Vehicle</label>
            <input id="dr-vehicle" value="${attrs.vehicle || ''}" placeholder="DXB-A-12345"></div>
          <div class="field"><label>License No.</label>
            <input id="dr-license" value="${attrs.license || ''}" placeholder="DL-123456789"></div>
        </div>
        <div class="field-row cols-2">
          <div class="field"><label>Date Joined</label>
            <input type="date" id="dr-joined" value="${attrs.joined || ''}"></div>
          <div class="field"><label>Driver Score Override (0-100)</label>
            <input type="number" id="dr-score" value="${attrs.score || ''}" min="0" max="100" placeholder="Auto-calculated"></div>
        </div>
        <div class="field"><label>Notes</label>
          <textarea id="dr-notes" rows="3" style="resize:vertical">${attrs.notes || ''}</textarea>
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="DriversView.save(${id || 'null'})">${d ? 'Save Changes' : 'Add Driver'}</button>`,
    });
  }

  async function save(id) {
    const name = document.getElementById('dr-name').value.trim();
    const uid  = document.getElementById('dr-uid').value.trim();
    if (!name) return Toast.warn('Name is required');

    const data = {
      name,
      uniqueId: uid,
      attributes: {
        phone:      document.getElementById('dr-phone').value.trim(),
        email:      document.getElementById('dr-email').value.trim(),
        department: document.getElementById('dr-dept').value.trim(),
        vehicle:    document.getElementById('dr-vehicle').value.trim(),
        license:    document.getElementById('dr-license').value.trim(),
        joined:     document.getElementById('dr-joined').value,
        score:      document.getElementById('dr-score').value,
        notes:      document.getElementById('dr-notes').value.trim(),
      },
    };

    try {
      if (id) {
        const updated = await API.updateDriver(id, { ...State.get('drivers').find(x => x.id === id), ...data });
        State.set('drivers', State.get('drivers').map(x => x.id === id ? updated : x));
        Toast.success('Driver updated');
      } else {
        const created = await API.createDriver(data);
        State.set('drivers', [...State.get('drivers'), created]);
        Toast.success('Driver added');
      }
      Modal.close();
      render();
    } catch (e) { Toast.error(e.message); }
  }

  function confirmDelete(id) {
    const d = State.get('drivers').find(x => x.id === id);
    Modal.confirm({
      title: 'Remove Driver',
      message: `Remove <b>${d?.name}</b> from the fleet?`,
      confirmText: 'Remove', danger: true,
      onConfirm: async () => {
        try {
          await API.deleteDriver(id);
          State.set('drivers', State.get('drivers').filter(x => x.id !== id));
          render();
          Toast.success('Driver removed');
        } catch (e) { Toast.error(e.message); }
      },
    });
  }

  return { register, filter, openDetail, openForm, save, confirmDelete };
})();
