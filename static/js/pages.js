/* pages.js — All page renderers */
const Pages = (() => {
  const app = () => document.getElementById('app');

  function loading() {
    app().innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Loading…</span></div>`;
  }

  function emptyState(icon, title, msg, btnLabel, btnAction) {
    return `<div class="empty-state">
      <i class="ti ${icon}"></i><h3>${title}</h3><p>${msg}</p>
      ${btnLabel ? `<button class="btn-primary" onclick="${btnAction}">${btnLabel}</button>` : ''}
    </div>`;
  }

  /* ── Shared: listing card ── */
  function listingCard(l, showUnlocked = false) {
    const tags = [];
    if (l.has_water)    tags.push('Water');
    if (l.has_security) tags.push('Security');
    if (l.has_parking)  tags.push('Parking');
    if (l.has_wifi)     tags.push('WiFi');
    if (l.is_furnished) tags.push('Furnished');
    if (l.has_gym)      tags.push('Gym');

    const imgHtml = l.cover_photo
      ? `<img src="${l.cover_photo}" alt="${escHtml(l.title)}" loading="lazy"/>`
      : `<i class="ti ti-building card-img-placeholder"></i>`;

    const isNew  = (Date.now() - new Date(l.created_at)) < 7 * 86400000;
    const badge  = l.is_featured
      ? `<span class="card-badge">Featured</span>`
      : isNew ? `<span class="card-badge green">New</span>` : '';

    const ratingHtml = l.review_count > 0
      ? `<div class="card-rating"><i class="ti ti-star-filled"></i>${Number(l.average_rating).toFixed(1)} <span>(${l.review_count})</span></div>` : '';

    return `<div class="listing-card" onclick="Router.go('listing',{id:'${l.id}'})">
      <div class="card-img">${imgHtml}${badge}</div>
      <div class="card-body">
        <div class="card-title">${escHtml(l.title)}</div>
        <div class="card-loc"><i class="ti ti-map-pin"></i>${l.area_name ? escHtml(l.area_name)+' · ' : ''}${escHtml(l.county_name)}</div>
        <div class="card-tags">
          <span class="ctag">${typeLabel(l.property_type)}</span>
          ${tags.slice(0,2).map(t=>`<span class="ctag">${t}</span>`).join('')}
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

  /* ── Shared: search box ── */
  function searchBoxHTML(ctx) {
    return `<div class="search-box" id="search-box-${ctx}">
      <div class="search-icon"><i class="ti ti-search"></i></div>
      <div class="autocomplete-wrap">
        <input type="text" id="search-input-${ctx}" placeholder="Estate, area, county or town…"
          oninput="handleSearchInput('${ctx}',this.value)"
          onkeydown="if(event.key==='Enter'){doSearch('${ctx}')}"
          autocomplete="off"/>
        <div class="autocomplete-list hidden" id="ac-list-${ctx}"></div>
      </div>
      <select id="search-type-${ctx}">
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
      <select id="search-price-${ctx}">
        <option value="">Any price</option>
        <option value="10000">Under 10k</option>
        <option value="20000">Under 20k</option>
        <option value="40000">Under 40k</option>
        <option value="80000">Under 80k</option>
      </select>
      <button class="search-btn" onclick="doSearch('${ctx}')"><i class="ti ti-search"></i> Search</button>
    </div>`;
  }

  function initSearchBox(ctx) {
    let acTimer;
    window.handleSearchInput = async (c, val) => {
      if (c !== ctx) return;
      clearTimeout(acTimer);
      const list = el(`ac-list-${c}`);
      if (val.length < 2) { list && hideEl(list); return; }
      acTimer = setTimeout(async () => {
        const r = await API.suggest(val);
        if (!r.ok || !r.data.length) { list && hideEl(list); return; }
        list.innerHTML = r.data.map(item => `
          <div class="ac-item" onclick="selectSuggestion('${c}','${escHtml(item.name)}','${item.type}','${item.value}')">
            <i class="ti ${item.type==='county'?'ti-map':item.type==='area'?'ti-map-pin':'ti-building'}"></i>
            ${escHtml(item.name)}<span class="ac-type">${item.type}</span>
          </div>`).join('');
        showEl(list);
      }, 280);
    };
    window.selectSuggestion = (c, name, type, value) => {
      const inp = el(`search-input-${c}`);
      if (inp) inp.value = name;
      const list = el(`ac-list-${c}`);
      if (list) hideEl(list);
      if (type === 'county')  Router.go('browse', { county: value });
      else if (type === 'listing') Router.go('listing', { id: value });
      else doSearch(c);
    };
    window.doSearch = (c) => {
      const q     = (el(`search-input-${c}`) || {}).value || '';
      const type  = (el(`search-type-${c}`)  || {}).value || '';
      const price = (el(`search-price-${c}`) || {}).value || '';
      const params = {};
      if (q)     params.q         = q;
      if (type)  params.type      = type;
      if (price) params.max_price = price;
      Router.go('browse', params);
    };
    document.addEventListener('click', e => {
      const list = el(`ac-list-${ctx}`);
      if (list && !list.contains(e.target)) hideEl(list);
    });
  }

  /* ── Shared: footer ── */
  function footerHTML() {
    return `<footer class="footer">
      <div class="footer-inner">
        <div class="footer-top">
          <div class="footer-brand">
            <span class="logo">My<span style="color:#fff">Nyumba</span></span>
            <p>Find verified rental houses across all 47 counties in Kenya. Pay Ksh 500 to unlock landlord contacts.</p>
          </div>
          <div class="footer-links-group">
            <h4>Navigate</h4>
            <div class="footer-links">
              <a href="#" onclick="Router.go('home');return false;"><i class="ti ti-home"></i> Home</a>
              <a href="#" onclick="Router.go('browse');return false;"><i class="ti ti-search"></i> Browse listings</a>
              <a href="#" onclick="Router.go('counties');return false;"><i class="ti ti-map"></i> All counties</a>
              <a href="#" onclick="Router.go('how');return false;"><i class="ti ti-help-circle"></i> How it works</a>
            </div>
          </div>
          <div class="footer-links-group">
            <h4>Account</h4>
            <div class="footer-links">
              <a href="#" onclick="openModal('register-modal');return false;"><i class="ti ti-user-plus"></i> Sign up free</a>
              <a href="#" onclick="openModal('login-modal');return false;"><i class="ti ti-login"></i> Log in</a>
              <a href="#" onclick="Router.go('dashboard');return false;"><i class="ti ti-layout-dashboard"></i> Landlord dashboard</a>
              <a href="#" onclick="Router.go('unlocks');return false;"><i class="ti ti-key"></i> My unlocked houses</a>
            </div>
          </div>
          <div class="footer-links-group">
            <h4>Help & Support</h4>
            <div class="footer-links">
              <a href="mailto:michaelmalaba3634@gmail.com"><i class="ti ti-mail"></i> michaelmalaba3634@gmail.com</a>
              <a href="https://wa.me/254703245513" target="_blank"><i class="ti ti-brand-whatsapp"></i> +254 703 245 513</a>
              <a href="#"><i class="ti ti-shield"></i> Privacy policy</a>
              <a href="#"><i class="ti ti-file-text"></i> Terms of service</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© ${new Date().getFullYear()} MyNyumba. All rights reserved. All 47 counties in Kenya covered.</p>
          <p>For help: <a href="mailto:michaelmalaba3634@gmail.com" style="color:var(--orange)">michaelmalaba3634@gmail.com</a> · <a href="https://wa.me/254703245513" style="color:var(--green)">WhatsApp</a></p>
        </div>
      </div>
    </footer>`;
  }

  /* ── Shared: dash sidebar ── */
  function dashSidebarHTML(activePage, user) {
    const isLandlord = user && (user.role === 'landlord' || user.role === 'admin');
    const isAdmin    = user && user.is_admin;
    return `<aside class="dash-sidebar">
      <div class="dash-sidebar-header">
        <h3>${escHtml((user && user.full_name) || 'My Account')}</h3>
        <p>${user && user.email ? escHtml(user.email) : ''}</p>
      </div>
      <nav class="dash-nav">
        ${isLandlord ? `
        <span class="nav-section-label">Landlord</span>
        <a href="#" class="${activePage==='dashboard'?'active':''}" onclick="Router.go('dashboard');return false;"><i class="ti ti-layout-dashboard"></i> Dashboard</a>
        <a href="#" class="${activePage==='add-listing'?'active':''}" onclick="Router.go('add-listing');return false;"><i class="ti ti-plus"></i> Add listing</a>
        ` : ''}
        ${isAdmin ? `
        <hr/>
        <span class="nav-section-label">Admin</span>
        <a href="#" class="${activePage==='admin'?'active':''}" onclick="Router.go('admin');return false;"><i class="ti ti-shield"></i> Admin panel</a>
        ` : ''}
        <hr/>
        <span class="nav-section-label">My Account</span>
        <a href="#" class="${activePage==='unlocks'?'active':''}" onclick="Router.go('unlocks');return false;"><i class="ti ti-key"></i> My unlocked houses</a>
        <a href="#" class="${activePage==='profile'?'active':''}" onclick="Router.go('profile');return false;"><i class="ti ti-user"></i> Profile</a>
        <hr/>
        <a href="#" onclick="Router.go('home');return false;"><i class="ti ti-home"></i> Back to home</a>
        <a href="#" onclick="Auth.logout();return false;" class="logout-link"><i class="ti ti-logout"></i> Log out</a>
      </nav>
    </aside>`;
  }

  /* ══════════════════════════════════════════════
     HOME
  ══════════════════════════════════════════════ */
  async function home() {
    loading();
    const [countiesR, listingsR] = await Promise.all([
      API.counties(),
      API.listings({ sort: 'newest', per_page: 8 })
    ]);
    const counties = countiesR.ok ? countiesR.data : [];
    const listings = listingsR.ok ? listingsR.data.listings : [];
    const total    = listingsR.ok ? listingsR.data.total : 0;
    const topCounties = [...counties].sort((a,b) => b.listing_count - a.listing_count).slice(0, 14);

    app().innerHTML = `
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
        <span class="ftag" data-filter="gym=true">Gym</span>
      </div>
      <div class="hero-stats">
        <div class="h-stat"><strong>${total.toLocaleString()}+</strong><span>Active listings</span></div>
        <div class="h-stat"><strong>47</strong><span>Counties</span></div>
        <div class="h-stat"><strong>580+</strong><span>Areas covered</span></div>
        <div class="h-stat"><strong>Ksh 500</strong><span>Flat unlock fee</span></div>
      </div>
    </section>

    <div class="counties-bar">
      <button class="active" onclick="Router.go('counties')">All counties</button>
      ${topCounties.map(c=>`<button onclick="Router.go('browse',{county:'${c.slug}'})">${escHtml(c.name)}</button>`).join('')}
    </div>

    <div class="section">
      <div class="sec-hdr">
        <h2>Latest listings</h2>
        <button onclick="Router.go('browse')">View all <i class="ti ti-arrow-right"></i></button>
      </div>
      ${listings.length > 0
        ? `<div class="cards-grid">${listings.map(l=>listingCard(l)).join('')}</div>`
        : emptyState('ti-building-off','No listings yet','Be the first to post a house!','Post a listing',"Router.go('add-listing')")}
    </div>

    <section class="how-section" id="how-it-works">
      <h2>How <span class="text-orange">MyNyumba</span> works</h2>
      <p class="sub">Simple 3-step process to find your next home</p>
      <div class="steps-grid">
        <div class="step-card"><div class="step-num">1</div><h3>Search a listing</h3><p>Browse houses by county, estate, price and amenities across all 47 counties in Kenya.</p></div>
        <div class="step-card"><div class="step-num">2</div><h3>Pay Ksh 500 via M-Pesa</h3><p>One-time fee per listing. An STK push is sent to your phone — just enter your PIN.</p></div>
        <div class="step-card"><div class="step-num">3</div><h3>Contact landlord directly</h3><p>Get the landlord's phone and WhatsApp. Call to arrange a viewing immediately.</p></div>
      </div>
      <span class="fee-note"><i class="ti ti-shield-check"></i> No hidden charges · M-Pesa STK Push · Instant unlock</span>
    </section>

    <div class="ll-cta">
      <div class="ll-cta-inner">
        <div class="ll-cta-box">
          <div class="ll-icon"><i class="ti ti-key"></i></div>
          <div class="ll-text">
            <h3>Are you a landlord?</h3>
            <p>Post your vacant house for free. Add photos, videos and a full list of services. Reach thousands of tenants across Kenya.</p>
            <div class="ll-btns">
              <button class="btn-primary" onclick="handleLandlordCTA()"><i class="ti ti-plus"></i> Post a listing — it's free</button>
              <button class="btn-outline" onclick="Router.go('dashboard')"><i class="ti ti-layout-dashboard"></i> Landlord dashboard</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    ${footerHTML()}`;

    el('home-filters').addEventListener('click', e => {
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
    if (user.role !== 'landlord' && !user.is_admin) {
      showToast('You need a landlord account to post listings.', 'info'); return;
    }
    Router.go('add-listing');
  }
  window.handleLandlordCTA = handleLandlordCTA;

  /* ══════════════════════════════════════════════
     BROWSE
  ══════════════════════════════════════════════ */
  async function browse(initialParams = {}) {
    loading();
    const countiesR = await API.counties();
    const counties  = countiesR.ok ? countiesR.data : [];

    let activeCounty = initialParams.county || '';
    let activeArea   = initialParams.area_id || '';
    let activeSort   = 'newest';
    let activePage   = 1;
    let propType     = initialParams.type || '';
    let maxPrice     = initialParams.max_price || '';
    let searchQ      = initialParams.q || '';
    const amenityParams = {};
    ['water','security','parking','wifi','furnished','dsq','gym','cctv','borehole','generator','pet_friendly'].forEach(k => {
      if (initialParams[k]) amenityParams[k] = initialParams[k];
    });

    let areas = [];
    if (activeCounty) {
      const co = counties.find(c => c.slug === activeCounty);
      if (co) { const ar = await API.areas(co.id); if (ar.ok) areas = ar.data; }
    }

    async function fetchAndRender() {
      const params = {
        sort: activeSort, page: activePage, per_page: 12,
        ...(searchQ      && { q: searchQ }),
        ...(activeCounty && { county: activeCounty }),
        ...(activeArea   && { area_id: activeArea }),
        ...(propType     && { type: propType }),
        ...(maxPrice     && { max_price: maxPrice }),
        ...amenityParams
      };
      const r = await API.listings(params);
      const data = r.ok ? r.data : { listings: [], total: 0, pages: 1 };
      renderResults(data);
    }

    function renderResults({ listings, total, pages }) {
      const rc = el('results-count');
      if (rc) rc.textContent = `${total.toLocaleString()} listing${total !== 1 ? 's' : ''}`;
      const ra = el('results-area');
      if (!ra) return;
      ra.innerHTML = listings.length > 0
        ? `<div class="cards-grid">${listings.map(l=>listingCard(l)).join('')}</div>`
        : emptyState('ti-building-off','No listings found','Try adjusting your filters or search.','','');
      const pa = el('pagination-area');
      if (pa) {
        if (pages <= 1) { pa.innerHTML = ''; return; }
        let html = `<div class="pagination">
          <button class="page-btn" ${activePage===1?'disabled':''} onclick="browseSetPage(${activePage-1})"><i class="ti ti-chevron-left"></i></button>`;
        for (let i = 1; i <= Math.min(pages, 7); i++)
          html += `<button class="page-btn ${i===activePage?'active':''}" onclick="browseSetPage(${i})">${i}</button>`;
        if (pages > 7) html += `<span style="color:var(--text-3);padding:0 4px">…</span><button class="page-btn ${activePage===pages?'active':''}" onclick="browseSetPage(${pages})">${pages}</button>`;
        html += `<button class="page-btn" ${activePage===pages?'disabled':''} onclick="browseSetPage(${activePage+1})"><i class="ti ti-chevron-right"></i></button></div>`;
        pa.innerHTML = html;
      }
    }

    window.browseSetPage = p => { activePage = p; fetchAndRender(); window.scrollTo(0,0); };
    window.browseSort    = v => { activeSort = v; activePage = 1; fetchAndRender(); };
    window.browseType    = v => { propType   = v; activePage = 1; fetchAndRender(); };
    window.browseAmenity = (filter, tagEl) => {
      document.querySelectorAll('.amenity-filters .ftag').forEach(t => t.classList.remove('active'));
      tagEl.classList.add('active');
      Object.keys(amenityParams).forEach(k => delete amenityParams[k]);
      if (filter) { const [k,v] = filter.split('='); amenityParams[k] = v; }
      activePage = 1; fetchAndRender();
    };
    window.browseSetCounty = async (slug, cid) => {
      activeCounty = slug; activeArea = ''; activePage = 1; areas = [];
      if (slug && cid) { const ar = await API.areas(cid); if (ar.ok) areas = ar.data; }
      browse({ county: slug, q: searchQ, type: propType, ...amenityParams });
    };
    window.browseSetArea = areaId => {
      activeArea = areaId; activePage = 1;
      document.querySelectorAll('#area-chips .area-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.areaId == areaId || (areaId==='' && c.dataset.areaId==='')));
      fetchAndRender();
    };

    const areasHTML = areas.length > 0
      ? `<div class="area-chips" id="area-chips">
          <span class="area-chip ${!activeArea?'active':''}" data-area-id="" onclick="browseSetArea('')">All areas</span>
          ${areas.map(a=>`<span class="area-chip ${activeArea==a.id?'active':''}" data-area-id="${a.id}" onclick="browseSetArea('${a.id}')">${escHtml(a.name)}</span>`).join('')}
        </div>` : '';

    app().innerHTML = `
    <div class="browse-header">
      <div class="browse-header-inner">
        <div style="margin-bottom:10px">${searchBoxHTML('browse')}</div>
        <div class="counties-bar" style="padding:0;margin:0;background:transparent;border:none">
          <button class="${!activeCounty?'active':''}" onclick="browseSetCounty('','')">All</button>
          ${counties.map(c=>`<button class="${activeCounty===c.slug?'active':''}" onclick="browseSetCounty('${c.slug}','${c.id}')">${escHtml(c.name)}</button>`).join('')}
        </div>
      </div>
    </div>
    ${areasHTML}
    <div class="results-bar" style="max-width:100%">
      <span id="results-count">Loading…</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <select class="sort-select" onchange="browseSort(this.value)">
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
          <option value="popular">Most unlocked</option>
        </select>
        <select class="sort-select" onchange="browseType(this.value)" style="min-width:130px">
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
      </div>
    </div>
    <div class="amenity-filters">
      ${[['','All'],['water=true','Water'],['parking=true','Parking'],['wifi=true','WiFi'],
         ['security=true','Security'],['furnished=true','Furnished'],['dsq=true','DSQ'],
         ['gym=true','Gym'],['cctv=true','CCTV'],['borehole=true','Borehole'],
         ['generator=true','Generator'],['pet_friendly=true','Pet-friendly'],['pool=true','Pool']]
        .map(([f,l])=>`<span class="ftag ${Object.keys(amenityParams).length===0&&!f?'active':''}" onclick="browseAmenity('${f}',this)">${l}</span>`).join('')}
    </div>
    <div class="section" style="padding-top:16px">
      <div id="results-area"><div class="loading-state"><div class="spinner"></div><span>Loading…</span></div></div>
      <div id="pagination-area"></div>
    </div>
    ${footerHTML()}`;

    initSearchBox('browse');
    fetchAndRender();
  }

  /* ══════════════════════════════════════════════
     COUNTIES
  ══════════════════════════════════════════════ */
  async function counties() {
    loading();
    const r = await API.counties();
    if (!r.ok) { app().innerHTML = emptyState('ti-alert-circle','Failed to load','Could not load counties.','Retry',"Pages.counties()"); return; }
    const all = r.data;
    const byRegion = {};
    all.forEach(c => { if (!byRegion[c.region]) byRegion[c.region] = []; byRegion[c.region].push(c); });
    const regionIcons = {
      'Nairobi Region':'ti-building-skyscraper','Central':'ti-mountain','Coast':'ti-waves',
      'Rift Valley':'ti-mountain-off','Western':'ti-tree','Nyanza':'ti-ripple',
      'Eastern':'ti-map','North Eastern':'ti-map-2'
    };
    app().innerHTML = `
    <div class="hero" style="padding:32px 20px 24px">
      <h1>All <em>47 counties</em> in Kenya</h1>
      <p class="hero-sub">Select a county to browse listings in that area</p>
      ${searchBoxHTML('counties')}
      <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:14px">
        <span class="ftag active" onclick="filterRegion('',this)">All regions</span>
        ${Object.keys(byRegion).map(reg=>`<span class="ftag" onclick="filterRegion('${escHtml(reg)}',this)">${reg}</span>`).join('')}
      </div>
    </div>
    <div style="max-width:1280px;margin:0 auto;padding:24px 20px" id="counties-page">
      ${Object.entries(byRegion).map(([region, cs]) => `
        <div class="region-section" data-region="${escHtml(region)}" style="margin-bottom:28px">
          <h3 style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">${region}</h3>
          <div class="county-grid">
            ${cs.map(c=>`
              <div class="county-card" onclick="Router.go('browse',{county:'${c.slug}'})">
                <i class="ti ${regionIcons[region]||'ti-map-pin'}"></i>
                <h3>${escHtml(c.name)}</h3>
                <p>${c.listing_count > 0 ? c.listing_count+' listing'+(c.listing_count!==1?'s':'') : 'Coming soon'}</p>
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    ${footerHTML()}`;

    initSearchBox('counties');
    window.filterRegion = (region, btn) => {
      document.querySelectorAll('.hero .ftag').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.region-section').forEach(s => {
        s.style.display = (!region || s.dataset.region === region) ? '' : 'none';
      });
    };
  }

  /* ══════════════════════════════════════════════
     LISTING DETAIL
  ══════════════════════════════════════════════ */
  async function listing(id) {
    if (!id) { Router.go('home'); return; }
    loading();
    const [r, unlockR] = await Promise.all([
      API.listing(id),
      Auth.current() ? API.unlockStatus(id) : Promise.resolve({ ok:true, data:{ status:'not_unlocked' } })
    ]);
    if (!r.ok) { app().innerHTML = emptyState('ti-building-off','Listing not found','This listing may have been removed.','Browse listings',"Router.go('browse')"); return; }

    const l          = r.data.listing;
    const media      = r.data.media || [];
    const reviews    = r.data.reviews || [];
    const isUnlocked = unlockR.ok && unlockR.data.status === 'completed';
    const ld         = isUnlocked ? unlockR.data : null;
    const photos     = media.filter(m => m.media_type === 'photo');
    const videos     = media.filter(m => m.media_type === 'video');

    const galleryMain = photos.length > 0
      ? `<img src="${photos[0].url}" alt="${escHtml(l.title)}" id="gallery-main-img"/>`
      : `<i class="ti ti-building placeholder-icon"></i>`;

    const thumbs = [
      ...photos.map((p,i) => `<div class="gallery-thumb ${i===0?'active':''}" onclick="setGalleryImg('${p.url}',this)"><img src="${p.url}" alt="Photo ${i+1}" loading="lazy"/></div>`),
      ...videos.map(v => `<div class="gallery-thumb" onclick="setGalleryVideo('${v.url}',this)"><i class="ti ti-photo" style="color:var(--surface-3)"></i><div class="video-indicator"><i class="ti ti-player-play-filled"></i></div></div>`)
    ].join('');

    const amenities = [
      ['has_water','Running water'],['has_borehole','Borehole water'],
      ['has_security','24hr security'],['has_cctv','CCTV cameras'],
      ['has_parking','Vehicle parking'],['has_wifi','WiFi included'],
      ['has_electricity_token','Electricity (token)'],['has_generator','Backup generator'],
      ['is_furnished','Furnished'],['has_dsq','DSQ'],
      ['has_garbage','Garbage collection'],['has_caretaker','Caretaker on-site'],
      ['has_gym','Gym'],['has_pool','Swimming pool'],
      ['has_playground','Children playground'],['is_pet_friendly','Pet-friendly'],
      ['has_balcony','Balcony'],['has_lift','Lift / elevator'],
    ];
    const nearby = [
      ['near_school','ti-school','Schools'],['near_hospital','ti-building-hospital','Hospital'],
      ['near_market','ti-shopping-cart','Market'],['near_matatu','ti-bus','Matatu stage'],
      ['near_church','ti-church','Place of worship'],['near_water_kiosk','ti-droplet','Water kiosk'],
    ].filter(([k]) => l[k]);

    const sidebarContact = isUnlocked && ld ? `
      <div class="contact-reveal-panel">
        <h3><i class="ti ti-user-check"></i> Landlord contact</h3>
        <div class="contact-row"><i class="ti ti-user"></i><div><strong>${escHtml(ld.landlord_name||'Landlord')}</strong><small>Verified landlord</small></div></div>
        <div class="contact-row"><i class="ti ti-phone"></i><div><strong>${escHtml(ld.landlord_phone||'N/A')}</strong><small>Call directly</small></div></div>
        <div class="contact-row"><i class="ti ti-brand-whatsapp"></i><div><strong>${escHtml(ld.landlord_phone||'N/A')}</strong><small>WhatsApp</small></div></div>
        ${ld.landlord_email ? `<div class="contact-row"><i class="ti ti-mail"></i><div><strong>${escHtml(ld.landlord_email)}</strong><small>Email</small></div></div>` : ''}
        <button class="btn-whatsapp" onclick="window.open('https://wa.me/${(ld.landlord_phone||'').replace(/\D/g,'')}','_blank')"><i class="ti ti-brand-whatsapp"></i> Open WhatsApp chat</button>
        <button class="btn-ghost btn-block mt-12" onclick="Reviews.open('${l.id}')"><i class="ti ti-star"></i> Leave a review</button>
      </div>` : `
      <div class="contact-lock-panel">
        <div class="lock-icon"><i class="ti ti-lock"></i></div>
        <p>Landlord contact is hidden. Pay <strong style="color:var(--orange)">Ksh 500</strong> via M-Pesa to reveal phone and WhatsApp.</p>
        <button class="btn-primary btn-block" onclick="Unlock.open('${l.id}','${escHtml(l.title)}')"><i class="ti ti-device-mobile-dollar"></i> Unlock — Ksh 500</button>
      </div>`;

    app().innerHTML = `
    <div class="crumb">
      <span onclick="Router.go('home')">Home</span>
      <i class="ti ti-chevron-right" style="font-size:11px;color:var(--text-3)"></i>
      <span onclick="Router.go('browse',{county:'${l.county_slug}'})"> ${escHtml(l.county_name)}</span>
      ${l.area_name ? `<i class="ti ti-chevron-right" style="font-size:11px;color:var(--text-3)"></i><span onclick="Router.go('browse',{county:'${l.county_slug}',area_id:'${l.area_id}'})">${escHtml(l.area_name)}</span>` : ''}
      <i class="ti ti-chevron-right" style="font-size:11px;color:var(--text-3)"></i>
      <span style="color:var(--text-2);cursor:default">${typeLabel(l.property_type)}</span>
    </div>
    <div style="max-width:1280px;margin:0 auto">
      <div class="detail-layout">
        <div class="detail-main">
          <div class="media-gallery">
            <div class="gallery-main" id="gallery-main">${galleryMain}</div>
            ${thumbs ? `<div class="gallery-thumbs">${thumbs}</div>` : ''}
          </div>
          <h1 class="detail-title">${escHtml(l.title)}</h1>
          <div class="detail-loc"><i class="ti ti-map-pin"></i>${l.street_address?escHtml(l.street_address)+' · ':''}${l.area_name?escHtml(l.area_name)+' · ':''}${escHtml(l.county_name)}</div>
          <div class="detail-tags">
            <span class="dtag">${typeLabel(l.property_type)}</span>
            ${l.floor?`<span class="dtag">${escHtml(l.floor)} floor</span>`:''}
            <span class="dtag green">Available now</span>
            <span class="dtag">${l.views} views</span>
          </div>
          <div class="detail-price">${formatPrice(l.monthly_rent)} <small>/month</small></div>
          <div class="deposit-note">Deposit: ${formatPrice(l.monthly_rent * l.deposit_months)} (${l.deposit_months} months)</div>
          ${l.review_count > 0 ? `<div class="detail-rating">${starsHtml(l.average_rating, l.review_count)}</div>` : ''}

          ${l.description?`<div class="panel" style="margin-top:16px"><div class="panel-title"><i class="ti ti-info-circle"></i> About this property</div><p style="font-size:13px;color:var(--text-2);line-height:1.7">${escHtml(l.description)}</p></div>`:''}

          <div class="panel">
            <div class="panel-title"><i class="ti ti-list-check"></i> Amenities & services</div>
            <div class="amenity-grid">
              ${amenities.map(([k,label])=>`<div class="amenity-item"><i class="ti ${l[k]?'ti-check yes':'ti-x no'}"></i><span>${label}</span></div>`).join('')}
            </div>
          </div>

          ${nearby.length>0?`<div class="panel"><div class="panel-title"><i class="ti ti-map-2"></i> Nearby services</div><div class="nearby-grid">${nearby.map(([,icon,label])=>`<div class="nearby-item"><i class="ti ${icon}"></i><span>${label}</span></div>`).join('')}</div></div>`:''}

          <div class="panel"><div class="panel-title"><i class="ti ti-map"></i> Location</div><div class="map-box"><i class="ti ti-map-pin"></i><span>${l.area_name?escHtml(l.area_name)+', ':''} ${escHtml(l.county_name)}</span></div><p style="font-size:11px;color:var(--text-3);margin-top:6px">Exact address revealed after unlocking contact.</p></div>

          <div class="panel">
            <div class="panel-title"><i class="ti ti-star"></i> Reviews (${l.review_count})</div>
            ${reviews.length > 0
              ? reviews.map(rv=>`<div class="review-card"><div class="review-header"><span class="reviewer-name">${escHtml(rv.reviewer_name||'Tenant')}</span><span class="review-stars">${'★'.repeat(rv.rating)}${'☆'.repeat(5-rv.rating)}</span></div><div class="review-date">${timeAgo(rv.created_at)}</div>${rv.comment?`<div class="review-comment">${escHtml(rv.comment)}</div>`:''}</div>`).join('')
              : `<p style="font-size:13px;color:var(--text-3)">No reviews yet. Unlock this listing and be the first to review!</p>`}
          </div>
        </div>
        <div class="detail-sidebar">
          ${sidebarContact}
          <div class="panel">
            <div style="font-size:12px;color:var(--text-2)">
              ${[['Property type',typeLabel(l.property_type)],['Monthly rent',`<span class="text-orange">${formatPrice(l.monthly_rent)}</span>`],['Deposit',`${l.deposit_months} month${l.deposit_months>1?'s':''}`],['County',escHtml(l.county_name)],l.area_name?['Area',escHtml(l.area_name)]:null,['Listed',timeAgo(l.created_at)]].filter(Boolean).map(([k,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${k}</span><strong>${v}</strong></div>`).join('')}
            </div>
          </div>
          <button class="btn-ghost btn-block mt-8" onclick="Router.go('browse',{county:'${l.county_slug}'})"><i class="ti ti-arrow-left"></i> More in ${escHtml(l.county_name)}</button>
        </div>
      </div>
    </div>
    ${footerHTML()}`;

    window.setGalleryImg   = (url, thumb) => { el('gallery-main').innerHTML = `<img src="${url}" alt="Photo" id="gallery-main-img"/>`; document.querySelectorAll('.gallery-thumb').forEach(t=>t.classList.remove('active')); thumb.classList.add('active'); };
    window.setGalleryVideo = (url, thumb) => { el('gallery-main').innerHTML = `<video src="${url}" controls style="width:100%;height:100%;object-fit:cover"></video>`; document.querySelectorAll('.gallery-thumb').forEach(t=>t.classList.remove('active')); thumb.classList.add('active'); };
  }

  /* ══════════════════════════════════════════════
     LANDLORD DASHBOARD
  ══════════════════════════════════════════════ */
  async function dashboard() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    if (user.role !== 'landlord' && !user.is_admin) {
      app().innerHTML = emptyState('ti-lock','Landlord account required','Register as a landlord to access the dashboard.','Sign up as landlord',"openModal('register-modal')");
      return;
    }
    loading();
    const r = await API.landlordListings();
    if (!r.ok) { app().innerHTML = emptyState('ti-alert-circle','Error',r.data.error||'Failed to load.','Retry',"Router.go('dashboard')"); return; }
    const { listings, stats } = r.data;
    const s = stats || {};

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('dashboard', user)}
      <div class="dash-content">
        <div class="dash-header-section">
          <h2>Welcome, ${escHtml((user.full_name||'').split(' ')[0])}</h2>
          <p>Manage your listings and track performance</p>
        </div>
        <div class="metrics-row">
          <div class="metric-card"><strong>${s.active||0}</strong><span>Active listings</span></div>
          <div class="metric-card"><strong>${s.pending||0}</strong><span>Pending</span></div>
          <div class="metric-card"><strong>${Number(s.total_views||0).toLocaleString()}</strong><span>Total views</span></div>
          <div class="metric-card"><strong>${Number(s.total_unlocks||0).toLocaleString()}</strong><span>Unlocks</span></div>
        </div>
        <button class="btn-primary btn-block" style="margin-bottom:20px" onclick="Router.go('add-listing')"><i class="ti ti-plus"></i> Add new listing</button>
        <div class="panel">
          <div class="panel-title"><i class="ti ti-list"></i> My listings</div>
          ${listings.length === 0
            ? `<p style="font-size:13px;color:var(--text-3);text-align:center;padding:20px 0">No listings yet. Add your first one above!</p>`
            : listings.map(l=>`
              <div class="listing-row">
                <div class="lr-thumb"><i class="ti ti-building"></i></div>
                <div class="lr-info">
                  <h4>${escHtml(l.title)}</h4>
                  <p>${escHtml(l.county_name)}${l.area_name?' · '+escHtml(l.area_name):''} · ${formatPrice(l.monthly_rent)}/mo · ${l.photo_count||0} photo${l.photo_count!==1?'s':''}</p>
                </div>
                <span class="status-badge status-${l.status}">${l.status.charAt(0).toUpperCase()+l.status.slice(1)}</span>
                <div class="lr-actions">
                  <button class="btn-ghost btn-xs" onclick="Router.go('listing',{id:'${l.id}'})"><i class="ti ti-eye"></i> View</button>
                  <button class="btn-ghost btn-xs" onclick="Router.go('edit-listing',{id:'${l.id}'})"><i class="ti ti-edit"></i> Edit</button>
                  <button class="btn-danger btn-xs" onclick="confirmDeleteListing('${l.id}')"><i class="ti ti-trash"></i> Delete</button>
                </div>
              </div>`).join('')}
        </div>
      </div>
    </div>`;

    window.confirmDeleteListing = async id => {
      if (!confirm('Delete this listing? This cannot be undone.')) return;
      const r = await API.deleteListing(id);
      if (r.ok) { showToast('Listing deleted.','success'); Router.go('dashboard'); }
      else showToast(r.data.error||'Delete failed.','error');
    };
  }

  /* ══════════════════════════════════════════════
     ADD LISTING
  ══════════════════════════════════════════════ */
  async function addListing() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    if (user.role !== 'landlord' && !user.is_admin) { showToast('You need a landlord account.','info'); return; }
    loading();
    const countiesR = await API.counties();
    const counties  = countiesR.ok ? countiesR.data : [];
    let uploadedMedia = [];

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('add-listing', user)}
      <div class="dash-content">
        <div class="page-header">
          <button class="back-btn" onclick="Router.go('dashboard')"><i class="ti ti-arrow-left"></i> Back</button>
          <h1>Add new listing</h1>
        </div>
        <form id="add-listing-form" onsubmit="submitAddListing(event)" style="margin-top:16px">
          <div class="form-panel">
            <div class="form-panel-title"><i class="ti ti-map-pin"></i> Location</div>
            <div class="form-group"><label>County *</label>
              <select id="fl-county" required onchange="loadAreas(this.value)">
                <option value="">Select county…</option>
                ${counties.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group hidden" id="area-group"><label>Area / estate</label>
              <select id="fl-area"><option value="">Select area…</option></select>
            </div>
            <div class="form-group"><label>Street address / estate name</label>
              <input type="text" id="fl-street" placeholder="e.g. Phase 2, Road B, near Total petrol station"/>
            </div>
          </div>
          <div class="form-panel">
            <div class="form-panel-title"><i class="ti ti-home"></i> Property details</div>
            <div class="form-group"><label>Listing title *</label>
              <input type="text" id="fl-title" placeholder="e.g. Modern 1 bedroom apartment in Kasarani" required/>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Property type *</label>
                <select id="fl-type" required>
                  <option value="">Select type…</option>
                  <option value="bedsitter">Bedsitter</option><option value="studio">Studio</option>
                  <option value="1_bedroom">1 Bedroom</option><option value="2_bedroom">2 Bedroom</option>
                  <option value="3_bedroom">3 Bedroom</option><option value="4_bedroom">4 Bedroom</option>
                  <option value="bungalow">Bungalow</option><option value="maisonette">Maisonette</option>
                  <option value="townhouse">Townhouse</option><option value="apartment">Apartment</option>
                </select>
              </div>
              <div class="form-group"><label>Floor</label>
                <select id="fl-floor">
                  <option value="">Any</option><option value="Ground">Ground floor</option>
                  <option value="1st">1st floor</option><option value="2nd">2nd floor</option>
                  <option value="3rd">3rd floor</option><option value="4th+">4th floor+</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Monthly rent (Ksh) *</label>
                <input type="number" id="fl-rent" placeholder="e.g. 14000" min="500" required/>
              </div>
              <div class="form-group"><label>Deposit (months)</label>
                <select id="fl-deposit"><option value="1">1 month</option><option value="2" selected>2 months</option><option value="3">3 months</option></select>
              </div>
            </div>
            <div class="form-group"><label>Description</label>
              <textarea id="fl-desc" rows="4" placeholder="Describe the property — size, condition, nearby landmarks…"></textarea>
            </div>
          </div>
          <div class="form-panel">
            <div class="form-panel-title"><i class="ti ti-list-check"></i> Amenities & services</div>
            <div class="check-grid">
              ${[['has_water','Running water'],['has_borehole','Borehole water'],['has_security','24hr security'],['has_cctv','CCTV cameras'],['has_parking','Vehicle parking'],['has_wifi','WiFi included'],['has_electricity_token','Electricity (token)'],['has_generator','Generator backup'],['is_furnished','Furnished'],['has_dsq','DSQ'],['has_garbage','Garbage collection'],['has_caretaker','Caretaker on-site'],['has_gym','Gym'],['has_pool','Swimming pool'],['has_playground','Children playground'],['is_pet_friendly','Pet-friendly'],['has_balcony','Balcony'],['has_lift','Lift / elevator']].map(([k,l])=>`<label class="chk-item"><input type="checkbox" name="${k}"/> ${l}</label>`).join('')}
            </div>
          </div>
          <div class="form-panel">
            <div class="form-panel-title"><i class="ti ti-map-2"></i> Nearby services</div>
            <div class="check-grid">
              ${[['near_school','School nearby'],['near_hospital','Hospital / clinic'],['near_market','Market / supermarket'],['near_matatu','Matatu stage'],['near_church','Place of worship'],['near_water_kiosk','Water kiosk']].map(([k,l])=>`<label class="chk-item"><input type="checkbox" name="${k}"/> ${l}</label>`).join('')}
            </div>
          </div>
          <div class="form-panel">
            <div class="form-panel-title"><i class="ti ti-photo"></i> Photos & videos</div>
            <div class="upload-box" onclick="el('photo-input').click()">
              <i class="ti ti-camera"></i><p>Tap to upload photos</p><small>JPEG, PNG · Up to 10 photos · Max 10MB each</small>
              <input type="file" id="photo-input" accept="image/*" multiple style="display:none" onchange="addMedia(this,'photo')"/>
            </div>
            <div class="upload-box mt-8" onclick="el('video-input').click()">
              <i class="ti ti-video"></i><p>Tap to upload a video walkthrough</p><small>MP4 · Max 50MB</small>
              <input type="file" id="video-input" accept="video/*" style="display:none" onchange="addMedia(this,'video')"/>
            </div>
            <div class="media-preview-grid" id="media-previews"></div>
          </div>
          <div id="add-listing-error" class="form-error hidden"></div>
          <button type="submit" class="btn-primary btn-block" id="submit-listing-btn"><i class="ti ti-check"></i> Publish listing</button>
          <button type="button" class="btn-ghost btn-block mt-8" onclick="Router.go('dashboard')"><i class="ti ti-arrow-left"></i> Cancel</button>
        </form>
      </div>
    </div>`;

    window.loadAreas = async cid => {
      const ag = el('area-group'), as_ = el('fl-area');
      if (!cid) { ag && ag.classList.add('hidden'); return; }
      ag && ag.classList.remove('hidden');
      as_.innerHTML = '<option value="">Loading…</option>';
      const r = await API.areas(cid);
      as_.innerHTML = '<option value="">Select area…</option>';
      if (r.ok) r.data.forEach(a => { as_.innerHTML += `<option value="${a.id}">${escHtml(a.name)}</option>`; });
    };
    window.addMedia = (input, type) => {
      Array.from(input.files).forEach(file => {
        uploadedMedia.push({ file, type });
        const url = URL.createObjectURL(file);
        const idx = uploadedMedia.length - 1;
        const prev = el('media-previews');
        const div = document.createElement('div');
        div.className = 'media-preview-item';
        div.innerHTML = type === 'photo' ? `<img src="${url}" alt="preview"/>` : `<video src="${url}" style="pointer-events:none"></video>`;
        const rm = document.createElement('button');
        rm.type = 'button'; rm.innerHTML = '✕';
        rm.onclick = () => { uploadedMedia.splice(idx, 1); div.remove(); };
        div.appendChild(rm); prev.appendChild(div);
      });
      input.value = '';
    };
    window.submitAddListing = async e => {
      e.preventDefault();
      const errEl = el('add-listing-error');
      const btn   = el('submit-listing-btn');
      hideEl(errEl);
      const countyId = el('fl-county').value;
      const title    = el('fl-title').value.trim();
      const type     = el('fl-type').value;
      const rent     = el('fl-rent').value;
      if (!countyId || !title || !type || !rent) { showEl(errEl); errEl.textContent = 'Please fill in all required fields.'; return; }
      const payload = { county_id:countyId, area_id:el('fl-area').value||null, street_address:el('fl-street').value.trim(), title, property_type:type, floor:el('fl-floor').value, monthly_rent:parseInt(rent), deposit_months:parseInt(el('fl-deposit').value), description:el('fl-desc').value.trim() };
      document.querySelectorAll('#add-listing-form input[type="checkbox"]').forEach(cb => { payload[cb.name] = cb.checked; });
      setLoading(btn, true);
      const r = await API.createListing(payload);
      if (!r.ok) { setLoading(btn, false); showEl(errEl); errEl.textContent = r.data.error||'Failed to create listing.'; return; }
      const lid = r.data.listing_id;
      for (const m of uploadedMedia) { const fd = new FormData(); fd.append('file',m.file); fd.append('media_type',m.type); await API.uploadMedia(lid, fd); }
      setLoading(btn, false);
      showToast('Listing published successfully!', 'success');
      Router.go('listing', { id: lid });
    };
  }

  /* ══════════════════════════════════════════════
     EDIT LISTING
  ══════════════════════════════════════════════ */
  async function editListing(id) {
    const user = Auth.current();
    if (!user || (user.role !== 'landlord' && !user.is_admin)) { Router.go('dashboard'); return; }
    loading();
    const r = await API.listing(id);
    if (!r.ok) { showToast('Listing not found.','error'); Router.go('dashboard'); return; }
    const l = r.data.listing;

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('dashboard', user)}
      <div class="dash-content">
        <div class="page-header">
          <button class="back-btn" onclick="Router.go('dashboard')"><i class="ti ti-arrow-left"></i> Back</button>
          <h1>Edit listing</h1>
        </div>
        <form id="edit-form" onsubmit="submitEdit(event,'${id}')" style="margin-top:16px">
          <div class="form-panel">
            <div class="form-panel-title"><i class="ti ti-home"></i> Property details</div>
            <div class="form-group"><label>Listing title *</label><input type="text" id="el-title" value="${escHtml(l.title)}" required/></div>
            <div class="form-row">
              <div class="form-group"><label>Monthly rent (Ksh) *</label><input type="number" id="el-rent" value="${l.monthly_rent}" required/></div>
              <div class="form-group"><label>Status</label>
                <select id="el-status">
                  <option value="active" ${l.status==='active'?'selected':''}>Active</option>
                  <option value="inactive" ${l.status==='inactive'?'selected':''}>Inactive</option>
                </select>
              </div>
            </div>
            <div class="form-group"><label>Description</label><textarea id="el-desc" rows="4">${escHtml(l.description||'')}</textarea></div>
          </div>
          <div class="form-panel">
            <div class="form-panel-title"><i class="ti ti-list-check"></i> Amenities & nearby</div>
            <div class="check-grid">
              ${[['has_water','Running water'],['has_borehole','Borehole'],['has_security','24hr security'],['has_cctv','CCTV'],['has_parking','Parking'],['has_wifi','WiFi'],['has_electricity_token','Electricity token'],['has_generator','Generator'],['is_furnished','Furnished'],['has_dsq','DSQ'],['has_garbage','Garbage collection'],['has_caretaker','Caretaker'],['has_gym','Gym'],['has_pool','Pool'],['has_playground','Playground'],['is_pet_friendly','Pet-friendly'],['has_balcony','Balcony'],['has_lift','Lift'],['near_school','Near school'],['near_hospital','Near hospital'],['near_market','Near market'],['near_matatu','Near matatu'],['near_church','Near church'],['near_water_kiosk','Water kiosk']].map(([k,lb])=>`<label class="chk-item"><input type="checkbox" name="${k}" ${l[k]?'checked':''}/> ${lb}</label>`).join('')}
            </div>
          </div>
          <div id="edit-error" class="form-error hidden"></div>
          <button type="submit" class="btn-primary btn-block" id="edit-btn"><i class="ti ti-check"></i> Save changes</button>
          <button type="button" class="btn-ghost btn-block mt-8" onclick="Router.go('listing',{id:'${id}'})"><i class="ti ti-eye"></i> View listing</button>
          <button type="button" class="btn-ghost btn-block mt-8" onclick="Router.go('dashboard')"><i class="ti ti-arrow-left"></i> Back to dashboard</button>
        </form>
      </div>
    </div>`;

    window.submitEdit = async (e, lid) => {
      e.preventDefault();
      const errEl = el('edit-error'); const btn = el('edit-btn'); hideEl(errEl);
      const payload = { title:el('el-title').value.trim(), monthly_rent:parseInt(el('el-rent').value), description:el('el-desc').value.trim(), status:el('el-status').value };
      document.querySelectorAll('#edit-form input[type="checkbox"]').forEach(cb => { payload[cb.name] = cb.checked; });
      setLoading(btn, true);
      const r = await API.updateListing(lid, payload);
      setLoading(btn, false);
      if (r.ok) { showToast('Listing updated.','success'); Router.go('listing',{id:lid}); }
      else { showEl(errEl); errEl.textContent = r.data.error||'Update failed.'; }
    };
  }

  /* ══════════════════════════════════════════════
     MY UNLOCKS
  ══════════════════════════════════════════════ */
  async function unlocks() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    loading();
    const r    = await API.myUnlocks();
    const data = r.ok ? r.data : [];

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('unlocks', user)}
      <div class="dash-content">
        <div class="page-header">
          <button class="back-btn" onclick="Router.go('home')"><i class="ti ti-arrow-left"></i> Back</button>
          <h1>My unlocked houses</h1>
        </div>
        <p style="font-size:13px;color:var(--text-2);margin:12px 0 20px">Houses whose landlord contacts you have already paid to unlock.</p>
        ${data.length === 0
          ? emptyState('ti-key-off','No unlocked houses yet','Browse listings and unlock the ones you like.','Browse listings',"Router.go('browse')")
          : data.map(u=>`
            <div class="unlock-card">
              <div class="unlock-card-icon"><i class="ti ti-building"></i></div>
              <div class="unlock-card-info">
                <h4>${escHtml(u.title)}</h4>
                <p>${escHtml(u.county_name)}${u.area_name?' · '+escHtml(u.area_name):''} · ${formatPrice(u.monthly_rent)}/mo · ${typeLabel(u.property_type)}</p>
                <p style="font-size:11px;color:var(--text-3);margin-top:2px">Unlocked ${timeAgo(u.completed_at)}</p>
              </div>
              <button class="btn-primary btn-sm" onclick="Router.go('listing',{id:'${u.listing_id}'})"><i class="ti ti-eye"></i> View</button>
            </div>`).join('')}
      </div>
    </div>`;
  }

  /* ══════════════════════════════════════════════
     PROFILE
  ══════════════════════════════════════════════ */
  async function profile() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); return; }
    loading();
    const r = await API.me();
    const u = r.ok ? r.data : user;

    // Pre-compute values to avoid nested template literal issues
    const avatarClass   = u.is_admin ? 'profile-avatar admin' : 'profile-avatar';
    const avatarLetter  = (u.full_name || u.email || 'U').charAt(0).toUpperCase();
    const badgeClass    = u.is_admin ? 'profile-badge admin-badge' : 'profile-badge';
    const badgeIcon     = u.is_admin ? 'ti-shield' : (u.role === 'landlord' ? 'ti-key' : 'ti-user');
    const badgeLabel    = u.is_admin ? 'Admin' : (u.role === 'landlord' ? 'Landlord' : 'Tenant');
    const accountType   = u.is_admin ? 'Admin' : (u.role === 'landlord' ? 'Landlord' : 'Tenant');
    const phoneRow      = u.phone     ? `<p><i class="ti ti-phone" style="font-size:13px;vertical-align:-2px"></i> ${escHtml(u.phone)}</p>` : '';
    const idRow         = u.id_number ? `<p><i class="ti ti-id" style="font-size:13px;vertical-align:-2px"></i> ID: ${escHtml(u.id_number)}</p>` : '';
    const locationRow   = u.location  ? `<p><i class="ti ti-map-pin" style="font-size:13px;vertical-align:-2px"></i> ${escHtml(u.location)}</p>` : '';

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('profile', user)}
      <div class="dash-content">
        <div class="page-header">
          <button class="back-btn" onclick="history.back()"><i class="ti ti-arrow-left"></i> Back</button>
          <h1>My profile</h1>
        </div>
        <div class="profile-info-card" style="margin-top:16px">
          <div class="${avatarClass}">${avatarLetter}</div>
          <div class="profile-meta">
            <h3>${escHtml(u.full_name || '')}</h3>
            <p><i class="ti ti-mail" style="font-size:13px;vertical-align:-2px"></i> ${escHtml(u.email || '')}</p>
            ${phoneRow}
            ${idRow}
            ${locationRow}
            <span class="${badgeClass}"><i class="ti ${badgeIcon}"></i> ${badgeLabel}</span>
          </div>
        </div>
        <div class="form-panel">
          <div class="form-panel-title"><i class="ti ti-edit"></i> Edit profile</div>
          <div class="form-group"><label>Full name</label><input type="text" id="p-name" value="${escHtml(u.full_name||'')}"/></div>
          <div class="form-group"><label>Phone number (M-Pesa)</label><input type="tel" id="p-phone" value="${escHtml(u.phone||'')}" placeholder="07XX XXX XXX"/></div>
          <div class="form-group"><label>ID / Passport number</label><input type="text" id="p-idnumber" value="${escHtml(u.id_number||'')}"/></div>
          <div class="form-group"><label>Location / Town</label><input type="text" id="p-location" value="${escHtml(u.location||'')}" placeholder="e.g. Nairobi, Kasarani"/></div>
          <div class="form-group"><label>Email address</label><input type="email" value="${escHtml(u.email||'')}" disabled style="opacity:0.6"/></div>
          <div class="form-group"><label>Account type</label><input type="text" value="${accountType}" disabled style="opacity:0.6"/></div>
          <div id="profile-error" class="form-error hidden"></div>
          <div id="profile-success" class="form-success hidden">Profile updated successfully.</div>
          <button class="btn-primary btn-block" id="save-profile-btn" onclick="saveProfile()"><i class="ti ti-check"></i> Save changes</button>
        </div>
      </div>
    </div>`;

    window.saveProfile = async () => {
      const btn = el('save-profile-btn'); const errEl = el('profile-error'); const sucEl = el('profile-success');
      hideEl(errEl); hideEl(sucEl);
      setLoading(btn, true);
      const r = await API.updateProfile({ full_name:el('p-name').value.trim(), phone:el('p-phone').value.trim(), id_number:el('p-idnumber').value.trim(), location:el('p-location').value.trim() });
      setLoading(btn, false);
      if (r.ok) { showEl(sucEl); await Auth.restoreSession(); }
      else { showEl(errEl); errEl.textContent = r.data.error||'Update failed.'; }
    };
  }

  /* ══════════════════════════════════════════════
     ADMIN PANEL
  ══════════════════════════════════════════════ */
  async function admin() {
    const user = Auth.current();
    if (!user || !user.is_admin) { showToast('Admin access required.','error'); Router.go('home'); return; }
    loading();
    const [statsR, listingsR, landlordsR] = await Promise.all([
      API.adminStats(), API.adminListings(), API.adminLandlords()
    ]);
    const stats     = statsR.ok     ? statsR.data     : {};
    const listings  = listingsR.ok  ? listingsR.data  : [];
    const landlords = landlordsR.ok ? landlordsR.data : [];
    let activeTab   = 'listings';

    function adminListingRow(l) {
      var area      = l.area_name ? ' &middot; ' + escHtml(l.area_name) : '';
      var statusCls = 'status-badge status-' + l.status;
      return '<div class="admin-listing-row">'
        + '<div class="lr-thumb"><i class="ti ti-building"></i></div>'
        + '<div class="lr-info" style="flex:1">'
        +   '<h4>' + escHtml(l.title) + '</h4>'
        +   '<p>' + escHtml(l.county_name) + area + ' &middot; ' + formatPrice(l.monthly_rent) + '/mo</p>'
        +   '<p style="font-size:11px;color:var(--text-3)">By: ' + escHtml(l.landlord_name || '') + ' &middot; ' + escHtml(l.landlord_phone || '') + ' &middot; ' + l.views + ' views &middot; ' + l.unlock_count + ' unlocks</p>'
        + '</div>'
        + '<span class="' + statusCls + '">' + l.status + '</span>'
        + '<div class="lr-actions">'
        +   '<button class="btn-ghost btn-xs" onclick="Router.go(\'listing\',{id:\'' + l.id + '\'})"><i class="ti ti-eye"></i> View</button>'
        +   '<button class="btn-danger btn-xs" onclick="adminDeleteListing(\'' + l.id + '\')"><i class="ti ti-trash"></i> Delete</button>'
        + '</div>'
        + '</div>';
    }

    function adminLandlordCard(l) {
      var initial  = (l.full_name || l.email || 'L').charAt(0).toUpperCase();
      var plural   = l.listing_count !== 1 ? 's' : '';
      var phoneHtml    = l.phone     ? '<div class="admin-contact-row"><i class="ti ti-phone"></i> ' + escHtml(l.phone) + '</div>' : '';
      var idHtml       = l.id_number ? '<div class="admin-contact-row"><i class="ti ti-id"></i> ID: ' + escHtml(l.id_number) + '</div>' : '';
      var locationHtml = l.location  ? '<div class="admin-contact-row"><i class="ti ti-map-pin"></i> ' + escHtml(l.location) + '</div>' : '';
      return '<div class="admin-landlord-card">'
        + '<div class="admin-landlord-header">'
        +   '<div class="admin-landlord-avatar">' + initial + '</div>'
        +   '<div class="admin-landlord-info" style="flex:1">'
        +     '<h4>' + escHtml(l.full_name || 'Unknown') + '</h4>'
        +     '<p>' + l.listing_count + ' listing' + plural + ' &middot; ' + l.total_views + ' views &middot; ' + l.total_unlocks + ' unlocks</p>'
        +   '</div>'
        +   '<span class="status-badge status-active">Landlord</span>'
        + '</div>'
        + '<div class="admin-contact-row"><i class="ti ti-mail"></i> ' + escHtml(l.email || '') + '</div>'
        + phoneHtml
        + idHtml
        + locationHtml
        + '<p style="font-size:11px;color:var(--text-3);margin-top:6px">Joined ' + timeAgo(l.created_at) + '</p>'
        + '</div>';
    }

    function renderTab() {
      var tc = el('admin-tab-content');
      if (!tc) return;
      if (activeTab === 'listings') {
        if (listings.length === 0) {
          tc.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:20px 0;text-align:center">No listings yet.</p>';
        } else {
          tc.innerHTML = listings.map(adminListingRow).join('');
        }
      } else {
        if (landlords.length === 0) {
          tc.innerHTML = '<p style="color:var(--text-3);font-size:13px;padding:20px 0;text-align:center">No landlords registered yet.</p>';
        } else {
          tc.innerHTML = landlords.map(adminLandlordCard).join('');
        }
      }
    }

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('admin', user)}
      <div class="dash-content">
        <div class="page-header">
          <h1><i class="ti ti-shield" style="color:var(--orange)"></i> Admin panel</h1>
        </div>
        <div class="admin-stats" style="margin-top:16px">
          <div class="admin-stat"><strong>${stats.active_listings||0}</strong><span>Active listings</span></div>
          <div class="admin-stat"><strong>${stats.total_listings||0}</strong><span>Total listings</span></div>
          <div class="admin-stat"><strong>${stats.landlords||0}</strong><span>Landlords</span></div>
          <div class="admin-stat"><strong>${stats.tenants||0}</strong><span>Tenants</span></div>
          <div class="admin-stat"><strong>${stats.total_unlocks||0}</strong><span>Total unlocks</span></div>
        </div>
        <div class="admin-tabs">
          <button class="admin-tab active" id="tab-listings" onclick="switchAdminTab('listings')"><i class="ti ti-building"></i> All listings (${listings.length})</button>
          <button class="admin-tab" id="tab-landlords" onclick="switchAdminTab('landlords')"><i class="ti ti-users"></i> Landlords (${landlords.length})</button>
        </div>
        <div id="admin-tab-content"></div>
      </div>
    </div>`;

    window.switchAdminTab = tab => {
      activeTab = tab;
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      el(`tab-${tab}`) && el(`tab-${tab}`).classList.add('active');
      renderTab();
    };
    window.adminDeleteListing = async id => {
      if (!confirm('Delete this listing permanently?')) return;
      const r = await API.deleteListing(id);
      if (r.ok) { showToast('Listing deleted.','success'); Router.go('admin'); }
      else showToast(r.data.error||'Delete failed.','error');
    };
    renderTab();
  }

  function scrollToHow() {
    Router.go('home');
    setTimeout(() => {
      const howEl = document.getElementById('how-it-works');
      if (howEl) howEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 500);
  }

  return { home, browse, counties, listing, dashboard, addListing, editListing, unlocks, profile, admin, scrollToHow };
})();