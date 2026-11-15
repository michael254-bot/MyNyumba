/* uploader.js — Fast photo & video uploads for listings
   1. Photos are shrunk in the browser as soon as they're picked
      (max 1600px on the long edge, WebP/JPEG ~80%). A 6MB phone photo
      usually ends up around 250–400KB.
   2. Files go straight from the browser to Supabase Storage through a
      short-lived signed URL, so they never pass through Flask/gunicorn.
   3. Three files upload at the same time, each with its own progress bar.
   If the signed-URL endpoint isn't available, it falls back to the old
   POST /api/listings/<id>/media route (still compressed, still parallel). */
const Uploader = (() => {
  const MAX_EDGE     = 1600;
  const QUALITY      = 0.8;
  const MAX_PHOTOS   = 15;
  const MAX_PHOTO_MB = 25;   // before compression
  const MAX_VIDEO_MB = 50;   // Supabase free-tier object limit
  const CONCURRENCY  = 3;

  let webpOk = null;
  function supportsWebp() {
    if (webpOk === null) {
      try { webpOk = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); }
      catch (e) { webpOk = false; }
    }
    return webpOk;
  }

  function fmtSize(b) {
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(b / 1024)) + ' KB';
  }

  async function compressImage(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return file;
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      try { bmp = await createImageBitmap(file); } catch (e2) { return file; } // e.g. HEIC outside Safari
    }
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // PNG transparency -> white, not black
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const type = supportsWebp() ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise(res => canvas.toBlob(res, type, QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const ext = type === 'image/webp' ? 'webp' : 'jpg';
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.${ext}`, { type });
  }

  function extOf(file) {
    const m = /\.([a-z0-9]+)$/i.exec(file.name || '');
    if (m) return m[1].toLowerCase();
    return (file.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace('quicktime', 'mov');
  }

  /* XHR so we get upload progress (fetch can't report it) */
  function xhrSend(method, url, body, headers, onProgress) {
    return new Promise(resolve => {
      const x = new XMLHttpRequest();
      x.open(method, url);
      Object.entries(headers || {}).forEach(([k, v]) => x.setRequestHeader(k, v));
      x.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = () => {
        let data = {};
        try { data = JSON.parse(x.responseText || '{}'); } catch (e) {}
        resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, data });
      };
      x.onerror = () => resolve({ ok: false, status: 0, data: { error: 'Network error' } });
      x.ontimeout = x.onerror;
      x.send(body);
    });
  }

  let directSupported = true; // flips to false if the server has no /media/sign route

  async function uploadOne(listingId, item, sortOrder) {
    const file = item.blob;
    const onP = p => setProgress(item, p);
    if (directSupported) {
      const s = await API.signMedia(listingId, { media_type: item.type, ext: extOf(file), content_type: file.type || 'application/octet-stream' });
      if (s.ok && s.data.upload_url) {
        const put = await xhrSend('PUT', s.data.upload_url, file, { 'Content-Type': file.type || 'application/octet-stream' }, onP);
        if (!put.ok) {
          // Blocked by CORS or refused by storage: send the retry (and later files) through our server instead
          if (put.status === 0 || (put.status >= 400 && put.status < 500)) directSupported = false;
          return { ok: false, error: (put.data && (put.data.message || put.data.error)) || 'Upload failed' };
        }
        const c = await API.confirmMedia(listingId, { path: s.data.path, media_type: item.type, sort_order: sortOrder });
        return c.ok ? { ok: true } : { ok: false, error: c.data.error || 'Could not save file' };
      }
      if (s.status === 404 || s.status === 405 || s.status === 501) directSupported = false;
      else return { ok: false, error: s.data.error || 'Could not start upload' };
    }
    const fd = new FormData();
    fd.append('file', file); fd.append('media_type', item.type); fd.append('sort_order', sortOrder);
    const token = localStorage.getItem('mn_token') || '';
    const r = await xhrSend('POST', `/api/listings/${listingId}/media`, fd, token ? { Authorization: `Bearer ${token}` } : {}, onP);
    return r.ok ? { ok: true } : { ok: false, error: r.data.error || 'Upload failed' };
  }

  function setProgress(item, p) {
    item.progress = p;
    const bar = item.el && item.el.querySelector('.mp-bar i');
    if (bar) bar.style.width = Math.round(p * 100) + '%';
    const st = item.el && item.el.querySelector('.mp-state');
    if (st && item.status === 'uploading') st.textContent = p >= 0.999 ? 'Saving…' : Math.round(p * 100) + '%';
    if (item.owner && item.owner.onProgress) item.owner.onProgress();
  }

  function create({ gridId, summaryId, onChange }) {
    const items = [];
    let seq = 0;
    const inst = { items, onProgress: null };

    function grid() { return document.getElementById(gridId); }

    function renderSummary() {
      const s = document.getElementById(summaryId);
      if (!s) return;
      const photos = items.filter(i => i.type === 'photo').length;
      const videos = items.filter(i => i.type === 'video').length;
      if (!items.length) { s.innerHTML = ''; return; }
      const busy = items.some(i => i.status === 'compressing');
      const orig = items.reduce((a, i) => a + i.origSize, 0);
      const now  = items.reduce((a, i) => a + (i.blob ? i.blob.size : i.origSize), 0);
      s.innerHTML = busy
        ? `Shrinking photos so they upload faster…`
        : `<strong>${photos} of ${MAX_PHOTOS} photos${videos ? ` and ${videos} video${videos !== 1 ? 's' : ''}` : ''}</strong>, ${fmtSize(now)} to upload${now < orig * 0.9 ? `, down from ${fmtSize(orig)}` : ''}. The first photo is the cover; remove and re-add photos to change the order.`;
    }

    function renderItem(item) {
      const div = document.createElement('div');
      div.className = 'media-preview-item is-busy';
      const media = item.type === 'photo'
        ? `<img src="${item.url}" alt="" decoding="async"/>`
        : `<video src="${item.url}#t=0.5" muted playsinline preload="metadata"></video>`;
      div.innerHTML = `${media}<div class="mp-meta"><span class="mp-size">${item.type === 'video' ? 'Video' : 'Shrinking…'}</span></div>
        <div class="mp-state"></div>
        <div class="mp-bar"><i></i></div>
        <button type="button" class="mp-remove" aria-label="Remove"><i class="ti ti-x"></i></button>`;
      div.querySelector('.mp-remove').onclick = () => remove(item.id);
      item.el = div;
      grid().appendChild(div);
    }

    function refreshCover() {
      const firstPhoto = items.find(i => i.type === 'photo');
      items.forEach(i => {
        const b = i.el && i.el.querySelector('.mp-cover');
        if (i === firstPhoto && !b) i.el.insertAdjacentHTML('beforeend', '<span class="mp-cover">Cover</span>');
        if (i !== firstPhoto && b) b.remove();
      });
    }

    function changed() { refreshCover(); renderSummary(); if (onChange) onChange(); if (inst.onChange) inst.onChange(); }

    async function addFiles(fileList, type) {
      const files = Array.from(fileList || []);
      const errors = [];
      for (const file of files) {
        const isVideo = type === 'video' || /^video\//.test(file.type);
        const kind = isVideo ? 'video' : 'photo';
        if (kind === 'photo' && items.filter(i => i.type === 'photo').length >= MAX_PHOTOS) { errors.push(`You can add up to ${MAX_PHOTOS} photos.`); break; }
        if (kind === 'photo' && file.size > MAX_PHOTO_MB * 1048576) { errors.push(`${file.name} is over ${MAX_PHOTO_MB} MB.`); continue; }
        if (kind === 'video' && file.size > MAX_VIDEO_MB * 1048576) { errors.push(`${file.name} is ${fmtSize(file.size)}. Videos can be up to ${MAX_VIDEO_MB} MB, so trim it or record at 720p.`); continue; }
        const item = { id: ++seq, file, type: kind, blob: null, origSize: file.size, status: 'compressing', progress: 0, url: URL.createObjectURL(file), owner: inst };
        items.push(item);
        renderItem(item);
      }
      changed();
      // Compress in the background, one at a time so the page stays responsive
      for (const item of items.filter(i => i.status === 'compressing')) {
        item.blob = item.type === 'photo' ? await compressImage(item.file) : item.file;
        if (!items.includes(item)) continue; // removed while compressing
        item.status = 'ready';
        item.el.classList.remove('is-busy');
        const sz = item.el.querySelector('.mp-size');
        if (sz) sz.textContent = fmtSize(item.blob.size);
        changed();
      }
      return errors;
    }

    function remove(id) {
      const idx = items.findIndex(i => i.id === id);
      if (idx < 0) return;
      const [it] = items.splice(idx, 1);
      if (it.status === 'uploading') { items.splice(idx, 0, it); return; }
      URL.revokeObjectURL(it.url);
      it.el && it.el.remove();
      changed();
    }

    async function ready() {
      while (items.some(i => i.status === 'compressing')) await new Promise(r => setTimeout(r, 100));
    }

    /* Upload everything that isn't done yet. Photos first so the cover is in place early. */
    async function uploadAll(listingId, startOrder = 0) {
      await ready();
      const queue = items.filter(i => i.status !== 'done')
        .sort((a, b) => (a.type === b.type ? 0 : a.type === 'photo' ? -1 : 1));
      const order = new Map(items.filter(i => i.type === 'photo').concat(items.filter(i => i.type === 'video')).map((it, k) => [it, startOrder + k]));
      const failed = [];
      const block = grid() && grid().closest('.media-block'); if (block) block.classList.add('is-sending');
      queue.forEach(it => { it.el.classList.remove('is-error', 'is-done'); it.el.classList.add('is-queued'); const st = it.el.querySelector('.mp-state'); if (st) st.textContent = 'Waiting'; });
      async function worker() {
        while (queue.length) {
          const item = queue.shift();
          item.status = 'uploading'; item.el.classList.remove('is-queued'); item.el.classList.add('is-uploading'); setProgress(item, 0.02);
          let r = await uploadOne(listingId, item, order.get(item));
          if (!r.ok) r = await uploadOne(listingId, item, order.get(item)); // one retry for flaky mobile data
          item.el.classList.remove('is-uploading');
          if (r.ok) {
            item.status = 'done'; setProgress(item, 1); item.el.classList.add('is-done');
            const st = item.el.querySelector('.mp-state'); if (st) st.textContent = '✓ Uploaded';
          }
          else {
            item.status = 'error'; item.error = r.error; item.el.classList.add('is-error');
            const sz = item.el.querySelector('.mp-size'); if (sz) sz.textContent = 'Failed';
            failed.push(item);
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
      if (block) block.classList.remove('is-sending');
      return { ok: failed.length === 0, failed };
    }

    function totals() {
      const pending = items.filter(i => i.status !== 'done' || i.progress < 1);
      // Progress by file, so the overall figure matches what the tiles show
      const avg = items.length ? items.reduce((a, i) => a + (i.status === 'done' ? 1 : Math.min(0.95, i.progress || 0)), 0) / items.length : 0;
      return { fraction: Math.min(1, avg), sent: items.filter(i => i.status === 'done' || (i.progress || 0) >= 0.999).length, done: items.filter(i => i.status === 'done').length, count: items.length, pending: pending.length };
    }

    inst.addFiles = addFiles; inst.remove = remove; inst.uploadAll = uploadAll; inst.totals = totals; inst.ready = ready;
    inst.count = () => items.length;
    return inst;
  }

  /* Drag-and-drop onto an .upload-box */
  function bindDrop(boxId, onFiles) {
    const box = document.getElementById(boxId);
    if (!box) return;
    ['dragenter', 'dragover'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev => box.addEventListener(ev, e => { e.preventDefault(); box.classList.remove('dragover'); }));
    box.addEventListener('drop', e => onFiles(e.dataTransfer.files));
  }

  return { create, bindDrop, fmtSize };
})();
