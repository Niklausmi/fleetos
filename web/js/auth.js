/* ═══════════════════════════════════════════
   auth.js — Authentication
═══════════════════════════════════════════ */
const Auth = (() => {

  function useDemo() {
    document.getElementById('login-server').value = 'https://demo.traccar.org';
    document.getElementById('login-email').value  = 'demo@traccar.org';
    document.getElementById('login-pass').value   = 'demo';
  }

  async function login() {
    let server = document.getElementById('login-server').value.trim().replace(/\/$/, '');
    const email  = document.getElementById('login-email').value.trim();
    const pass   = document.getElementById('login-pass').value;
    const btn    = document.getElementById('login-btn');
    const errEl  = document.getElementById('login-error');

    // If server is empty, use same-origin proxy (nginx routes /api/ → traccar:8082)
    if (!server) server = window.location.origin;

    if (!email || !pass) {
      errEl.textContent = 'Email and password are required.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    btn.textContent = 'Connecting…';
    btn.disabled    = true;

    const auth = 'Basic ' + btoa(email + ':' + pass);
    try {
      API.setBase(server, auth);
      const session = await API.login(email, pass);
      State.set('session', session);
      localStorage.setItem('fo_server', server);
      localStorage.setItem('fo_auth',   auth);
      _afterLogin(session);
    } catch (e) {
      errEl.textContent = 'Login failed: ' + e.message;
      errEl.style.display = 'block';
      btn.textContent = 'Connect to Fleet';
      btn.disabled    = false;
    }
  }

  async function tryAutoLogin() {
    const server = localStorage.getItem('fo_server');
    const auth   = localStorage.getItem('fo_auth');
    if (!server || !auth) return false;
    try {
      API.setBase(server, auth);
      const session = await API.getSession();
      State.set('session', session);
      _afterLogin(session);
      return true;
    } catch {
      localStorage.removeItem('fo_server');
      localStorage.removeItem('fo_auth');
      return false;
    }
  }

  function _afterLogin(session) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    // Populate user chip
    const name = session.name || session.email || 'User';
    document.getElementById('user-name').textContent   = name;
    document.getElementById('user-avatar').textContent = name[0].toUpperCase();
    document.getElementById('user-role').textContent   = session.administrator ? 'Administrator' : 'User';

    // FIX: hide admin-only nav items for non-admins
    if (!session.administrator) {
      document.querySelector('[data-view="users"]')?.remove();
      document.querySelector('[data-view="drivers"]')?.remove();
    }

    // Init Firebase push after login (requires user gesture context)
    if (window.FCM) {
      FCM.init().then(token => {
        if (token) console.log('[Auth] FCM push registered');
      }).catch(() => {});
    }

    App.init();
  }

  async function logout() {
    try { await API.logout(); } catch {}
    localStorage.removeItem('fo_server');
    localStorage.removeItem('fo_auth');
    location.reload();
  }

  return { login, logout, tryAutoLogin, useDemo };
})();
