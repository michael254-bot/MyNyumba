/* ui.js — Shared UI utilities, Router, Modal/Toast system */

/* ── Helpers ──────────────────────────────────────── */
function el(id) { return document.getElementById(id); }
function showEl(e) { if (e) e.classList.remove('hidden'); }
function hideEl(e) { if (e) e.classList.add('hidden'); }
function showElQ(sel) { document.querySelectorAll(sel).forEach(e => e.classList.remove('hidden')); }
function hideElQ(sel) { document.querySelectorAll(sel).forEach(e => e.classList.add('hidden')); }

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
    bedsitter: 'Bedsitter', studio: 'Studio',
    '1_bedroom': '1 Bedroom', '2_bedroom': '2 Bedroom',
    '3_bedroom': '3 Bedroom', '4_bedroom': '4 Bedroom',
    bungalow: 'Bungalow', maisonette: 'Maisonette',
    townhouse: 'Townhouse', apartment: 'Apartment'
  };
  return map[t] || t;
}

function stars(n, count) {
  const filled = Math.round(n);
  const s = '★'.repeat(filled) + '☆'.repeat(5 - filled);
  return `<span style="color:#EF9F27">${s}</span> <span class="text-muted text-xs">${Number(n).toFixed(1)} (${count})</span>`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d/7)} weeks ago`;
  return `${Math.floor(d/30)} months ago`;
}

/* ── Toast ─────────────────────────────────────────── */
function showToast(msg, type = 'info') {
  const icons = { success: 'ti-circle-check', error: 'ti-alert-circle', info: 'ti-info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="ti ${icons[type] || icons.info}"></i><span>${msg}</span>`;
  el('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ── Modal ─────────────────────────────────────────── */
function openModal(id) {
  closeAllModals();
  showEl(el(id));
  showEl(el('modal-overlay'));
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  hideEl(el(id));
  // only hide overlay if no other modal open
  const anyOpen = document.querySelectorAll('.modal:not(.hidden)').length > 0;
  if (!anyOpen) {
    hideEl(el('modal-overlay'));
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  hideEl(el('modal-overlay'));
  document.body.style.overflow = '';
}

function switchModal(from, to) {
  closeModal(from);
  openModal(to);
}

function togglePassword(inputId, btn) {
  const inp = el(inputId);
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = '<i class="ti ti-eye-off"></i>';
  } else {
    inp.type = 'password';
    btn.innerHTML = '<i class="ti ti-eye"></i>';
  }
}

function selectRole(btn) {
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  el('reg-role').value = btn.dataset.role;
}

/* ── User dropdown ─────────────────────────────────── */
el('user-pill-btn') && el('user-pill-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  el('user-dropdown').classList.toggle('open');
});
document.addEventListener('click', () => {
  el('user-dropdown') && el('user-dropdown').classList.remove('open');
});
function closeUserMenu() {
  el('user-dropdown') && el('user-dropdown').classList.remove('open');
}

/* ── Mobile nav ────────────────────────────────────── */
el('burger-btn') && el('burger-btn').addEventListener('click', () => {
  const links = el('nav-links');
  links.classList.toggle('open');
  const icon = el('burger-btn').querySelector('i');
  icon.className = links.classList.contains('open') ? 'ti ti-x' : 'ti ti-menu-2';
});
function closeMobileMenu() {
  const links = el('nav-links');
  links && links.classList.remove('open');
  const icon = el('burger-btn') && el('burger-btn').querySelector('i');
  if (icon) icon.className = 'ti ti-menu-2';
}

/* ── Star rating ────────────────────────────────────── */
function setRating(val) {
  el('review-rating').value = val;
  el('star-input').querySelectorAll('button').forEach((b, i) => {
    b.classList.toggle('active', i < val);
  });
}

/* ── Router ─────────────────────────────────────────── */
const Router = (() => {
  let currentRoute = 'home';
  let currentParams = {};

  const routes = {
    home:       () => Pages.home(),
    browse:     () => Pages.browse(currentParams),
    counties:   () => Pages.counties(),
    listing:    () => Pages.listing(currentParams.id),
    dashboard:  () => Pages.dashboard(),
    unlocks:    () => Pages.unlocks(),
    profile:    () => Pages.profile(),
    how:        () => Pages.scrollToHow(),
    'add-listing': () => Pages.addListing(),
    'edit-listing': () => Pages.editListing(currentParams.id),
  };

  function go(route, params = {}) {
    currentRoute = route;
    currentParams = params;
    window.scrollTo(0, 0);
    closeMobileMenu();
    // Update active nav link
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.textContent.trim().toLowerCase() === route);
    });
    render();
  }

  function refresh() {
    render();
  }

  function render() {
    const fn = routes[currentRoute];
    if (fn) fn();
    else Pages.home();
  }

  return { go, refresh, current: () => currentRoute, params: () => currentParams };
})();

/* ── Unlock module ─────────────────────────────────── */
const Unlock = (() => {
  let _listingId = null;
  let _listingTitle = '';

  function open(listingId, title) {
    const user = Auth.current();
    if (!user) {
      showToast('Please log in to unlock listings.', 'info');
      openModal('login-modal');
      return;
    }
    _listingId = listingId;
    _listingTitle = title;

    // Pre-fill phone from profile
    const phone = user.phone || '';
    el('mpesa-phone').value = phone;
    el('unlock-listing-name').textContent = title;
    hideEl(el('unlock-error'));
    hideEl(el('unlock-success'));
    openModal('unlock-modal');
  }

  async function initiate() {
    const btn = el('unlock-submit-btn');
    const errEl = el('unlock-error');
    const sucEl = el('unlock-success');
    const phone = el('mpesa-phone').value.trim();

    if (!phone) { showEl(errEl); errEl.textContent = 'Enter your M-Pesa phone number.'; return; }

    hideEl(errEl);
    hideEl(sucEl);
    setLoading(btn, true);

    const r = await API.initiateUnlock(_listingId, phone);
    setLoading(btn, false);

    if (r.ok) {
      showEl(sucEl);
      sucEl.textContent = r.data.message || 'STK Push sent! Enter your M-Pesa PIN on your phone.';
      hideEl(btn);
      // Poll for completion
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
        showEl(errEl);
        hideEl(sucEl);
        errEl.textContent = 'Payment not confirmed. If you paid, please contact support.';
        showEl(el('unlock-submit-btn'));
      }
    }, 3000);
  }

  return { open, initiate };
})();

/* ── Reviews module ─────────────────────────────────── */
const Reviews = (() => {
  let _listingId = null;

  function open(listingId) {
    const user = Auth.current();
    if (!user) { showToast('Please log in to leave a review.', 'info'); openModal('login-modal'); return; }
    _listingId = listingId;
    setRating(0);
    el('review-comment').value = '';
    hideEl(el('review-error'));
    openModal('review-modal');
  }

  async function submit(e) {
    e.preventDefault();
    const rating = parseInt(el('review-rating').value);
    const comment = el('review-comment').value.trim();
    const errEl = el('review-error');

    if (!rating) { showEl(errEl); errEl.textContent = 'Please select a rating.'; return; }

    const btn = e.submitter;
    setLoading(btn, true);
    const r = await API.addReview(_listingId, { rating, comment });
    setLoading(btn, false);

    if (r.ok) {
      closeAllModals();
      showToast('Review submitted. Thank you!', 'success');
      Router.refresh();
    } else {
      showEl(errEl);
      errEl.textContent = r.data.error || 'Failed to submit review.';
    }
  }

  return { open, submit };
})();