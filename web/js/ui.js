/* ═══════════════════════════════════════════
   ui.js — Modal, Toast, helpers
═══════════════════════════════════════════ */

/* ── TOAST ───────────────────────────── */
const Toast = (() => {
  function show(msg, type = 'default', duration = 3200) {
    const wrap = document.getElementById('toast-wrap');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', warn: '⚠', default: 'ℹ' };
    el.innerHTML = `<span>${icons[type] || icons.default}</span> ${msg}`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, duration);
  }
  return {
    success: (m, d) => show(m, 'success', d),
    error:   (m, d) => show(m, 'error', d),
    warn:    (m, d) => show(m, 'warn', d),
    info:    (m, d) => show(m, 'default', d),
  };
})();

/* ── MODAL ───────────────────────────── */
const Modal = (() => {
  function open({ title, body, footer = '', size = '' }) {
    document.getElementById('modal-title').innerHTML = title;
    document.getElementById('modal-body').innerHTML  = body;
    document.getElementById('modal-footer').innerHTML = footer;
    const box = document.getElementById('modal-box');
    box.className = 'modal-box' + (size ? ' modal-' + size : '');
    document.getElementById('modal-overlay').classList.add('open');
  }

  function close() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal-body').innerHTML = '';
    document.getElementById('modal-footer').innerHTML = '';
  }

  function confirm({ title, message, confirmText = 'Confirm', danger = false, onConfirm }) {
    open({
      title,
      body: `<p class="confirm-text">${message}</p>`,
      footer: `
        <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm-btn">${confirmText}</button>`,
      size: 'sm',
    });
    document.getElementById('modal-confirm-btn').onclick = () => { close(); onConfirm && onConfirm(); };
  }

  return { open, close, confirm };
})();

/* ── HELPERS ─────────────────────────── */
const Fmt = (() => {
  function speed(knots)   { return (knots * 1.852).toFixed(0) + ' km/h'; }
  function dist(m)        { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'; }
  function duration(secs) {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  function time(iso)      { return iso ? new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—'; }
  function datetime(iso)  { return iso ? new Date(iso).toLocaleString() : '—'; }
  function date(iso)      { return iso ? new Date(iso).toLocaleDateString() : '—'; }
  function ago(iso) {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60)    return Math.round(diff) + 's ago';
    if (diff < 3600)  return Math.round(diff / 60) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return Math.round(diff / 86400) + 'd ago';
  }
  function coord(n)       { return n ? n.toFixed(5) : '—'; }
  function statusClass(s) { return s === 'online' ? 'online' : s === 'idle' ? 'idle' : 'offline'; }
  function statusColor(s) {
    return s === 'online' ? 'var(--online)' : s === 'idle' ? 'var(--idle)' : 'var(--offline)';
  }
  function initial(name)  { return name ? name[0].toUpperCase() : '?'; }
  function avatarColor(name) {
    const colors = ['#7B61FF','#00E5C3','#FF6B6B','#FFB347','#58A6FF','#E040FB'];
    let hash = 0;
    for (const c of (name || 'X')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  return { speed, dist, duration, time, datetime, date, ago, coord, statusClass, statusColor, initial, avatarColor };
})();

/* ── SEARCH UTIL ─────────────────────── */
function filterList(items, query, fields) {
  if (!query) return items;
  const q = query.toLowerCase();
  return items.filter(item => fields.some(f => String(item[f] || '').toLowerCase().includes(q)));
}

/* ── DATE RANGE UTIL ─────────────────── */
function todayRange() {
  const d = new Date(); d.setHours(0,0,0,0);
  return { from: d.toISOString(), to: new Date().toISOString() };
}
function rangeForPeriod(period) {
  const now = new Date();
  let from;
  if (period === 'today') {
    from = new Date(now); from.setHours(0,0,0,0);
  } else if (period === 'week') {
    from = new Date(now); from.setDate(now.getDate() - 6); from.setHours(0,0,0,0);
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    from = new Date(now); from.setHours(0,0,0,0);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

/* ── GRADIENT AVATAR ─────────────────── */
function avatarEl(name, size = 36) {
  const color = Fmt.avatarColor(name);
  return `<div class="user-avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.38)}px;background:${color}">${Fmt.initial(name)}</div>`;
}
