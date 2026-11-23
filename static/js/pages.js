/* pages.js — All page renderers */
const Pages = (() => {
  const app = () => document.getElementById('app');

  const PROPERTY_TYPES = [
    ['bedsitter','Bedsitter'],['studio','Studio'],['1_bedroom','1 bedroom'],['2_bedroom','2 bedroom'],
    ['3_bedroom','3 bedroom'],['4_bedroom','4 bedroom'],['bungalow','Bungalow'],['maisonette','Maisonette'],
    ['townhouse','Townhouse'],['apartment','Apartment']
  ];
  const AMENITIES = [
    ['has_water','Running water','ti-droplet'],['has_borehole','Borehole','ti-droplet'],
    ['has_security','24-hour security','ti-shield-check'],['has_cctv','CCTV','ti-video'],
    ['has_parking','Parking','ti-car'],['has_wifi','WiFi included','ti-wifi'],
    ['has_electricity_token','Token electricity','ti-bolt'],['has_generator','Backup generator','ti-bolt'],
    ['is_furnished','Furnished','ti-armchair'],['has_dsq','DSQ','ti-home'],
    ['has_garbage','Garbage collection','ti-trash'],['has_caretaker','Caretaker on site','ti-user-check'],
    ['has_gym','Gym','ti-barbell'],['has_pool','Swimming pool','ti-pool'],
    ['has_playground','Playground','ti-mood-kid'],['is_pet_friendly','Pets allowed','ti-paw'],
    ['has_balcony','Balcony','ti-building'],['has_lift','Lift','ti-elevator'],
  ];
  const NEARBY = [
    ['near_school','School','ti-school'],['near_hospital','Hospital or clinic','ti-building-hospital'],
    ['near_market','Market or supermarket','ti-shopping-cart'],['near_matatu','Matatu stage','ti-bus'],
    ['near_church','Place of worship','ti-building-church'],['near_water_kiosk','Water kiosk','ti-droplet'],
  ];
  const AMENITY_FILTERS = [['','Any'],['water=true','Water'],['parking=true','Parking'],['wifi=true','WiFi'],
    ['security=true','Security'],['furnished=true','Furnished'],['dsq=true','DSQ'],['gym=true','Gym'],
    ['cctv=true','CCTV'],['borehole=true','Borehole'],['generator=true','Generator'],
    ['pet_friendly=true','Pets allowed'],['pool=true','Pool']];

  const STATUS_LABEL = { active:'Live', pending:'In review', inactive:'Hidden', let:'Let', archived:'Archived', rejected:'Rejected' };
  const statusLabel = st => STATUS_LABEL[st] || escHtml(st);
  function hiddenReason(l) {
    if (l.status !== 'inactive') return '';
    if (l.auto_hidden_reason === 'reported') return 'Hidden because tenants reported it taken. Confirm it\'s available to bring it back.';
    if (l.auto_hidden_reason === 'not_confirmed') return 'Hidden because it wasn\'t confirmed for over 30 days.';
    return '';
  }

  function typeOptions(selected = '', anyLabel = 'Any type') {
    return `<option value="">${anyLabel}</option>` +
      PROPERTY_TYPES.map(([v,l]) => `<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('');
  }

  function loading() {
    app().classList.remove('has-book-bar');
    app().innerHTML = `<div class="loading-state"><span class="spinner"></span><span>Loading…</span></div>`;
  }

  function skeletonGrid(n = 8) {
    return `<div class="cards-grid" aria-busy="true">${Array.from({length:n}).map(() =>
      `<div><div class="skel skel-img"></div><div class="skel skel-line"></div><div class="skel skel-line short"></div></div>`).join('')}</div>`;
  }

  function emptyState(icon, title, msg, btnLabel, btnAction) {
    return `<div class="empty-state">
      <i class="ti ${icon}"></i><h3>${title}</h3><p>${msg}</p>
      ${btnLabel ? `<button class="btn-primary" onclick="${btnAction}">${btnLabel}</button>` : ''}
    </div>`;
  }

  function placeLine(area, county) {
    return [area, county].filter(Boolean).map(escHtml).join(', ');
  }

  /* ── Home hero: full-width room photos that crossfade behind the text ── */
  const HERO_SLIDES = [
    // Only photos that stay sharp full-width and keep the white text easy to read.
    // [file, label, focal point, sharp on big screens?]
    ['1-sitting-room',   'Sitting room',   '50% 55%', true],
    ['2-living-room',    'Living room',    '50% 50%', true],
    ['3-reading-corner', 'Reading corner', '62% 50%', true],
  ];
  const heroSet = () => HERO_SLIDES.map((s, i) => i).filter(i => HERO_SLIDES[i][3] || window.innerWidth <= 700);

  function heroSlidesHTML() {
    const dir = '/static/img/hero-bg/';
    return HERO_SLIDES.map(([f, , pos, wide], i) => {
      // Only the first photo loads with the page; the rest load once the page is idle
      const a = i === 0 ? 'srcset' : 'data-srcset';
      return `<picture class="hero-slide ${i === 0 ? 'is-active' : ''} ${wide ? '' : 'is-small'}" data-i="${i}">
          <source media="(max-width: 700px)" type="image/avif" ${a}="${dir}${f}-m.avif"/>
          <source media="(max-width: 700px)" type="image/webp" ${a}="${dir}${f}-m.webp"/>
          <source type="image/avif" ${a}="${dir}${f}.avif"/>
          <img ${i === 0 ? `src="${dir}${f}.webp" fetchpriority="high"` : `data-src="${dir}${f}.webp"`} alt="" decoding="async" style="object-position:${pos}"/>
        </picture>`;
    }).join('');
  }

  const HeroSlider = (() => {
    let active = 0, timer = null, visible = true, io = null;
    const STEP_MS = 6000;
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function hydrate() {
      document.querySelectorAll('.hero-slide [data-srcset]').forEach(s => { s.srcset = s.dataset.srcset; s.removeAttribute('data-srcset'); });
      document.querySelectorAll('.hero-slide img[data-src]').forEach(i => { i.src = i.dataset.src; i.removeAttribute('data-src'); });
    }

    // active = position in the current set (4 photos on big screens, 6 on phones)
    function show(pos) {
      const slides = document.querySelectorAll('.hero-slide');
      const dots = document.querySelectorAll('.hero-dot');
      if (!slides.length) return stop();
      const set = heroSet();
      active = (pos + set.length) % set.length;
      const idx = set[active];
      slides.forEach(s => s.classList.toggle('is-active', +s.dataset.i === idx));
      dots.forEach(d => {
        const on = +d.dataset.i === idx;
        d.classList.remove('is-active'); d.setAttribute('aria-current', on ? 'true' : 'false');
        if (on) { void d.offsetWidth; d.classList.add('is-active'); }   // restart the progress bar
      });
      const room = el('hero-room'); if (room) room.textContent = HERO_SLIDES[idx][1];
    }

    function tick() {
      if (!el('hero')) return stop();
      if (visible && !document.hidden) show(active + 1);
    }

    function start() {
      stop(); active = 0;
      const hero = el('hero'); if (!hero) return;
      const go = () => setTimeout(hydrate, 300);
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
      document.querySelectorAll('.hero-dot').forEach(d => d.addEventListener('click', () => { show(heroSet().indexOf(+d.dataset.i)); restart(); }));
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; hero.classList.toggle('is-paused', !visible); }, { threshold: 0.15 });
        io.observe(hero);
      }
      if (reduced()) { hero.classList.add('is-still'); return; }
      show(0);
      timer = setInterval(tick, STEP_MS);
    }
    function restart() { if (timer) { clearInterval(timer); timer = setInterval(tick, STEP_MS); } }
    function stop() { if (timer) clearInterval(timer); timer = null; if (io) io.disconnect(); io = null; }
    return { start, stop };
  })();

  /* ── Shared: listing tile ── */
  function listingCard(l, showUnlocked = false) {
    const extras = [];
    if (l.has_water)    extras.push('water');
    if (l.has_security) extras.push('security');
    if (l.has_parking)  extras.push('parking');
    if (l.has_wifi)     extras.push('WiFi');
    if (l.is_furnished) extras.push('furnished');

    const imgHtml = l.cover_photo
      ? `<img src="${escHtml(l.cover_photo)}" alt="" loading="lazy" decoding="async" width="600" height="570"/>`
      : `<i class="ti ti-photo card-img-placeholder"></i>`;

    const isNew  = (Date.now() - new Date(l.created_at)) < 7 * 86400000;
    const badge  = l.is_featured
      ? `<span class="card-badge">Featured</span>`
      : isNew ? `<span class="card-badge green">New</span>` : '';

    const ratingHtml = l.review_count > 0
      ? `<div class="card-rating"><i class="ti ti-star-filled"></i>${Number(l.average_rating).toFixed(1)} <span>(${l.review_count})</span></div>` : '';

    const go = `Router.go('listing',{id:'${jsStr(l.id)}'})`;
    return `<article class="listing-card" tabindex="0" role="link" aria-label="${escHtml(l.title)}" onclick="${go}" onkeydown="if(event.key==='Enter'){${go}}">
      <div class="card-img">${imgHtml}${badge}</div>
      <div class="card-body">
        <div class="card-row"><h3 class="card-title">${escHtml(l.title)}</h3>${ratingHtml}</div>
        <div class="card-loc">${placeLine(l.area_name, l.county_name)}</div>
        <div class="card-tags">${[typeLabel(l.property_type)].concat(extras.slice(0,2)).join(', ')}</div>
        <div class="card-footer">
          <div class="card-price">${formatPrice(l.monthly_rent)}<small> a month</small></div>
        </div>
      </div>
    </article>`;
  }

  /* ── Shared: search box ── */
  function searchBoxHTML(ctx, values = {}) {
    return `<form class="search-box" id="search-box-${ctx}" role="search" onsubmit="event.preventDefault();doSearch('${ctx}')">
      <div class="search-icon"><i class="ti ti-search"></i></div>
      <div class="autocomplete-wrap">
        <label class="sr-only" for="search-input-${ctx}">Where do you want to live?</label>
        <input type="text" id="search-input-${ctx}" placeholder="Estate, town or county" value="${escHtml(values.q||'')}"
          oninput="handleSearchInput('${ctx}',this.value)" autocomplete="off"/>
        <div class="autocomplete-list hidden" id="ac-list-${ctx}"></div>
      </div>
      <label class="sr-only" for="search-type-${ctx}">House type</label>
      <select id="search-type-${ctx}">${typeOptions(values.type||'')}</select>
      <label class="sr-only" for="search-price-${ctx}">Rent</label>
      <select id="search-price-${ctx}">
        <option value="">Any rent</option>
        ${[['10000','Up to 10k'],['20000','Up to 20k'],['40000','Up to 40k'],['80000','Up to 80k']]
          .map(([v,l]) => `<option value="${v}" ${String(values.max_price||'')===v?'selected':''}>${l}</option>`).join('')}
      </select>
      <button class="search-btn" type="submit"><i class="ti ti-search"></i> Search</button>
    </form>`;
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
          <div class="ac-item" onclick="selectSuggestion('${c}','${jsStr(item.name)}','${jsStr(item.type)}','${jsStr(item.value)}')">
            <i class="ti ${item.type==='county'?'ti-map':item.type==='area'?'ti-map-pin':'ti-building'}"></i>
            ${escHtml(item.name)}<span class="ac-type">${item.type === 'listing' ? 'house' : escHtml(item.type)}</span>
          </div>`).join('');
        showEl(list);
      }, 250);
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
      if (q)     params.q         = q.trim();
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
            <a href="/" class="logo" onclick="Router.go('home');return false;" aria-label="MyNyumba home"><svg class="logo-mark" viewBox="0 0 256 256" aria-hidden="true" focusable="false"><rect width="256" height="256" rx="56" fill="#b30057"/><g fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -6)"><path d="M58 124 L128 62 L198 124"/><path d="M76 198 V166 A26 26 0 0 1 128 166 V198 M128 166 A26 26 0 0 1 180 166 V198"/></g></svg><span class="logo-word"><span class="logo-my">my</span>nyumba</span></a>
            <p>Rental houses in all 47 counties. Browse for free and pay Ksh 500 only for the landlords you want to call.</p>
          </div>
          <div class="footer-links-group">
            <h4>Find a house</h4>
            <div class="footer-links">
              <a href="/browse" onclick="Router.go('browse');return false;">Browse houses</a>
              <a href="/counties" onclick="Router.go('counties');return false;">Counties</a>
              <a href="/#how-it-works" onclick="Router.go('how');return false;">How it works</a>
              <a href="/unlocks" onclick="Router.go('unlocks');return false;">Houses you've unlocked</a>
            </div>
          </div>
          <div class="footer-links-group">
            <h4>Landlords</h4>
            <div class="footer-links">
              <a href="#" onclick="handleLandlordCTA();return false;">List your house</a>
              <a href="/dashboard" onclick="Router.go('dashboard');return false;">Landlord dashboard</a>
              <a href="#" onclick="openModal('login-modal');return false;">Log in</a>
            </div>
          </div>
          <div class="footer-links-group">
            <h4>Help</h4>
            <div class="footer-links">
              <a href="https://wa.me/254703245513" target="_blank" rel="noopener"><i class="ti ti-brand-whatsapp"></i> +254 703 245 513</a>
              <a href="mailto:michaelmalaba3634@gmail.com"><i class="ti ti-mail"></i> michaelmalaba3634@gmail.com</a>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p>© ${new Date().getFullYear()} MyNyumba</p>
          <p><a href="/privacy" onclick="Router.go('privacy');return false;">Privacy</a> &nbsp; <a href="/terms" onclick="Router.go('terms');return false;">Terms</a></p>
        </div>
      </div>
    </footer>`;
  }

  /* ── Shared: dash sidebar ── */
  function dashSidebarHTML(activePage, user) {
    const isLandlord = user && (user.role === 'landlord' || user.role === 'admin' || user.is_admin);
    const isAdmin    = user && user.is_admin;
    const link = (page, icon, label, extraActive) =>
      `<a href="${Router.pathFor(page, {})}" class="${activePage===page||extraActive?'active':''}" onclick="Router.go('${page}');return false;"><i class="ti ${icon}"></i> ${label}</a>`;
    return `<aside class="dash-sidebar">
      <div class="dash-sidebar-header">
        <h3>${escHtml((user && user.full_name) || 'Your account')}</h3>
        <p>${user && user.email ? escHtml(user.email) : ''}</p>
      </div>
      <nav class="dash-nav" aria-label="Account">
        ${isLandlord ? `
        ${link('dashboard','ti-layout-dashboard','Your listings', activePage==='edit-listing')}
        ${link('add-listing','ti-plus','Add a listing')}
        ` : ''}
        ${isAdmin ? `${link('admin','ti-shield','Admin')}` : ''}
        ${link('unlocks','ti-key','Unlocked houses')}
        ${link('profile','ti-user','Profile')}
        <hr/>
        <a href="#" onclick="Auth.logout();return false;" class="logout-link"><i class="ti ti-logout"></i> Log out</a>
      </nav>
    </aside>`;
  }

  /* ══════════════════════════════════════════════
     HOME
  ══════════════════════════════════════════════ */
  async function home() {
    app().innerHTML = `
    <section class="hero hero-bg" id="hero">
      <div class="hero-slides" aria-hidden="true">${heroSlidesHTML()}</div>
      <div class="hero-scrim" aria-hidden="true"></div>
      <div class="hero-content">
        <h1>Find a house to rent, anywhere in Kenya</h1>
        <p class="hero-sub">Look through photos, rent and what's included for free. When you find the one, pay <strong>Ksh 500</strong> by M-Pesa to get the landlord's number.</p>
        ${searchBoxHTML('home')}
        <div class="filter-tags" id="home-filters" aria-label="Quick filters">
          ${[['water=true','Water included'],['security=true','Security'],['parking=true','Parking'],['wifi=true','WiFi'],
             ['furnished=true','Furnished'],['dsq=true','DSQ'],['pet_friendly=true','Pets allowed']]
            .map(([f,l]) => `<button type="button" class="ftag" data-filter="${f}">${l}</button>`).join('')}
        </div>
        <div class="hero-stats" id="hero-stats">
          <span class="h-stat"><strong id="stat-total">&nbsp;</strong></span>
          <span class="h-stat"><strong>47</strong> counties</span>
          <span class="h-stat"><strong>Ksh 500</strong> per landlord contact</span>
        </div>
      </div>
      <div class="hero-meta">
        <span id="hero-room" aria-live="off">${HERO_SLIDES[0][1]}</span>
        <div class="hero-dots" role="group" aria-label="Background photos">
          ${HERO_SLIDES.map(([, label, , wide], i) => `<button type="button" class="hero-dot ${i === 0 ? 'is-active' : ''} ${wide ? '' : 'is-small'}" data-i="${i}" aria-label="Show ${label}" aria-current="${i === 0}"><i></i></button>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" style="padding-top:32px">
      <div class="sec-center">
        <h2>New this week</h2>
        <p>The latest houses landlords have put up. Tap one to see photos, the deposit and what's included.</p>
        <div class="counties-bar" id="home-counties"></div>
      </div>
      <div id="home-listings">${skeletonGrid(8)}</div>
      <div class="sec-more"><button class="btn-outline" onclick="Router.go('browse')">See all houses</button></div>
    </section>

    <section class="how-section" id="how-it-works">
      <h2>How MyNyumba works</h2>
      <p class="sub">No agent in the middle. You deal with the landlord yourself.</p>
      <div class="steps-grid">
        <div class="step-card"><div class="step-num">Step 1</div><h3>Search for free</h3><p>Filter by county, estate, rent and what's included. You see the photos, rent and deposit before you pay anything.</p></div>
        <div class="step-card"><div class="step-num">Step 2</div><h3>Pay Ksh 500 by M-Pesa</h3><p>Pick a house and we send an M-Pesa prompt to your phone. Enter your PIN. You pay once per house, never again for the same one.</p></div>
        <div class="step-card"><div class="step-num">Step 3</div><h3>Call the landlord</h3><p>The landlord's phone number, WhatsApp and the exact address show up straight away, so you can book a viewing.</p></div>
      </div>
      <span class="fee-note">No subscription. You only pay for the houses you want to see.</span>
    </section>

    <section class="ll-cta">
      <div class="ll-cta-inner">
        <div class="ll-text">
          <h3>Got a house to let?</h3>
          <p>Listing is free. Add photos, a short video and what's included, and tenants who are ready to move will call you directly.</p>
          <div class="ll-btns">
            <button class="btn-primary" onclick="handleLandlordCTA()">List your house</button>
            <button class="btn-outline" onclick="Router.go('dashboard')">Go to your dashboard</button>
          </div>
        </div>
      </div>
    </section>
    ${footerHTML()}`;

    HeroSlider.start();
    el('home-filters').addEventListener('click', e => {
      const tag = e.target.closest('.ftag');
      if (!tag) return;
      const [k, v] = tag.dataset.filter.split('=');
      Router.go('browse', { [k]: v });
    });
    initSearchBox('home');

    // Load data after the page shell is on screen
    const [countiesR, listingsR] = await Promise.all([
      API.counties(),
      API.listings({ sort: 'newest', per_page: 8 })
    ]);
    if (Router.current() !== 'home' && Router.current() !== 'how') return;
    const counties = countiesR.ok ? countiesR.data : [];
    const listings = listingsR.ok ? listingsR.data.listings : [];
    const total    = listingsR.ok ? listingsR.data.total : 0;
    const topCounties = [...counties].sort((a,b) => b.listing_count - a.listing_count).slice(0, 12);

    const st = el('stat-total');
    // Only show the count once it's big enough to help rather than undercut "anywhere in Kenya"
    if (st) { if (total >= 50) st.parentElement.innerHTML = `<strong>${Number(total).toLocaleString()}</strong> houses listed`; else st.parentElement.remove(); }
    const cb = el('home-counties');
    if (cb) cb.innerHTML = topCounties.filter(c => c.listing_count > 0).slice(0, 8).map(c=>`<button onclick="Router.go('browse',{county:'${jsStr(c.slug)}'})">${escHtml(c.name)}</button>`).join('')
      + `<button onclick="Router.go('counties')">All counties</button>`;
    const hl = el('home-listings');
    if (hl) hl.innerHTML = listings.length > 0
      ? `<div class="cards-grid">${listings.map(l=>listingCard(l)).join('')}</div>`
      : emptyState('ti-building','No houses listed yet','Landlords are just getting started. If you have a vacant house, you can be the first.','List your house',"handleLandlordCTA()");
  }

  function handleLandlordCTA() {
    const user = Auth.current();
    if (!user) { selectRole(document.querySelector('.role-btn[data-role="landlord"]')); openModal('register-modal'); return; }
    if (user.role !== 'landlord' && !user.is_admin) {
      showToast('Your account is set up for renting. Create a landlord account to list a house.', 'info'); return;
    }
    Router.go('add-listing');
  }
  window.handleLandlordCTA = handleLandlordCTA;

  /* ══════════════════════════════════════════════
     BROWSE
  ══════════════════════════════════════════════ */
  async function browse(initialParams = {}) {
    let activeCounty = initialParams.county || '';
    let activeArea   = initialParams.area_id || '';
    let activeSort   = initialParams.sort || 'newest';
    let activePage   = 1;
    let propType     = initialParams.type || '';
    let maxPrice     = initialParams.max_price || '';
    let searchQ      = initialParams.q || '';
    const amenityParams = {};
    ['water','security','parking','wifi','furnished','dsq','gym','cctv','borehole','generator','pet_friendly','pool'].forEach(k => {
      if (initialParams[k]) amenityParams[k] = initialParams[k];
    });
    let reqId = 0;

    function currentParams() {
      return {
        ...(searchQ      && { q: searchQ }),
        ...(activeCounty && { county: activeCounty }),
        ...(activeArea   && { area_id: activeArea }),
        ...(propType     && { type: propType }),
        ...(maxPrice     && { max_price: maxPrice }),
        ...(activeSort !== 'newest' && { sort: activeSort }),
        ...amenityParams
      };
    }

    function syncUrl() { history.replaceState({ route:'browse', params: currentParams() }, '', Router.pathFor('browse', currentParams())); }

    app().innerHTML = `
    <div class="browse-header">
      <div class="browse-header-inner">
        ${searchBoxHTML('browse', { q: searchQ, type: propType, max_price: maxPrice })}
      </div>
    </div>
    <div id="area-chips-wrap"></div>
    <div class="results-bar">
      <div>
        <h1 id="results-title">Houses for rent</h1>
        <span id="results-count">&nbsp;</span>
      </div>
      <div class="results-controls">
        <label class="sr-only" for="browse-county">County</label>
        <select class="sort-select" id="browse-county" onchange="browseSetCounty(this.value)"><option value="">All counties</option></select>
        <label class="sr-only" for="browse-sort">Sort</label>
        <select class="sort-select" id="browse-sort" onchange="browseSort(this.value)">
          ${[['newest','Newest first'],['price_asc','Lowest rent'],['price_desc','Highest rent'],['rating','Best rated'],['popular','Most unlocked']]
            .map(([v,l])=>`<option value="${v}" ${activeSort===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="amenity-filters" aria-label="Filter by what's included">
      ${AMENITY_FILTERS.map(([f,l]) => {
        const [k] = f.split('=');
        const on = f ? !!amenityParams[k] : Object.keys(amenityParams).length === 0;
        return `<button type="button" class="ftag ${on?'active':''}" onclick="browseAmenity('${f}',this)">${l}</button>`;
      }).join('')}
    </div>
    <div class="section browse-results">
      <div id="results-area">${skeletonGrid(8)}</div>
      <div id="pagination-area"></div>
    </div>
    ${footerHTML()}`;
    initSearchBox('browse');

    async function fetchAndRender() {
      const my = ++reqId;
      const ra = el('results-area');
      if (ra && !ra.querySelector('.skel')) ra.style.opacity = '0.5';
      const r = await API.listings({ ...currentParams(), page: activePage, per_page: 12 });
      if (my !== reqId) return; // a newer request has started
      if (ra) ra.style.opacity = '';
      renderResults(r.ok ? r.data : { listings: [], total: 0, pages: 1 }, r.ok);
    }

    function renderResults({ listings, total, pages }, ok = true) {
      const rc = el('results-count');
      if (rc) rc.textContent = `${Number(total).toLocaleString()} house${total !== 1 ? 's' : ''}`;
      const ra = el('results-area');
      if (!ra) return;
      ra.innerHTML = listings.length > 0
        ? `<div class="cards-grid">${listings.map(l=>listingCard(l)).join('')}</div>`
        : ok
          ? emptyState('ti-search','No houses match','Try a nearby area, a higher rent limit or fewer filters.','Clear filters',"Router.go('browse')")
          : emptyState('ti-wifi-off','Couldn\'t load houses','Check your connection and try again.','Try again',"Router.refresh()");
      const pa = el('pagination-area');
      if (!pa) return;
      if (pages <= 1) { pa.innerHTML = ''; return; }
      const nums = new Set([1, pages, activePage - 1, activePage, activePage + 1].filter(n => n >= 1 && n <= pages));
      let html = `<nav class="pagination" aria-label="Pages">
        <button class="page-btn" ${activePage===1?'disabled':''} onclick="browseSetPage(${activePage-1})" aria-label="Previous page"><i class="ti ti-chevron-left"></i></button>`;
      let last = 0;
      [...nums].sort((a,b)=>a-b).forEach(n => {
        if (n - last > 1) html += `<span class="page-gap">…</span>`;
        html += `<button class="page-btn ${n===activePage?'active':''}" onclick="browseSetPage(${n})" ${n===activePage?'aria-current="page"':''}>${n}</button>`;
        last = n;
      });
      html += `<button class="page-btn" ${activePage===pages?'disabled':''} onclick="browseSetPage(${activePage+1})" aria-label="Next page"><i class="ti ti-chevron-right"></i></button></nav>`;
      pa.innerHTML = html;
    }

    window.browseSetPage = p => { activePage = p; fetchAndRender(); window.scrollTo({ top: 0 }); };
    window.browseSort    = v => { activeSort = v; activePage = 1; syncUrl(); fetchAndRender(); };
    window.browseAmenity = (filter, tagEl) => {
      document.querySelectorAll('.amenity-filters .ftag').forEach(t => t.classList.remove('active'));
      tagEl.classList.add('active');
      Object.keys(amenityParams).forEach(k => delete amenityParams[k]);
      if (filter) { const [k,v] = filter.split('='); amenityParams[k] = v; }
      activePage = 1; syncUrl(); fetchAndRender();
    };
    window.browseSetCounty = slug => {
      Router.go('browse', { ...currentParams(), county: slug || undefined, area_id: undefined, ...(slug ? {} : {}) });
    };
    window.browseSetArea = areaId => {
      activeArea = areaId; activePage = 1;
      document.querySelectorAll('#area-chips .area-chip').forEach(c => c.classList.toggle('active', String(c.dataset.areaId) === String(areaId)));
      syncUrl(); fetchAndRender();
    };

    // Listings and counties load in parallel
    fetchAndRender();
    const countiesR = await API.counties();
    const counties  = countiesR.ok ? countiesR.data : [];
    const co = counties.find(c => c.slug === activeCounty);
    const title = el('results-title');
    if (title) title.textContent = co ? `Houses in ${co.name}` : (searchQ ? `Houses matching “${searchQ}”` : 'Houses for rent');
    const cs = el('browse-county');
    if (cs) cs.innerHTML = `<option value="">All counties</option>` +
      [...counties].sort((a,b) => a.name.localeCompare(b.name))
        .map(c=>`<option value="${escHtml(c.slug)}" ${activeCounty===c.slug?'selected':''}>${escHtml(c.name)}${c.listing_count ? ` (${c.listing_count})` : ''}</option>`).join('');
    if (co) {
      const ar = await API.areas(co.id);
      const areas = ar.ok ? ar.data : [];
      const wrap = el('area-chips-wrap');
      if (wrap && areas.length) wrap.innerHTML = `<div class="area-chips" id="area-chips">
          <button type="button" class="area-chip ${!activeArea?'active':''}" data-area-id="" onclick="browseSetArea('')">All of ${escHtml(co.name)}</button>
          ${areas.map(a=>`<button type="button" class="area-chip ${String(activeArea)===String(a.id)?'active':''}" data-area-id="${escHtml(a.id)}" onclick="browseSetArea('${jsStr(a.id)}')">${escHtml(a.name)}</button>`).join('')}
        </div>`;
    }
  }

  /* ══════════════════════════════════════════════
     COUNTIES
  ══════════════════════════════════════════════ */
  async function counties() {
    loading();
    const r = await API.counties();
    if (!r.ok) { app().innerHTML = emptyState('ti-wifi-off','Couldn\'t load counties','Check your connection and try again.','Try again',"Pages.counties()"); return; }
    const all = r.data;
    const byRegion = {};
    all.forEach(c => { if (!byRegion[c.region]) byRegion[c.region] = []; byRegion[c.region].push(c); });
    app().innerHTML = `
    <section class="hero hero-compact">
      <h1>Houses by county</h1>
      <p class="hero-sub">Pick a county to see what's available, or search for an estate or town.</p>
      ${searchBoxHTML('counties')}
      <div class="filter-tags" id="region-filters">
        <button type="button" class="ftag active" onclick="filterRegion('',this)">All regions</button>
        ${Object.keys(byRegion).map(reg=>`<button type="button" class="ftag" onclick="filterRegion('${jsStr(reg)}',this)">${escHtml(reg)}</button>`).join('')}
      </div>
    </section>
    <div class="section" style="padding-top:24px" id="counties-page">
      ${Object.entries(byRegion).map(([region, cs]) => `
        <div class="region-section" data-region="${escHtml(region)}">
          <h2 class="region-title">${escHtml(region)}</h2>
          <div class="county-grid">
            ${cs.map(c=>`
              <a href="/browse?county=${encodeURIComponent(c.slug)}" class="county-card ${c.listing_count>0?'':'is-empty'}" onclick="Router.go('browse',{county:'${jsStr(c.slug)}'});return false;">
                <h3>${escHtml(c.name)}</h3>
                <p>${c.listing_count > 0 ? c.listing_count+' house'+(c.listing_count!=1?'s':'') : 'None yet'}</p>
              </a>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    ${footerHTML()}`;

    initSearchBox('counties');
    window.filterRegion = (region, btn) => {
      document.querySelectorAll('#region-filters .ftag').forEach(p => p.classList.remove('active'));
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
    if (!r.ok) { app().innerHTML = emptyState('ti-building','This house isn\'t available','The landlord may have taken it down or it has been let.','Browse other houses',"Router.go('browse')") + footerHTML(); return; }

    const l          = r.data.listing;
    const media      = r.data.media || [];
    const reviews    = r.data.reviews || [];
    const isUnlocked = unlockR.ok && unlockR.data.status === 'completed';
    const ld         = isUnlocked ? unlockR.data : null;
    const photos     = media.filter(m => m.media_type === 'photo');
    const videos     = media.filter(m => m.media_type === 'video');
    const slides     = photos.concat(videos);

    // Gallery: up to five cells, the rest behind "Show all"
    const cells = slides.slice(0, 5);
    const galleryHtml = cells.length
      ? `<div class="gallery count-${Math.min(cells.length,5)}" style="position:relative">
          ${cells.map((m, i) => `<button type="button" class="gallery-cell" onclick="openLightbox(${i})" aria-label="${m.media_type==='video'?'Play video':'View photo '+(i+1)}">
              ${m.media_type === 'video'
                ? `<video src="${escHtml(m.url)}#t=0.5" muted playsinline preload="metadata"></video><span class="video-indicator"><i class="ti ti-player-play-filled"></i></span>`
                : `<img src="${escHtml(m.url)}" alt="" ${i===0?'fetchpriority="high"':'loading="lazy"'} decoding="async"/>`}
            </button>`).join('')}
          ${slides.length > 1 ? `<button type="button" class="gallery-all" onclick="openLightbox(0)"><i class="ti ti-photo"></i> ${photos.length} photo${photos.length!==1?'s':''}${videos.length?` and ${videos.length} video${videos.length!==1?'s':''}`:''}</button>` : ''}
        </div>`
      : `<div class="gallery-empty"><i class="ti ti-photo"></i><span>The landlord hasn't added photos yet</span></div>`;

    const included = AMENITIES.filter(([k]) => l[k]);
    const missing  = AMENITIES.filter(([k]) => !l[k]);
    const nearby   = NEARBY.filter(([k]) => l[k]);
    const depositText = `${formatPrice(l.monthly_rent * l.deposit_months)} (${l.deposit_months} month${l.deposit_months>1?'s':''})`;
    const facts = [
      ['Deposit', depositText],
      ['Move in', l.status === 'active' ? 'Available now' : 'No longer available'],
      ['Listed', timeAgo(l.created_at)],
    ];

    const address = (ld && ld.street_address) || '';
    const phoneDigits = ld ? String(ld.landlord_phone||'').replace(/\D/g,'').replace(/^0/, '254') : '';
    const contactHtml = isUnlocked && ld ? `
      <div class="contact-reveal-panel">
        <h3><i class="ti ti-circle-check"></i> You've unlocked this house</h3>
        <div class="contact-row"><i class="ti ti-user"></i><div><strong>${escHtml(ld.landlord_name||'Landlord')}</strong><small>Landlord</small></div></div>
        <div class="contact-row"><i class="ti ti-phone"></i><div><strong>${escHtml(ld.landlord_phone||'Not given')}</strong><small>Phone and WhatsApp</small></div></div>
        <div class="contact-row"><i class="ti ti-map-pin"></i><div><strong>${address ? escHtml(address) : placeLine(l.area_name, l.county_name)}</strong><small>${address ? 'Address' : 'No street address given. Ask for directions when you call.'}</small></div></div>
        <div class="contact-actions">
          ${ld.landlord_phone ? `<a class="btn-primary" href="tel:${escHtml(String(ld.landlord_phone).replace(/\s/g,''))}"><i class="ti ti-phone"></i> Call ${escHtml(ld.landlord_name ? ld.landlord_name.split(' ')[0] : 'the landlord')}</a>` : ''}
          ${phoneDigits ? `<a class="btn-whatsapp" href="https://wa.me/${phoneDigits}" target="_blank" rel="noopener"><i class="ti ti-brand-whatsapp"></i> WhatsApp</a>` : ''}
        </div>
        <button class="report-link" onclick="Reports.open('${jsStr(l.id)}')">Already taken or wrong number? Tell us</button>
        ${ld.landlord_email ? `<p class="book-note">Or email <a href="mailto:${escHtml(ld.landlord_email)}" style="text-decoration:underline">${escHtml(ld.landlord_email)}</a></p>` : ''}
      </div>` : `
      <div class="contact-lock-panel">
        ${unlockR.ok && unlockR.data.status === 'manual_review'
          ? `<div class="review-box"><strong>We're checking your M-Pesa payment</strong>Code ${escHtml(unlockR.data.manual_code || '')}. The landlord's number appears here once we've matched it. Questions? WhatsApp <a href="https://wa.me/254703245513" target="_blank" rel="noopener" style="text-decoration:underline">+254 703 245 513</a>.</div>`
          : `${unlockR.ok && unlockR.data.status === 'failed' && unlockR.data.review_note ? `<div class="form-error">${escHtml(unlockR.data.review_note)} If you did pay, WhatsApp +254 703 245 513 with the M-Pesa SMS.</div>` : ''}
             <button class="btn-primary btn-block" onclick="Unlock.open('${jsStr(l.id)}','${jsStr(l.title)}')">Get landlord's number</button>
             <p class="book-note">Ksh 500, paid once by M-Pesa. You get their phone, WhatsApp and the exact address.</p>`}
      </div>`;

    app().innerHTML = `
    <nav class="crumb" aria-label="Breadcrumb">
      <span onclick="Router.go('browse',{county:'${jsStr(l.county_slug)}'})">${escHtml(l.county_name)}</span>
      ${l.area_name ? `<i class="ti ti-chevron-right"></i><span onclick="Router.go('browse',{county:'${jsStr(l.county_slug)}',area_id:'${jsStr(l.area_id)}'})">${escHtml(l.area_name)}</span>` : ''}
      <i class="ti ti-chevron-right"></i>
      <span class="crumb-current">${typeLabel(l.property_type)}</span>
    </nav>
    <div class="detail-page">
      ${l.status && l.status !== 'active'
        ? (isUnlocked && (l.status === 'let' || l.status === 'archived' || l.status === 'inactive')
            ? `<div class="let-banner"><strong>${l.status === 'inactive' ? 'This house is off the market for now.' : 'This house has been let.'}</strong> It's no longer in search. The landlord's details stay here for your records.</div>`
            : `<div class="let-banner">Preview. This listing is ${({pending:'waiting for review', let:'marked as let', archived:'archived', inactive:'hidden'})[l.status] || 'not live'}, so tenants can't find it in search.</div>`)
        : ''}
      <div class="detail-head">
        <h1 class="detail-title">${escHtml(l.title)}</h1>
        <div class="detail-loc">
          ${l.review_count > 0 ? `<span class="detail-rating">${starsHtml(l.average_rating, l.review_count)}</span><span aria-hidden="true">&nbsp;/&nbsp;</span>` : ''}
          <span>${placeLine(l.area_name, l.county_name)}</span>
        </div>
      </div>
      ${galleryHtml}
      <div class="detail-layout ${isUnlocked ? 'is-unlocked' : ''}">
        <div class="detail-main">
          <div class="detail-summary">
            <h2>${typeLabel(l.property_type)}${l.floor ? `, ${escHtml(l.floor)} floor` : ''}</h2>
            <div class="detail-tags">
              <span class="dtag green">${l.status === 'active' ? 'Available now' : statusLabel(l.status)}</span>
              <span class="dtag">Deposit ${depositText}</span>
              <span class="dtag">${Number(l.views||0).toLocaleString()} views</span>
            </div>
          </div>

          ${l.description ? `<section class="detail-block"><h2>About this house</h2><p class="prose">${escHtml(l.description)}</p></section>` : ''}

          <section class="detail-block">
            <h2>What's included</h2>
            ${included.length
              ? `<div class="amenity-grid">${included.map(([,label,icon])=>`<div class="amenity-item"><i class="ti ${icon}"></i><span>${label}</span></div>`).join('')}</div>`
              : `<p class="text-muted">The landlord hasn't listed any amenities.</p>`}
            ${included.length && missing.length ? `<p class="text-muted mt-16" style="font-size:15px">Not included: ${missing.map(([,label])=>label).join(', ')}.</p>` : ''}
          </section>

          ${nearby.length ? `<section class="detail-block"><h2>Nearby</h2><div class="nearby-grid">${nearby.map(([,label,icon])=>`<div class="nearby-item"><i class="ti ${icon}"></i><span>${label}</span></div>`).join('')}</div></section>` : ''}

          <section class="detail-block">
            <h2>Where it is</h2>
            <div class="map-box"><i class="ti ti-map-pin"></i><span>${placeLine(l.area_name, l.county_name)}</span><small>${isUnlocked ? (address ? escHtml(address) : 'Ask the landlord for directions.') : 'You get the exact address with the landlord\'s number.'}</small></div>
          </section>

          <section class="detail-block">
            <h2>${l.review_count > 0 ? `${starsHtml(l.average_rating, l.review_count)}` : 'Reviews'}</h2>
            ${reviews.length > 0
              ? `<div class="review-list">${reviews.map(rv=>`<div class="review-card">
                  <div class="review-header"><span class="review-avatar">${escHtml((rv.reviewer_name||'T').charAt(0).toUpperCase())}</span>
                    <div><span class="reviewer-name">${escHtml(rv.reviewer_name||'Tenant')}</span><span class="review-date">${'★'.repeat(rv.rating)}${'☆'.repeat(5-rv.rating)} &nbsp;${timeAgo(rv.created_at)}</span></div></div>
                  ${rv.comment?`<p class="review-comment">${escHtml(rv.comment)}</p>`:''}
                </div>`).join('')}</div>`
              : `<p class="text-muted">No reviews yet. Only tenants who unlocked this house can review it.</p>`}
            ${isUnlocked ? `<button class="btn-outline mt-16" onclick="Reviews.open('${jsStr(l.id)}')">Review this house</button>` : ''}
          </section>
        </div>
        <aside class="detail-sidebar">
          <div class="book-card">
            <div class="detail-price">${formatPrice(l.monthly_rent)} <small>a month</small></div>
            <div class="book-facts">${facts.map(([k,v])=>`<div><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
            ${contactHtml}
          </div>
          <button class="btn-text btn-block mt-12" onclick="Router.go('browse',{county:'${jsStr(l.county_slug)}'})">More houses in ${escHtml(l.county_name)}</button>
        </aside>
      </div>
    </div>
    ${isUnlocked || l.status !== 'active' || (unlockR.ok && unlockR.data.status === 'manual_review') ? '' : `<div class="mobile-book-bar">
      <div style="min-width:0"><div class="detail-price">${formatPrice(l.monthly_rent)}<small>/month</small></div><small class="dep">Deposit ${formatPrice(l.monthly_rent * l.deposit_months)}</small></div>
      <button class="btn-primary" onclick="Unlock.open('${jsStr(l.id)}','${jsStr(l.title)}')">Get number (Ksh 500)</button>
    </div>`}
    ${footerHTML()}`;
    app().classList.toggle('has-book-bar', !isUnlocked && l.status === 'active' && !(unlockR.ok && unlockR.data.status === 'manual_review'));

    /* Full-screen viewer for photos and video */
    window.openLightbox = (start) => {
      if (!slides.length) return;
      let i = start || 0;
      const box = document.createElement('div');
      box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      document.body.appendChild(box); document.body.style.overflow = 'hidden';
      function show() {
        const m = slides[i];
        box.innerHTML = `<div class="lightbox-bar"><button class="btn-text" data-act="close"><i class="ti ti-x"></i> Close</button><span>${i+1} / ${slides.length}</span><span style="width:80px"></span></div>
          <div class="lightbox-stage">
            ${m.media_type === 'video' ? `<video src="${escHtml(m.url)}" controls autoplay playsinline></video>` : `<img src="${escHtml(m.url)}" alt="Photo ${i+1} of ${slides.length}"/>`}
            ${slides.length > 1 ? `<button class="lightbox-nav prev" data-act="prev" aria-label="Previous"><i class="ti ti-chevron-left"></i></button><button class="lightbox-nav next" data-act="next" aria-label="Next"><i class="ti ti-chevron-right"></i></button>` : ''}
          </div>`;
      }
      function close() { box.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', key); }
      function step(d) { i = (i + d + slides.length) % slides.length; show(); }
      function key(e) { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); }
      box.addEventListener('click', e => {
        const a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'close') close(); else step(a.dataset.act === 'next' ? 1 : -1);
      });
      let x0 = null;
      box.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); x0 = null; });
      document.addEventListener('keydown', key);
      show();
    };
  }

  /* ══════════════════════════════════════════════
     LANDLORD DASHBOARD
  ══════════════════════════════════════════════ */
  function requireLandlord() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); app().innerHTML = emptyState('ti-lock','Log in to see your listings','Your dashboard shows your houses, views and how many tenants unlocked each one.','Log in',"openModal('login-modal')"); return null; }
    if (user.role !== 'landlord' && !user.is_admin) {
      app().innerHTML = emptyState('ti-key','This area is for landlords','Your account is set up for renting. To list a house, create a separate landlord account.','Create landlord account',"selectRole(document.querySelector('.role-btn[data-role=landlord]'));openModal('register-modal')");
      return null;
    }
    return user;
  }

  async function dashboard() {
    const user = requireLandlord(); if (!user) return;
    loading();
    const r = await API.landlordListings();
    if (!r.ok) { app().innerHTML = emptyState('ti-alert-circle','Couldn\'t load your listings',r.data.error||'Check your connection and try again.','Try again',"Router.go('dashboard')"); return; }
    const { listings, stats } = r.data;
    const s = stats || {};
    const needsCheck = listings.filter(l => (l.status === 'active' && (l.days_since_confirmed || 0) >= 30) || (l.status === 'active' && l.open_reports > 0) || (l.status === 'inactive' && l.auto_hidden_reason));

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('dashboard', user)}
      <div class="dash-content">
        <div class="dash-header-section">
          <div>
            <h2>Your listings</h2>
            <p>Hi ${escHtml((user.full_name||'').split(' ')[0] || 'there')}. Here's how your houses are doing.</p>
          </div>
          <button class="btn-primary" onclick="Router.go('add-listing')"><i class="ti ti-plus"></i> Add a listing</button>
        </div>
        <div class="metrics-row">
          <div class="metric-card"><strong>${s.active||0}</strong><span>Live</span></div>
          <div class="metric-card"><strong>${listings.filter(l => l.status === 'let' || l.status === 'archived').length}</strong><span>Let</span></div>
          <div class="metric-card"><strong>${Number(s.total_views||0).toLocaleString()}</strong><span>Views</span></div>
          <div class="metric-card"><strong>${Number(s.total_unlocks||0).toLocaleString()}</strong><span>Tenants who unlocked</span></div>
        </div>
        ${needsCheck.length ? `<div class="notice">
          <h3>Are these still available?</h3>
          <p>It's been a month since you confirmed ${needsCheck.length === 1 ? 'this house' : 'these houses'}. Unconfirmed listings are hidden after 37 days, so tenants don't pay for houses that are gone.</p>
          ${needsCheck.map(l => `<div class="notice-row"><div><strong>${escHtml(l.title)}</strong>${l.open_reports ? `<div class="row-note warn">${l.open_reports} tenant${l.open_reports!=1?'s':''} reported it taken</div>` : ''}</div>
            <div><button class="btn-ghost btn-xs" onclick="confirmAvailable('${jsStr(l.id)}')"><i class="ti ti-check"></i> Still available</button>
            <button class="btn-ghost btn-xs" onclick="setListingStatus('${jsStr(l.id)}','let')"><i class="ti ti-key"></i> It's been let</button></div></div>`).join('')}
        </div>` : ''}
        <div class="list-head"><h3>All houses</h3><span>${listings.length} listing${listings.length!==1?'s':''}</span></div>
        ${listings.length === 0
          ? emptyState('ti-home','You haven\'t listed a house yet','It takes about five minutes. Have a few photos of the house ready.','Add your first listing',"Router.go('add-listing')")
          : listings.map(l=>`
            <div class="listing-row">
              <div class="lr-thumb">${l.cover_photo ? `<img src="${escHtml(l.cover_photo)}" alt="" loading="lazy"/>` : '<i class="ti ti-photo"></i>'}</div>
              <div class="lr-info">
                <h4>${escHtml(l.title)}</h4>
                <p>${placeLine(l.area_name, l.county_name)}, ${formatPrice(l.monthly_rent)} a month</p>
                <p>${Number(l.views||0).toLocaleString()} views, ${l.unlock_count||0} unlocks, ${l.photo_count||0} photo${l.photo_count!=1?'s':''}</p>
                ${hiddenReason(l) ? `<div class="row-note warn">${hiddenReason(l)}</div>` : ''}
              </div>
              <span class="status-badge status-${escHtml(l.status)}">${statusLabel(l.status)}</span>
              <div class="lr-actions">
                <button class="btn-ghost btn-xs" onclick="Router.go('edit-listing',{id:'${jsStr(l.id)}'})"><i class="ti ti-edit"></i> Edit</button>
                <button class="btn-ghost btn-xs" onclick="Router.go('listing',{id:'${jsStr(l.id)}'})"><i class="ti ti-eye"></i> ${l.status==='active' ? 'View' : 'Preview'}</button>
                ${l.status==='active'
                  ? `<button class="btn-ghost btn-xs" onclick="setListingStatus('${jsStr(l.id)}','let')"><i class="ti ti-key"></i> Mark as let</button>`
                  : (l.status==='let' || l.status==='archived') ? `<button class="btn-ghost btn-xs" onclick="setListingStatus('${jsStr(l.id)}','active')"><i class="ti ti-refresh"></i> Relist</button>`
                  : l.status==='inactive' ? `<button class="btn-ghost btn-xs" onclick="${l.auto_hidden_reason ? `confirmAvailable('${jsStr(l.id)}')` : `setListingStatus('${jsStr(l.id)}','active')`}"><i class="ti ti-check"></i> Make live</button>` : ''}
                <button class="btn-danger btn-xs" onclick="confirmDeleteListing('${jsStr(l.id)}','${jsStr(l.title)}')"><i class="ti ti-trash"></i> Delete</button>
              </div>
            </div>`).join('')}
      </div>
    </div>`;

    window.confirmAvailable = async id => {
      const r = await API.confirmListing(id);
      if (r.ok) { showToast('Thanks. It stays live for another 30 days.', 'success'); Router.go('dashboard'); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
    window.setListingStatus = async (id, status) => {
      if (status === 'let' && !confirm('Mark this house as let? It leaves search straight away. Tenants who already paid will see it\'s been let. You can relist it when it\'s vacant again.')) return;
      const r = await API.updateListing(id, { status });
      const msg = { active: 'Listing is live again.', let: 'Marked as let. Relist it any time it\'s vacant.', inactive: 'Listing hidden.' }[status] || 'Saved.';
      if (r.ok) { showToast(msg, 'success'); Router.go('dashboard'); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
    window.confirmDeleteListing = async (id, title) => {
      if (!confirm(`Delete "${title}"? Its photos and reviews go too. You can't undo this.`)) return;
      const r = await API.deleteListing(id);
      if (r.ok) { showToast('Listing deleted.','success'); Router.go('dashboard'); }
      else showToast(r.data.error||'Couldn\'t delete the listing. Try again.','error');
    };
  }

  /* ── Shared: media picker block used by add & edit ── */
  function mediaPickerHTML() {
    return `<div class="media-block" id="media-block"><div class="upload-row">
        <label class="upload-box" id="photo-drop" for="photo-input">
          <i class="ti ti-camera"></i><p>Add photos</p><small>Up to 15. We shrink them before upload, so big phone photos are fine.</small>
          <input type="file" id="photo-input" accept="image/*" multiple class="sr-only" onchange="addMedia(this,'photo')"/>
        </label>
        <label class="upload-box" id="video-drop" for="video-input">
          <i class="ti ti-video"></i><p>Add a video walkthrough</p><small>Optional. MP4 or MOV, up to 50 MB (about a minute at 720p).</small>
          <input type="file" id="video-input" accept="video/*" class="sr-only" onchange="addMedia(this,'video')"/>
        </label>
      </div>
      <div class="media-preview-grid" id="media-previews"></div>
      <p class="upload-summary" id="media-summary"></p></div>`;
  }

  function bindMediaPicker(uploader) {
    uploader.onChange = () => { const b = el('media-block'); if (b) b.classList.toggle('has-media', uploader.count() > 0); };
    window.addMedia = async (input, type) => {
      const files = Array.from(input.files); input.value = ''; // copy first: clearing the input empties its FileList
      const errors = await uploader.addFiles(files, type);
      if (errors.length) showToast(errors[0], 'error');
    };
    Uploader.bindDrop('photo-drop', async files => { const e = await uploader.addFiles(files, 'photo'); if (e.length) showToast(e[0], 'error'); });
    Uploader.bindDrop('video-drop', async files => { const e = await uploader.addFiles(files, 'video'); if (e.length) showToast(e[0], 'error'); });
  }

  /* Shows overall progress while files upload; returns the result */
  async function runUploads(uploader, listingId, mountId, startOrder = 0) {
    const mount = el(mountId);
    if (mount) mount.innerHTML = `<div class="upload-progress"><p>Uploading photos and video <span id="up-count"></span></p><div class="progress-track"><i id="up-bar"></i></div></div>`;
    uploader.onProgress = () => {
      const t = uploader.totals();
      const bar = el('up-bar'); if (bar) bar.style.width = Math.round(t.fraction * 100) + '%';
      const c = el('up-count'); if (c) c.textContent = `${t.done} of ${t.count} done`;
      const sm = el('media-summary'); if (sm && t.done < t.count) sm.innerHTML = `<strong>Uploading, ${Math.round(t.fraction * 100)}% done</strong> (${t.sent} of ${t.count} sent). Keep this page open until it finishes.`;
    };
    uploader.onProgress();
    const res = await uploader.uploadAll(listingId, startOrder);
    uploader.onProgress();
    return res;
  }

  /* ══════════════════════════════════════════════
     ADD LISTING
  ══════════════════════════════════════════════ */
  async function addListing() {
    const user = requireLandlord(); if (!user) return;
    const countiesR = await API.counties();
    const counties  = (countiesR.ok ? countiesR.data : []).slice().sort((a,b) => a.name.localeCompare(b.name));
    const uploader  = Uploader.create({ gridId: 'media-previews', summaryId: 'media-summary' });
    let createdId = null; // if the listing saved but some uploads failed, retry uses the same listing

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('add-listing', user)}
      <div class="dash-content">
        <div class="form-page">
          <div class="page-header">
            <button class="back-btn" onclick="Router.go('dashboard')" aria-label="Back to your listings"><i class="ti ti-arrow-left"></i></button>
            <h1>Add a listing</h1>
          </div>
          <p class="page-lede">Tenants see everything here except your phone number and street address, which they pay Ksh 500 to unlock.</p>
          <form id="add-listing-form" onsubmit="submitAddListing(event)" novalidate>
            <div class="form-panel">
              <h2 class="form-panel-title">Photos and video</h2>
              <p class="form-panel-sub">Tenants scroll past listings with one or two photos. Five or more clear ones work best, starting with the sitting room.</p>
              ${mediaPickerHTML()}
            </div>
            <div class="form-panel">
              <h2 class="form-panel-title">Where is it?</h2>
              <p class="form-panel-sub">The street address stays hidden until a tenant unlocks the listing.</p>
              <div class="form-row">
                <div class="form-group"><label for="fl-county">County</label>
                  <select id="fl-county" required onchange="loadAreas(this.value)">
                    <option value="">Choose a county</option>
                    ${counties.map(c=>`<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group" id="area-group"><label for="fl-area">Area or estate <span class="optional">optional</span></label>
                  <select id="fl-area" disabled onchange="toggleNewArea(this.value)"><option value="">Choose a county first</option></select>
                  <input type="text" id="fl-area-new" class="hidden" maxlength="60" placeholder="Type the area or estate" style="margin-top:8px"/>
                </div>
              </div>
              <div class="form-group"><label for="fl-street">Street address or directions <span class="optional">optional</span></label>
                <input type="text" id="fl-street" placeholder="Phase 2, Road B, near the Total station"/>
              </div>
            </div>
            <div class="form-panel">
              <h2 class="form-panel-title">About the house</h2>
              <p class="form-panel-sub">Be specific. "2 bedroom with borehole near Thika Road Mall" beats "Spacious modern apartment".</p>
              <div class="form-group"><label for="fl-title">Listing title</label>
                <input type="text" id="fl-title" maxlength="80" placeholder="1 bedroom near Kasarani stadium" required/>
              </div>
              <div class="form-row">
                <div class="form-group"><label for="fl-type">House type</label>
                  <select id="fl-type" required>${typeOptions('', 'Choose a type')}</select>
                </div>
                <div class="form-group"><label for="fl-floor">Floor <span class="optional">optional</span></label>
                  <select id="fl-floor">
                    <option value="">Not applicable</option><option value="Ground">Ground floor</option>
                    <option value="1st">1st floor</option><option value="2nd">2nd floor</option>
                    <option value="3rd">3rd floor</option><option value="4th+">4th floor or higher</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group"><label for="fl-rent">Rent per month (Ksh)</label>
                  <input type="number" inputmode="numeric" id="fl-rent" placeholder="14000" min="500" required/>
                </div>
                <div class="form-group"><label for="fl-deposit">Deposit</label>
                  <select id="fl-deposit"><option value="1">1 month's rent</option><option value="2" selected>2 months' rent</option><option value="3">3 months' rent</option></select>
                </div>
              </div>
              <div class="form-group"><label for="fl-desc">Description <span class="optional">optional</span></label>
                <textarea id="fl-desc" rows="5" placeholder="Size of the rooms, condition, how water and electricity work, what's close by…"></textarea>
              </div>
            </div>
            <div class="form-panel">
              <h2 class="form-panel-title">What's included</h2>
              <p class="form-panel-sub">Tick everything that comes with the rent.</p>
              <div class="check-grid">
                ${AMENITIES.map(([k,l])=>`<label class="chk-item"><input type="checkbox" name="${k}"/> ${l}</label>`).join('')}
              </div>
            </div>
            <div class="form-panel">
              <h2 class="form-panel-title">What's nearby</h2>
              <p class="form-panel-sub">Within about ten minutes' walk.</p>
              <div class="check-grid">
                ${NEARBY.map(([k,l])=>`<label class="chk-item"><input type="checkbox" name="${k}"/> ${l}</label>`).join('')}
              </div>
            </div>
            <div id="upload-status"></div>
            <div id="add-listing-error" class="form-error hidden" style="margin-top:24px"></div>
            <div class="form-actions">
              <button type="button" class="btn-text" onclick="Router.go('dashboard')">Cancel</button>
              <button type="submit" class="btn-primary" id="submit-listing-btn">Publish listing</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;

    bindMediaPicker(uploader);

    window.loadAreas = async cid => {
      const as_ = el('fl-area');
      if (!cid) { as_.innerHTML = '<option value="">Choose a county first</option>'; as_.disabled = true; return; }
      as_.disabled = true; as_.innerHTML = '<option value="">Loading areas…</option>';
      const r = await API.areas(cid);
      const areas = r.ok ? r.data : [];
      as_.innerHTML = `<option value="">${areas.length ? 'Choose an area' : 'No areas listed yet'}</option>` +
        areas.map(a => `<option value="${escHtml(a.id)}">${escHtml(a.name)}</option>`).join('') +
        `<option value="__new">My area isn't listed</option>`;
      as_.disabled = false;
      toggleNewArea(as_.value);
    };
    window.toggleNewArea = v => {
      const inp = el('fl-area-new'); if (!inp) return;
      inp.classList.toggle('hidden', v !== '__new');
      if (v === '__new') inp.focus();
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
      const missing  = [!countyId && 'county', !title && 'title', !type && 'house type', !rent && 'rent'].filter(Boolean);
      if (missing.length) {
        showEl(errEl); errEl.textContent = `Add the ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} before publishing.`;
        const first = { county: 'fl-county', title: 'fl-title', 'house type': 'fl-type', rent: 'fl-rent' }[missing[0]];
        el(first) && el(first).focus();
        return;
      }
      setLoading(btn, true);
      if (!createdId) {
        const areaVal = el('fl-area').value;
        const payload = { county_id:countyId, area_id:(areaVal && areaVal !== '__new') ? areaVal : null, area_name: areaVal === '__new' ? el('fl-area-new').value.trim() : '', street_address:el('fl-street').value.trim(), title, property_type:type, floor:el('fl-floor').value, monthly_rent:parseInt(rent, 10), deposit_months:parseInt(el('fl-deposit').value, 10), description:el('fl-desc').value.trim() };
        document.querySelectorAll('#add-listing-form input[type="checkbox"]').forEach(cb => { payload[cb.name] = cb.checked; });
        const r = await API.createListing(payload);
        if (!r.ok) { setLoading(btn, false); showEl(errEl); errEl.textContent = r.data.error||'Your listing didn\'t save. Check your connection and try again.'; return; }
        createdId = r.data.listing_id;
      }
      if (uploader.count()) {
        btn.innerHTML = '<span class="spinner"></span> Uploading…';
        const res = await runUploads(uploader, createdId, 'upload-status');
        if (!res.ok) {
          setLoading(btn, false);
          btn.textContent = `Retry ${res.failed.length} failed upload${res.failed.length!==1?'s':''}`;
          showEl(errEl);
          errEl.textContent = `Your listing is saved, but ${res.failed.length} file${res.failed.length!==1?'s':''} didn't upload (${res.failed[0].error}). Remove ${res.failed.length!==1?'them':'it'} or press retry.`;
          return;
        }
      }
      setLoading(btn, false);
      showToast('Listing published.', 'success');
      Router.go('listing', { id: createdId });
    };
  }

  /* ══════════════════════════════════════════════
     EDIT LISTING
  ══════════════════════════════════════════════ */
  async function editListing(id) {
    const user = requireLandlord(); if (!user) return;
    loading();
    let r = await API.ownListing(id);
    if (!r.ok && (r.status === 404 || r.status === 405)) r = await API.listing(id); // older backend
    if (!r.ok) { showToast('That listing wasn\'t found.','error'); Router.go('dashboard'); return; }
    const l = r.data.listing;
    let existing = (r.data.media || []).slice();
    const uploader = Uploader.create({ gridId: 'media-previews', summaryId: 'media-summary' });

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('edit-listing', user)}
      <div class="dash-content">
        <div class="form-page">
          <div class="page-header">
            <button class="back-btn" onclick="Router.go('dashboard')" aria-label="Back to your listings"><i class="ti ti-arrow-left"></i></button>
            <h1>Edit listing</h1>
          </div>
          <p class="page-lede">${escHtml(l.title)}</p>
          <form id="edit-form" onsubmit="submitEdit(event,'${jsStr(id)}')">
            <div class="form-panel">
              <h2 class="form-panel-title">Photos and video</h2>
              <p class="form-panel-sub">Remove old photos or add new ones. New files upload when you save.</p>
              <div class="media-preview-grid" id="existing-media"></div>
              ${mediaPickerHTML()}
            </div>
            <div class="form-panel">
              <h2 class="form-panel-title">Details</h2>
              <div class="form-group"><label for="el-title">Listing title</label><input type="text" id="el-title" maxlength="80" value="${escHtml(l.title)}" required/></div>
              <div class="form-row">
                <div class="form-group"><label for="el-rent">Rent per month (Ksh)</label><input type="number" inputmode="numeric" id="el-rent" value="${escHtml(l.monthly_rent)}" required/></div>
                <div class="form-group"><label for="el-status">Visibility</label>
                  <select id="el-status">
                    <option value="active" ${l.status==='active'?'selected':''}>Live, tenants can see it</option>
                    <option value="let" ${l.status==='let'||l.status==='archived'?'selected':''}>Let, the house has been taken</option>
                    <option value="inactive" ${l.status==='inactive'?'selected':''}>Hidden for now</option>
                    ${l.status==='pending' ? `<option value="pending" selected>In review</option>` : ''}
                  </select>
                </div>
              </div>
              <div class="form-group"><label for="el-desc">Description</label><textarea id="el-desc" rows="5">${escHtml(l.description||'')}</textarea></div>
            </div>
            <div class="form-panel">
              <h2 class="form-panel-title">What's included and nearby</h2>
              <div class="check-grid">
                ${AMENITIES.concat(NEARBY.map(([k,lb,ic]) => [k, 'Near: ' + lb.toLowerCase(), ic])).map(([k,lb])=>`<label class="chk-item"><input type="checkbox" name="${k}" ${l[k]?'checked':''}/> ${lb}</label>`).join('')}
              </div>
            </div>
            <div id="upload-status"></div>
            <div id="edit-error" class="form-error hidden" style="margin-top:24px"></div>
            <div class="form-actions">
              <button type="button" class="btn-text" onclick="Router.go('listing',{id:'${jsStr(id)}'})">View listing</button>
              <button type="submit" class="btn-primary" id="edit-btn">Save changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;

    function renderExisting() {
      const g = el('existing-media'); if (!g) return;
      g.innerHTML = existing.map((m, i) => `<div class="media-preview-item">
          ${m.media_type === 'video' ? `<video src="${escHtml(m.url)}#t=0.5" muted preload="metadata"></video>` : `<img src="${escHtml(m.url)}" alt="" loading="lazy"/>`}
          ${i === 0 && m.media_type === 'photo' ? '<span class="mp-cover">Cover</span>' : ''}
          <button type="button" class="mp-remove" onclick="removeExistingMedia('${jsStr(m.id)}')" aria-label="Delete this file"><i class="ti ti-trash"></i></button>
        </div>`).join('');
    }
    renderExisting();
    bindMediaPicker(uploader);

    window.removeExistingMedia = async mediaId => {
      if (!confirm('Delete this file from the listing?')) return;
      const rr = await API.deleteMedia(id, mediaId);
      if (rr.ok) { existing = existing.filter(m => String(m.id) !== String(mediaId)); renderExisting(); showToast('File deleted.', 'success'); }
      else showToast(rr.data.error || 'Couldn\'t delete the file.', 'error');
    };

    window.submitEdit = async (e, lid) => {
      e.preventDefault();
      const errEl = el('edit-error'); const btn = el('edit-btn'); hideEl(errEl);
      const payload = { title:el('el-title').value.trim(), monthly_rent:parseInt(el('el-rent').value, 10), description:el('el-desc').value.trim(), status:el('el-status').value };
      document.querySelectorAll('#edit-form input[type="checkbox"]').forEach(cb => { payload[cb.name] = cb.checked; });
      setLoading(btn, true);
      const r = await API.updateListing(lid, payload);
      if (!r.ok) { setLoading(btn, false); showEl(errEl); errEl.textContent = r.data.error||'Your changes didn\'t save. Try again.'; return; }
      if (uploader.count()) {
        btn.innerHTML = '<span class="spinner"></span> Uploading…';
        const res = await runUploads(uploader, lid, 'upload-status', existing.length);
        if (!res.ok) {
          setLoading(btn, false);
          showEl(errEl); errEl.textContent = `Changes saved, but ${res.failed.length} file${res.failed.length!==1?'s':''} didn't upload. Press save to retry.`;
          return;
        }
      }
      setLoading(btn, false);
      showToast('Changes saved.','success');
      Router.go(payload.status === 'active' ? 'listing' : 'dashboard', { id: lid });
    };
  }

  /* ══════════════════════════════════════════════
     MY UNLOCKS
  ══════════════════════════════════════════════ */
  async function unlocks() {
    const user = Auth.current();
    if (!user) { openModal('login-modal'); app().innerHTML = emptyState('ti-key','Log in to see your unlocked houses','Every house you pay for stays here, with the landlord\'s number.','Log in',"openModal('login-modal')"); return; }
    loading();
    const r    = await API.myUnlocks();
    const data = r.ok ? r.data : [];

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('unlocks', user)}
      <div class="dash-content">
        <div class="page-header"><h1>Unlocked houses</h1></div>
        <p class="page-lede">Houses you've paid for. Open one to see the landlord's number again.</p>
        ${data.length === 0
          ? emptyState('ti-key','Nothing unlocked yet','When you pay for a house, it stays here so you can find the landlord\'s number later.','Browse houses',"Router.go('browse')")
          : data.map(u=>`
            <div class="unlock-card">
              <div class="unlock-card-icon">${u.cover_photo ? `<img src="${escHtml(u.cover_photo)}" alt="" loading="lazy"/>` : '<i class="ti ti-photo"></i>'}</div>
              <div class="unlock-card-info">
                <h4>${escHtml(u.title)}</h4>
                <p>${placeLine(u.area_name, u.county_name)}, ${formatPrice(u.monthly_rent)} a month, ${typeLabel(u.property_type).toLowerCase()}</p>
                <p>Unlocked ${timeAgo(u.completed_at).toLowerCase()}${u.listing_status === 'let' || u.listing_status === 'archived' ? '. <strong style="color:var(--ink)">Now let</strong>' : u.listing_status === 'inactive' ? '. Off the market for now' : ''}${u.reported ? '. You reported this one' : ''}</p>
              </div>
              <button class="btn-ghost btn-xs" onclick="Router.go('listing',{id:'${jsStr(u.listing_id)}'})"><i class="ti ti-phone"></i> See contact</button>
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

    const accountType   = u.is_admin ? 'Admin' : (u.role === 'landlord' ? 'Landlord' : 'Tenant');

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('profile', user)}
      <div class="dash-content">
        <div class="form-page">
          <div class="page-header"><h1>Profile</h1></div>
          <p class="page-lede">${accountType} account. ${u.role === 'landlord' || u.is_admin ? 'Tenants get this phone number after they pay to contact you.' : 'We send M-Pesa payment prompts to this number.'}</p>
          <div class="form-panel">
            <div class="form-group"><label for="p-name">Full name</label><input type="text" id="p-name" value="${escHtml(u.full_name||'')}" autocomplete="name"/></div>
            <div class="form-row">
              <div class="form-group"><label for="p-phone">M-Pesa phone number</label><input type="tel" id="p-phone" value="${escHtml(u.phone||'')}" placeholder="07XX XXX XXX" autocomplete="tel"/></div>
              <div class="form-group"><label for="p-location">Town</label><input type="text" id="p-location" value="${escHtml(u.location||'')}" placeholder="Nairobi, Kasarani"/></div>
            </div>
            <div class="form-group"><label for="p-idnumber">ID or passport number <span class="optional">optional</span></label><input type="text" id="p-idnumber" value="${escHtml(u.id_number||'')}"/><p class="form-hint">Only the MyNyumba admin sees this. It helps us verify landlords if a tenant reports a problem.</p></div>
            <div class="form-group"><label for="p-email">Email</label><input type="email" id="p-email" value="${escHtml(u.email||'')}" disabled/><p class="form-hint">Your email can't be changed here. WhatsApp support if you need to.</p></div>
            <div id="profile-error" class="form-error hidden"></div>
            <div id="profile-success" class="form-success hidden">Changes saved.</div>
            <div class="form-actions" style="justify-content:flex-end"><button class="btn-primary" id="save-profile-btn" onclick="saveProfile()">Save changes</button></div>
          </div>
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
      else { showEl(errEl); errEl.textContent = r.data.error||'Your changes didn\'t save. Try again.'; }
    };
  }

  /* ══════════════════════════════════════════════
     ADMIN — LANDLORD DETAIL VIEW
  ══════════════════════════════════════════════ */
  async function adminLandlord(landlordId) {
    const user = Auth.current();
    if (!user || !user.is_admin) { Router.go('home'); return; }
    loading();
    const r = await API.adminLandlordDetail(landlordId);
    if (!r.ok) { showToast('Couldn\'t load that landlord.', 'error'); Router.go('admin'); return; }
    const { profile: lp, listings } = r.data;

    const initial      = (lp.full_name || lp.email || 'L').charAt(0).toUpperCase();
    const totalViews   = listings.reduce((s, l) => s + (l.views || 0), 0);
    const totalUnlocks = listings.reduce((s, l) => s + (l.unlock_count || 0), 0);
    const activeCount  = listings.filter(l => l.status === 'active').length;
    const lid = jsStr(landlordId);

    const rows = listings.length === 0
      ? '<p class="text-muted" style="padding:24px 0">This landlord hasn\'t listed anything yet.</p>'
      : listings.map(l => `<div class="listing-row">
          <div class="lr-thumb">${l.cover_photo ? `<img src="${escHtml(l.cover_photo)}" alt="" loading="lazy"/>` : '<i class="ti ti-photo"></i>'}</div>
          <div class="lr-info">
            <h4>${escHtml(l.title)}</h4>
            <p>${placeLine(l.area_name, l.county_name)}, ${formatPrice(l.monthly_rent)} a month</p>
            <p>${l.views} views, ${l.unlock_count} unlocks, ${l.photo_count} photos, listed ${timeAgo(l.created_at).toLowerCase()}</p>
          </div>
          <span class="status-badge status-${escHtml(l.status)}">${statusLabel(l.status)}</span>
          <div class="lr-actions">
            <button class="btn-ghost btn-xs" onclick="Router.go('edit-listing',{id:'${jsStr(l.id)}'})"><i class="ti ti-edit"></i> Edit</button>
            ${l.status === 'active'
              ? `<button class="btn-ghost btn-xs" onclick="adminToggleListingStatus('${jsStr(l.id)}','inactive')"><i class="ti ti-eye-off"></i> Hide</button>`
              : `<button class="btn-ghost btn-xs" onclick="adminToggleListingStatus('${jsStr(l.id)}','active')"><i class="ti ti-eye"></i> Make live</button>`}
            <button class="btn-danger btn-xs" onclick="adminDeleteOneListing('${jsStr(l.id)}','${lid}')" aria-label="Delete"><i class="ti ti-trash"></i></button>
          </div>
        </div>`).join('');

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('admin', user)}
      <div class="dash-content">
        <div class="page-header">
          <button class="back-btn" onclick="Router.go('admin')" aria-label="Back to admin"><i class="ti ti-arrow-left"></i></button>
          <h1>Landlord</h1>
        </div>
        <div class="profile-info-card" style="margin:24px 0">
          <div class="admin-landlord-avatar" style="width:64px;height:64px;font-size:24px">${initial}</div>
          <div class="profile-meta" style="flex:1">
            <h3>${escHtml(lp.full_name || 'No name')}</h3>
            <p><i class="ti ti-mail"></i> ${escHtml(lp.email || '')}</p>
            ${lp.phone     ? `<p><i class="ti ti-phone"></i> ${escHtml(lp.phone)}</p>` : ''}
            ${lp.id_number ? `<p><i class="ti ti-id"></i> ID ${escHtml(lp.id_number)}</p>` : ''}
            ${lp.location  ? `<p><i class="ti ti-map-pin"></i> ${escHtml(lp.location)}</p>` : ''}
            <p>Joined ${timeAgo(lp.created_at).toLowerCase()}</p>
          </div>
        </div>
        <div class="metrics-row">
          <div class="metric-card"><strong>${listings.length}</strong><span>Listings</span></div>
          <div class="metric-card"><strong>${activeCount}</strong><span>Live</span></div>
          <div class="metric-card"><strong>${totalViews}</strong><span>Views</span></div>
          <div class="metric-card"><strong>${totalUnlocks}</strong><span>Unlocks</span></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px">
          <button class="btn-danger btn-sm" onclick="adminSuspendLandlord('${lid}')"><i class="ti ti-user-off"></i> Suspend and hide all listings</button>
          <button class="btn-ghost btn-sm" onclick="adminRestoreLandlord('${lid}')"><i class="ti ti-user-check"></i> Make all listings live again</button>
        </div>
        <div class="list-head"><h3>Their listings</h3></div>
        <div id="landlord-listings-container">${rows}</div>
      </div>
    </div>`;

    window.adminToggleListingStatus = async function(id, newStatus) {
      const r = await API.updateListing(id, { status: newStatus });
      if (r.ok) { showToast(newStatus === 'active' ? 'Listing is live.' : 'Listing hidden.', 'success'); adminLandlord(landlordId); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
    window.adminDeleteOneListing = async function(id, llid) {
      if (!confirm('Delete this listing for good? You can\'t undo this.')) return;
      const r = await API.deleteListing(id);
      if (r.ok) { showToast('Listing deleted.', 'success'); adminLandlord(llid); }
      else showToast(r.data.error || 'Couldn\'t delete it. Try again.', 'error');
    };
    window.adminSuspendLandlord = async function(llid) {
      if (!confirm('Suspend this landlord? All their listings will be hidden.')) return;
      const r = await API.adminSuspendLandlord(llid);
      if (r.ok) { showToast(r.data.message, 'success'); adminLandlord(llid); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
    window.adminRestoreLandlord = async function(llid) {
      if (!confirm('Make all of this landlord\'s listings live again?')) return;
      const r = await API.adminRestoreLandlord(llid);
      if (r.ok) { showToast(r.data.message, 'success'); adminLandlord(llid); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
  }

  /* ══════════════════════════════════════════════
     ADMIN PANEL
  ══════════════════════════════════════════════ */
  async function admin() {
    const user = Auth.current();
    if (!user || !user.is_admin) { showToast('That page is for admins only.','error'); Router.go('home'); return; }
    loading();
    const [statsR, listingsR, landlordsR, paymentsR] = await Promise.all([
      API.adminStats(), API.adminListings(), API.adminLandlords(), API.adminManualPayments()
    ]);
    const stats     = statsR.ok     ? statsR.data     : {};
    const listings  = listingsR.ok  ? listingsR.data  : [];
    const landlords = landlordsR.ok ? landlordsR.data : [];
    const payments  = paymentsR.ok  ? paymentsR.data  : [];
    let activeTab   = payments.length ? 'payments' : 'listings';

    function paymentRow(pmt) {
      return `<div class="admin-listing-row">
        <div class="lr-info">
          <h4>${escHtml(pmt.manual_code)} &nbsp;Ksh ${Number(pmt.amount || 500).toLocaleString()}</h4>
          <p>From ${escHtml(pmt.phone || '')}, ${escHtml(pmt.tenant_name || pmt.tenant_email || 'tenant')}. Sent ${timeAgo(pmt.manual_submitted_at).toLowerCase()}</p>
          <p>For: ${escHtml(pmt.title)}</p>
        </div>
        <div class="lr-actions" style="flex:0 0 auto;width:auto;min-width:0">
          <button class="btn-ghost btn-xs" onclick="reviewPayment('${jsStr(pmt.id)}','approve','${jsStr(pmt.manual_code)}')"><i class="ti ti-check"></i> Approve</button>
          <button class="btn-danger btn-xs" onclick="reviewPayment('${jsStr(pmt.id)}','reject','${jsStr(pmt.manual_code)}')"><i class="ti ti-x"></i> Reject</button>
        </div>
      </div>`;
    }

    function adminListingRow(l) {
      return `<div class="admin-listing-row">
        <div class="lr-thumb">${l.cover_photo ? `<img src="${escHtml(l.cover_photo)}" alt="" loading="lazy"/>` : '<i class="ti ti-photo"></i>'}</div>
        <div class="lr-info">
          <h4>${escHtml(l.title)}</h4>
          <p>${placeLine(l.area_name, l.county_name)}, ${formatPrice(l.monthly_rent)} a month</p>
          <p>${escHtml(l.landlord_name || 'Unknown landlord')}${l.landlord_phone ? ', ' + escHtml(l.landlord_phone) : ''}. ${l.views} views, ${l.unlock_count} unlocks</p>
          ${l.open_reports ? `<div class="row-note warn">${l.open_reports} open report${l.open_reports!=1?'s':''}: ${escHtml(String(l.report_reasons||'').replace(/wrong_number/g,'wrong number').replace(/,/g,', '))}</div>` : ''}
          ${hiddenReason(l) ? `<div class="row-note">${hiddenReason(l)}</div>` : ''}
        </div>
        <span class="status-badge status-${escHtml(l.status)}">${statusLabel(l.status)}</span>
        <div class="lr-actions">
          <button class="btn-ghost btn-xs" onclick="Router.go('listing',{id:'${jsStr(l.id)}'})"><i class="ti ti-eye"></i> ${l.status === 'active' ? 'View' : 'Preview'}</button>
          ${l.status === 'active'
            ? `<button class="btn-ghost btn-xs" onclick="adminSetStatus('${jsStr(l.id)}','let')"><i class="ti ti-key"></i> Mark as let</button>`
            : `<button class="btn-ghost btn-xs" onclick="adminSetStatus('${jsStr(l.id)}','active')"><i class="ti ti-check"></i> ${l.status === 'pending' ? 'Approve' : (l.status === 'let' || l.status === 'archived') ? 'Relist' : 'Make live'}</button>`}
          <button class="btn-danger btn-xs" onclick="adminDeleteListing('${jsStr(l.id)}')"><i class="ti ti-trash"></i> Delete</button>
        </div>
      </div>`;
    }

    function adminLandlordCard(l) {
      const initial = (l.full_name || l.email || 'L').charAt(0).toUpperCase();
      return `<div class="admin-landlord-card">
        <div class="admin-landlord-header">
          <div class="admin-landlord-avatar">${initial}</div>
          <div class="admin-landlord-info" style="flex:1">
            <h4>${escHtml(l.full_name || 'No name')}</h4>
            <p>${l.listing_count} listing${l.listing_count != 1 ? 's' : ''} (${l.active_listings || 0} live), ${l.total_views} views, ${l.total_unlocks} unlocks. Joined ${timeAgo(l.created_at).toLowerCase()}.</p>
          </div>
        </div>
        <div class="admin-contact-row"><i class="ti ti-mail"></i> ${escHtml(l.email || '')}</div>
        ${l.phone ? `<div class="admin-contact-row"><i class="ti ti-phone"></i> ${escHtml(l.phone)}</div>` : ''}
        ${l.id_number ? `<div class="admin-contact-row"><i class="ti ti-id"></i> ID ${escHtml(l.id_number)}</div>` : ''}
        ${l.location ? `<div class="admin-contact-row"><i class="ti ti-map-pin"></i> ${escHtml(l.location)}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="btn-outline btn-xs" onclick="Pages._adminLandlord('${jsStr(l.id)}')">See listings</button>
          <button class="btn-danger btn-xs" onclick="quickSuspend('${jsStr(l.id)}')"><i class="ti ti-user-off"></i> Suspend</button>
        </div>
      </div>`;
    }

    function renderTab() {
      const tc = el('admin-tab-content');
      if (!tc) return;
      if (activeTab === 'payments') {
        tc.innerHTML = payments.length
          ? `<p class="page-lede" style="margin:16px 0 0">Check each code against the M-Pesa messages on the phone that receives Send Money payments before approving. Approve only if the amount is Ksh 500 and the code isn't already used.</p>` + payments.map(paymentRow).join('')
          : '<p class="text-muted" style="padding:24px 0">No payments waiting. Manual M-Pesa codes show up here.</p>';
      } else if (activeTab === 'listings') {
        tc.innerHTML = listings.length ? listings.map(adminListingRow).join('') : '<p class="text-muted" style="padding:24px 0">No listings yet.</p>';
      } else {
        tc.innerHTML = landlords.length ? landlords.map(adminLandlordCard).join('') : '<p class="text-muted" style="padding:24px 0">No landlords have signed up yet.</p>';
      }
    }

    app().innerHTML = `
    <div class="dash-layout">
      ${dashSidebarHTML('admin', user)}
      <div class="dash-content">
        <div class="page-header"><h1>Admin</h1></div>
        <p class="page-lede">Everything on MyNyumba, across all landlords.</p>
        <div class="admin-stats">
          <div class="admin-stat"><strong>${stats.active_listings||0}</strong><span>Live listings</span></div>
          <div class="admin-stat"><strong>${stats.total_listings||0}</strong><span>All listings</span></div>
          <div class="admin-stat"><strong>${stats.landlords||0}</strong><span>Landlords</span></div>
          <div class="admin-stat"><strong>${stats.tenants||0}</strong><span>Tenants</span></div>
          <div class="admin-stat"><strong>${stats.total_unlocks||0}</strong><span>Paid unlocks</span></div>
          <div class="admin-stat"><strong>${stats.reported_listings||0}</strong><span>Reported houses</span></div>
        </div>
        <div class="admin-tabs" role="tablist">
          <button class="admin-tab ${activeTab==='payments'?'active':''}" id="tab-payments" role="tab" onclick="switchAdminTab('payments')">M-Pesa codes to check (${payments.length})</button>
          <button class="admin-tab ${activeTab==='listings'?'active':''}" id="tab-listings" role="tab" onclick="switchAdminTab('listings')">Listings (${listings.length})</button>
          <button class="admin-tab" id="tab-landlords" role="tab" onclick="switchAdminTab('landlords')">Landlords (${landlords.length})</button>
        </div>
        <div id="admin-tab-content"></div>
      </div>
    </div>`;

    window.switchAdminTab = function(tab) {
      activeTab = tab;
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      const tabEl = el('tab-' + tab);
      if (tabEl) tabEl.classList.add('active');
      renderTab();
    };
    window.reviewPayment = async function(id, action, code) {
      let note = '';
      if (action === 'approve' && !confirm(`Approve ${code}? Only do this if you can see a Ksh 500 payment with this code in your M-Pesa messages.`)) return;
      if (action === 'reject') { note = prompt(`Why are you rejecting ${code}? The tenant sees this.`, 'We couldn\'t find this payment in our M-Pesa statement.'); if (note === null) return; }
      const r = await API.adminReviewPayment(id, action, note);
      if (r.ok) { showToast(r.data.message, 'success'); Router.go('admin'); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
    window.adminSetStatus = async function(id, status) {
      const r = await API.updateListing(id, { status });
      if (r.ok) { showToast({ active: 'Listing is live.', let: 'Marked as let.', inactive: 'Listing hidden.' }[status] || 'Saved.', 'success'); Router.go('admin'); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
    window.adminDeleteListing = async function(id) {
      if (!confirm('Delete this listing for good? You can\'t undo this.')) return;
      const r = await API.deleteListing(id);
      if (r.ok) { showToast('Listing deleted.', 'success'); Router.go('admin'); }
      else showToast(r.data.error || 'Couldn\'t delete it. Try again.', 'error');
    };
    window.quickSuspend = async function(llid) {
      if (!confirm('Suspend this landlord and hide all their listings?')) return;
      const r = await API.adminSuspendLandlord(llid);
      if (r.ok) { showToast(r.data.message, 'success'); Router.go('admin'); }
      else showToast(r.data.error || 'That didn\'t work. Try again.', 'error');
    };
    renderTab();
  }

  async function scrollToHow() {
    if (!document.getElementById('how-it-works')) await home();
    history.replaceState({ route: 'how', params: {} }, '', '/#how-it-works');
    requestAnimationFrame(() => {
      const howEl = document.getElementById('how-it-works');
      if (howEl) howEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Expose adminLandlord so onclick in HTML strings can reach it
  function _adminLandlord(id) { adminLandlord(id); }

  return { home, browse, counties, listing, dashboard, addListing, editListing, unlocks, profile, admin, _adminLandlord, scrollToHow, footer: footerHTML };
})();
