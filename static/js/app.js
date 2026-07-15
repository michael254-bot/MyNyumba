/* app.js — Bootstrap & initialization */

document.addEventListener('DOMContentLoaded', async () => {
  // Restore session first
  await Auth.restoreSession();

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.route) {
      Router.go(e.state.route, e.state.params || {});
    }
  });

  // Route based on current URL path
  const path   = window.location.pathname;
  const search = new URLSearchParams(window.location.search);

  if (path.startsWith('/listing/')) {
    const id = path.split('/listing/')[1];
    Router.go('listing', { id });
  } else if (path === '/browse') {
    const params = {};
    if (search.get('q'))       params.q         = search.get('q');
    if (search.get('county'))  params.county     = search.get('county');
    if (search.get('type'))    params.type       = search.get('type');
    if (search.get('max_price')) params.max_price = search.get('max_price');
    Router.go('browse', params);
  } else if (path === '/counties') {
    Router.go('counties');
  } else if (path === '/dashboard') {
    Router.go('dashboard');
  } else if (path === '/admin') {
    Router.go('admin');
  } else if (path === '/unlocks') {
    Router.go('unlocks');
  } else if (path === '/profile') {
    Router.go('profile');
  } else if (path === '/login') {
    Router.go('home');
    openModal('login-modal');
  } else if (path === '/register') {
    Router.go('home');
    openModal('register-modal');
  } else {
    Router.go('home');
  }
});