// Photo gallery view: #/gallery and #/gallery/<sessionId>
import { store } from '../store.js';
import { icon, esc, fmtDate, fmtTime, openSession } from '../ui.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const scan = () => window.dispatchEvent(new CustomEvent('spark:scan'));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let S = null;

function on(target, ev, fn, opts) {
  target.addEventListener(ev, fn, opts);
  S.off.push(() => target.removeEventListener(ev, fn, opts));
}

function signature() {
  return JSON.stringify([
    store.getCategories().map((c) => [c.id, c.name]),
    store.getSessions().map((s) => [s.id, s.title, s.date, s.categoryId, store.getPhotos(s.id).map((p) => [p.id, p.thumb, p.caption])]),
  ]);
}

function routeId() {
  const m = /^#\/gallery\/([^/?#]+)/.exec(location.hash);
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

/* ------------------------------------------------------------------ mount */
function mount(root, params = []) {
  if (S) unmount();
  let id = '';
  try { id = params[0] ? decodeURIComponent(params[0]) : ''; } catch { id = params[0] || ''; }
  S = { root, albumId: id, cat: '', mode: 'albums', off: [], items: [], lb: null, sig: signature() };
  root.classList.add('gal-page');
  renderPage();

  // photos fade in once loaded and tell us their real shape
  on(root, 'load', onImgLoad, true);
  on(root, 'error', (e) => { if (e.target.tagName === 'IMG') e.target.closest('.gal-photo, .gal-fan__p')?.classList.add('is-loaded', 'is-broken'); }, true);

  on(root, 'click', (e) => {
    const t = e.target;
    const nav = t.closest('[data-album]');
    if (nav && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) { e.preventDefault(); navigate(nav.dataset.album); return; }
    const cat = t.closest('[data-cat]');
    if (cat) { S.cat = cat.dataset.cat; refreshBar(); renderContent(); return; }
    const mode = t.closest('[data-mode]');
    if (mode) { S.mode = mode.dataset.mode; refreshBar(); renderContent(); return; }
    const det = t.closest('[data-details]');
    if (det) { openSession(det.dataset.details); return; }
    const ph = t.closest('.gal-photo');
    if (ph) openLightbox(+ph.dataset.i, ph);
  });
  on(window, 'popstate', () => {
    if (!/^#\/gallery/.test(location.hash)) return;
    const next = routeId();
    if (next !== S.albumId) { S.albumId = next; closeLightbox(true); renderPage(); }
  });
  S.unsub = store.subscribe(() => {
    const sig = signature();
    if (sig === S.sig) return;
    S.sig = sig;
    if (S.cat && !store.getCategory(S.cat)) S.cat = '';
    if (S.lb) return; // do not disturb an open photo
    renderPage(true);
  });
}

function unmount() {
  if (!S) return;
  closeLightbox(true);
  S.off.forEach((f) => f());
  S.unsub?.();
  S.root.classList.remove('gal-page');
  S = null;
}

function navigate(id) {
  const hash = id ? `#/gallery/${encodeURIComponent(id)}` : '#/gallery';
  if (location.hash !== hash) history.pushState(null, '', hash);
  S.albumId = id;
  renderPage();
  if (window.__lenis?.scrollTo) window.__lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
}

function onImgLoad(e) {
  const img = e.target;
  if (img.tagName !== 'IMG') return;
  const box = img.closest('.gal-photo, .gal-fan__p');
  if (!box) return;
  if (box.classList.contains('gal-photo') && img.naturalWidth) box.style.setProperty('--ar', `${img.naturalWidth} / ${img.naturalHeight}`);
  box.classList.add('is-loaded');
}

/* ------------------------------------------------------------------ pages */
function head(kicker, title, lead) {
  return `<header class="gal-head">
    <span class="eyebrow" data-reveal>${kicker}</span>
    <h1 class="h-section" data-reveal style="--i:1">${title}</h1>
    ${lead ? `<p class="lead" data-reveal style="--i:2">${lead}</p>` : ''}
  </header>`;
}

function renderPage(soft) {
  const root = S.root;
  if (!S.albumId) {
    root.innerHTML = `<section class="gal container">
      ${head('Photo gallery', 'Moments we <span class="fire-text">lit up</span>', 'Every Saturday, festival and morning class leaves a trail of faces and flames. Pick an album and relive it.')}
      <div class="gal-bar" data-reveal style="--i:3" data-bar></div>
      <div data-content></div>
    </section>`;
    refreshBar();
    renderContent(soft);
  } else {
    renderAlbum(soft);
  }
  scan();
}

function refreshBar() {
  const bar = S.root.querySelector('[data-bar]');
  if (!bar) return;
  const cats = store.getCategories();
  bar.innerHTML = `
    <div class="filters" role="group" aria-label="Filter by event">
      <button type="button" data-cat="" aria-pressed="${!S.cat}">All events</button>
      ${cats.map((c) => `<button type="button" data-cat="${esc(c.id)}" aria-pressed="${S.cat === c.id}">${esc(c.name)}</button>`).join('')}
    </div>
    <div class="gal-mode" role="group" aria-label="View">
      <button type="button" data-mode="albums" aria-pressed="${S.mode === 'albums'}">${icon('grid')} Albums</button>
      <button type="button" data-mode="wall" aria-pressed="${S.mode === 'wall'}">${icon('image')} All photos</button>
    </div>`;
}

function albums() {
  return store.getAlbums().filter((s) => !S.cat || s.categoryId === S.cat);
}

const FAN = {
  1: [{ x: 0, r: -1, hx: 0, hr: 0 }],
  2: [{ x: -15, r: -6, hx: -32, hr: -11 }, { x: 15, r: 5, hx: 32, hr: 10 }],
  3: [{ x: -26, r: -9, hx: -48, hr: -15 }, { x: 26, r: 8, hx: 48, hr: 14 }, { x: 0, r: -1, hx: 0, hr: 0 }],
};

function renderContent() {
  const box = S.root.querySelector('[data-content]');
  const list = albums();
  S.items = [];
  if (!list.length) {
    box.innerHTML = `<div class="empty gal-empty" data-reveal><p>${S.cat ? 'No photos for this event yet.' : 'No photos yet. The first album will land here soon.'}</p>${S.cat ? '<button class="btn btn--ghost btn--sm" data-cat="">Show all events</button>' : ''}</div>`;
    scan();
    return;
  }
  const nPhotos = list.reduce((n, s) => n + store.photoCount(s.id), 0);
  const summary = `<p class="gal-summary muted" aria-live="polite">${plural(list.length, 'album')} · ${plural(nPhotos, 'photo')}</p>`;

  if (S.mode === 'wall') {
    let i = 0;
    const cells = [];
    list.forEach((s) => store.getPhotos(s.id).forEach((p) => { S.items.push({ p, s }); cells.push(photoCell(p, s, i++, true)); }));
    box.innerHTML = `${summary}<div class="gal-masonry" data-masonry>${cells.join('')}</div>`;
    hydrate(box);
  } else {
    box.innerHTML = `${summary}<div class="gal-albums">${list.map((s, i) => albumCard(s, i)).join('')}</div>`;
    hydrate(box);
  }
  scan();
}

function albumCard(s, i) {
  const cat = store.getCategory(s.categoryId);
  const photos = store.getPhotos(s.id);
  const pick = photos.slice(0, 3);
  const f = FAN[pick.length];
  const fan = pick.map((p, k) => `<span class="gal-fan__p" style="--x:${f[k].x}%;--r:${f[k].r}deg;--hx:${f[k].hx}%;--hr:${f[k].hr}deg"><img alt="" loading="lazy" decoding="async" data-ref="${esc(p.thumb || p.src)}"></span>`).join('');
  return `<a class="gal-album card" href="#/gallery/${encodeURIComponent(s.id)}" data-album="${esc(s.id)}" data-spot data-reveal style="--i:${i % 6}" data-cursor="Open" aria-label="Open album: ${esc(s.title)}, ${plural(photos.length, 'photo')}">
    <span class="gal-fan" data-n="${pick.length}">${fan}</span>
    <span class="gal-album__body">
      <span class="chip chip--hot">${esc(cat?.name || 'Event')}</span>
      <span class="gal-album__title">${esc(s.title)}</span>
      <span class="gal-album__meta">${esc(fmtDate(s.date))}<i></i>${plural(photos.length, 'photo')}</span>
    </span>
  </a>`;
}

function photoCell(p, s, i, showAlbum) {
  const label = p.caption || `${s.title}, photo ${i + 1}`;
  return `<button type="button" class="gal-photo" data-i="${i}" data-reveal="zoom" style="--i:${i % 5}" data-cursor="View" aria-label="View photo: ${esc(label)}">
    <img alt="${esc(p.caption || s.title)}" loading="lazy" decoding="async" data-ref="${esc(p.thumb || p.src)}">
    ${showAlbum ? `<span class="gal-photo__cap">${esc(s.title)}</span>` : (p.caption ? `<span class="gal-photo__cap">${esc(p.caption)}</span>` : '')}
  </button>`;
}

/** Give every image with data-ref its src (handles media: references). */
function hydrate(scope) {
  scope.querySelectorAll('img[data-ref]').forEach((img) => {
    const ref = img.dataset.ref;
    img.removeAttribute('data-ref');
    store.setImage(img, ref);
  });
}

function renderAlbum() {
  const s = store.getSession(S.albumId);
  const back = `<a class="back gal-back" href="#/gallery" data-album="">${icon('arrow-left')} All albums</a>`;
  S.items = [];
  if (!s) {
    S.root.innerHTML = `<section class="gal container">${back}
      <div class="empty gal-empty" data-reveal><h2 class="h-card">We could not find that album</h2><p>It may have been moved or removed.</p><a class="btn btn--sm" href="#/gallery" data-album="">${icon('image')} Browse all albums</a></div></section>`;
    return;
  }
  const cat = store.getCategory(s.categoryId);
  const photos = store.getPhotos(s.id);
  const meta = [fmtDate(s.date), fmtTime(s.time), s.venue].filter(Boolean).map(esc).join('<i></i>');
  const headHtml = `<header class="gal-head gal-head--album">
    ${back}
    <div class="gal-head__row">
      <div>
        <div class="gal-head__chips" data-reveal><span class="chip chip--hot">${esc(cat?.name || 'Event')}</span><span class="chip">${icon('image')} ${plural(photos.length, 'photo')}</span></div>
        <h1 class="h-section" data-reveal style="--i:1">${esc(s.title)}</h1>
        <p class="gal-album__meta gal-album__meta--lg" data-reveal style="--i:2">${meta}</p>
      </div>
      <button class="btn btn--ghost" data-details="${esc(s.id)}" data-magnetic data-reveal style="--i:3">Session details ${icon('arrow')}</button>
    </div>
  </header>`;
  if (!photos.length) {
    S.root.innerHTML = `<section class="gal container">${headHtml}
      <div class="empty gal-empty" data-reveal><h2 class="h-card">No photos from this session yet</h2><p>Photos are added after each session. Check back soon.</p><a class="btn btn--ghost btn--sm" href="#/gallery" data-album="">Browse other albums</a></div></section>`;
    return;
  }
  photos.forEach((p) => S.items.push({ p, s }));
  S.root.innerHTML = `<section class="gal container">${headHtml}
    <div class="gal-masonry" data-masonry>${photos.map((p, i) => photoCell(p, s, i, false)).join('')}</div></section>`;
  hydrate(S.root);
}

/* ------------------------------------------------------------------ lightbox */
function openLightbox(index, opener) {
  if (!S.items.length || S.lb) return;
  const el = document.createElement('div');
  el.className = 'gal-lb';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Photo viewer');
  el.setAttribute('data-lenis-prevent', ''); el.tabIndex = -1;
  el.innerHTML = `
    <div class="gal-lb__top">
      <span class="gal-lb__count" aria-live="polite"></span>
      <button type="button" class="icon-btn gal-lb__close" data-lb="close" aria-label="Close photo viewer">${icon('x')}</button>
    </div>
    <button type="button" class="icon-btn gal-lb__nav gal-lb__nav--prev" data-lb="prev" aria-label="Previous photo">${icon('chevron-left')}</button>
    <figure class="gal-lb__stage">
      <img class="gal-lb__img" alt="" draggable="false">
      <figcaption class="gal-lb__cap"></figcaption>
    </figure>
    <button type="button" class="icon-btn gal-lb__nav gal-lb__nav--next" data-lb="next" aria-label="Next photo">${icon('chevron')}</button>`;
  document.body.append(el);
  const lb = S.lb = {
    el, i: index, tok: 0, opener, items: S.items.slice(),
    img: el.querySelector('.gal-lb__img'), cap: el.querySelector('.gal-lb__cap'), count: el.querySelector('.gal-lb__count'),
    off: [],
  };
  const addL = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); lb.off.push(() => t.removeEventListener(ev, fn, o)); };

  document.body.classList.add('is-locked');
  window.__lenis?.stop();

  addL(el, 'click', (e) => {
    const b = e.target.closest('[data-lb]');
    if (b) { const k = b.dataset.lb; if (k === 'close') closeLightbox(); else step(k === 'next' ? 1 : -1); return; }
    if (!e.target.closest('.gal-lb__img, .gal-lb__cap')) closeLightbox();
  });
  addL(document, 'keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeLightbox(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Tab') {
      const f = [...el.querySelectorAll('button:not([disabled])')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      e.preventDefault();
      f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length].focus();
    }
  }, true);
  let sx = 0, sy = 0;
  addL(el, 'touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  addL(el, 'touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  show(index, 0);
  requestAnimationFrame(() => { el.classList.add('is-open'); el.querySelector('.gal-lb__close').focus({ preventScroll: true }); });
}

