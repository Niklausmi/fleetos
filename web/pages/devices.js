/* ═══════════════════════════════════════════
   pages/devices.js — Device Management
═══════════════════════════════════════════ */
const DevicesView = (() => {
  let _filter = '';

  function register() {
    Views.register('devices', { init, onShow: () => {}, onHide: () => {} });
  }

  function init() {
    document.getElementById('view-devices').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Devices</h2>
          <div class="page-sub" id="dev-count">0 devices registered</div>
        </div>
        <div class="page-actions">
          <div class="search-wrap"><span class="search-icon">🔍</span>
            <input type="text" id="dev-search" placeholder="Search…" style="width:200px" oninput="DevicesView.filter(this.value)">
          </div>
          <button class="btn btn-primary" onclick="DevicesView.openForm()">+ Add Device</button>
        </div>
      </div>
      <div class="page-scroll">
        <div id="devices-table-wrap">
          <div class="card" style="overflow:hidden">
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr>
                  <th>Status</th><th>Name</th><th>Unique ID (IMEI)</th><th>Group</th>
                  <th>Speed</th><th>Last Seen</th><th>Category</th><th style="text-align:right">Actions</th>
                </tr></thead>
                <tbody id="devices-tbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;

    State.on('devices', render);
    State.on('positions', render);
    render();
  }

  function filter(q) { _filter = q; render(); }

  function render() {
    const tbody = document.getElementById('devices-tbody');
    const count = document.getElementById('dev-count');
    if (!tbody) return;
    const devices   = filterList(State.get('devices'), _filter, ['name', 'uniqueId']);
    const positions = State.get('positions');
    const groups    = State.get('groups');

    if (count) count.textContent = `${State.get('devices').length} devices registered`;

    if (!devices.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding:32px"><div class="empty-icon">📡</div><div class="empty-title">No devices found</div></div></td></tr>`;
      return;
    }
    tbody.innerHTML = devices.map(d => {
      const p = positions[d.id] || {};
      const s = Fmt.statusClass(d.status);
      const grp = groups.find(g => g.id === d.groupId);
      return `<tr>
        <td><span class="status-dot ${s}" style="display:inline-block"></span></td>
        <td><b>${d.name}</b>${d.phone ? `<div style="font-size:11px;color:var(--muted)">${d.phone}</div>` : ''}</td>
        <td class="td-mono">${d.uniqueId || '—'}</td>
        <td>${grp ? `<span class="badge badge-user">${grp.name}</span>` : '—'}</td>
        <td class="td-mono">${p.speed ? Fmt.speed(p.speed) : '—'}</td>
        <td class="td-mono">${Fmt.ago(p.fixTime)}</td>
        <td>${d.category ? `<span style="font-size:13px">${catIcon(d.category)}</span> ${d.category}` : '—'}</td>
        <td><div class="td-actions">
          <button class="btn btn-icon btn-sm" title="View on map" onclick="DevicesView.focusOnMap(${d.id})">🗺️</button>
          <button class="btn btn-icon btn-sm" title="Edit" onclick="DevicesView.openForm(${d.id})">✏️</button>
          <button class="btn btn-icon btn-sm" title="Send command" onclick="DevicesView.openCommand(${d.id})">📡</button>
          <button class="btn btn-icon btn-sm" title="Delete" onclick="DevicesView.confirmDelete(${d.id})">🗑️</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  function catIcon(c) {
    const m = { car:'🚗', truck:'🚛', bus:'🚌', motorcycle:'🏍️', bicycle:'🚲', boat:'⛵', plane:'✈️', arrow:'➡️' };
    return m[c] || '🚗';
  }

  function openForm(id = null) {
    const device = id ? State.getDevice(id) : null;
    const groups = State.get('groups');
    Modal.open({
      title: device ? `Edit: ${device.name}` : 'Add New Device',
      size: 'lg',
      body: `
        <div class="field-row cols-2">
          <div class="field"><label>Device Name *</label><input id="df-name" value="${device?.name || ''}" placeholder="e.g. Alpha-01"></div>
          <div class="field"><label>Unique ID (IMEI) *</label><input id="df-uid" value="${device?.uniqueId || ''}" placeholder="123456789012345"></div>
        </div>
        <div class="field-row cols-2">
          <div class="field"><label>Phone Number</label><input id="df-phone" value="${device?.phone || ''}" placeholder="+1234567890"></div>
          <div class="field"><label>Category</label>
            <select id="df-category">
              ${['','car','truck','bus','motorcycle','bicycle','boat','plane','arrow'].map(c => `<option value="${c}" ${device?.category===c?'selected':''}>${c || 'Default'}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field-row cols-2">
          <div class="field"><label>Group</label>
            <select id="df-group">
              <option value="">No Group</option>
              ${groups.map(g => `<option value="${g.id}" ${device?.groupId===g.id?'selected':''}>${g.name}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Contact</label><input id="df-contact" value="${device?.contact || ''}" placeholder="Owner contact"></div>
        </div>
        <div class="field"><label>Model</label><input id="df-model" value="${device?.model || ''}" placeholder="e.g. Toyota Land Cruiser"></div>
        <div class="note note-warn" style="margin-top:4px"><span class="note-icon">⚠️</span>The Unique ID must match the IMEI programmed in the GPS device.</div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="DevicesView.save(${id || 'null'})">${device ? 'Save Changes' : 'Add Device'}</button>`,
    });
  }

  async function save(id) {
    const data = {
      name:     document.getElementById('df-name').value.trim(),
      uniqueId: document.getElementById('df-uid').value.trim(),
      phone:    document.getElementById('df-phone').value.trim(),
      category: document.getElementById('df-category').value,
      groupId:  parseInt(document.getElementById('df-group').value) || 0,
      contact:  document.getElementById('df-contact').value.trim(),
      model:    document.getElementById('df-model').value.trim(),
    };
    if (!data.name || !data.uniqueId) return Toast.warn('Name and Unique ID are required');
    try {
      if (id) {
        const updated = await API.updateDevice(id, { ...State.getDevice(id), ...data });
        State.mergeDevices([updated]);
        Toast.success('Device updated');
      } else {
        const created = await API.createDevice(data);
        State.set('devices', [...State.get('devices'), created]);
        Toast.success('Device added');
      }
      Modal.close();
    } catch (e) { Toast.error('Error: ' + e.message); }
  }

  function confirmDelete(id) {
    const d = State.getDevice(id);
    Modal.confirm({
      title: 'Delete Device',
      message: `Delete <b>${d?.name}</b>? This removes the device and all associated data permanently.`,
      confirmText: 'Delete', danger: true,
      onConfirm: async () => {
        try {
          await API.deleteDevice(id);
          State.set('devices', State.get('devices').filter(d => d.id !== id));
          Toast.success('Device deleted');
        } catch (e) { Toast.error(e.message); }
      },
    });
  }

  function focusOnMap(id) {
    Views.show('dashboard');
    Dashboard.selectDevice(id);
  }

  function openCommand(deviceId) {
    const d = State.getDevice(deviceId);
    Modal.open({
      title: `Send Command — ${d?.name}`,
      size: 'sm',
      body: `
        <div class="field"><label>Command Type</label>
          <select id="cmd-type">
            <option value="positionPeriodic">Position Periodic</option>
            <option value="engineStop">Engine Stop</option>
            <option value="engineResume">Engine Resume</option>
            <option value="alarmArm">Arm Alarm</option>
            <option value="alarmDisarm">Disarm Alarm</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="field"><label>Frequency (seconds)</label><input id="cmd-freq" value="60" type="number"></div>
        <div class="note"><span class="note-icon">📡</span>Command will be sent to the device over the air on next connection.</div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="DevicesView.sendCommand(${deviceId})">Send</button>`,
    });
  }

  async function sendCommand(deviceId) {
    const type = document.getElementById('cmd-type').value;
    const freq = parseInt(document.getElementById('cmd-freq').value);
    try {
      await API.sendCommand({ deviceId, type, attributes: { frequency: freq } });
      Modal.close();
      Toast.success('Command sent');
    } catch (e) { Toast.error(e.message); }
  }

  return { register, filter, openForm, save, confirmDelete, focusOnMap, openCommand, sendCommand };
})();
