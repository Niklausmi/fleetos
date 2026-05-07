/* ═══════════════════════════════════════════
   pages/settings.js — Settings
═══════════════════════════════════════════ */
const SettingsView = (() => {

  function register() {
    Views.register('settings', { init, onShow: () => {}, onHide: () => {} });
  }

  function init() {
    const session = State.get('session') || {};
    document.getElementById('view-settings').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Settings</h2>
          <div class="page-sub">Server, map and account configuration</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-danger" onclick="Auth.logout()">Sign Out</button>
        </div>
      </div>
      <div class="page-scroll">

        <div class="settings-grid">
          <!-- Connection -->
          <div class="settings-section">
            <div class="settings-section-title">🔌 Connection</div>
            <div class="setting-row">
              <div><div class="setting-label">Server URL</div><div class="setting-desc">Active Traccar endpoint</div></div>
              <div style="font-family:var(--font-mono);font-size:11px;color:var(--accent);max-width:160px;overflow:hidden;text-overflow:ellipsis">${API.getBase()}</div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">WebSocket</div><div class="setting-desc">Live real-time updates</div></div>
              <div class="toggle on" id="ws-toggle" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Auto-refresh</div><div class="setting-desc">Fallback polling (15s)</div></div>
              <div class="toggle on" onclick="this.classList.toggle('on')"></div>
            </div>
          </div>

          <!-- Map -->
          <div class="settings-section">
            <div class="settings-section-title">🗺️ Map</div>
            <div class="setting-row">
              <div><div class="setting-label">Map Style</div></div>
              <select id="map-style-sel" style="width:130px" onchange="LiveMap.setStyle(this.value)">
                <option value="dark">Dark</option>
                <option value="satellite">Satellite</option>
                <option value="streets">Streets</option>
              </select>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Trail Length</div><div class="setting-desc">Points per vehicle</div></div>
              <input type="number" value="20" style="width:70px">
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Cluster Markers</div></div>
              <div class="toggle on" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Show Trails</div></div>
              <div class="toggle on" onclick="this.classList.toggle('on')"></div>
            </div>
          </div>

          <!-- Account -->
          <div class="settings-section">
            <div class="settings-section-title">👤 Account</div>
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
              <div class="user-avatar" style="width:52px;height:52px;font-size:20px;background:${Fmt.avatarColor(session.name || 'A')}">${Fmt.initial(session.name || 'A')}</div>
              <div>
                <div style="font-size:15px;font-weight:600">${session.name || '—'}</div>
                <div style="font-size:12px;color:var(--muted)">${session.email || '—'}</div>
                <span class="badge ${session.administrator ? 'badge-admin' : 'badge-user'}" style="margin-top:4px">${session.administrator ? '👑 Admin' : '👤 User'}</span>
              </div>
            </div>
            <button class="btn btn-secondary btn-full" onclick="SettingsView.openChangePassword()">Change Password</button>
          </div>

          <!-- Notifications prefs -->
          <div class="settings-section">
            <div class="settings-section-title">🔔 Alert Preferences</div>
            <div class="setting-row">
              <div><div class="setting-label">Overspeed Alerts</div></div>
              <div class="toggle on" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Geofence Alerts</div></div>
              <div class="toggle on" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Ignition Events</div></div>
              <div class="toggle" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="setting-row">
              <div><div class="setting-label">Offline Alerts</div></div>
              <div class="toggle on" onclick="this.classList.toggle('on')"></div>
            </div>
          </div>

          <!-- Server config (admin only) -->
          ${session.administrator ? `
          <div class="settings-section" style="grid-column:1/-1">
            <div class="settings-section-title">🖥️ Server Configuration</div>
            <div id="server-config-body">
              <div class="empty-state" style="padding:20px"><div class="empty-icon" style="font-size:24px">⏳</div></div>
            </div>
          </div>` : ''}

        </div>
      </div>`;

    if (session.administrator) loadServerConfig();
  }

  async function loadServerConfig() {
    try {
      const srv = await API.getServer();
      State.set('serverInfo', srv);
      const el = document.getElementById('server-config-body');
      if (!el) return;
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px">
          <div class="field"><label>Registration</label>
            <div class="toggle-wrap"><div class="toggle ${srv.registration ? 'on' : ''}" id="srv-registration" onclick="this.classList.toggle('on')"></div><span style="font-size:12px;color:var(--muted)">Allow new registrations</span></div>
          </div>
          <div class="field"><label>Readonly</label>
            <div class="toggle-wrap"><div class="toggle ${srv.readonly ? 'on' : ''}" id="srv-readonly" onclick="this.classList.toggle('on')"></div><span style="font-size:12px;color:var(--muted)">Read-only mode</span></div>
          </div>
          <div class="field"><label>Device Readonly</label>
            <div class="toggle-wrap"><div class="toggle ${srv.deviceReadonly ? 'on' : ''}" id="srv-devicereadonly" onclick="this.classList.toggle('on')"></div><span style="font-size:12px;color:var(--muted)">Users cannot edit devices</span></div>
          </div>
          <div class="field"><label>Map Layer URL</label>
            <input id="srv-map" value="${srv.mapUrl || ''}" placeholder="Custom tile URL"></div>
          <div class="field"><label>Default Latitude</label>
            <input type="number" id="srv-lat" value="${srv.latitude || ''}" placeholder="25.2"></div>
          <div class="field"><label>Default Longitude</label>
            <input type="number" id="srv-lon" value="${srv.longitude || ''}" placeholder="55.3"></div>
        </div>
        <div style="margin-top:14px">
          <button class="btn btn-primary" onclick="SettingsView.saveServer()">Save Server Settings</button>
        </div>`;
    } catch {}
  }

  async function saveServer() {
    const srv = State.get('serverInfo') || {};
    const data = {
      ...srv,
      registration:   document.getElementById('srv-registration')?.classList.contains('on'),
      readonly:       document.getElementById('srv-readonly')?.classList.contains('on'),
      deviceReadonly: document.getElementById('srv-devicereadonly')?.classList.contains('on'),
      mapUrl:         document.getElementById('srv-map')?.value || '',
      latitude:       parseFloat(document.getElementById('srv-lat')?.value) || 0,
      longitude:      parseFloat(document.getElementById('srv-lon')?.value) || 0,
    };
    try {
      await API.updateServer(data);
      Toast.success('Server settings saved');
    } catch (e) { Toast.error(e.message); }
  }

  function openChangePassword() {
    Modal.open({
      title: 'Change Password',
      size: 'sm',
      body: `
        <div class="field"><label>Current Password</label><input type="password" id="cp-old" placeholder="••••••••"></div>
        <div class="field"><label>New Password</label><input type="password" id="cp-new" placeholder="••••••••"></div>
        <div class="field"><label>Confirm Password</label><input type="password" id="cp-confirm" placeholder="••••••••"></div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="SettingsView.savePassword()">Change Password</button>`,
    });
  }

  async function savePassword() {
    const newP    = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    if (!newP)          return Toast.warn('Enter a new password');
    if (newP !== confirm) return Toast.warn('Passwords do not match');
    if (newP.length < 6) return Toast.warn('Password must be at least 6 characters');
    try {
      const session = State.get('session');
      await API.updateUser(session.id, { ...session, password: newP });
      Modal.close();
      Toast.success('Password changed — please log in again');
      setTimeout(() => Auth.logout(), 2000);
    } catch (e) { Toast.error(e.message); }
  }

  return { register, saveServer, openChangePassword, savePassword };
})();
