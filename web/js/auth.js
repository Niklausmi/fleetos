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
    const server = document.getElementById('login-server').value.trim().replace(/\/$/, '');
    const email  = document.getElementById('login-email').value.trim();
    const pass   = document.getElementById('login-pass').value;
    const btn    = document.getElementById('login-btn');
    const errEl  = document.getElementById('login-error');

    if (!server || !email || !pass) {
      errEl.textContent = 'All fields are required.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    btn.textContent = 'Connecting…';
    btn.disabled = true;

    const auth = 'Basic ' + btoa(email + ':' + pass);
    try {
      API.setBase(server, auth);
      const session = await API.login(email, pass);
      State.set('session', session);
      localStorage.setItem('fo_server', server);
      localStorage.setItem('fo_auth', auth);
      _afterLogin(session, server);
    } catch (e) {
      errEl.textContent = 'Login failed: ' + e.message;
      errEl.style.display = 'block';
      btn.textContent = 'Connect to Fleet';
      btn.disabled = false;
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
      _afterLogin(session, server);
      return true;
    } catch {
      localStorage.removeItem('fo_server');
      localStorage.removeItem('fo_auth');
      return false;
    }
  }

  function _afterLogin(session, server) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    // populate user chip
    const name = session.name || session.email || 'User';
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-avatar').textContent = name[0].toUpperCase();
    document.getElementById('user-role').textContent = session.administrator ? 'Administrator' : 'User';
    // show/hide admin-only nav
    if (!session.administrator) {
      document.querySelector('[data-view="users"]')?.remove();
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
