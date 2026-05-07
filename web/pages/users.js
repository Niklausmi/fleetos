/* ═══════════════════════════════════════════
   pages/users.js — User Management
   Full CRUD via Traccar /users API
   Includes device permission assignment
═══════════════════════════════════════════ */
const UsersView = (() => {
  let _filter = '';

  function register() {
    Views.register('users', { init, onShow: reload, onHide: () => {} });
  }

  function init() {
    document.getElementById('view-users').innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Users</h2>
          <div class="page-sub" id="user-count">Managing fleet access</div>
        </div>
        <div class="page-actions">
          <div class="search-wrap"><span class="search-icon">🔍</span>
            <input type="text" placeholder="Search users…" style="width:200px" oninput="UsersView.filter(this.value)">
          </div>
          <button class="btn btn-primary" onclick="UsersView.openForm()">+ Add User</button>
        </div>
      </div>
      <div class="page-scroll" id="users-scroll">
        <div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Loading…</div></div>
      </div>`;
    reload();
  }

  async function reload() {
    try {
      const users = await API.getUsers();
      State.set('users', users);
      render();
    } catch (e) {
      document.getElementById('users-scroll').innerHTML =
        `<div class="note note-danger"><span class="note-icon">❌</span>${e.message}</div>`;
    }
  }

  function filter(q) { _filter = q; render(); }

  function render() {
    const scroll = document.getElementById('users-scroll');
    const count  = document.getElementById('user-count');
    if (!scroll) return;
    const users = filterList(State.get('users'), _filter, ['name', 'email']);
    if (count) count.textContent = `${State.get('users').length} users registered`;

    if (!users.length) {
      scroll.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No users found</div></div>`;
      return;
    }

    scroll.innerHTML = `
      <div class="card" style="overflow:hidden">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>User</th><th>Email</th><th>Role</th><th>Phone</th>
              <th>Devices</th><th>Expires</th><th>Status</th>
              <th style="text-align:right">Actions</th>
            </tr></thead>
            <tbody>
              ${users.map(u => {
                const initials = Fmt.initial(u.name);
                const color    = Fmt.avatarColor(u.name);
                const role     = u.administrator ? 'admin' : u.manager ? 'manager' : 'user';
                const expired  = u.expirationTime && new Date(u.expirationTime) < new Date();
                return `<tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:10px">
                      <div class="user-avatar" style="width:32px;height:32px;font-size:12px;background:${color}">${initials}</div>
                      <div>
                        <div style="font-weight:600">${u.name || '—'}</div>
                        ${u.login ? `<div style="font-size:11px;color:var(--muted)">${u.login}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td class="td-mono" style="font-size:12px">${u.email}</td>
                  <td><span class="badge badge-${role}">${role}</span></td>
                  <td style="color:var(--muted);font-size:12px">${u.phone || '—'}</td>
                  <td style="font-family:var(--font-mono);font-size:12px">${u.deviceLimit === -1 ? '∞' : (u.deviceLimit || 0)}</td>
                  <td style="font-size:12px;color:${expired ? 'var(--accent3)' : 'var(--muted)'}">
                    ${u.expirationTime ? Fmt.date(u.expirationTime) : '∞'}
                  </td>
                  <td><span class="badge ${u.disabled ? 'badge-offline' : 'badge-online'}">${u.disabled ? 'Disabled' : 'Active'}</span></td>
                  <td>
                    <div class="td-actions">
                      <button class="btn btn-icon btn-sm" title="Edit" onclick="UsersView.openForm(${u.id})">✏️</button>
                      <button class="btn btn-icon btn-sm" title="Manage permissions" onclick="UsersView.openPermissions(${u.id})">🔑</button>
                      <button class="btn btn-icon btn-sm" title="Delete" onclick="UsersView.confirmDelete(${u.id})">🗑️</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function openForm(id = null) {
    const u = id ? State.get('users').find(x => x.id === id) : null;
    Modal.open({
      title: u ? `Edit User: ${u.name}` : 'Add New User',
      size: 'lg',
      body: `
        <div class="field-row cols-2">
          <div class="field"><label>Full Name *</label>
            <input id="uf-name" value="${u?.name || ''}" placeholder="John Smith"></div>
          <div class="field"><label>Email *</label>
            <input type="email" id="uf-email" value="${u?.email || ''}" placeholder="john@company.com"></div>
        </div>
        <div class="field-row cols-2">
          <div class="field"><label>${u ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" id="uf-pass" placeholder="••••••••"></div>
          <div class="field"><label>Phone</label>
            <input id="uf-phone" value="${u?.phone || ''}" placeholder="+1234567890"></div>
        </div>
        <div class="field-row cols-2">
          <div class="field"><label>Device Limit</label>
            <input type="number" id="uf-dlimit" value="${u?.deviceLimit ?? -1}" placeholder="-1 for unlimited"></div>
          <div class="field"><label>Expiration Date</label>
            <input type="date" id="uf-expire" value="${u?.expirationTime ? u.expirationTime.slice(0,10) : ''}"></div>
        </div>

        <div style="margin:14px 0 10px">
          <label style="display:block;margin-bottom:10px">Role & Permissions</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
              <input type="checkbox" id="uf-admin" ${u?.administrator ? 'checked' : ''} style="width:auto">
              👑 Administrator
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
              <input type="checkbox" id="uf-manager" ${u?.manager ? 'checked' : ''} style="width:auto">
              🧑‍💼 Manager
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
              <input type="checkbox" id="uf-readonly" ${u?.readonly ? 'checked' : ''} style="width:auto">
              👁️ Read Only
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
              <input type="checkbox" id="uf-disabled" ${u?.disabled ? 'checked' : ''} style="width:auto">
              🚫 Disabled
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
              <input type="checkbox" id="uf-devicero" ${u?.deviceReadonly ? 'checked' : ''} style="width:auto">
              📡 Device Read Only
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 12px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
              <input type="checkbox" id="uf-limitcmd" ${u?.limitCommands ? 'checked' : ''} style="width:auto">
              🔒 Limit Commands
            </label>
          </div>
        </div>

        <div class="note"><span class="note-icon">💡</span>
          <div>Administrators have full access. Managers can add/edit devices. Use Permissions to assign specific devices.</div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="UsersView.save(${id || 'null'})">${u ? 'Save Changes' : 'Create User'}</button>`,
    });
  }

  async function save(id) {
    const name  = document.getElementById('uf-name').value.trim();
    const email = document.getElementById('uf-email').value.trim();
    const pass  = document.getElementById('uf-pass').value;
    if (!name || !email)    return Toast.warn('Name and email are required');
    if (!id && !pass)       return Toast.warn('Password is required for new users');

    const expDate = document.getElementById('uf-expire').value;
    const data = {
      name, email,
      phone:          document.getElementById('uf-phone').value.trim(),
      deviceLimit:    parseInt(document.getElementById('uf-dlimit').value) || -1,
      expirationTime: expDate ? new Date(expDate).toISOString() : null,
      administrator:  document.getElementById('uf-admin').checked,
      manager:        document.getElementById('uf-manager').checked,
      readonly:       document.getElementById('uf-readonly').checked,
      disabled:       document.getElementById('uf-disabled').checked,
      deviceReadonly: document.getElementById('uf-devicero').checked,
      limitCommands:  document.getElementById('uf-limitcmd').checked,
    };
    if (pass) data.password = pass;

    try {
      if (id) {
        const updated = await API.updateUser(id, { ...State.get('users').find(x => x.id === id), ...data });
        State.set('users', State.get('users').map(x => x.id === id ? updated : x));
        Toast.success('User updated');
      } else {
        const created = await API.createUser(data);
        State.set('users', [...State.get('users'), created]);
        Toast.success('User created');
      }
      Modal.close();
      render();
    } catch (e) { Toast.error(e.message); }
  }

  function openPermissions(userId) {
    const u = State.get('users').find(x => x.id === userId);
    const devices = State.get('devices');
    const groups  = State.get('groups');
    const geofences = State.get('geofences');

    Modal.open({
      title: `Permissions — ${u?.name}`,
      size: 'lg',
      body: `
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
          Select which devices, groups and zones this user can access.
        </p>

        <div class="field">
          <label>Devices</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:180px;overflow-y:auto;padding:4px">
            ${devices.map(d => `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 10px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
                <input type="checkbox" class="perm-device" data-id="${d.id}" style="width:auto">
                📡 ${d.name}
              </label>`).join('')}
          </div>
        </div>

        <div class="field-row cols-2">
          <div class="field">
            <label>Groups</label>
            ${groups.map(g => `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--text)">
                <input type="checkbox" class="perm-group" data-id="${g.id}" style="width:auto"> 📁 ${g.name}
              </label>`).join('') || '<div style="color:var(--muted);font-size:12px">No groups</div>'}
          </div>
          <div class="field">
            <label>Geofences / Zones</label>
            ${geofences.map(g => `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px;font-size:13px;text-transform:none;letter-spacing:0;color:var(--text)">
                <input type="checkbox" class="perm-geo" data-id="${g.id}" style="width:auto"> 📐 ${g.name}
              </label>`).join('') || '<div style="color:var(--muted);font-size:12px">No zones</div>'}
          </div>
        </div>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="UsersView.savePermissions(${userId})">Save Permissions</button>`,
    });
  }

  async function savePermissions(userId) {
    const perms = [];
    document.querySelectorAll('.perm-device:checked').forEach(el => perms.push({ userId, deviceId: parseInt(el.dataset.id) }));
    document.querySelectorAll('.perm-group:checked').forEach(el => perms.push({ userId, groupId: parseInt(el.dataset.id) }));
    document.querySelectorAll('.perm-geo:checked').forEach(el => perms.push({ userId, geofenceId: parseInt(el.dataset.id) }));

    try {
      await Promise.all(perms.map(p => API.linkPermission(p)));
      Modal.close();
      Toast.success(`Permissions updated`);
    } catch (e) { Toast.error(e.message); }
  }

  function confirmDelete(id) {
    const u = State.get('users').find(x => x.id === id);
    const session = State.get('session');
    if (u?.id === session?.id) return Toast.warn('Cannot delete your own account');
    Modal.confirm({
      title: 'Delete User',
      message: `Delete user <b>${u?.name}</b> (${u?.email})? This action cannot be undone.`,
      confirmText: 'Delete User', danger: true,
      onConfirm: async () => {
        try {
          await API.deleteUser(id);
          State.set('users', State.get('users').filter(x => x.id !== id));
          render();
          Toast.success('User deleted');
        } catch (e) { Toast.error(e.message); }
      },
    });
  }

  return { register, filter, openForm, save, openPermissions, savePermissions, confirmDelete };
})();
