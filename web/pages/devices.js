/* ═══════════════════════════════════════════
   pages/devices.js — Device Management
   Full FAMS fields: Vehicle Info + Customer Details
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
            <input type="text" id="dev-search" placeholder="Search name, IMEI, plate…"
                   style="width:220px" oninput="DevicesView.filter(this.value)">
          </div>
          <button class="btn btn-primary" onclick="DevicesView.openForm()">+ Add Device</button>
        </div>
      </div>
      <div class="page-scroll">
        <div class="card" style="overflow:hidden">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>Status</th><th>Name / Plate</th><th>IMEI</th><th>Group</th>
                <th>Make / Model</th><th>Speed</th><th>Last Seen</th>
                <th style="text-align:right">Actions</th>
              </tr></thead>
              <tbody id="devices-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>`;

    State.on('devices',   render);
    State.on('positions', render);
    render();
  }

  function filter(q) { _filter = q; render(); }

  function render() {
    const tbody = document.getElementById('devices-tbody');
    const count = document.getElementById('dev-count');
    if (!tbody) return;

    const devices   = State.get('devices').filter(d => {
      if (!_filter) return true;
      const q = _filter.toLowerCase();
      const a = d.attributes || {};
      return (d.name||'').toLowerCase().includes(q) ||
             (d.uniqueId||'').toLowerCase().includes(q) ||
             (a.plate||'').toLowerCase().includes(q) ||
             (a.vrn||'').toLowerCase().includes(q);
    });
    const positions = State.get('positions');
    const groups    = State.get('groups');

    if (count) count.textContent = `${State.get('devices').length} devices registered`;

    if (!devices.length) {
      tbody.innerHTML = `<tr><td colspan="8">
        <div class="empty-state" style="padding:32px">
          <div class="empty-icon">📡</div>
          <div class="empty-title">No devices found</div>
        </div></td></tr>`;
      return;
    }

    tbody.innerHTML = devices.map(d => {
      const p   = positions[d.id] || {};
      const a   = d.attributes || {};
      const s   = d.status || 'offline';
      const grp = groups.find(g => g.id === d.groupId);
      const spd = p.speed ? +(p.speed * 1.852).toFixed(1) : 0;
      const plate = a.plate || a.vrn || '';
      const make  = [a.make, a.model].filter(Boolean).join(' ') || d.model || '—';

      return `<tr>
        <td><span class="status-dot ${s}" style="display:inline-block"></span></td>
        <td>
          <div style="font-weight:500;font-size:13px">${d.name}</div>
          ${plate ? `<div style="font-size:10.5px;color:var(--muted);font-family:var(--font-mono)">${plate}</div>` : ''}
        </td>
        <td class="td-mono">${d.uniqueId || '—'}</td>
        <td>${grp ? `<span class="badge badge-user">${grp.name}</span>` : '—'}</td>
        <td style="font-size:12px">${make}</td>
        <td class="td-mono" style="color:${spd>0?'var(--success)':'var(--muted)'}">
          ${spd > 0 ? spd.toFixed(0)+' km/h' : '—'}
        </td>
        <td class="td-mono">${Fmt.ago(p.fixTime)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-icon btn-sm" title="Focus on map"
                    onclick="DevicesView.focusOnMap(${d.id})">🗺️</button>
            <button class="btn btn-icon btn-sm" title="Edit device"
                    onclick="DevicesView.openForm(${d.id})">✏️</button>
            <button class="btn btn-icon btn-sm" title="Send command"
                    onclick="DevicesView.openCommand(${d.id})">📡</button>
            <button class="btn btn-icon btn-sm" title="Delete"
                    onclick="DevicesView.confirmDelete(${d.id})">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  /* ─────────────────────────────────────────
     DEVICE FORM — Full FAMS fields with tabs
  ───────────────────────────────────────── */
  function openForm(id = null) {
    const d  = id ? State.getDevice(id) : null;
    const a  = d?.attributes || {};
    const groups = State.get('groups');

    Modal.open({
      title: d ? `Edit Device — ${d.name}` : 'Add New Device',
      size:  'lg',
      body: `
        <!-- Tab bar -->
        <div class="tab-bar" style="margin-bottom:18px">
          <button class="tab-btn active" onclick="DevicesView._tab('main',this)">Main</button>
          <button class="tab-btn"        onclick="DevicesView._tab('vehicle',this)">Vehicle Info</button>
          <button class="tab-btn"        onclick="DevicesView._tab('customer',this)">Customer Details</button>
          <button class="tab-btn"        onclick="DevicesView._tab('sim',this)">SIM / Tracker</button>
        </div>

        <!-- MAIN TAB -->
        <div id="dtab-main">
          <div class="field-row cols-2">
            <div class="field"><label>Device Name *</label>
              <input id="df-name" value="${d?.name||''}" placeholder="e.g. BHH-023"></div>
            <div class="field"><label>IMEI (Unique ID) *</label>
              <input id="df-uid" value="${d?.uniqueId||''}" placeholder="352312095141563"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Phone Number</label>
              <input id="df-phone" value="${d?.phone||''}" placeholder="03XXXXXXXXX"></div>
            <div class="field"><label>Category</label>
              <select id="df-category">
                ${['','car','truck','bus','motorcycle','bicycle','boat','plane'].map(c =>
                  `<option value="${c}" ${d?.category===c?'selected':''}>${c||'Default'}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Group</label>
              <select id="df-group">
                <option value="">No Group</option>
                ${groups.map(g =>
                  `<option value="${g.id}" ${d?.groupId===g.id?'selected':''}>${g.name}</option>`
                ).join('')}
              </select>
            </div>
            <div class="field"><label>Contact / Owner</label>
              <input id="df-contact" value="${d?.contact||''}" placeholder="Owner name"></div>
          </div>
          <div class="note note-warn" style="margin-top:4px">
            <span class="note-icon">⚠️</span>
            IMEI must match exactly what is programmed in the GPS device.
          </div>
        </div>

        <!-- VEHICLE INFO TAB -->
        <div id="dtab-vehicle" style="display:none">
          <div class="field-row cols-2">
            <div class="field"><label>VRN / Plate Number</label>
              <input id="df-plate" value="${a.plate||a.vrn||''}" placeholder="BHH-023"></div>
            <div class="field"><label>Vehicle Type</label>
              <select id="df-vtype">
                ${['','Car','Truck','Bus','Motorcycle','Van','Pickup'].map(t =>
                  `<option value="${t}" ${(a.vehicleType||'')=== t?'selected':''}>${t||'Select type'}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Make</label>
              <input id="df-make" value="${a.make||''}" placeholder="Toyota"></div>
            <div class="field"><label>Model</label>
              <input id="df-model" value="${a.model||d?.model||''}" placeholder="Vitz"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Colour</label>
              <input id="df-colour" value="${a.colour||a.color||''}" placeholder="Silver"></div>
            <div class="field"><label>Engine Type</label>
              <select id="df-engine">
                ${['','Petrol','Diesel','CNG','Hybrid','Electric'].map(t =>
                  `<option value="${t}" ${(a.engineType||'')=== t?'selected':''}>${t||'Select'}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>VIN / Chassis No</label>
              <input id="df-vin" value="${a.vin||a.chassisNo||''}" placeholder="Chassis number"></div>
            <div class="field"><label>Registration No</label>
              <input id="df-regno" value="${a.registrationNo||''}" placeholder="Registration number"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Device Model</label>
              <input id="df-devmodel" value="${a.deviceModel||''}" placeholder="ATS-GO, FM3001…"></div>
            <div class="field"><label>Object Owner / Manager</label>
              <input id="df-objowner" value="${a.objectOwner||''}" placeholder="Manager name"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Installation Date</label>
              <input type="date" id="df-installdate" value="${a.installationDate||''}"></div>
            <div class="field"><label>Corporate Name</label>
              <input id="df-corporate" value="${a.corporateName||''}" placeholder="Company name"></div>
          </div>
        </div>

        <!-- CUSTOMER DETAILS TAB -->
        <div id="dtab-customer" style="display:none">
          <div class="field-row cols-2">
            <div class="field"><label>Customer Name</label>
              <input id="df-custname" value="${a.customerName||''}" placeholder="Full name"></div>
            <div class="field"><label>Mobile No. 1</label>
              <input id="df-mob1" value="${a.mobile1||''}" placeholder="03XXXXXXXXX"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Mobile No. 2</label>
              <input id="df-mob2" value="${a.mobile2||''}" placeholder="03XXXXXXXXX"></div>
            <div class="field"><label>Secondary User / Driver</label>
              <input id="df-driver2" value="${a.secondaryDriver||''}" placeholder="Name + number"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Emergency Contact 1</label>
              <input id="df-emg1" value="${a.emergencyContact1||''}" placeholder="Name + number"></div>
            <div class="field"><label>Emergency Contact 2</label>
              <input id="df-emg2" value="${a.emergencyContact2||''}" placeholder="Name + number"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>NIC No.</label>
              <input id="df-nic" value="${a.nicNo||''}" placeholder="XXXXX-XXXXXXX-X"></div>
            <div class="field"><label>Date of Birth</label>
              <input type="date" id="df-dob" value="${a.dateOfBirth||''}"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Mother Name</label>
              <input id="df-mother" value="${a.motherName||''}" placeholder="Mother's name"></div>
            <div class="field"><label>Address</label>
              <input id="df-address" value="${a.address||''}" placeholder="Full address"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Normal Password</label>
              <input id="df-normpass" value="${a.normalPassword||''}" placeholder="e.g. 9696"></div>
            <div class="field"><label>Emergency Password</label>
              <input id="df-emgpass" value="${a.emergencyPassword||''}" placeholder="Emergency code"></div>
          </div>
          <div class="field"><label>Instructions / Notes</label>
            <input id="df-instructions" value="${a.instructions||''}" placeholder="Any special instructions"></div>
        </div>

        <!-- SIM / TRACKER TAB -->
        <div id="dtab-sim" style="display:none">
          <div class="field-row cols-2">
            <div class="field"><label>SIM Number</label>
              <input id="df-sim" value="${a.simNumber||''}" placeholder="03XXXXXXXXX"></div>
            <div class="field"><label>MSISDN</label>
              <input id="df-msisdn" value="${a.msisdn||''}" placeholder="MSISDN"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>SIM Activation Date</label>
              <input type="date" id="df-simact" value="${a.simActivationDate||''}"></div>
            <div class="field"><label>SIM Expiration Date</label>
              <input type="date" id="df-simexp" value="${a.simExpirationDate||''}"></div>
          </div>
          <div class="field-row cols-2">
            <div class="field"><label>Expiration Date</label>
              <input type="date" id="df-expiry" value="${d?.expirationTime?.slice(0,10)||''}"></div>
            <div class="field"><label>Devices Limit</label>
              <input id="df-devlimit" value="${a.devicesLimit||'Unlimited'}" placeholder="Unlimited"></div>
          </div>
        </div>`,

      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        ${d ? `<button class="btn btn-danger btn-sm" onclick="DevicesView.confirmDelete(${d.id});Modal.close()">Delete</button>` : ''}
        <button class="btn btn-primary" onclick="DevicesView.save(${id||'null'})">
          ${d ? 'Save Changes' : 'Add Device'}
        </button>`,
    });
  }

  function _tab(name, btn) {
    ['main','vehicle','customer','sim'].forEach(t => {
      const el = document.getElementById('dtab-' + t);
      if (el) el.style.display = t === name ? '' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  async function save(id) {
    const name     = document.getElementById('df-name')?.value.trim();
    const uniqueId = document.getElementById('df-uid')?.value.trim();
    if (!name || !uniqueId) return Toast.warn('Name and IMEI are required');

    // Collect all attribute fields
    const attrs = {
      // Vehicle info
      plate:            _v('df-plate'),
      vrn:              _v('df-plate'),
      vehicleType:      _v('df-vtype'),
      make:             _v('df-make'),
      model:            _v('df-model'),
      colour:           _v('df-colour'),
      engineType:       _v('df-engine'),
      vin:              _v('df-vin'),
      chassisNo:        _v('df-vin'),
      registrationNo:   _v('df-regno'),
      deviceModel:      _v('df-devmodel'),
      objectOwner:      _v('df-objowner'),
      installationDate: _v('df-installdate'),
      corporateName:    _v('df-corporate'),
      // Customer details
      customerName:     _v('df-custname'),
      mobile1:          _v('df-mob1'),
      mobile2:          _v('df-mob2'),
      secondaryDriver:  _v('df-driver2'),
      emergencyContact1:_v('df-emg1'),
      emergencyContact2:_v('df-emg2'),
      nicNo:            _v('df-nic'),
      dateOfBirth:      _v('df-dob'),
      motherName:       _v('df-mother'),
      address:          _v('df-address'),
      normalPassword:   _v('df-normpass'),
      emergencyPassword:_v('df-emgpass'),
      instructions:     _v('df-instructions'),
      // SIM
      simNumber:        _v('df-sim'),
      msisdn:           _v('df-msisdn'),
      simActivationDate:_v('df-simact'),
      simExpirationDate:_v('df-simexp'),
      devicesLimit:     _v('df-devlimit'),
    };

    // Strip empty values so we don't pollute Traccar attributes
    Object.keys(attrs).forEach(k => { if (!attrs[k]) delete attrs[k]; });

    // Merge with existing attributes if editing
    const existing   = id ? (State.getDevice(id) || {}) : {};
    const existAttrs = existing.attributes || {};

    const data = {
      name, uniqueId,
      phone:    _v('df-phone') || undefined,
      category: _v('df-category') || undefined,
      groupId:  parseInt(_v('df-group')) || undefined,
      contact:  _v('df-contact') || undefined,
      model:    _v('df-model') || undefined,
      attributes: { ...existAttrs, ...attrs },
    };

    try {
      if (id) {
        const updated = await API.updateDevice(id, { ...existing, ...data });
        State.mergeDevices([updated]);
        Toast.success('Device updated');
      } else {
        const created = await API.createDevice(data);
        State.set('devices', [...State.get('devices'), created]);
        Toast.success('Device added');
      }
      Modal.close();
      render();
    } catch (e) { Toast.error('Error: ' + e.message); }
  }

  // Helper: get value of an input by id, return '' if not present
  function _v(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  function confirmDelete(id) {
    const d = State.getDevice(id);
    Modal.open({
      title: 'Delete Device',
      size:  'sm',
      body:  `<div class="confirm-text">Delete <b>${d?.name}</b>? This removes the device and all associated history permanently.</div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-danger" onclick="DevicesView._doDelete(${id})">Delete</button>`,
    });
  }

  async function _doDelete(id) {
    try {
      await API.deleteDevice(id);
      State.set('devices', State.get('devices').filter(d => d.id !== id));
      Toast.success('Device deleted');
      Modal.close();
    } catch (e) { Toast.error(e.message); }
  }

  function focusOnMap(id) {
    Views.show('dashboard');
    setTimeout(() => Dashboard.selectDevice(id), 300);
  }

  function openCommand(deviceId) {
    const d = State.getDevice(deviceId);
    Modal.open({
      title: `Send Command — ${d?.name}`,
      size:  'sm',
      body: `
        <div class="field"><label>Command Type</label>
          <select id="cmd-type">
            <option value="positionPeriodic">Position Periodic</option>
            <option value="engineStop">Engine Stop</option>
            <option value="engineResume">Engine Resume</option>
            <option value="alarmArm">Arm Alarm</option>
            <option value="alarmDisarm">Disarm Alarm</option>
            <option value="custom">Custom SMS</option>
          </select>
        </div>
        <div class="field"><label>Frequency (seconds)</label>
          <input id="cmd-freq" value="60" type="number" min="10"></div>
        <div class="note"><span class="note-icon">📡</span>
          Command is sent to the device on next connection.</div>`,
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

  return {
    register, filter, openForm, _tab, save,
    confirmDelete, _doDelete, focusOnMap, openCommand, sendCommand,
  };
})();