function step(d) {
  const lb = S?.lb; if (!lb) return;
  const n = lb.items.length;
  if (n < 2) return;
  show((lb.i + d + n) % n, d);
}

function show(i, dir) {
  const lb = S.lb;
  lb.i = i;
  const { p, s } = lb.items[i];
  const tok = ++lb.tok;
  const n = lb.items.length;
  lb.count.textContent = `${i + 1} / ${n}`;
  lb.el.classList.toggle('is-single', n < 2);
  lb.img.alt = p.caption || s.title;
  lb.cap.innerHTML = `${p.caption ? `<b>${esc(p.caption)}</b>` : ''}<small>${esc(s.title)} · ${esc(fmtDate(s.date))}</small>`;

  const img = lb.img;
  img.classList.remove('is-in', 'is-from-next', 'is-from-prev');
  if (!reduced()) { void img.offsetWidth; img.classList.add(dir > 0 ? 'is-from-next' : dir < 0 ? 'is-from-prev' : 'is-in'); }
  img.classList.add('is-low');
  store.setImage(img, p.thumb || p.src);
  if (p.src && p.src !== p.thumb) {
    store.resolveImage(p.src).then((url) => {
      if (!url || !S?.lb || tok !== lb.tok) return;
      const pre = new Image();
      pre.onload = () => { if (S?.lb && tok === lb.tok) { img.src = url; img.classList.remove('is-low'); } };
      pre.src = url;
    });
  } else {
    img.classList.remove('is-low');
  }
  // preload neighbours
  [1, -1].forEach((d) => {
    const nb = lb.items[(i + d + n) % n];
    if (nb && nb !== lb.items[i]) store.resolveImage(nb.p.src || nb.p.thumb).then((u) => { if (u) new Image().src = u; });
  });
}

function closeLightbox(silent) {
  const lb = S?.lb; if (!lb) return;
  S.lb = null;
  lb.off.forEach((f) => f());
  lb.el.classList.remove('is-open');
  document.body.classList.remove('is-locked');
  window.__lenis?.start();
  setTimeout(() => lb.el.remove(), silent ? 0 : 420);
  if (silent) { lb.el.remove(); return; }
  const target = lb.opener?.isConnected ? lb.opener : S.root.querySelector('.gal-photo');
  target?.focus?.({ preventScroll: true });
}

export default { mount, unmount };
