/* pages.js — All page renderers, everything from backend */
const Pages = (() => {

  const app = () => document.getElementById('app');

  function loading() {
    app().innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>`;
  }

  function empty(icon, title, msg, btnLabel, btnAction) {
    return `<div class="empty-state">
      <i class="ti ${icon}"></i>
      <h3>${title}</h3>
      <p>${msg}</p>
      ${btnLabel ? `<button class="btn-primary" onclick="${btnAction}">${btnLabel}</button>` : ''}
    </div>`;
  }

  /* ── Listing card HTML ──────────────────────────── */
  function listingCard(l, showUnlocked = false) {
    const tags = [];
    if (l.has_water) tags.push('Water');
    if (l.has_security) tags.push('Security');
    if (l.has_parking) tags.push('Parking');
    if (l.has_wifi) tags.push('WiFi');
    if (l.is_furnished) tags.push('Furnished');
    if (l.has_gym) tags.push('Gym');
    if (l.has_pool) tags.push('Pool');

    const imgHtml = l.cover_photo
      ? `<img src="${l.cover_photo}" alt="${l.title}" loading="lazy" />`
      : `<i class="ti ti-building card-img-placeholder"></i>`;

    const ratingHtml = l.review_count > 0
      ? `<div class="card-rating"><i class="ti ti-star-filled"></i>${Number(l.average_rating).toFixed(1)} <span>(${l.review_count})</span></div>`
      : '';

    const isNew = (Date.now() - new Date(l.created_at)) < 7 * 86400000;
    const badge = l.is_featured
      ? `<span class="card-badge">Featured</span>`
      : isNew ? `<span class="card-badge green">New</span>` : '';

    return `
    <div class="listing-card" onclick="Router.go('listing',{id:'${l.id}'})">
      <div class="card-img">
        ${imgHtml}
        ${badge}
      </div>
      <div class="card-body">
        <div class="card-title">${l.title}</div>
        <div class="card-loc">
          <i class="ti ti-map-pin"></i>
          ${l.area_name ? l.area_name + ' · ' : ''}${l.county_name}
        </div>
        <div class="card-tags">
          <span class="ctag">${typeLabel(l.property_type)}</span>
          ${tags.slice(0, 2).map(t => `<span class="ctag">${t}</span>`).join('')}
        </div>
        ${ratingHtml}
        <div class="card-footer">
          <div class="card-price">${formatPrice(l.monthly_rent)}<small>/mo</small></div>
          ${showUnlocked
            ? `<button class="unlock-btn unlocked" onclick="event.stopPropagation();Router.go('listing',{id:'${l.id}'})"><i class="ti ti-check"></i> View</button>`
            : `<button class="unlock-btn" onclick="event.stopPropagation();Unlock.open('${l.id}','${escHtml(l.title)}')"><i class="ti ti-lock"></i> Unlock</button>`}
        </div>
      </div>
    </div>`;
  }

  function escHtml(s) {
    return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════════════════════
     HOME PAGE
  ══════════════════════════════════════════════ */
  async function home() {
    loading();
    const [countiesR, listingsR] = await Promise.all([
      API.counties(),
      API.listings({ sort: 'newest', per_page: 8 })
    ]);

    const counties = countiesR.ok ? countiesR.data : [];
    const listings = listingsR.ok ? listingsR.data.listings : [];
    const total = listingsR.ok ? listingsR.data.total : 0;
    const areaCount = counties.reduce((a, c) => a + 1, 0) * 10; // approx

    // Featured counties for bar (top 12 by listing count)
    const topCounties = [...counties].sort((a,b) => b.listing_count - a.listing_count).slice(0, 12);

    app().innerHTML = `
    <!-- HERO -->
    <section class="hero">
      <h1>Find your next home across <em>Kenya</em></h1>
      <p class="hero-sub">All 47 counties · Verified landlords · Pay <strong>Ksh 500</strong> to unlock contact</p>
      ${searchBoxHTML('home')}
      <div class="filter-tags" id="home-filters">
        <span class="ftag active" data-filter="">All</span>
        <span class="ftag" data-filter="water=true">Water included</span>
        <span class="ftag" data-filter="security=true">Security</span>
        <span class="ftag" data-filter="parking=true">Parking</span>
        <span class="ftag" data-filter="wifi=true">WiFi</span>
        <span class="ftag" data-filter="furnished=true">Furnished</span>
        <span class="ftag" data-filter="dsq=true">DSQ</span>
        <span class="ftag" data-filter="pet_friendly=true">Pet-friendly</span>
      </div>
      <div class="hero-stats">
        <div class="h-stat"><strong>${total.toLocaleString()}+</strong><span>Active listings</span></div>
        <div class="h-stat"><strong>47</strong><span>Counties</span></div>
        <div class="h-stat"><strong>${counties.length * 10}+</strong><span>Areas covered</span></div>
        <div class="h-stat"><strong>Ksh 500</strong><span>Flat unlock fee</span></div>
      </div>
    </section>

    <!-- COUNTY BAR -->
    <div class="counties-bar">
      <button class="active" onclick="Router.go('counties')">All counties</button>
      ${topCounties.map(c => `
        <button onclick="Router.go('browse',{county:'${c.slug}',countyName:'${escHtml(c.name)}'})">
          ${c.name}
        </button>`).join('')}
    </div>

    <!-- LATEST LISTINGS -->
    <div class="section">
      <div class="sec-hdr">
        <h2>Latest listings</h2>
        <button onclick="Router.go('browse')">View all <i class="ti ti-arrow-right"></i></button>
      </div>
      ${listings.length > 0
        ? `<div class="cards-grid">${listings.map(l => listingCard(l)).join('')}</div>`
        : empty('ti-building-off', 'No listings yet', 'Be the first to post a house!', 'Post a listing', "Router.go('add-listing')")
      }
    </div>

    <!-- HOW IT WORKS -->
    <section class="how-section" id="how-it-works">
      <h2>How <span class="text-orange">MyNyumba</span> works</h2>
      <p class="sub">Simple 3-step process to find your next home</p>
      <div class="steps-grid">
        <div class="step-card">
          <div class="step-num">1</div>
          <h3>Search a listing</h3>
          <p>Browse houses by county, estate, price range, and amenities across all 47 counties in Kenya.</p>
        </div>
        <div class="step-card">
          <div class="step-num">2</div>
          <h3>Pay Ksh 500 via M-Pesa</h3>
          <p>One-time fee per listing. An STK push is sent to your phone — just enter your M-Pesa PIN.</p>
        </div>
        <div class="step-card">
          <div class="step-num">3</div>
          <h3>Contact landlord directly</h3>
          <p>Get the landlord's phone and WhatsApp. Call or message them to arrange a viewing.</p>
        </div>
      </div>
      <span class="fee-note"><i class="ti ti-shield-check"></i> No hidden charges · M-Pesa STK Push · Instant unlock</span>
    </section>

    <!-- LANDLORD CTA -->
    <div class="ll-cta">
      <div class="ll-cta-inner">
        <div class="ll-cta-box">
          <div class="ll-icon"><i class="ti ti-key"></i></div>
          <div class="ll-text">
            <h3>Are you a landlord?</h3>
            <p>Post your vacant house for free. Add photos, videos, and a full list of services. Reach thousands of tenants actively searching in your area across Kenya.</p>
            <div class="ll-btns">
              <button class="btn-primary" onclick="handleLandlordCTA()">
                <i class="ti ti-plus"></i> Post a listing — it's free
              </button>
              <button class="btn-outline" onclick="Router.go('dashboard')">
                <i class="ti ti-layout-dashboard"></i> Landlord dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${footerHTML()}`;

    // Filter tags
    document.getElementById('home-filters').addEventListener('click', e => {
      const tag = e.target.closest('.ftag');
      if (!tag) return;
      document.querySelectorAll('#home-filters .ftag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      const filter = tag.dataset.filter;
      const params = filter ? Object.fromEntries([filter.split('=')]) : {};
      Router.go('browse', params);
    });

    initSearchBox('home');
  }

  function handleLandlordCTA() {
    const user = Auth.current();
    if (!user) { openModal('register-modal'); return; }
    if (user.role !== 'landlord') {
      showToast('You need a landlord account to post listings.', 'info'); return;
    }
    Router.go('add-listing');
  }
  window.handleLandlordCTA = handleLandlordCTA;

  /* ══════════════════════════════════════════════
     BROWSE PAGE
  ══════════════════════════════════════════════ */
  async function browse(initialParams = {}) {
    loading();
    const countiesR = await API.counties();
    const counties = countiesR.ok ? countiesR.data : [];

    let activeCounty = initialParams.county || '';
    let activeArea = initialParams.area_id || '';
    let activeSort = 'newest';
    let activePage = 1;
    let searchQ = initialParams.q || '';
    let propType = initialParams.type || '';
    let maxPrice = initialParams.max_price || '';

    const amenityParams = {};
    ['water','security','parking','wifi','furnished','dsq','gym','cctv','borehole','generator','pet_friendly'].forEach(k => {
      if (initialParams[k]) amenityParams[k] = initialParams[k];
    });

    let areas = [];
    if (activeCounty) {
      const countyObj = counties.find(c => c.slug === activeCounty);
      if (countyObj) {
        const ar = await API.areas(countyObj.id);
        if (ar.ok) areas = ar.data;
      }
    }

    async function fetchAndRender() {
      const params = {
        sort: activeSort, page: activePage, per_page: 12,
        ...(searchQ && { q: searchQ }),
        ...(activeCounty && { county: activeCounty }),
        ...(activeArea && { area_id: activeArea }),
        ...(propType && { type: propType }),
        ...(maxPrice && { max_price: maxPrice }),
        ...amenityParams
      };
      const r = await API.listings(params);
      const data = r.ok ? r.data : { listings: [], total: 0, pages: 1 };
      renderResults(data);
    }

    function renderResults({ listings, total, pages }) {
      const resEl = document.getElementById('results-area');
      if (!resEl) return;
      document.getElementById('results-count').textContent = `${total.toLocaleString()} listing${total !== 1 ? 's' : ''}`;
      if (listings.length === 0) {
        resEl.innerHTML = empty('ti-building-off', 'No listings found', 'Try adjusting your filters or search.', '', '');
        document.getElementById('pagination-area').innerHTML = '';
        return;
      }
      resEl.innerHTML = `<div class="cards-grid">${listings.map(l => listingCard(l)).join('')}</div>`;
      renderPagination(pages);
    }

    function renderPagination(pages) {
      const p = document.getElementById('pagination-area');
      if (!p || pages <= 1) { if (p) p.innerHTML = ''; return; }
      let html = `<div class="pagination">
        <button class="page-btn" ${activePage === 1 ? 'disabled' : ''} onclick="browseSetPage(${activePage - 1})">
          <i class="ti ti-chevron-left"></i>
        </button>`;
      for (let i = 1; i <= Math.min(pages, 7); i++) {
        html += `<button class="page-btn ${i === activePage ? 'active' : ''}" onclick="browseSetPage(${i})">${i}</button>`;
      }
      if (pages > 7) html += `<span style="color:var(--text-3);padding:0 4px">…</span>
        <button class="page-btn ${activePage === pages ? 'active' : ''}" onclick="browseSetPage(${pages})">${pages}</button>`;
      html += `<button class="page-btn" ${activePage === pages ? 'disabled' : ''} onclick="browseSetPage(${activePage + 1})">
          <i class="ti ti-chevron-right"></i>
        </button></div>`;
      p.innerHTML = html;
    }

    window.browseSetPage = (p) => { activePage = p; fetchAndRender(); window.scrollTo(0, 0); };

    const countiesBarHTML = `
      <button class="${!activeCounty ? 'active' : ''}" onclick="browseSetCounty('')">All counties</button>
      ${counties.map(c => `
        <button class="${activeCounty === c.slug ? 'active' : ''}" onclick="browseSetCounty('${c.slug}','${c.id}','${escHtml(c.name)}')">
          ${c.name}
        </button>`).join('')}`;

    const areasChipsHTML = areas.length > 0 ? `
      <div class="area-chips" id="area-chips">
        <span class="area-chip ${!activeArea ? 'active' : ''}" onclick="browseSetArea('')">All areas</span>
        ${areas.map(a => `
          <span class="area-chip ${activeArea == a.id ? 'active' : ''}" onclick="browseSetArea('${a.id}')">
            ${a.name}
          </span>`).join('')}
      </div>` : '';

    app().innerHTML = `
    <!-- STICKY SEARCH HEADER -->
    <div class="browse-header">
      <div class="browse-header-inner">
        <div class="browse-search">${searchBoxHTML('browse')}</div>
        <div class="counties-bar" style="padding:0;margin-top:10px;background:transparent;border:none">
          ${countiesBarHTML}
        </div>
      </div>
    </div>

    ${areasChipsHTML}

    <!-- RESULTS BAR -->
    <div class="results-bar">
      <span id="results-count">Loading…</span>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <select class="sort-select" id="sort-select" onchange="browseSort(this.value)">
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
          <option value="popular">Most unlocked</option>
        </select>
        <select class="sort-select" id="type-select" onchange="browseType(this.value)" style="min-width:130px">
          <option value="">All types</option>
          <option value="bedsitter">Bedsitter</option>
          <option value="studio">Studio</option>
          <option value="1_bedroom">1 Bedroom</option>
          <option value="2_bedroom">2 Bedroom</option>
          <option value="3_bedroom">3 Bedroom</option>
          <option value="4_bedroom">4 Bedroom</option>
          <option value="bungalow">Bungalow</option>
          <option value="maisonette">Maisonette</option>
          <option value="townhouse">Townhouse</option>
        </select>
      </div>
    </div>

    <!-- AMENITY FILTERS -->
    <div class="amenity-filters">
      ${[
        ['','All'],['water=true','Water'],['parking=true','Parking'],['wifi=true','WiFi'],
        ['security=true','Security'],['furnished=true','Furnished'],['dsq=true','DSQ'],
        ['gym=true','Gym'],['cctv=true','CCTV'],['borehole=true','Borehole'],
        ['generator=true','Generator'],['pet_friendly=true','Pet-friendly'],['pool=true','Pool']
      ].map(([f,l]) => `<span class="ftag ${Object.keys(amenityParams).length === 0 && !f ? 'active' : ''}" 
        data-filter="${f}" onclick="browseAmenity('${f}',this)">${l}</span>`).join('')}
    </div>

    <!-- RESULTS -->
    <div class="section" style="padding-top:16px">
      <div id="results-area"><div class="loading-state"><div class="spinner"></div><span>Loading listings…</span></div></div>
      <div id="pagination-area"></div>
    </div>

    ${footerHTML()}`;

    initSearchBox('browse');

    window.browseSort = (v) => { activeSort = v; activePage = 1; fetchAndRender(); };
    window.browseType = (v) => { propType = v; activePage = 1; fetchAndRender(); };
    window.browseAmenity = (filter, el) => {
      document.querySelectorAll('.amenity-filters .ftag').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      Object.keys(amenityParams).forEach(k => delete amenityParams[k]);
      if (filter) {
        const [k, v] = filter.split('=');
        amenityParams[k] = v;
      }
      activePage = 1;
      fetchAndRender();
    };
    window.browseSetCounty = async (slug, countyId, name) => {
      activeCounty = slug;
      activeArea = '';
      activePage = 1;
      areas = [];
      if (slug && countyId) {
        const ar = await API.areas(countyId);
        if (ar.ok) areas = ar.data;
      }
      browse({ county: slug, area_id: '', q: searchQ, type: propType, ...amenityParams });
    };
    window.browseSetArea = (areaId) => {
      activeArea = areaId;
      activePage = 1;
      document.querySelectorAll('#area-chips .area-chip').forEach(c => c.classList.toggle('active', c.dataset.areaId == areaId || (areaId === '' && c.textContent.includes('All'))));
      fetchAndRender();
    };

    fetchAndRender();
  }

  /* ══════════════════════════════════════════════
     COUNTIES PAGE
  ══════════════════════════════════════════════ */
  async function counties() {
    loading();
    const r = await API.counties();
    if (!r.ok) { app().innerHTML = empty('ti-alert-circle', 'Failed to load', 'Could not load counties.', 'Retry', "Pages.counties()"); return; }

    const all = r.data;
    const byRegion = {};
    all.forEach(c => {
      if (!byRegion[c.region]) byRegion[c.region] = [];
      byRegion[c.region].push(c);
    });

    const regionIcons = {
      'Nairobi Region': 'ti-building-skyscraper',
      'Central': 'ti-mountain',
      'Coast': 'ti-waves',
      'Rift Valley': 'ti-mountain-off',
      'Western': 'ti-tree',
      'Nyanza': 'ti-ripple',
      'Eastern': 'ti-map',
      'North Eastern': 'ti-map-2',
    };

    app().innerHTML = `
    <div class="hero" style="padding:32px 20px 24px">
      <h1>All <em>47 counties</em> in Kenya</h1>
      <p class="hero-sub">Select a county to browse listings in that area</p>
      ${searchBoxHTML('counties')}
      <div class="region-pills" style="justify-content:center;margin-top:14px;display:flex;flex-wrap:wrap;gap:6px">
        <span class="region-pill active" onclick="filterRegion('',this)">All regions</span>
        ${Object.keys(byRegion).map(r => `<span class="region-pill" onclick="filterRegion('${escHtml(r)}',this)">${r}</span>`).join('')}
      </div>
    </div>
    <div class="counties-page" id="counties-page">
      ${Object.entries(byRegion).map(([region, cs]) => `
        <div class="region-section" data-region="${region}">
          <h3>${region}</h3>
          <div class="county-grid">
            ${cs.map(c => `
              <div class="county-card" onclick="Router.go('browse',{county:'${c.slug}',countyName:'${escHtml(c.name)}'})">
                <i class="ti ${regionIcons[region] || 'ti-map-pin'}"></i>
                <h3>${c.name}</h3>
                <p>${c.listing_count > 0 ? c.listing_count + ' listing' + (c.listing_count !== 1 ? 's' : '') : 'Coming soon'}</p>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    ${footerHTML()}`;

    initSearchBox('counties');

    window.filterRegion = (region, btn) => {
      document.querySelectorAll('.region-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.region-section').forEach(s => {
        s.style.display = (!region || s.dataset.region === region) ? '' : 'none';
      });
    };
  }

  /* ══════════════════════════════════════════════
     LISTING DETAIL PAGE
  ══════════════════════════════════════════════ */
  async function listing(id) {
    if (!id) { Router.go('home'); return; }
    loading();

    const [r, unlockR] = await Promise.all([
      API.listing(id),
      Auth.current() ? API.unlockStatus(id) : Promise.resolve({ ok: true, data: { status: 'not_unlocked' } })
    ]);

    if (!r.ok) {
      app().innerHTML = empty('ti-building-off', 'Listing not found', 'This listing may have been removed.', 'Browse listings', "Router.go('browse')");
      return;
    }

    const l = r.data.listing;
    const media = r.data.media || [];
    const reviews = r.data.reviews || [];
    const isUnlocked = unlockR.ok && unlockR.data.status === 'completed';
    const landlordData = isUnlocked ? unlockR.data : null;

    const photos = media.filter(m => m.media_type === 'photo');
    const videos = media.filter(m => m.media_type === 'video');

    // Gallery
    let galleryMain = photos.length > 0
      ? `<img src="${photos[0].url}" alt="${l.title}" id="gallery-main-img" />`
      : `<i class="ti ti-building placeholder-icon"></i>`;

    const thumbs = [
      ...photos.map((p, i) => `
        <div class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="setGalleryImg('${p.url}',this)">
          <img src="${p.url}" alt="Photo ${i+1}" loading="lazy"/>
        </div>`),
      ...videos.map(v => `
        <div class="gallery-thumb" onclick="setGalleryVideo('${v.url}',this)">
          <i class="ti ti-photo" style="color:var(--surface-3);font-size:18px"></i>
          <div class="video-indicator"><i class="ti ti-player-play-filled"></i></div>
        </div>`)
    ].join('');

    // Amenities
    const amenities = [
      ['has_water','Running water (borehole/mains)'],
      ['has_borehole','Borehole water'],
      ['has_security','24hr security guard'],
      ['has_cctv','CCTV cameras'],
      ['has_parking','Vehicle parking'],
      ['has_wifi','WiFi included'],
      ['has_electricity_token','Electricity (token meter)'],
      ['has_generator','Backup generator'],
      ['is_furnished','Furnished'],
      ['has_dsq','DSQ (servant quarter)'],
      ['has_garbage','Garbage collection'],
      ['has_caretaker','Caretaker on-site'],
      ['has_gym','Gym'],
      ['has_pool','Swimming pool'],
      ['has_playground','Children playground'],
      ['is_pet_friendly','Pet-friendly'],
      ['has_balcony','Balcony'],
      ['has_lift','Lift / elevator'],
    ];

    const nearby = [
      ['near_school','ti-school','Schools'],
      ['near_hospital','ti-building-hospital','Hospital'],
      ['near_market','ti-shopping-cart','Market'],
      ['near_matatu','ti-bus','Matatu stage'],
      ['near_church','ti-church','Place of worship'],
      ['near_water_kiosk','ti-droplet','Water kiosk'],
    ].filter(([k]) => l[k]);

    // Sidebar: contact or unlock
    let sidebarContact = isUnlocked && landlordData
      ? `<div class="contact-reveal-panel">
          <h3><i class="ti ti-user-check"></i> Landlord contact</h3>
          <div class="contact-row">
            <i class="ti ti-user"></i>
            <div><strong>${landlordData.landlord_name || 'Landlord'}</strong><small>Verified landlord</small></div>
          </div>
          <div class="contact-row">
            <i class="ti ti-phone"></i>
            <div><strong>${landlordData.landlord_phone || 'N/A'}</strong><small>Call directly</small></div>
          </div>
          <div class="contact-row">
            <i class="ti ti-brand-whatsapp"></i>
            <div><strong>${landlordData.landlord_phone || 'N/A'}</strong><small>WhatsApp</small></div>
          </div>
          <button class="btn-whatsapp" onclick="window.open('https://wa.me/${(landlordData.landlord_phone||'').replace(/\D/g,'')}','_blank')">
            <i class="ti ti-brand-whatsapp"></i> Open WhatsApp chat
          </button>
          <button class="btn-ghost btn-block mt-12" onclick="Reviews.open('${l.id}')">
            <i class="ti ti-star"></i> Leave a review
          </button>
        </div>`
      : `<div class="contact-lock-panel">
          <div class="lock-icon"><i class="ti ti-lock"></i></div>
          <p>Landlord contact is hidden. Pay <strong style="color:var(--orange)">Ksh 500</strong> via M-Pesa to reveal their phone number and WhatsApp.</p>
          <button class="btn-primary btn-block" onclick="Unlock.open('${l.id}','${escHtml(l.title)}')">
            <i class="ti ti-device-mobile-dollar"></i> Unlock — Ksh 500
          </button>
        </div>`;

    app().innerHTML = `
    <div class="detail-page">
      <div class="detail-back">
        <div class="crumb">
          <span onclick="Router.go('home')">Home</span>
          <i class="ti ti-chevron-right" style="font-size:12px;color:var(--text-3)"></i>
          <span onclick="Router.go('browse',{county:'${l.county_slug}'})">
            ${l.county_name}
          </span>
          ${l.area_name ? `<i class="ti ti-chevron-right" style="font-size:12px;color:var(--text-3)"></i>
          <span onclick="Router.go('browse',{county:'${l.county_slug}',area_id:'${l.area_id}'})">
            ${l.area_name}
          </span>` : ''}
          <i class="ti ti-chevron-right" style="font-size:12px;color:var(--text-3)"></i>
          <span style="color:var(--text-2);cursor:default">${typeLabel(l.property_type)}</span>
        </div>
      </div>

      <div class="detail-layout">
        <!-- MAIN CONTENT -->
        <div class="detail-main">
          <!-- GALLERY -->
          <div class="media-gallery">
            <div class="gallery-main" id="gallery-main">${galleryMain}</div>
            ${thumbs ? `<div class="gallery-thumbs">${thumbs}</div>` : ''}
          </div>

          <h1 class="detail-title">${l.title}</h1>
          <div class="detail-loc">
            <i class="ti ti-map-pin"></i>
            ${l.street_address || ''}
            ${l.area_name ? (l.street_address ? ' · ' : '') + l.area_name : ''}
            · ${l.county_name}
          </div>
          <div class="detail-tags">
            <span class="dtag">${typeLabel(l.property_type)}</span>
            ${l.floor ? `<span class="dtag">${l.floor} floor</span>` : ''}
            <span class="dtag green">Available now</span>
            <span class="dtag">${l.views} views</span>
          </div>
          <div class="detail-price">
            ${formatPrice(l.monthly_rent)} <small>/month</small>
          </div>
          <div class="deposit-note">Deposit: ${formatPrice(l.monthly_rent * l.deposit_months)} (${l.deposit_months} months)</div>
          ${l.review_count > 0 ? `<div class="detail-rating">${stars(l.average_rating, l.review_count)}</div>` : ''}

          <!-- DESCRIPTION -->
          ${l.description ? `
          <div class="panel" style="margin-top:16px">
            <div class="panel-title"><i class="ti ti-info-circle"></i> About this property</div>
            <p style="font-size:13px;color:var(--text-2);line-height:1.7">${l.description}</p>
          </div>` : ''}

          <!-- AMENITIES -->
          <div class="panel">
            <div class="panel-title"><i class="ti ti-list-check"></i> Amenities & services</div>
            <div class="amenity-grid">
              ${amenities.map(([k, label]) => `
                <div class="amenity-item">
                  <i class="ti ${l[k] ? 'ti-check yes' : 'ti-x no'}"></i>
                  <span>${label}</span>
                </div>`).join('')}
            </div>
          </div>

          <!-- NEARBY -->
          ${nearby.length > 0 ? `
          <div class="panel">
            <div class="panel-title"><i class="ti ti-map-2"></i> Nearby services</div>
            <div class="nearby-grid">
              ${nearby.map(([,icon,label]) => `
                <div class="nearby-item">
                  <i class="ti ${icon}"></i>
                  <span>${label}</span>
                </div>`).join('')}
            </div>
          </div>` : ''}

          <!-- MAP -->
          <div class="panel">
            <div class="panel-title"><i class="ti ti-map"></i> Location</div>
            <div class="map-box">
              <i class="ti ti-map-pin"></i>
              <span>${l.area_name ? l.area_name + ', ' : ''}${l.county_name}</span>
            </div>
            <p style="font-size:11px;color:var(--text-3);margin-top:6px">Exact address revealed after unlocking contact.</p>
          </div>

          <!-- REVIEWS -->
          <div class="panel">
            <div class="panel-title"><i class="ti ti-star"></i> Reviews (${l.review_count})</div>
            ${reviews.length > 0
              ? reviews.map(rv => `
                  <div class="review-card">
                    <div class="review-header">
                      <span class="reviewer-name">${rv.reviewer_name || 'Tenant'}</span>
                      <span class="review-stars">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</span>
                    </div>
                    <div class="review-date">${timeAgo(rv.created_at)}</div>
                    ${rv.comment ? `<div class="review-comment">${rv.comment}</div>` : ''}
                  </div>`).join('')
              : `<p style="font-size:13px;color:var(--text-3)">No reviews yet. Unlock this listing and leave the first review!</p>`}
          </div>
        </div>

        <!-- SIDEBAR -->
        <div class="detail-sidebar">
          ${sidebarContact}
          <div class="panel" style="margin-top:0">
            <div style="font-size:12px;color:var(--text-2)">
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                <span>Property type</span><strong>${typeLabel(l.property_type)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                <span>Monthly rent</span><strong class="text-orange">${formatPrice(l.monthly_rent)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                <span>Deposit</span><strong>${l.deposit_months} month${l.deposit_months > 1 ? 's' : ''}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                <span>County</span><strong>${l.county_name}</strong>
              </div>
              ${l.area_name ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
                <span>Area</span><strong>${l.area_name}</strong>
              </div>` : ''}
              <div style="display:flex;justify-content:space-between;padding:5px 0">
                <span>Listed</span><strong>${timeAgo(l.created_at)}</strong>
              </div>
            </div>
          </div>
          <button class="btn-ghost btn-block" onclick="Router.go('browse',{county:'${l.county_slug}'})">
            <i class="ti ti-arrow-left"></i> More in ${l.county_name}
          </button>
        </div>
      </div>
    </div>
    ${footerHTML()}`;

    // Gallery controls
    window.setGalleryImg = (url, thumb) => {
      const main = document.getElementById('gallery-main');
      main.innerHTML = `<img src="${url}" alt="Photo" id="gallery-main-img" />`;
      document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    };
    window.setGalleryVideo = (url, thumb) => {
      const main = document.getElementById('gallery-main');
      main.innerHTML = `<video src="${url}" controls style="width:100%;height:100%;object-fit:cover"></video>`;
      document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    };
  }

  /* ══════════════════════════════════════════════
     LANDLORD DASHBOARD
  ══════════════════════════════════════════════ */
  async function dashboard() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    if (user.role !== 'landlord') {
      app().innerHTML = empty('ti-lock', 'Landlord account required', 'Please register as a landlord to access the dashboard.', 'Sign up as landlord', "openModal('register-modal')");
      return;
    }
    loading();
    const r = await API.landlordListings();
    if (!r.ok) { app().innerHTML = empty('ti-alert-circle', 'Error', r.data.error || 'Failed to load dashboard.', 'Retry', "Router.go('dashboard')"); return; }

    const { listings, stats } = r.data;
    const s = stats || {};

    app().innerHTML = `
    <div class="dash-layout">
      <!-- SIDEBAR -->
      <aside class="dash-sidebar">
        <nav class="dash-nav">
          <a href="#" class="active" onclick="Router.go('dashboard');return false"><i class="ti ti-layout-dashboard"></i> Dashboard</a>
          <a href="#" onclick="Router.go('add-listing');return false"><i class="ti ti-plus"></i> Add listing</a>
          <hr/>
          <a href="#" onclick="Router.go('profile');return false"><i class="ti ti-user"></i> Profile</a>
          <a href="#" onclick="Auth.logout();return false"><i class="ti ti-logout"></i> Log out</a>
        </nav>
      </aside>

      <!-- CONTENT -->
      <div class="dash-content">
        <div class="dash-header-section">
          <h2>Welcome, ${(user.full_name || '').split(' ')[0]}</h2>
          <p>Manage your listings and track performance</p>
        </div>

        <!-- METRICS -->
        <div class="metrics-row">
          <div class="metric-card"><strong>${s.active || 0}</strong><span>Active listings</span></div>
          <div class="metric-card"><strong>${s.pending || 0}</strong><span>Pending review</span></div>
          <div class="metric-card"><strong>${Number(s.total_views || 0).toLocaleString()}</strong><span>Total views</span></div>
          <div class="metric-card"><strong>${Number(s.total_unlocks || 0).toLocaleString()}</strong><span>Unlocks this month</span></div>
        </div>

        <!-- ADD LISTING -->
        <button class="btn-primary btn-block" style="margin-bottom:20px" onclick="Router.go('add-listing')">
          <i class="ti ti-plus"></i> Add new listing
        </button>

        <!-- LISTINGS TABLE -->
        <div class="panel">
          <div class="panel-title"><i class="ti ti-list"></i> My listings</div>
          ${listings.length === 0
            ? `<p style="font-size:13px;color:var(--text-3);text-align:center;padding:20px 0">No listings yet. Add your first one!</p>`
            : listings.map(l => `
              <div class="listing-row">
                <div class="lr-thumb">
                  ${l.photo_count > 0
                    ? `<img src="" alt="" style="display:none" /><i class="ti ti-building" style="font-size:22px;color:var(--orange)"></i>`
                    : `<i class="ti ti-building" style="font-size:22px;color:var(--orange)"></i>`}
                </div>
                <div class="lr-info">
                  <h4>${l.title}</h4>
                  <p>${l.county_name}${l.area_name ? ' · ' + l.area_name : ''} · ${formatPrice(l.monthly_rent)}/mo · ${l.photo_count || 0} photo${l.photo_count !== 1 ? 's' : ''}${l.video_count > 0 ? ', ' + l.video_count + ' video' : ''}</p>
                </div>
                <span class="status-badge status-${l.status}">${l.status.charAt(0).toUpperCase() + l.status.slice(1)}</span>
                <div class="lr-actions">
                  <button class="btn-ghost btn-xs" onclick="Router.go('listing',{id:'${l.id}'})"><i class="ti ti-eye"></i></button>
                  <button class="btn-ghost btn-xs" onclick="Router.go('edit-listing',{id:'${l.id}'})"><i class="ti ti-edit"></i></button>
                  <button class="btn-ghost btn-xs" style="border-color:#e57373;color:#e57373" onclick="deleteListing('${l.id}')"><i class="ti ti-trash"></i></button>
                </div>
              </div>`).join('')}
        </div>
      </div>
    </div>`;

    window.deleteListing = async (id) => {
      if (!confirm('Delete this listing? This cannot be undone.')) return;
      const r = await API.deleteListing(id);
      if (r.ok) { showToast('Listing deleted.', 'success'); Router.go('dashboard'); }
      else showToast(r.data.error || 'Delete failed.', 'error');
    };
  }

  /* ══════════════════════════════════════════════
     ADD LISTING PAGE
  ══════════════════════════════════════════════ */
  async function addListing() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    if (user.role !== 'landlord') {
      showToast('You need a landlord account to post listings.', 'info'); return;
    }

    loading();
    const countiesR = await API.counties();
    const counties = countiesR.ok ? countiesR.data : [];

    let uploadedMedia = []; // { file, type, previewUrl }
    let selectedCountyId = null;

    app().innerHTML = `
    <div class="add-listing-page">
      <h2>Add a new listing</h2>
      <p class="sub">Fill in the details below, add photos/videos, and publish instantly.</p>
      <form id="add-listing-form" onsubmit="submitAddListing(event)">

        <!-- LOCATION -->
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-map-pin"></i> Location</div>
          <div class="form-group">
            <label>County *</label>
            <select id="fl-county" required onchange="loadAreas(this.value)">
              <option value="">Select county…</option>
              ${counties.map(c => `<option value="${c.id}" data-slug="${c.slug}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" id="area-group" style="display:none">
            <label>Area / estate</label>
            <select id="fl-area"><option value="">Select area…</option></select>
          </div>
          <div class="form-group">
            <label>Street address / estate name</label>
            <input type="text" id="fl-street" placeholder="e.g. Phase 2, Road B, near Total petrol station"/>
          </div>
        </div>

        <!-- PROPERTY DETAILS -->
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-home"></i> Property details</div>
          <div class="form-group">
            <label>Listing title *</label>
            <input type="text" id="fl-title" placeholder="e.g. Modern 1 bedroom apartment in Kasarani" required/>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Property type *</label>
              <select id="fl-type" required>
                <option value="">Select type…</option>
                <option value="bedsitter">Bedsitter</option>
                <option value="studio">Studio</option>
                <option value="1_bedroom">1 Bedroom</option>
                <option value="2_bedroom">2 Bedroom</option>
                <option value="3_bedroom">3 Bedroom</option>
                <option value="4_bedroom">4 Bedroom</option>
                <option value="bungalow">Bungalow</option>
                <option value="maisonette">Maisonette</option>
                <option value="townhouse">Townhouse</option>
                <option value="apartment">Apartment</option>
              </select>
            </div>
            <div class="form-group">
              <label>Floor</label>
              <select id="fl-floor">
                <option value="">Any</option>
                <option value="Ground">Ground floor</option>
                <option value="1st">1st floor</option>
                <option value="2nd">2nd floor</option>
                <option value="3rd">3rd floor</option>
                <option value="4th+">4th floor+</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Monthly rent (Ksh) *</label>
              <input type="number" id="fl-rent" placeholder="e.g. 14000" min="500" required/>
            </div>
            <div class="form-group">
              <label>Deposit (months)</label>
              <select id="fl-deposit">
                <option value="1">1 month</option>
                <option value="2" selected>2 months</option>
                <option value="3">3 months</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="fl-desc" rows="4" placeholder="Describe the property — size, condition, what makes it great, nearby landmarks…"></textarea>
          </div>
        </div>

        <!-- AMENITIES -->
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-list-check"></i> Amenities & services</div>
          <div class="check-grid">
            ${[
              ['has_water','Running water'],['has_borehole','Borehole water'],
              ['has_security','24hr security'],['has_cctv','CCTV cameras'],
              ['has_parking','Vehicle parking'],['has_wifi','WiFi included'],
              ['has_electricity_token','Electricity (token)'],['has_generator','Generator backup'],
              ['is_furnished','Furnished'],['has_dsq','DSQ'],
              ['has_garbage','Garbage collection'],['has_caretaker','Caretaker on-site'],
              ['has_gym','Gym'],['has_pool','Swimming pool'],
              ['has_playground','Children playground'],['is_pet_friendly','Pet-friendly'],
              ['has_balcony','Balcony'],['has_lift','Lift / elevator'],
            ].map(([k,l]) => `
              <label class="chk-item">
                <input type="checkbox" name="${k}" id="am-${k}"/>
                ${l}
              </label>`).join('')}
          </div>
        </div>

        <!-- NEARBY SERVICES -->
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-map-2"></i> Nearby services</div>
          <div class="check-grid">
            ${[
              ['near_school','School nearby'],['near_hospital','Hospital/clinic'],
              ['near_market','Market / supermarket'],['near_matatu','Matatu stage'],
              ['near_church','Place of worship'],['near_water_kiosk','Water kiosk'],
            ].map(([k,l]) => `
              <label class="chk-item">
                <input type="checkbox" name="${k}" id="am-${k}"/>
                ${l}
              </label>`).join('')}
          </div>
        </div>

        <!-- PHOTOS & VIDEOS -->
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-photo"></i> Photos & videos</div>
          <div class="upload-box" onclick="document.getElementById('photo-input').click()">
            <i class="ti ti-camera"></i>
            <p>Tap to upload photos</p>
            <small>JPEG, PNG · Up to 10 photos · Max 10MB each</small>
            <input type="file" id="photo-input" accept="image/*" multiple style="display:none" onchange="addMedia(this,'photo')"/>
          </div>
          <div class="upload-box mt-8" onclick="document.getElementById('video-input').click()">
            <i class="ti ti-video"></i>
            <p>Tap to upload a video walkthrough</p>
            <small>MP4 · Max 50MB</small>
            <input type="file" id="video-input" accept="video/*" style="display:none" onchange="addMedia(this,'video')"/>
          </div>
          <div class="media-preview-grid" id="media-previews"></div>
          <p style="font-size:11px;color:var(--text-3);margin-top:6px">Photos and videos are uploaded after publishing.</p>
        </div>

        <div id="add-listing-error" class="form-error hidden"></div>
        <button type="submit" class="btn-primary btn-block" id="submit-listing-btn">
          <i class="ti ti-check"></i> Publish listing
        </button>
        <button type="button" class="btn-ghost btn-block mt-8" onclick="Router.go('dashboard')">Cancel</button>
      </form>
    </div>
    ${footerHTML()}`;

    window.loadAreas = async (countyId) => {
      selectedCountyId = countyId;
      const areaGroup = document.getElementById('area-group');
      const areaSelect = document.getElementById('fl-area');
      if (!countyId) { areaGroup.style.display = 'none'; return; }
      areaSelect.innerHTML = '<option value="">Loading…</option>';
      areaGroup.style.display = '';
      const r = await API.areas(countyId);
      areaSelect.innerHTML = '<option value="">Select area…</option>';
      if (r.ok) r.data.forEach(a => {
        areaSelect.innerHTML += `<option value="${a.id}">${a.name}</option>`;
      });
    };

    window.addMedia = (input, type) => {
      const files = Array.from(input.files);
      files.forEach(file => {
        uploadedMedia.push({ file, type });
        const url = URL.createObjectURL(file);
        const idx = uploadedMedia.length - 1;
        const prev = document.getElementById('media-previews');
        const div = document.createElement('div');
        div.className = 'media-preview-item';
        div.innerHTML = type === 'photo'
          ? `<img src="${url}" alt="preview"/>`
          : `<video src="${url}" style="pointer-events:none"></video>`;
        const rm = document.createElement('button');
        rm.type = 'button'; rm.innerHTML = '✕';
        rm.onclick = () => { uploadedMedia.splice(idx, 1); div.remove(); };
        div.appendChild(rm);
        prev.appendChild(div);
      });
      input.value = '';
    };

    window.submitAddListing = async (e) => {
      e.preventDefault();
      const errEl = document.getElementById('add-listing-error');
      const btn = document.getElementById('submit-listing-btn');
      hideEl(errEl);

      const countyId = document.getElementById('fl-county').value;
      const title = document.getElementById('fl-title').value.trim();
      const type = document.getElementById('fl-type').value;
      const rent = document.getElementById('fl-rent').value;

      if (!countyId || !title || !type || !rent) {
        showEl(errEl); errEl.textContent = 'Please fill in all required fields.'; return;
      }

      const payload = {
        county_id: countyId,
        area_id: document.getElementById('fl-area').value || null,
        street_address: document.getElementById('fl-street').value.trim(),
        title,
        property_type: type,
        floor: document.getElementById('fl-floor').value,
        monthly_rent: parseInt(rent),
        deposit_months: parseInt(document.getElementById('fl-deposit').value),
        description: document.getElementById('fl-desc').value.trim(),
      };

      // Amenities
      document.querySelectorAll('.add-listing-page input[type="checkbox"]').forEach(cb => {
        payload[cb.name] = cb.checked;
      });

      setLoading(btn, true);
      const r = await API.createListing(payload);

      if (!r.ok) {
        setLoading(btn, false);
        showEl(errEl); errEl.textContent = r.data.error || 'Failed to create listing.';
        return;
      }

      const listingId = r.data.listing_id;

      // Upload media
      for (const m of uploadedMedia) {
        const fd = new FormData();
        fd.append('file', m.file);
        fd.append('media_type', m.type);
        await API.uploadMedia(listingId, fd);
      }

      setLoading(btn, false);
      showToast('Listing published successfully!', 'success');
      Router.go('listing', { id: listingId });
    };
  }

  /* ══════════════════════════════════════════════
     EDIT LISTING PAGE
  ══════════════════════════════════════════════ */
  async function editListing(id) {
    const user = Auth.current();
    if (!user || user.role !== 'landlord') { Router.go('dashboard'); return; }
    loading();

    const r = await API.listing(id);
    if (!r.ok) { showToast('Listing not found.', 'error'); Router.go('dashboard'); return; }
    const l = r.data.listing;

    const countiesR = await API.counties();
    const counties = countiesR.ok ? countiesR.data : [];

    app().innerHTML = `
    <div class="add-listing-page">
      <h2>Edit listing</h2>
      <p class="sub">${l.title}</p>
      <form id="edit-listing-form" onsubmit="submitEditListing(event,'${id}')">
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-home"></i> Property details</div>
          <div class="form-group">
            <label>Listing title *</label>
            <input type="text" id="el-title" value="${escHtml(l.title)}" required/>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Monthly rent (Ksh) *</label>
              <input type="number" id="el-rent" value="${l.monthly_rent}" required/>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="el-status">
                <option value="active" ${l.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="inactive" ${l.status === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="el-desc" rows="4">${l.description || ''}</textarea>
          </div>
        </div>
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-list-check"></i> Amenities</div>
          <div class="check-grid">
            ${[
              ['has_water','Running water'],['has_borehole','Borehole'],
              ['has_security','24hr security'],['has_cctv','CCTV'],
              ['has_parking','Parking'],['has_wifi','WiFi'],
              ['has_electricity_token','Electricity token'],['has_generator','Generator'],
              ['is_furnished','Furnished'],['has_dsq','DSQ'],
              ['has_garbage','Garbage collection'],['has_caretaker','Caretaker'],
              ['has_gym','Gym'],['has_pool','Pool'],
              ['has_playground','Playground'],['is_pet_friendly','Pet-friendly'],
              ['has_balcony','Balcony'],['has_lift','Lift'],
              ['near_school','Near school'],['near_hospital','Near hospital'],
              ['near_market','Near market'],['near_matatu','Near matatu'],
              ['near_church','Near church'],['near_water_kiosk','Water kiosk'],
            ].map(([k,lb]) => `
              <label class="chk-item">
                <input type="checkbox" name="${k}" ${l[k] ? 'checked' : ''}/>
                ${lb}
              </label>`).join('')}
          </div>
        </div>
        <div id="edit-listing-error" class="form-error hidden"></div>
        <button type="submit" class="btn-primary btn-block" id="edit-listing-btn">
          <i class="ti ti-check"></i> Save changes
        </button>
        <button type="button" class="btn-ghost btn-block mt-8" onclick="Router.go('dashboard')">Cancel</button>
      </form>
    </div>
    ${footerHTML()}`;

    window.submitEditListing = async (e, listingId) => {
      e.preventDefault();
      const errEl = document.getElementById('edit-listing-error');
      const btn = document.getElementById('edit-listing-btn');
      hideEl(errEl);
      const payload = {
        title: document.getElementById('el-title').value.trim(),
        monthly_rent: parseInt(document.getElementById('el-rent').value),
        description: document.getElementById('el-desc').value.trim(),
        status: document.getElementById('el-status').value,
      };
      document.querySelectorAll('#edit-listing-form input[type="checkbox"]').forEach(cb => {
        payload[cb.name] = cb.checked;
      });
      setLoading(btn, true);
      const r = await API.updateListing(listingId, payload);
      setLoading(btn, false);
      if (r.ok) { showToast('Listing updated.', 'success'); Router.go('listing', { id: listingId }); }
      else { showEl(errEl); errEl.textContent = r.data.error || 'Update failed.'; }
    };
  }

  /* ══════════════════════════════════════════════
     MY UNLOCKS PAGE
  ══════════════════════════════════════════════ */
  async function unlocks() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    loading();
    const r = await API.myUnlocks();
    const data = r.ok ? r.data : [];
    app().innerHTML = `
    <div class="unlocks-page">
      <h2 style="margin-bottom:4px">My unlocked houses</h2>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:20px">Houses whose landlord contacts you've already paid to unlock.</p>
      ${data.length === 0
        ? empty('ti-key-off', 'No unlocked houses yet', 'Browse listings and unlock the ones you like.', 'Browse listings', "Router.go('browse')")
        : data.map(u => `
          <div class="unlock-card">
            <div class="unlock-card-icon"><i class="ti ti-building"></i></div>
            <div class="unlock-card-info">
              <h4>${u.title}</h4>
              <p>${u.county_name}${u.area_name ? ' · ' + u.area_name : ''} · ${formatPrice(u.monthly_rent)}/mo · ${typeLabel(u.property_type)}</p>
              <p style="font-size:11px;color:var(--text-3);margin-top:2px">Unlocked ${timeAgo(u.completed_at)}</p>
            </div>
            <button class="btn-primary btn-sm" onclick="Router.go('listing',{id:'${u.listing_id}'})">
              <i class="ti ti-eye"></i> View
            </button>
          </div>`).join('')}
    </div>
    ${footerHTML()}`;
  }

  /* ══════════════════════════════════════════════
     PROFILE PAGE
  ══════════════════════════════════════════════ */
  async function profile() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    loading();
    const r = await API.me();
    const u = r.ok ? r.data : user;

    app().innerHTML = `
    <div class="profile-page">
      <h2 style="margin-bottom:4px">My profile</h2>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:20px">Update your name and phone number.</p>
      <div class="form-panel">
        <div class="form-panel-title"><i class="ti ti-user"></i> Personal info</div>
        <div class="form-group">
          <label>Email address</label>
          <input type="email" value="${u.email || ''}" disabled style="opacity:0.6"/>
        </div>
        <div class="form-group">
          <label>Full name</label>
          <input type="text" id="p-name" value="${u.full_name || ''}"/>
        </div>
        <div class="form-group">
          <label>Phone number (M-Pesa)</label>
          <input type="tel" id="p-phone" value="${u.phone || ''}" placeholder="07XX XXX XXX"/>
        </div>
        <div class="form-group">
          <label>Account type</label>
          <input type="text" value="${u.role === 'landlord' ? 'Landlord' : 'Tenant'}" disabled style="opacity:0.6"/>
        </div>
        <div id="profile-error" class="form-error hidden"></div>
        <div id="profile-success" class="form-success hidden">Profile updated successfully.</div>
        <button class="btn-primary btn-block" id="save-profile-btn" onclick="saveProfile()">
          <i class="ti ti-check"></i> Save changes
        </button>
      </div>
    </div>
    ${footerHTML()}`;

    window.saveProfile = async () => {
      const btn = document.getElementById('save-profile-btn');
      const errEl = document.getElementById('profile-error');
      const sucEl = document.getElementById('profile-success');
      hideEl(errEl); hideEl(sucEl);
      setLoading(btn, true);
      const r = await API.updateProfile({
        full_name: document.getElementById('p-name').value.trim(),
        phone: document.getElementById('p-phone').value.trim(),
      });
      setLoading(btn, false);
      if (r.ok) { showEl(sucEl); Auth.restoreSession(); }
      else { showEl(errEl); errEl.textContent = r.data.error || 'Update failed.'; }
    };
  }

  /* ══════════════════════════════════════════════
     SHARED HTML HELPERS
  ══════════════════════════════════════════════ */
  function searchBoxHTML(context) {
    const textColor = context === 'home' ? '' : '';
    return `
    <div class="search-box" id="search-box-${context}">
      <div class="search-icon"><i class="ti ti-search"></i></div>
      <div class="autocomplete-wrap">
        <input type="text" id="search-input-${context}" placeholder="Estate, area, county or town…"
          oninput="handleSearchInput('${context}',this.value)"
          onkeydown="if(event.key==='Enter'){doSearch('${context}')}"
          autocomplete="off"/>
        <div class="autocomplete-list hidden" id="ac-list-${context}"></div>
      </div>
      <select id="search-type-${context}">
        <option value="">All types</option>
        <option value="bedsitter">Bedsitter</option>
        <option value="studio">Studio</option>
        <option value="1_bedroom">1 Bedroom</option>
        <option value="2_bedroom">2 Bedroom</option>
        <option value="3_bedroom">3 Bedroom</option>
        <option value="4_bedroom">4 Bedroom</option>
        <option value="bungalow">Bungalow</option>
        <option value="maisonette">Maisonette</option>
      </select>
      <select id="search-price-${context}">
        <option value="">Any price</option>
        <option value="10000">Under 10k</option>
        <option value="20000">Under 20k</option>
        <option value="40000">Under 40k</option>
        <option value="80000">Under 80k</option>
      </select>
      <button class="search-btn" onclick="doSearch('${context}')">
        <i class="ti ti-search"></i> Search
      </button>
    </div>`;
  }

  function initSearchBox(context) {
    let acTimer;
    window.handleSearchInput = async (ctx, val) => {
      if (ctx !== context) return;
      clearTimeout(acTimer);
      const list = document.getElementById(`ac-list-${ctx}`);
      if (val.length < 2) { list && hideEl(list); return; }
      acTimer = setTimeout(async () => {
        const r = await API.suggest(val);
        if (!r.ok || r.data.length === 0) { list && hideEl(list); return; }
        list.innerHTML = r.data.map(item => `
          <div class="ac-item" onclick="selectSuggestion('${ctx}','${escHtml(item.name)}','${item.type}','${item.value}')">
            <i class="ti ${item.type === 'county' ? 'ti-map' : item.type === 'area' ? 'ti-map-pin' : 'ti-building'}"></i>
            ${item.name}
            <span class="ac-type">${item.type}</span>
          </div>`).join('');
        showEl(list);
      }, 280);
    };

    window.selectSuggestion = (ctx, name, type, value) => {
      const input = document.getElementById(`search-input-${ctx}`);
      if (input) input.value = name;
      const list = document.getElementById(`ac-list-${ctx}`);
      if (list) hideEl(list);
      if (type === 'county') Router.go('browse', { county: value });
      else if (type === 'listing') Router.go('listing', { id: value });
      else doSearch(ctx);
    };

    window.doSearch = (ctx) => {
      const q = (document.getElementById(`search-input-${ctx}`) || {}).value || '';
      const type = (document.getElementById(`search-type-${ctx}`) || {}).value || '';
      const price = (document.getElementById(`search-price-${ctx}`) || {}).value || '';
      const params = {};
      if (q) params.q = q;
      if (type) params.type = type;
      if (price) params.max_price = price;
      Router.go('browse', params);
    };

    // Close autocomplete on outside click
    document.addEventListener('click', e => {
      const list = document.getElementById(`ac-list-${context}`);
      if (list && !list.contains(e.target)) hideEl(list);
    }, { once: false });
  }

  function footerHTML() {
    return `
    <footer class="footer">
      <div class="footer-inner">
        <div class="logo" style="font-size:15px">My<span style="color:#fff">Nyumba</span></div>
        <p>© ${new Date().getFullYear()} MyNyumba · All 47 counties covered</p>
        <div class="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Help</a>
          <a href="#" onclick="Router.go('browse');return false;">Browse</a>
          <a href="#" onclick="Auth.current() && Auth.current().role==='landlord' ? Router.go('dashboard') : openModal('register-modal');return false;">Landlord</a>
        </div>
      </div>
    </footer>`;
  }

  function scrollToHow() {
    Router.go('home');
    setTimeout(() => {
      const el = document.getElementById('how-it-works');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }

  return { home, browse, counties, listing, dashboard, addListing, editListing, unlocks, profile, scrollToHow };
})();