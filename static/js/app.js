/* app.js — Bootstrap & initialization */

document.addEventListener('DOMContentLoaded', async () => {
  // Show the page straight away using the cached session, then check the
  // token in the background instead of making every first load wait for it.
  Auth.updateNavUI();
  Auth.restoreSession().then(invalid => { if (invalid) Router.refresh(); });

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.route) {
      Router.go(e.state.route, e.state.params || {}, true);
    }
  });

  // Route based on current URL path
  const path   = window.location.pathname;
  const search = new URLSearchParams(window.location.search);

  if (path === '/dashboard/new') {
    Router.go('add-listing');
  } else if (path.startsWith('/dashboard/edit/')) {
    Router.go('edit-listing', { id: decodeURIComponent(path.split('/dashboard/edit/')[1]) });
  } else if (path.startsWith('/listing/')) {
    const id = path.split('/listing/')[1];
    Router.go('listing', { id });
  } else if (path === '/browse') {
    const params = {};
    if (search.get('q'))       params.q         = search.get('q');
    if (search.get('county'))  params.county     = search.get('county');
    if (search.get('type'))    params.type       = search.get('type');
    if (search.get('max_price')) params.max_price = search.get('max_price');
    if (search.get('area_id'))   params.area_id   = search.get('area_id');
    ['water','security','parking','wifi','furnished','dsq','gym','cctv','borehole','generator','pet_friendly','pool']
      .forEach(k => { if (search.get(k)) params[k] = search.get(k); });
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
  } else if (location.hash === '#how-it-works') {
    Router.go('how');
  } else {
    Router.go('home');
  }
});