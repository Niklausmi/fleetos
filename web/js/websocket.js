/* ═══════════════════════════════════════════
   websocket.js — Traccar WebSocket
═══════════════════════════════════════════ */
const WS = (() => {
  let _ws = null;
  let _retryTimer = null;
  let _retryCount = 0;

  function connect() {
    const base = API.getBase(); // e.g. http://localhost:8082/api
    if (!base) return;
    const wsUrl = base.replace(/^http/, 'ws') + '/socket';
    _ws = new WebSocket(wsUrl);

    _ws.onopen = () => {
      _retryCount = 0;
      console.log('[WS] connected');
    };

    _ws.onmessage = (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }

      if (data.devices)   State.mergeDevices(data.devices);
      if (data.positions) State.mergePositions(data.positions);
      if (data.events)    State.prependEvents(data.events);
    };

    _ws.onerror = () => {};

    _ws.onclose = () => {
      console.log('[WS] disconnected, retrying…');
      _retryCount++;
      const delay = Math.min(2000 * _retryCount, 30000);
      clearTimeout(_retryTimer);
      _retryTimer = setTimeout(connect, delay);
    };
  }

  function disconnect() {
    clearTimeout(_retryTimer);
    if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
  }

  return { connect, disconnect };
})();
