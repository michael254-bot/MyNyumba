/* ui.js — Shared UI utilities, Router, Modal, Toast */

/* ── Helpers ─────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function showEl(e)  { if (e) e.classList.remove('hidden'); }
function hideEl(e)  { if (e) e.classList.add('hidden'); }

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.orig || btn.innerHTML;
    btn.disabled = false;
  }
}

function formatPrice(n) {
  return 'Ksh ' + Number(n).toLocaleString();
}

function typeLabel(t) {
  const map = {
    bedsitter:'Bedsitter', studio:'Studio', '1_bedroom':'1 Bedroom',
    '2_bedroom':'2 Bedroom', '3_bedroom':'3 Bedroom', '4_bedroom':'4 Bedroom',
    bungalow:'Bungalow', maisonette:'Maisonette', townhouse:'Townhouse', apartment:'Apartment'
  };
  return map[t] || t;
}

function starsHtml(n, count) {
  const filled = Math.round(n);
  const s = '★'.repeat(filled) + '☆'.repeat(5 - filled);
  return `<span style="color:#EF9F27">${s}</span> <span class="text-muted text-xs">${Number(n).toFixed(1)} (${count} review${count !== 1 ? 's' : ''})</span>`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return `${Math.floor(d / 30)} months ago`;
}

function escHtml(s) {
  return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* ── Toast ───────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const icons = { success: 'ti-circle-check', error: 'ti-alert-circle', info: 'ti-info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="ti ${icons[type] || icons.info}"></i><span>${msg}</span>`;
  el('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ── Modal ───────────────────────────────────────── */
function openModal(id) {
  closeAllModals();
  const m = el(id);
  if (m) { showEl(m); showEl(el('modal-overlay')); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = el(id);
  if (m) hideEl(m);
  const anyOpen = document.querySelectorAll('.modal:not(.hidden)').length > 0;
  if (!anyOpen) { hideEl(el('modal-overlay')); document.body.style.overflow = ''; }
}
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  hideEl(el('modal-overlay'));
  document.body.style.overflow = '';
}
function switchModal(from, to) { closeModal(from); openModal(to); }

function togglePassword(inputId, btn) {
  const inp = el(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.querySelector('i').className = inp.type === 'password' ? 'ti ti-eye' : 'ti ti-eye-off';
}

function selectRole(btn) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  el('reg-role').value = btn.dataset.role;
}

/* ── Mobile nav ──────────────────────────────────── */
function toggleMobileMenu() {
  const links = el('nav-links');
  const icon  = el('burger-icon');
  if (!links) return;
  const open = links.classList.toggle('open');
  if (icon) icon.className = open ? 'ti ti-x' : 'ti ti-menu-2';
}
function closeMobileMenu() {
  const links = el('nav-links');
  const icon  = el('burger-icon');
  if (links) links.classList.remove('open');
  if (icon)  icon.className = 'ti ti-menu-2';
}
// Close menu on outside tap
document.addEventListener('click', e => {
  const nav    = el('main-nav');
  const burger = el('burger-btn');
  if (nav && !nav.contains(e.target)) closeMobileMenu();
});

/* ── User dropdown ───────────────────────────────── */
function toggleUserMenu(e) {
  e.stopPropagation();
  const dd = el('user-dropdown');
  if (dd) dd.classList.toggle('open');
  const ch = el('nav-chevron');
  if (ch) ch.style.transform = (dd && dd.classList.contains('open')) ? 'rotate(180deg)' : '';
}
function closeUserMenu() {
  const dd = el('user-dropdown');
  if (dd) dd.classList.remove('open');
  const ch = el('nav-chevron');
  if (ch) ch.style.transform = '';
}
document.addEventListener('click', e => {
  const wrap = document.querySelector('.user-menu-wrap');
  if (wrap && !wrap.contains(e.target)) closeUserMenu();
});

/* ── Star rating ─────────────────────────────────── */
function setRating(val) {
  el('review-rating').value = val;
  el('star-input').querySelectorAll('button').forEach((b, i) => {
    b.classList.toggle('active', i < val);
  });
}

/* ── Active nav link highlight ───────────────────── */
function setActiveNav(route) {
  const map = { home:'nl-home', browse:'nl-browse', counties:'nl-counties', how:'nl-how' };
  document.querySelectorAll('.nav-links > a').forEach(a => a.classList.remove('active'));
  const id = map[route];
  if (id) { const a = el(id); if (a) a.classList.add('active'); }
}

