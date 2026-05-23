/* ═══════════════════════════════════════════
   pages/notifications.js — Alert Rules
   Uses Traccar /notifications API
═══════════════════════════════════════════ */
const NotificationsView = (() => {

  const EVENT_TYPES = [
    { value: 'deviceOnline',       label: 'Device Online',      icon: '✅' },
    { value: 'deviceOffline',      label: 'Device Offline',     icon: '❌' },
    { value: 'deviceUnknown',      label: 'Device Unknown',     icon: '❓' },
    { value: 'deviceStopped',      label: 'Device Stopped',     icon: '🛑' },
    { value: 'deviceMoving',       label: 'Device Moving',      icon: '🏃' },
    { value: 'deviceOverspeed',    label: 'Overspeed',          icon: '⚡' },
    { value: 'deviceFuelDrop',     label: 'Fuel Drop',          icon: '⛽' },
    { value: 'deviceFuelIncrease', label: 'Fuel Increase',      icon: '🔋' },
    { value: 'commandResult',      label: 'Command Result',     icon: '📡' },
    { value: 'geofenceEnter',      label: 'Geofence Enter',     icon: '📍' },
    { value: 'geofenceExit',       label: 'Geofence Exit',      icon: '🚪' },
    { value: 'alarm',              label: 'Alarm',              icon: '🚨' },
    { value: 'ignitionOn',         label: 'Ignition ON',        icon: '🔑' },
    { value: 'ignitionOff',        label: 'Ignition OFF',       icon: '🔒' },
    { value: 'maintenance',        label: 'Maintenance Due',    icon: '🔧' },
    { value: 'textMessage',        label: 'Text Message',       icon: '💬' },
    { value: 'driverChanged',      label: 'Driver Changed',     icon: '🧑' },
  ];

  const NOTIF_CHANNELS = [
    { value: 'web',        label: 'Web Push',    icon: '🌐' },
    { value: 'mail',       label: 'Email',       icon: '📧' },
    { value: 'sms',        label: 'SMS',         icon: '📱' },
    { value: 'telegram',   label: 'Telegram',    icon: '✈️' },
    { value: 'pushover',   label: 'Pushover',    icon: '📲' },
    { value: 'firebase',   label: 'Firebase',    icon: '🔥' },
  ];

  function register() {
    Views.register('notifications', { init, onShow: reload, onHide: () => {} });
  }

  function init() {
    document.getElementById('view-notifications').innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Alert Rules</div>
          <div class="page-sub">Configure event notifications and delivery channels</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="NotificationsView.openForm()">
            + New Alert Rule
          </button>
        </div>
      </div>
      <div class="page-scroll">
        <div class="note" style="margin-bottom:0">
          <span class="note-icon">ℹ️</span>
          <div>Alert rules are per user. Each rule triggers a notification when the selected event occurs on the specified devices.</div>
        </div>
        <div class="card" style="overflow:hidden">
          <div id="notif-list">
            <div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">Loading…</div></div>
          </div>
        </div>
      </div>`;
    reload();
  }

  async function reload() {
    try {
      const notifs = await API.getNotifications();
      State.set('notifications', notifs);
      render(notifs);
    } catch (e) {
      document.getElementById('notif-list').innerHTML =
        `<div class="note note-danger" style="margin:16px"><span class="note-icon">❌</span>${e.message}</div>`;
    }
  }

  function render(notifs) {
    const el = document.getElementById('notif-list');
    if (!el) return;
    if (!notifs.length) {
      el.innerHTML = `<div class="empty-state">
        <div class="empty-icon">⚡</div>
        <div class="empty-title">No alert rules yet</div>
        <div class="empty-sub">Create your first rule to start receiving notifications.</div>
        <button class="btn btn-primary" style="margin-top:8px" onclick="NotificationsView.openForm()">+ New Alert Rule</button>
      </div>`;
      return;
    }

    const devices = State.get('devices');

    el.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:36px"></th>
            <th>Event Type</th>
            <th>Applies To</th>
            <th>Channels</th>
            <th style="width:80px">Enabled</th>
            <th style="width:88px; text-align:right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${notifs.map(n => {
            const et      = EVENT_TYPES.find(t => t.value === n.type) || { icon: '🔔', label: n.type };
            const allDev  = n.always || (!n.deviceId && !n.groupId);
            const devName = allDev
              ? '<span style="color:var(--muted)">All devices</span>'
              : (devices.find(d => d.id === n.deviceId)?.name || 'Specific device');
            const channels = buildChannelTags(n);
            const enabled  = n.always !== false;

            return `<tr>
              <td>
                <div class="notif-type-dot" style="background:${typeColor(n.type)}"></div>
              </td>
              <td>
                <div class="notif-type-name">${et.label}</div>
                <div class="notif-type-key td-mono">${n.type}</div>
              </td>
              <td>${devName}</td>
              <td>${channels}</td>
              <td>
                <div class="toggle ${enabled ? 'on' : ''}"
                     onclick="NotificationsView.toggleEnabled(${n.id}, this)"></div>
              </td>
              <td>
                <div class="td-actions">
                  <button class="btn btn-icon btn-sm" title="Edit"
                          onclick="NotificationsView.openForm(${n.id})">✏️</button>
                  <button class="btn btn-icon btn-sm" title="Delete"
                          onclick="NotificationsView.confirmDelete(${n.id})">🗑️</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  }

  function buildChannelTags(n) {
    const map = [
      { key:'web',      label:'Web',      color:'var(--info)' },
      { key:'mail',     label:'Email',    color:'var(--primary)' },
      { key:'sms',      label:'SMS',      color:'var(--success)' },
      { key:'telegram', label:'Telegram', color:'var(--info)' },
      { key:'firebase', label:'Firebase', color:'var(--warn)' },
      { key:'pushover', label:'Pushover', color:'var(--muted)' },
    ];
    const active = map.filter(c => n[c.key]);
    if (!active.length)
      return `<span style="font-size:12px;color:var(--muted)">— none</span>`;
    return active.map(c =>
      `<span class="notif-channel-tag" style="--tc:${c.color}">${c.label}</span>`
    ).join('');
  }

  function typeColor(type) {
    const map = {
      deviceOverspeed:'var(--danger)', alarm:'var(--danger)',
      geofenceEnter:'var(--info)',     geofenceExit:'var(--info)',
      ignitionOn:'var(--success)',     ignitionOff:'var(--muted)',
      deviceOffline:'var(--warn)',     deviceOnline:'var(--success)',
      deviceMoving:'var(--primary)',   deviceStopped:'var(--muted)',
      maintenance:'var(--warn)',
    };
    return map[type] || 'var(--border-m)';
  }

  function openForm(id = null) {
    const n = id ? State.get('notifications').find(x => x.id === id) : null;
    const devices   = State.get('devices');
    const groups    = State.get('groups');
    const geofences = State.get('geofences');

    Modal.open({
      title: n ? 'Edit Alert Rule' : 'New Alert Rule',
      size: 'lg',
      body: `
        <div class="field">
          <label>Event Type *</label>
          <select id="nf-type">
            ${EVENT_TYPES.map(t => `<option value="${t.value}" ${n?.type === t.value ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
          </select>
        </div>

        <div class="field-row cols-2">
          <div class="field">
            <label>Apply to Devices</label>
            <select id="nf-device">
              <option value="">All Devices</option>
              ${devices.map(d => `<option value="${d.id}" ${n?.deviceId === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Or Apply to Group</label>
            <select id="nf-group">
              <option value="">No Group Filter</option>
              ${groups.map(g => `<option value="${g.id}" ${n?.groupId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="field">
          <label>Geofence (optional — for geofence events)</label>
          <select id="nf-geofence">
            <option value="">Any Geofence</option>
            ${geofences.map(g => `<option value="${g.id}" ${n?.geofenceId === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>
        </div>

        <div style="margin:14px 0 10px">
          <label style="display:block;margin-bottom:10px">Notification Channels</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            ${NOTIF_CHANNELS.map(c => `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
                <input type="checkbox" id="nf-${c.value}" ${n?.[c.value] ? 'checked' : ''} style="width:auto">
                ${c.icon} ${c.label}
              </label>`).join('')}
          </div>
        </div>

        <div id="nf-email-wrap" class="field" style="display:none">
          <label>Email Address (override)</label>
          <input id="nf-email-addr" value="${n?.attributes?.mail || ''}" placeholder="Leave blank to use account email">
        </div>

        <div class="note note-warn" style="margin-top:4px">
          <span class="note-icon">⚠️</span>
          <div>Email/SMS channels require server-level SMTP/SMS configuration in traccar.xml.</div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="NotificationsView.save(${id || 'null'})">${n ? 'Save Changes' : 'Create Rule'}</button>`,
    });

    // Show/hide email field based on channel selection
    document.getElementById('nf-mail').addEventListener('change', (e) => {
      document.getElementById('nf-email-wrap').style.display = e.target.checked ? 'block' : 'none';
    });
    if (n?.mail) document.getElementById('nf-email-wrap').style.display = 'block';
  }

  async function save(id) {
    const type       = document.getElementById('nf-type').value;
    const deviceId   = parseInt(document.getElementById('nf-device').value)   || null;
    const groupId    = parseInt(document.getElementById('nf-group').value)    || null;
    const geofenceId = parseInt(document.getElementById('nf-geofence').value) || null;
    const emailAddr  = document.getElementById('nf-email-addr').value.trim();

    if (!type) return Toast.warn('Event type is required');

    // Build only the fields Traccar accepts — omit zeros/nulls entirely
    const data = { type, always: true };
    if (deviceId)   data.deviceId   = deviceId;
    if (groupId)    data.groupId    = groupId;
    if (geofenceId) data.geofenceId = geofenceId;

    // Channel booleans — only include if true to keep payload minimal
    const channels = ['web','mail','sms','telegram','firebase','pushover'];
    channels.forEach(c => {
      const el = document.getElementById('nf-' + c);
      if (el && el.checked) data[c] = true;
    });

    // Attributes — only include non-empty values
    const attrs = {};
    if (emailAddr) attrs.mail = emailAddr;
    if (Object.keys(attrs).length) data.attributes = attrs;

    try {
      if (id) {
        // Merge with existing to preserve any server fields (id, calendarId, etc.)
        const existing = State.get('notifications').find(x => x.id === id) || {};
        const payload  = { ...existing, ...data, id };
        const updated  = await API.updateNotification(id, payload);
        State.set('notifications', State.get('notifications').map(x => x.id === id ? updated : x));
        Toast.success('Alert rule updated');
      } else {
        const created = await API.createNotification(data);
        State.set('notifications', [...State.get('notifications'), created]);
        Toast.success('Alert rule created');
      }
      Modal.close();
      reload();
    } catch (e) {
      Toast.error('Save failed: ' + e.message);
    }
  }

  async function toggleEnabled(id, el) {
    const wasOn = el.classList.contains('on');
    el.classList.toggle('on');
    try {
      const n = State.get('notifications').find(x => x.id === id);
      if (!n) return;
      // Traccar toggle: flip 'always' field; preserve all other fields intact
      await API.updateNotification(id, { ...n, always: !wasOn });
      State.set('notifications', State.get('notifications').map(x =>
        x.id === id ? { ...x, always: !wasOn } : x
      ));
    } catch (e) {
      Toast.error(e.message);
      el.classList.toggle('on'); // revert UI on failure
    }
  }

  function confirmDelete(id) {
    const n = State.get('notifications').find(x => x.id === id);
    const et = EVENT_TYPES.find(t => t.value === n?.type);
    Modal.confirm({
      title: 'Delete Alert Rule',
      message: `Delete rule for <b>${et?.label || n?.type}</b>?`,
      confirmText: 'Delete', danger: true,
      onConfirm: async () => {
        try {
          await API.deleteNotification(id);
          State.set('notifications', State.get('notifications').filter(x => x.id !== id));
          render(State.get('notifications'));
          Toast.success('Rule deleted');
        } catch (e) { Toast.error(e.message); }
      },
    });
  }

  return { register, openForm, save, toggleEnabled, confirmDelete };
})();
