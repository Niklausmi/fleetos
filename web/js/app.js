/* ═══════════════════════════════════════════
   app.js — Bootstrap & wiring
═══════════════════════════════════════════ */
const App = (() => {

  async function init() {
    try {
      const [devices, positions, geofences, groups] = await Promise.allSettled([
        API.getDevices(),
        API.getPositions(),
        API.getGeofences(),
        API.getGroups(),
      ]);
      if (devices.status   === 'fulfilled') State.set('devices',   devices.value);
      if (positions.status === 'fulfilled') State.mergePositions(positions.value);
      if (geofences.status === 'fulfilled') State.set('geofences', geofences.value);
      if (groups.status    === 'fulfilled') State.set('groups',    groups.value);
    } catch {}

    // FIX: use reliable 24h window instead of midnight-local to avoid TZ drift
    try {
      const to   = new Date().toISOString();
      const from = new Date(Date.now() - 86400000).toISOString();
      const evts = await API.getEvents(from, to);
      State.set('events', evts);
    } catch {}

    // Connect WebSocket
    WS.connect();

    // Event badge updater
    State.on('newEventCount', count => {
      const badge = document.getElementById('events-badge');
      if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
    });

    // Periodic position refresh fallback (every 15s)
    setInterval(async () => {
      try { State.mergePositions(await API.getPositions()); } catch {}
    }, 15000);

    // Register all views
    Dashboard.register();
    EventsView.register();
    PlaybackView.register();
    ReportsView.register();
    DevicesView.register();
    GeofencesView.register();
    NotificationsView.register();
    UsersView.register();
    DriversView.register();
    SettingsView.register();

    // Show default view
    Views.show('dashboard');
  }

  return { init };
})();

window.addEventListener('DOMContentLoaded', async () => {
  const ok = await Auth.tryAutoLogin();
  if (!ok) {
    document.getElementById('login-screen').style.display = 'flex';
  }
});
