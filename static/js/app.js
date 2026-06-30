/* app.js — App bootstrap & initialization */

document.addEventListener('DOMContentLoaded', async () => {
  // Restore session from localStorage
  await Auth.restoreSession();

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.route) {
      Router.go(e.state.route, e.state.params || {});
    }
  });

  // Route based on URL path
  const path = window.location.pathname;
  if (path.startsWith('/listing/')) {
    const id = path.split('/listing/')[1];
    Router.go('listing', { id });
  } else if (path === '/browse') {
    Router.go('browse');
  } else if (path === '/counties') {
    Router.go('counties');
  } else if (path === '/dashboard') {
    Router.go('dashboard');
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