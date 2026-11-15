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
  return `<i class="ti ti-star-filled"></i> <strong>${Number(n).toFixed(1)}</strong> <span>(${count} review${count !== 1 ? 's' : ''})</span>`;
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

/* Escape text for HTML content and attribute values */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/* Escape text used as a '...' string argument inside an inline onclick="" */
function jsStr(s) {
  return escHtml(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' '));
}

/* ── Toast ───────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const icons = { success: 'ti-circle-check', error: 'ti-alert-circle', info: 'ti-info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="ti ${icons[type] || icons.info}"></i><span></span>`;
  t.querySelector('span').textContent = msg; // messages can include server text, so never as HTML
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
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeMobileMenu() {
  const links = el('nav-links');
  const icon  = el('burger-icon');
  if (links && links.classList.contains('open')) document.body.style.overflow = '';
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
  const map = { home:'nl-home', browse:'nl-browse', listing:'nl-browse', counties:'nl-counties', how:'nl-how' };
  document.querySelectorAll('.nav-links > a').forEach(a => a.classList.remove('active'));
  const id = map[route];
  if (id) { const a = el(id); if (a) a.classList.add('active'); }
}

/* ── Router ──────────────────────────────────────── */
const Router = (() => {
  let currentRoute  = 'home';
  let currentParams = {};

  /* Keep the address bar in sync so links can be shared and Back works */
  function pathFor(route, params) {
    const qs = p => { const s = new URLSearchParams(p).toString(); return s ? '?' + s : ''; };
    switch (route) {
      case 'home':         return '/';
      case 'browse':       return '/browse' + qs(params);
      case 'listing':      return '/listing/' + encodeURIComponent(params.id || '');
      case 'add-listing':  return '/dashboard/new';
      case 'edit-listing': return '/dashboard/edit/' + encodeURIComponent(params.id || '');
      case 'how':          return '/#how-it-works';
      default:             return '/' + route;
    }
  }

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

  function go(route, params = {}, fromHistory = false) {
    currentRoute  = route;
    currentParams = params;
    if (!fromHistory) {
      const url = pathFor(route, params);
      const here = location.pathname + location.search + location.hash;
      const state = { route, params };
      if (url !== here) history.pushState(state, '', url); else history.replaceState(state, '', url);
    }
    if (route !== 'how') window.scrollTo(0, 0);
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

  return { go, refresh, pathFor, current: () => currentRoute, params: () => currentParams };
})();

/* ── Unlock module ───────────────────────────────── */
const Unlock = (() => {
  let _listingId = null;

  function open(listingId, title) {
    const user = Auth.current();
    if (!user) {
      showToast('Log in to get the landlord\'s number.', 'info');
      openModal('login-modal');
      return;
    }
    _listingId = listingId;
    if (el('mpesa-phone')) el('mpesa-phone').value = user.phone || '';
    if (el('unlock-listing-name')) el('unlock-listing-name').textContent = title || 'House listing';
    hideEl(el('unlock-error'));
    hideEl(el('unlock-success'));
    const btn = el('unlock-submit-btn');
    if (btn) { showEl(btn); btn.disabled = false; btn.innerHTML = 'Pay Ksh 500 with M-Pesa'; }
    openModal('unlock-modal');
  }

  async function initiate() {
    const btn   = el('unlock-submit-btn');
    const errEl = el('unlock-error');
    const sucEl = el('unlock-success');
    const phone = (el('mpesa-phone') || {}).value || '';

    if (!phone.trim()) { showEl(errEl); errEl.textContent = 'Enter the M-Pesa number to send the prompt to.'; return; }

    hideEl(errEl); hideEl(sucEl);
    setLoading(btn, true);

    const r = await API.initiateUnlock(_listingId, phone.trim());
    setLoading(btn, false);

    if (r.ok) {
      showEl(sucEl);
      sucEl.textContent = 'Check your phone and enter your M-Pesa PIN. This page updates once the payment goes through.';
      hideEl(btn);
      pollUnlock(_listingId);
    } else if (r.data.already_unlocked) {
      closeModal('unlock-modal');
      Router.go('listing', { id: _listingId });
    } else {
      showEl(errEl);
      errEl.textContent = r.data.error || 'We couldn\'t send the M-Pesa prompt. Check the number and try again.';
    }
  }

  async function pollUnlock(listingId) {
    let tries = 0;
    const interval = setInterval(async () => {
      tries++;

      // Stop polling if user logged out
      if (!Auth.current()) {
        clearInterval(interval);
        return;
      }

      const r = await API.unlockStatus(listingId);

      // Stop on server errors — don't spam
      if (!r.ok || r.status === 500 || r.status === 401) {
        clearInterval(interval);
        const errEl = el('unlock-error');
        const sucEl = el('unlock-success');
        if (errEl) {
          showEl(errEl);
          errEl.textContent = r.status === 401
            ? 'Your session has expired. Log in again to finish.'
            : 'We couldn\'t confirm the payment. If M-Pesa took the money, WhatsApp us on +254 703 245 513 with the confirmation message.';
        }
        hideEl(sucEl);
        const btn = el('unlock-submit-btn');
        if (btn) showEl(btn);
        return;
      }

      if (r.data.status === 'completed') {
        clearInterval(interval);
        closeAllModals();
        showToast('Payment received. The landlord\'s number is below.', 'success');
        Router.go('listing', { id: listingId });
      } else if (tries >= 20 || r.data.status === 'failed') {
        clearInterval(interval);
        const errEl = el('unlock-error');
        const sucEl = el('unlock-success');
        if (errEl) {
          showEl(errEl);
          errEl.textContent = r.data.status === 'failed'
            ? 'The payment was cancelled or didn\'t go through. You haven\'t been charged, so you can try again.'
            : 'No confirmation from M-Pesa yet. If you paid, WhatsApp us on +254 703 245 513 and we\'ll sort it out.';
        }
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
    if (!user) { showToast('Log in to review this house.', 'info'); openModal('login-modal'); return; }
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
    if (!rating) { showEl(errEl); errEl.textContent = 'Pick a star rating first.'; return; }
    const btn = e.submitter;
    setLoading(btn, true);
    const r = await API.addReview(_listingId, { rating, comment });
    setLoading(btn, false);
    if (r.ok) {
      closeAllModals();
      showToast('Review posted.', 'success');
      Router.go('listing', { id: _listingId });
    } else {
      showEl(errEl);
      errEl.textContent = r.data.error || 'Your review didn\'t post. Try again.';
    }
  }

  return { open, submit };
})();
/* Escape closes any open modal or menu */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.querySelector('.lightbox')) return; // lightbox handles its own Escape
  closeAllModals(); closeUserMenu(); closeMobileMenu();
});
