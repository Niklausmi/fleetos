/* ═══════════════════════════════════════════
   views.js — View router
═══════════════════════════════════════════ */
const Views = (() => {
  const _registry = {};
  let _current = null;

  const _meta = {
    dashboard:     { title: 'Live Map',  breadcrumb: 'Overview' },
    events:        { title: 'Events',    breadcrumb: 'Monitor' },
    notifications: { title: 'Alerts',   breadcrumb: 'Monitor' },
    playback:      { title: 'Playback',  breadcrumb: 'Analyze' },
    reports:       { title: 'Reports',   breadcrumb: 'Analyze' },
    devices:       { title: 'Devices',   breadcrumb: 'Manage' },
    geofences:     { title: 'Zones',     breadcrumb: 'Manage' },
    drivers:       { title: 'Drivers',   breadcrumb: 'Manage' },
    users:         { title: 'Users',     breadcrumb: 'Manage' },
    settings:      { title: 'Settings',  breadcrumb: 'Configuration' },
  };

  function register(name, { init, onShow, onHide }) {
    _registry[name] = { init, onShow, onHide, initialized: false };
  }

  function show(name) {
    if (!_registry[name]) { console.warn('Unknown view:', name); return; }

    // Hide current
    if (_current) {
      document.getElementById('view-' + _current)?.classList.remove('active');
      document.querySelector(`[data-view="${_current}"]`)?.classList.remove('active');
      _registry[_current]?.onHide?.();
    }

    // Show new
    const el = document.getElementById('view-' + name);
    if (!el) return;
    el.classList.add('active');
    document.querySelector(`[data-view="${name}"]`)?.classList.add('active');

    // Init once
    if (!_registry[name].initialized) {
      _registry[name].init?.();
      _registry[name].initialized = true;
    }
    _registry[name].onShow?.();
    _current = name;

    // FIX: Update topbar title + breadcrumb
    const m = _meta[name] || { title: name, breadcrumb: name };
    if (window.UI) UI.setPage(m.title, m.breadcrumb);

    // Clear event badge when viewing events
    if (name === 'events') State.clearEventBadge();
  }

  function reinit(name) {
    if (_registry[name]) {
      _registry[name].initialized = false;
      const el = document.getElementById('view-' + name);
      if (el) el.innerHTML = '';
    }
  }

  return { register, show, reinit };
})();
