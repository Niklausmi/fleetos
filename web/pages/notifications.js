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
          <h2 class="page-title">Alert Rules</h2>
          <div class="page-sub">Configure event notifications and alert channels</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="NotificationsView.openForm()">+ New Alert Rule</button>
        </div>
      </div>
      <div class="page-scroll">
        <div class="note note-success" style="margin-bottom:4px">
          <span class="note-icon">💡</span>
          <div>Alert rules are created per user. Each rule triggers a notification when the selected event occurs on the specified devices.</div>
        </div>
        <div id="notif-list" style="display:flex;flex-direction:column;gap:10px">
          <div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-title">Loading…</div></div>
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
        `<div class="note note-danger"><span class="note-icon">❌</span>${e.message}</div>`;
    }
  }

  function render(notifs) {
    const el = document.getElementById('notif-list');
    if (!el) return;
    if (!notifs.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div>
        <div class="empty-title">No alert rules yet</div>
        <div class="empty-sub">Create your first rule to start receiving notifications.</div>
        <button class="btn btn-primary" onclick="NotificationsView.openForm()">+ New Alert Rule</button>
      </div>`;
      return;
    }
    el.innerHTML = notifs.map(n => {
      const et = EVENT_TYPES.find(t => t.value === n.type) || { icon: '🔔', label: n.type };
      const channels = buildChannelBadges(n);
      const devices  = State.get('devices');
      const allDev   = n.always || (!n.deviceId && !n.groupId);
      return `<div class="notif-rule-row">
        <div class="notif-rule-icon" style="background:rgba(0,229,195,0.1)">${et.icon}</div>
        <div class="notif-rule-info">
          <div class="notif-rule-name">${et.label}</div>
          <div class="notif-rule-desc">
            ${allDev ? 'All devices' : (devices.find(d => d.id === n.deviceId)?.name || 'Specific device')}
            ${channels}
          </div>
        </div>
        <div class="notif-rule-actions">
          <div class="toggle ${n.always !== false ? 'on' : ''}" onclick="NotificationsView.toggleEnabled(${n.id}, this)" title="Enable/Disable"></div>
          <button class="btn btn-icon btn-sm" onclick="NotificationsView.openForm(${n.id})">✏️</button>
          <button class="btn btn-icon btn-sm" onclick="NotificationsView.confirmDelete(${n.id})">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }

  function buildChannelBadges(n) {
    const active = [];
    if (n.web)      active.push('🌐 Web');
    if (n.mail)     active.push('📧 Email');
    if (n.sms)      active.push('📱 SMS');
    if (n.telegram) active.push('✈️ Telegram');
    if (n.firebase) active.push('🔥 Firebase');
    if (!active.length) active.push('No channels');
    return ' · ' + active.join(', ');
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
    const data = {
      type:        document.getElementById('nf-type').value,
      deviceId:    parseInt(document.getElementById('nf-device').value) || 0,
      groupId:     parseInt(document.getElementById('nf-group').value) || 0,
      geofenceId:  parseInt(document.getElementById('nf-geofence').value) || 0,
      always:      true,
      web:         document.getElementById('nf-web').checked,
      mail:        document.getElementById('nf-mail').checked,
      sms:         document.getElementById('nf-sms').checked,
      telegram:    document.getElementById('nf-telegram').checked,
      firebase:    document.getElementById('nf-firebase').checked,
      pushover:    document.getElementById('nf-pushover').checked,
      attributes:  { mail: document.getElementById('nf-email-addr').value.trim() },
    };
    if (!data.type) return Toast.warn('Event type is required');
    try {
      if (id) {
        const updated = await API.updateNotification(id, { ...State.get('notifications').find(x => x.id === id), ...data });
        State.set('notifications', State.get('notifications').map(x => x.id === id ? updated : x));
        Toast.success('Alert rule updated');
      } else {
        const created = await API.createNotification(data);
        State.set('notifications', [...State.get('notifications'), created]);
        Toast.success('Alert rule created');
      }
      Modal.close();
      reload();
    } catch (e) { Toast.error(e.message); }
  }

  async function toggleEnabled(id, el) {
    el.classList.toggle('on');
    try {
      const n = State.get('notifications').find(x => x.id === id);
      await API.updateNotification(id, { ...n, always: el.classList.contains('on') });
    } catch (e) { Toast.error(e.message); el.classList.toggle('on'); }
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
