/* api.js — All backend calls */
const API = (() => {
  const BASE = '';

  function getToken() {
    return localStorage.getItem('mn_token') || '';
  }

  async function req(method, path, body = null, isForm = false) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body && !isForm) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    try {
      const r = await fetch(BASE + path, opts);
      const json = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data: json };
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'Network error. Check your connection.' } };
    }
  }

  return {
    // Auth
    login: (email, password) => req('POST', '/api/auth/login', { email, password }),
    register: (payload) => req('POST', '/api/auth/register', payload),
    logout: () => req('POST', '/api/auth/logout'),
    me: () => req('GET', '/api/auth/me'),
    updateProfile: (data) => req('PUT', '/api/auth/profile', data),

    // Counties
    counties: () => req('GET', '/api/counties'),
    county: (slug) => req('GET', `/api/counties/${slug}`),
    areas: (countyId) => req('GET', `/api/areas?county_id=${countyId}`),

    // Listings
    listings: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return req('GET', `/api/listings${qs ? '?' + qs : ''}`);
    },
    listing: (id) => req('GET', `/api/listings/${id}`),
    createListing: (data) => req('POST', '/api/listings', data),
    updateListing: (id, data) => req('PUT', `/api/listings/${id}`, data),
    deleteListing: (id) => req('DELETE', `/api/listings/${id}`),

    // Landlord
    landlordListings: () => req('GET', '/api/landlord/listings'),

    // Media
    uploadMedia: (listingId, formData) => req('POST', `/api/listings/${listingId}/media`, formData, true),
    deleteMedia: (listingId, mediaId) => req('DELETE', `/api/listings/${listingId}/media/${mediaId}`),

    // Unlocks
    initiateUnlock: (listingId, phone) => req('POST', '/api/unlock/initiate', { listing_id: listingId, phone }),
    unlockStatus: (listingId) => req('GET', `/api/unlock/status/${listingId}`),
    myUnlocks: () => req('GET', '/api/unlock/my'),

    // Reviews
    addReview: (listingId, data) => req('POST', `/api/listings/${listingId}/reviews`, data),

    // Search suggest
    suggest: (q) => req('GET', `/api/search/suggest?q=${encodeURIComponent(q)}`),
  };
})();