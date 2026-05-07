/* ═══════════════════════════════════════════
   state.js — Global state store
═══════════════════════════════════════════ */
const State = (() => {
  const _state = {
    session:       null,
    devices:       [],
    positions:     {},   // deviceId → position object
    events:        [],
    geofences:     [],
    users:         [],
    groups:        [],
    notifications: [],
    drivers:       [],
    selectedDevice: null,
    selectedEvent:  null,
    newEventCount:  0,
    serverInfo:     null,
  };

  const _listeners = {};

  function on(key, fn) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(fn);
  }

  function off(key, fn) {
    if (_listeners[key]) _listeners[key] = _listeners[key].filter(f => f !== fn);
  }

  function emit(key) {
    (_listeners[key] || []).forEach(fn => fn(_state[key]));
    (_listeners['*'] || []).forEach(fn => fn(key, _state[key]));
  }

  function set(key, value) {
    _state[key] = value;
    emit(key);
  }

  function get(key) {
    return _state[key];
  }

  function mergePositions(posArray) {
    const pos = { ..._state.positions };
    posArray.forEach(p => pos[p.deviceId] = p);
    set('positions', pos);
  }

  function mergeDevices(devArray) {
    const devs = [..._state.devices];
    devArray.forEach(d => {
      const i = devs.findIndex(x => x.id === d.id);
      if (i >= 0) devs[i] = { ...devs[i], ...d };
      else devs.push(d);
    });
    set('devices', devs);
  }

  function prependEvents(evtArray) {
    const merged = [...evtArray, ..._state.events].slice(0, 500);
    const newCount = _state.newEventCount + evtArray.length;
    _state.newEventCount = newCount;
    set('events', merged);
    emit('newEventCount');
  }

  function clearEventBadge() {
    _state.newEventCount = 0;
    emit('newEventCount');
  }

  function getDevice(id) {
    return _state.devices.find(d => d.id === id);
  }

  function getPosition(deviceId) {
    return _state.positions[deviceId];
  }

  function statusCounts() {
    return _state.devices.reduce((acc, d) => {
      const s = d.status || 'offline';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, { online: 0, idle: 0, offline: 0 });
  }

  return { on, off, set, get, mergePositions, mergeDevices, prependEvents, clearEventBadge, getDevice, getPosition, statusCounts };
})();