/* ── Router ──────────────────────────────────────── */
const Router = (() => {
  let currentRoute  = 'home';
  let currentParams = {};

  const routes = {
    home:           () => Pages.home(),
    browse:         () => Pages.browse(currentParams),
    counties:       () => Pages.counties(),
    listing:        () => Pages.listing(currentParams.id),
    dashboard:      () => Pages.dashboard(),
    'add-listing':  () => Pages.addListing(),
    'edit-listing': () => Pages.editListing(currentParams.id),
    unlocks:        () => Pages.unlocks(),
    profile:        () => Pages.profile(),
    admin:          () => Pages.admin(),
    how:            () => Pages.scrollToHow(),
  };

  function go(route, params = {}) {
    currentRoute  = route;
    currentParams = params;
    window.scrollTo(0, 0);
    closeMobileMenu();
    closeUserMenu();
    setActiveNav(route);
    render();
  }

  function refresh() { render(); }

  function render() {
    const fn = routes[currentRoute];
    if (fn) fn(); else Pages.home();
  }

  return { go, refresh, current: () => currentRoute, params: () => currentParams };
})();

/* ── Unlock module ───────────────────────────────── */
const Unlock = (() => {
  let _listingId = null;

  function open(listingId, title) {
    const user = Auth.current();
    if (!user) {
      showToast('Please log in to unlock listings.', 'info');
      openModal('login-modal');
      return;
    }
    _listingId = listingId;
    if (el('mpesa-phone')) el('mpesa-phone').value = user.phone || '';
    if (el('unlock-listing-name')) el('unlock-listing-name').textContent = title || 'House listing';
    hideEl(el('unlock-error'));
    hideEl(el('unlock-success'));
    const btn = el('unlock-submit-btn');
    if (btn) { showEl(btn); btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-mobile-dollar"></i> Send M-Pesa Push'; }
    openModal('unlock-modal');
  }

  async function initiate() {
    const btn   = el('unlock-submit-btn');
    const errEl = el('unlock-error');
    const sucEl = el('unlock-success');
    const phone = (el('mpesa-phone') || {}).value || '';

    if (!phone.trim()) { showEl(errEl); errEl.textContent = 'Enter your M-Pesa phone number.'; return; }

    hideEl(errEl); hideEl(sucEl);
    setLoading(btn, true);

    const r = await API.initiateUnlock(_listingId, phone.trim());
    setLoading(btn, false);

    if (r.ok) {
      showEl(sucEl);
      sucEl.textContent = r.data.message || 'STK Push sent! Enter your M-Pesa PIN on your phone.';
      hideEl(btn);
      pollUnlock(_listingId);
    } else if (r.data.already_unlocked) {
      closeModal('unlock-modal');
      Router.go('listing', { id: _listingId });
    } else {
      showEl(errEl);
      errEl.textContent = r.data.error || 'M-Pesa request failed. Try again.';
    }
  }

  async function pollUnlock(listingId) {
    let tries = 0;
    const interval = setInterval(async () => {
      tries++;
      const r = await API.unlockStatus(listingId);
      if (r.ok && r.data.status === 'completed') {
        clearInterval(interval);
        closeAllModals();
        showToast('Payment confirmed! Contact details unlocked.', 'success');
        Router.go('listing', { id: listingId });
      } else if (tries >= 20 || (r.ok && r.data.status === 'failed')) {
        clearInterval(interval);
        const errEl = el('unlock-error');
        const sucEl = el('unlock-success');
        if (errEl) { showEl(errEl); errEl.textContent = 'Payment not confirmed. If you paid, contact support.'; }
        hideEl(sucEl);
        const btn = el('unlock-submit-btn');
        if (btn) showEl(btn);
      }
    }, 3000);
  }

  return { open, initiate };
})();

/* ── Reviews module ──────────────────────────────── */
const Reviews = (() => {
  let _listingId = null;

  function open(listingId) {
    const user = Auth.current();
    if (!user) { showToast('Please log in to leave a review.', 'info'); openModal('login-modal'); return; }
    _listingId = listingId;
    setRating(0);
    if (el('review-comment')) el('review-comment').value = '';
    hideEl(el('review-error'));
    openModal('review-modal');
  }

  async function submit(e) {
    e.preventDefault();
    const rating  = parseInt((el('review-rating') || {}).value || 0);
    const comment = (el('review-comment') || {}).value.trim();
    const errEl   = el('review-error');
    if (!rating) { showEl(errEl); errEl.textContent = 'Please select a rating.'; return; }
    const btn = e.submitter;
    setLoading(btn, true);
    const r = await API.addReview(_listingId, { rating, comment });
    setLoading(btn, false);
    if (r.ok) {
      closeAllModals();
      showToast('Review submitted. Thank you!', 'success');
      Router.go('listing', { id: _listingId });
    } else {
      showEl(errEl);
      errEl.textContent = r.data.error || 'Failed to submit review.';
    }
  }

  return { open, submit };
})();