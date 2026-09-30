/* auth.js — Authentication state & actions */
const Auth = (() => {
  let _user = null;

  function save(token, user) {
    localStorage.setItem('mn_token', token);
    localStorage.setItem('mn_user', JSON.stringify(user));
    _user = user;
  }

  function clear() {
    localStorage.removeItem('mn_token');
    localStorage.removeItem('mn_user');
    _user = null;
  }

  function current() {
    if (_user) return _user;
    try { return JSON.parse(localStorage.getItem('mn_user')); } catch { return null; }
  }

  function isAdmin() {
    const u = current();
    return u && u.is_admin === true;
  }

  function updateNavUI() {
    const user = current();
    const authEl  = document.getElementById('nav-auth');
    const userEl  = document.getElementById('nav-user');
    const nameEl  = document.getElementById('nav-username');
    const avatarEl = document.getElementById('nav-avatar');
    const adminLink = document.getElementById('admin-nav-link');
    const mobileAuth = document.getElementById('mobile-auth-btns');
    const mobileUser = document.getElementById('mobile-user-links');

    if (user) {
      authEl  && authEl.classList.add('hidden');
      userEl  && userEl.classList.remove('hidden');
      mobileAuth && mobileAuth.classList.add('hidden');
      mobileUser && mobileUser.classList.remove('hidden');

      const name = user.full_name || user.email || 'User';
      if (nameEl)  nameEl.textContent  = name.split(' ')[0];
      if (avatarEl) {
        avatarEl.textContent = name.charAt(0).toUpperCase();
        avatarEl.className   = 'user-avatar' + (user.is_admin ? ' admin-avatar' : '');
      }
      // Show admin link in dropdown if admin
      if (adminLink) {
        adminLink.classList.toggle('hidden', !user.is_admin);
      }
    } else {
      authEl  && authEl.classList.remove('hidden');
      userEl  && userEl.classList.add('hidden');
      mobileAuth && mobileAuth.classList.remove('hidden');
      mobileUser && mobileUser.classList.add('hidden');
      if (adminLink) adminLink.classList.add('hidden');
    }
  }

  async function login(e) {
    e.preventDefault();
    const btn   = document.getElementById('login-submit');
    const errEl = document.getElementById('login-error');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    setLoading(btn, true);
    hideEl(errEl);

    const r = await API.login(email, password);
    setLoading(btn, false);

    if (r.ok) {
      save(r.data.access_token, r.data.user);
      updateNavUI();
      closeAllModals();
      const u = r.data.user;
      showToast('Welcome back, ' + (u.full_name || '').split(' ')[0] + '!', 'success');
      document.getElementById('login-form').reset();
      // Route to correct dashboard
      if (u.is_admin) {
        Router.go('admin');
      } else if (u.role === 'landlord') {
        Router.go('dashboard');
      } else {
        Router.refresh();
      }
    } else {
      showEl(errEl);
      errEl.textContent = r.data.error || 'Login failed. Check your credentials.';
    }
  }

  async function register(e) {
    e.preventDefault();
    const btn   = document.getElementById('register-submit');
    const errEl = document.getElementById('register-error');

    const payload = {
      full_name: document.getElementById('reg-name').value.trim(),
      email:     document.getElementById('reg-email').value.trim().toLowerCase(),
      password:  document.getElementById('reg-password').value,
      phone:     document.getElementById('reg-phone').value.trim(),
      id_number: document.getElementById('reg-idnumber').value.trim(),
      location:  document.getElementById('reg-location').value.trim(),
      role:      document.getElementById('reg-role').value,
    };

    if (!payload.full_name || !payload.email || !payload.password || !payload.phone) {
      showEl(errEl); errEl.textContent = 'Name, email, phone and password are required.'; return;
    }
    if (payload.password.length < 6) {
      showEl(errEl); errEl.textContent = 'Password must be at least 6 characters.'; return;
    }

    setLoading(btn, true);
    hideEl(errEl);

    const r = await API.register(payload);
    setLoading(btn, false);

    if (r.ok) {
      closeAllModals();
      showToast('Account created! Check your email to confirm, then log in.', 'success');
      document.getElementById('register-form').reset();
      setTimeout(() => openModal('login-modal'), 600);
    } else {
      showEl(errEl);
      errEl.textContent = r.data.error || 'Registration failed. Please try again.';
    }
  }

  async function logout() {
    await API.logout();
    clear();
    updateNavUI();
    showToast('Logged out successfully.', 'info');
    Router.go('home');
  }

  async function restoreSession() {
    const token        = localStorage.getItem('mn_token');
    const refreshToken = localStorage.getItem('mn_refresh');
    if (!token) { updateNavUI(); return; }

    const r = await API.me();
    if (r.ok) {
      _user = r.data;
      localStorage.setItem('mn_user', JSON.stringify(r.data));
    } else if (r.status === 401 && refreshToken) {
      // Token expired — try to refresh silently
      try {
        const { createClient } = window.supabase || {};
        // Attempt refresh via backend re-login is not possible without password,
        // so clear and ask user to log in again gracefully
        clear();
        showToast('Your session expired. Please log in again.', 'info');
      } catch {
        clear();
      }
    } else {
      clear();
    }
    updateNavUI();
  }

  return { login, register, logout, current, isAdmin, updateNavUI, restoreSession, save };
})();