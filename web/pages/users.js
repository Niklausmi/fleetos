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

  async function openPermissions(userId) {
    const u = State.get('users').find(x => x.id === userId);
    
    Modal.open({
      title: `Permissions — ${u?.name || 'User'}`,
      size: 'lg',
      body: `
        <div class="empty-state">
          <div class="empty-icon">🔑</div>
          <div class="empty-title">Loading permissions…</div>
        </div>`,
      footer: `<button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>`
    });

    try {
      const [userDevices, userGroups, userGeofences] = await Promise.all([
        API.getDevices(userId),
        API.getGroups(userId),
        API.getGeofences(userId),
      ]);

      const devices = State.get('devices') || [];
      const groups  = State.get('groups') || [];
      const geofences = State.get('geofences') || [];

      const userDeviceIds = new Set(userDevices.map(d => d.id));
      const userGroupIds = new Set(userGroups.map(g => g.id));
      const userGeofenceIds = new Set(userGeofences.map(g => g.id));

      Modal.open({
        title: `Permissions — ${u?.name || 'User'}`,
        size: 'lg',
        body: `
          <p style="font-size:13px;color:var(--muted);margin-bottom:16px">
            Select which devices, groups and zones this user can access.
          </p>

          <div class="field-row cols-2" style="margin-bottom: 14px">
            <div class="field">
              <label>Devices</label>
              <div class="multiselect-dropdown" id="dropdown-devices">
                <div class="multiselect-header" id="header-devices">Select devices...</div>
                <div class="multiselect-body">
                  <div class="multiselect-search-wrap">
                    <input type="text" class="multiselect-search" id="search-devices" placeholder="Search devices...">
                  </div>
                  <div class="multiselect-list" id="list-devices">
                    ${devices.map(d => {
                      const checked = userDeviceIds.has(d.id) ? 'checked' : '';
                      return `
                      <label class="multiselect-item" data-text="${d.name.toLowerCase()}">
                        <input type="checkbox" class="perm-device" data-id="${d.id}" ${checked}>
                        📡 ${d.name}
                      </label>`;
                    }).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">No devices available</div>'}
                  </div>
                </div>
              </div>
            </div>

            <div class="field">
              <label>Geofences / Zones</label>
              <div class="multiselect-dropdown" id="dropdown-geofences">
                <div class="multiselect-header" id="header-geofences">Select zones...</div>
                <div class="multiselect-body">
                  <div class="multiselect-search-wrap">
                    <input type="text" class="multiselect-search" id="search-geofences" placeholder="Search zones...">
                  </div>
                  <div class="multiselect-list" id="list-geofences">
                    ${geofences.map(g => {
                      const checked = userGeofenceIds.has(g.id) ? 'checked' : '';
                      return `
                      <label class="multiselect-item" data-text="${g.name.toLowerCase()}">
                        <input type="checkbox" class="perm-geo" data-id="${g.id}" ${checked}>
                        📐 ${g.name}
                      </label>`;
                    }).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">No zones available</div>'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="field">
            <label>Groups</label>
            <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:120px;overflow-y:auto;padding:4px">
              ${groups.map(g => {
                const checked = userGroupIds.has(g.id) ? 'checked' : '';
                return `
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--glass);border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 10px;text-transform:none;font-size:13px;letter-spacing:0;color:var(--text)">
                  <input type="checkbox" class="perm-group" data-id="${g.id}" ${checked} style="width:auto"> 📁 ${g.name}
                </label>`;
              }).join('') || '<div style="color:var(--muted);font-size:12px">No groups</div>'}
            </div>
          </div>`,
        footer: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" id="btn-save-perms">Save Permissions</button>`,
      });

      // Helper function to update dropdown header texts
      function updateHeader(dropdownId, checkboxClass, placeholderText) {
        const checked = document.querySelectorAll(`#${dropdownId} .${checkboxClass}:checked`);
        const header = document.getElementById(`header-${dropdownId.split('-')[1]}`);
        if (!header) return;
        if (checked.length === 0) {
          header.textContent = placeholderText;
        } else if (checked.length === 1) {
          const labelText = checked[0].parentElement.textContent.trim().replace(/^[^\s]+\s+/, '');
          header.textContent = labelText;
        } else {
          header.textContent = `${checked.length} selected`;
        }
      }

      // Initial header update
      updateHeader('dropdown-devices', 'perm-device', 'Select devices...');
      updateHeader('dropdown-geofences', 'perm-geo', 'Select zones...');

      // Dropdown toggle logic
      document.querySelectorAll('.multiselect-header').forEach(header => {
        header.onclick = (e) => {
          e.stopPropagation();
          const dropdown = header.parentElement;
          const wasOpen = dropdown.classList.contains('open');
          
          // Close other dropdowns
          document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.remove('open'));
          
          if (!wasOpen) {
            dropdown.classList.add('open');
            dropdown.querySelector('.multiselect-search')?.focus();
          }
        };
      });

      // Close dropdowns on outside click
      const closeDropdowns = () => {
        document.querySelectorAll('.multiselect-dropdown').forEach(d => d.classList.remove('open'));
      };
      document.removeEventListener('click', closeDropdowns);
      document.addEventListener('click', closeDropdowns);
      
      // Prevent closing when clicking inside the dropdown body
      document.querySelectorAll('.multiselect-body').forEach(body => {
        body.onclick = (e) => {
          e.stopPropagation();
        };
      });

      // Search functionality
      const wireSearch = (searchId, listId) => {
        const searchInput = document.getElementById(searchId);
        if (!searchInput) return;
        searchInput.oninput = (e) => {
          const q = e.target.value.toLowerCase().trim();
          const items = document.querySelectorAll(`#${listId} .multiselect-item`);
          items.forEach(item => {
            const text = item.dataset.text || '';
            if (text.includes(q)) {
              item.style.display = 'flex';
            } else {
              item.style.display = 'none';
            }
          });
        };
      };

      wireSearch('search-devices', 'list-devices');
      wireSearch('search-geofences', 'list-geofences');

      // Update headers on checkbox change
      document.querySelectorAll('.perm-device').forEach(cb => {
        cb.onchange = () => updateHeader('dropdown-devices', 'perm-device', 'Select devices...');
      });
      document.querySelectorAll('.perm-geo').forEach(cb => {
        cb.onchange = () => updateHeader('dropdown-geofences', 'perm-geo', 'Select zones...');
      });

      document.getElementById('btn-save-perms').onclick = () => {
        document.removeEventListener('click', closeDropdowns);
        UsersView.savePermissions(userId, userDeviceIds, userGroupIds, userGeofenceIds);
      };

      // Clean up event listener on Cancel button or Close icon click
      document.querySelector('#modal-footer button.btn-secondary')?.addEventListener('click', () => {
        document.removeEventListener('click', closeDropdowns);
      });
      document.querySelector('.modal-close')?.addEventListener('click', () => {
        document.removeEventListener('click', closeDropdowns);
      });

    } catch (e) {
      Modal.open({
        title: `Permissions — ${u?.name || 'User'}`,
        size: 'lg',
        body: `
          <div class="note note-danger">
            <span class="note-icon">❌</span>
            Failed to load permissions: ${e.message}
          </div>`,
        footer: `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`
      });
    }
  }

  async function savePermissions(userId, initialDeviceIds, initialGroupIds, initialGeofenceIds) {
    const currentDeviceIds = new Set();
    const currentGroupIds = new Set();
    const currentGeofenceIds = new Set();

    document.querySelectorAll('.perm-device:checked').forEach(el => currentDeviceIds.add(parseInt(el.dataset.id)));
    document.querySelectorAll('.perm-group:checked').forEach(el => currentGroupIds.add(parseInt(el.dataset.id)));
    document.querySelectorAll('.perm-geo:checked').forEach(el => currentGeofenceIds.add(parseInt(el.dataset.id)));

    const toLink = [];
    const toUnlink = [];

    // Compare and diff devices
    const devices = State.get('devices') || [];
    devices.forEach(d => {
      const wasLinked = initialDeviceIds.has(d.id);
      const isLinked = currentDeviceIds.has(d.id);
      if (isLinked && !wasLinked) {
        toLink.push({ userId, deviceId: d.id });
      } else if (!isLinked && wasLinked) {
        toUnlink.push({ userId, deviceId: d.id });
      }
    });

    // Compare and diff groups
    const groups = State.get('groups') || [];
    groups.forEach(g => {
      const wasLinked = initialGroupIds.has(g.id);
      const isLinked = currentGroupIds.has(g.id);
      if (isLinked && !wasLinked) {
        toLink.push({ userId, groupId: g.id });
      } else if (!isLinked && wasLinked) {
        toUnlink.push({ userId, groupId: g.id });
      }
    });

    // Compare and diff geofences
    const geofences = State.get('geofences') || [];
    geofences.forEach(g => {
      const wasLinked = initialGeofenceIds.has(g.id);
      const isLinked = currentGeofenceIds.has(g.id);
      if (isLinked && !wasLinked) {
        toLink.push({ userId, geofenceId: g.id });
      } else if (!isLinked && wasLinked) {
        toUnlink.push({ userId, geofenceId: g.id });
      }
    });

    const btn = document.getElementById('btn-save-perms');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    try {
      if (toLink.length > 0) {
        await Promise.all(toLink.map(p => API.linkPermission(p)));
      }
      if (toUnlink.length > 0) {
        await Promise.all(toUnlink.map(p => API.unlinkPermission(p)));
      }
      Modal.close();
      Toast.success('Permissions updated');
    } catch (e) {
      Toast.error(e.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save Permissions';
      }
    }
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
