/* ═══════════════════════════════════════════
   api.js — Traccar REST API wrapper
   Covers all endpoints used by FleetOS
═══════════════════════════════════════════ */
const API = (() => {
  let _base = '';
  let _auth = '';

  function setBase(url, auth) {
    _base = url.replace(/\/$/, '') + '/api';
    _auth = auth;
  }

  async function req(method, path, body = null, form = false) {
    const headers = { Authorization: _auth, Accept: 'application/json' };
    let bodyStr = null;
    if (body) {
      if (form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        bodyStr = new URLSearchParams(body).toString();
      } else {
        headers['Content-Type'] = 'application/json';
        bodyStr = JSON.stringify(body);
      }
    }
    const r = await fetch(_base + path, { method, headers, body: bodyStr, credentials: 'include' });
    if (!r.ok) {
      const msg = await r.text().catch(() => r.statusText);
      throw new Error(msg || r.statusText);
    }
    if (r.status === 204) return null;
    return r.json();
  }

  const get    = (path)        => req('GET',    path);
  const post   = (path, body, form) => req('POST',   path, body, form);
  const put    = (path, body)  => req('PUT',    path, body);
  const del    = (path)        => req('DELETE', path);

  return {
    setBase,
    getBase: () => _base,

    /* ── Session ──────────────────────── */
    login: (email, pass) => post('/session', { email, password: pass }, true),
    logout: () => del('/session'),
    getSession: () => get('/session'),

    /* ── Devices ──────────────────────── */
    getDevices: (userId) => get('/devices' + (userId ? `?userId=${userId}` : '')),
    getDevice: (id) => get(`/devices/${id}`),
    createDevice: (data) => post('/devices', data),
    updateDevice: (id, data) => put(`/devices/${id}`, data),
    deleteDevice: (id) => del(`/devices/${id}`),

    /* ── Positions ────────────────────── */
    getPositions: (deviceId) => get('/positions' + (deviceId ? `?deviceId=${deviceId}` : '')),
    getPositionHistory: (deviceId, from, to) =>
      get(`/positions?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

    /* ── Users ────────────────────────── */
    getUsers: () => get('/users'),
    getUser: (id) => get(`/users/${id}`),
    createUser: (data) => post('/users', data),
    updateUser: (id, data) => put(`/users/${id}`, data),
    deleteUser: (id) => del(`/users/${id}`),

    /* ── Groups ───────────────────────── */
    getGroups: (userId) => get('/groups' + (userId ? `?userId=${userId}` : '')),
    createGroup: (data) => post('/groups', data),
    updateGroup: (id, data) => put(`/groups/${id}`, data),
    deleteGroup: (id) => del(`/groups/${id}`),

    /* ── Geofences ────────────────────── */
    getGeofences: (userId) => get('/geofences' + (userId ? `?userId=${userId}` : '')),
    createGeofence: (data) => post('/geofences', data),
    updateGeofence: (id, data) => put(`/geofences/${id}`, data),
    deleteGeofence: (id) => del(`/geofences/${id}`),

    /* ── Notifications ────────────────── */
    getNotifications: () => get('/notifications'),
    createNotification: (data) => post('/notifications', data),
    updateNotification: (id, data) => put(`/notifications/${id}`, data),
    deleteNotification: (id) => del(`/notifications/${id}`),
    getNotificationTypes: () => get('/notifications/types'),

    /* ── Events (reports) ─────────────── */
    getEvents: (from, to, deviceIds = [], types = []) => {
      const params = new URLSearchParams({ from, to });
      deviceIds.forEach(id => params.append('deviceId', id));
      types.forEach(t => params.append('type', t));
      return get(`/reports/events?${params.toString()}`);
    },

    /* ── Reports ──────────────────────── */
    getReportSummary: (deviceIds, groupIds, from, to) => {
      const p = new URLSearchParams({ from, to });
      deviceIds.forEach(id => p.append('deviceId', id));
      groupIds.forEach(id => p.append('groupId', id));
      return get(`/reports/summary?${p}`);
    },
    getReportTrips: (deviceIds, groupIds, from, to) => {
      const p = new URLSearchParams({ from, to });
      deviceIds.forEach(id => p.append('deviceId', id));
      groupIds.forEach(id => p.append('groupId', id));
      return get(`/reports/trips?${p}`);
    },
    getReportStops: (deviceIds, groupIds, from, to) => {
      const p = new URLSearchParams({ from, to });
      deviceIds.forEach(id => p.append('deviceId', id));
      groupIds.forEach(id => p.append('groupId', id));
      return get(`/reports/stops?${p}`);
    },
    getReportRoute: (deviceId, from, to) =>
      get(`/reports/route?deviceId=${deviceId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

    /* ── Attributes ───────────────────── */
    getComputedAttributes: () => get('/attributes/computed'),
    createComputedAttribute: (data) => post('/attributes/computed', data),
    updateComputedAttribute: (id, data) => put(`/attributes/computed/${id}`, data),
    deleteComputedAttribute: (id) => del(`/attributes/computed/${id}`),

    /* ── Commands ─────────────────────── */
    getCommands: () => get('/commands'),
    sendCommand: (data) => post('/commands/send', data),
    getCommandTypes: (deviceId) => get(`/commands/types?deviceId=${deviceId}`),

    /* ── Calendars ────────────────────── */
    getCalendars: () => get('/calendars'),
    createCalendar: (data) => post('/calendars', data),
    deleteCalendar: (id) => del(`/calendars/${id}`),

    /* ── Server config ────────────────── */
    getServer: () => get('/server'),
    updateServer: (data) => put('/server', data),

    /* ── Statistics ───────────────────── */
    getStatistics: (from, to) => get(`/statistics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),

    /* ── Drivers (attributes) ─────────── */
    getDrivers: () => get('/drivers'),
    createDriver: (data) => post('/drivers', data),
    updateDriver: (id, data) => put(`/drivers/${id}`, data),
    deleteDriver: (id) => del(`/drivers/${id}`),

    /* ── Permissions ──────────────────── */
    linkPermission: (data) => post('/permissions', data),
    unlinkPermission: (data) => req('DELETE', '/permissions', data),
  };
})();
