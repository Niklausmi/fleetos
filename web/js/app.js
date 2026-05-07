/* ═══════════════════════════════════════════
   app.js — Bootstrap & wiring
═══════════════════════════════════════════ */
const App = (() => {

  async function init() {
    // Load base data in parallel
    try {
      const [devices, positions, geofences, groups] = await Promise.allSettled([
        API.getDevices(),
        API.getPositions(),
        API.getGeofences(),
        API.getGroups(),
      ]);
      if (devices.status === 'fulfilled')    State.set('devices', devices.value);
      if (positions.status === 'fulfilled')  State.mergePositions(positions.value);
      if (geofences.status === 'fulfilled')  State.set('geofences', geofences.value);
      if (groups.status === 'fulfilled')     State.set('groups', groups.value);
    } catch {}

    // Load recent events (last 24h)
    try {
      const { from, to } = rangeForPeriod('today');
      const evts = await API.getEvents(from, to);
      State.set('events', evts);
    } catch {}

    // Connect WebSocket
    WS.connect();

    // Register event-badge updater
    State.on('newEventCount', count => {
      const badge = document.getElementById('events-badge');
      if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-flex' : 'none'; }
    });

    // Periodic position refresh fallback
    setInterval(async () => {
      try {
        const pos = await API.getPositions();
        State.mergePositions(pos);
      } catch {}
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

/* ── AUTO-LOGIN ON LOAD ───────────────── */
window.addEventListener('DOMContentLoaded', async () => {
  const ok = await Auth.tryAutoLogin();
  if (!ok) {
    document.getElementById('login-screen').style.display = 'flex';
  }
});
