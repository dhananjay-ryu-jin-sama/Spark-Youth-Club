// Spark Youth Club admin panel.
// Everything goes through the store (assets/js/store.js). Lists re-render on store changes;
// forms live in modals so typing is never interrupted by a re-render underneath.
import { store } from './store.js';
import { icon, esc, fmtDate, fmtTime, toast, openModal } from './ui.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DEFAULT_VENUE = 'Ashraya Library, ISKCON Coimbatore';

const VIEWS = [
  { id: 'overview', label: 'Overview', icon: 'grid', eyebrow: 'Dashboard' },
  { id: 'events', label: 'Events', icon: 'flame', eyebrow: 'Shown on the home page' },
  { id: 'sessions', label: 'Sessions', icon: 'calendar', eyebrow: 'Dated sessions inside each event' },
  { id: 'gallery', label: 'Gallery', icon: 'image', eyebrow: 'Photos for each session' },
  { id: 'registrations', label: 'Registrations', icon: 'users', eyebrow: 'Visitor sign-ups' },
  { id: 'settings', label: 'Settings', icon: 'lock', eyebrow: 'Account and danger zone', desktopOnly: true },
];

const st = {
  screen: null,            // 'login' | 'dash'
  view: 'overview',
  built: new Set(),
  sessions: { cat: '', q: '', when: 'all', order: 'desc' },
  gallery: { cat: '', sid: '' },
  regs: { q: '', occ: 'all', data: null, loading: false },
};

/* ================================================================== helpers */
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const fillIcons = (root = document) => $$('[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); });

// Images: render a placeholder <img data-img=k>, then hydrate() hands the reference to store.setImage.
const imgRefs = new Map();
let imgSeq = 0;
function img(ref, fallback, alt = '') {
  if (!ref && !fallback) return `<span class="ph" aria-hidden="true">${icon('image')}</span>`;
  const k = String(++imgSeq);
  imgRefs.set(k, [ref, fallback]);
  return `<img data-img="${k}" alt="${esc(alt)}" decoding="async">`;
}
function hydrate(root) {
  $$('img[data-img]', root).forEach((el) => {
    const v = imgRefs.get(el.dataset.img);
    imgRefs.delete(el.dataset.img);
    el.removeAttribute('data-img');
    if (!v) return;
    el.addEventListener('error', () => el.classList.add('is-broken'), { once: true });
    const [ref, fb] = v;
    store.setImage(el, ref || fb, ref ? fb : undefined);
  });
}

/** Run an async action with a busy button, a success toast and a readable error. Resolves { ok, value, error }. */
async function run(btn, busyLabel, fn, success) {
  const prev = btn ? btn.innerHTML : '';
  if (btn) {
    btn.style.minWidth = btn.offsetWidth + 'px';
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = `<span class="adm-spin" aria-hidden="true"></span><span>${esc(busyLabel)}</span>`;
  }
  try {
    const value = await fn();
    if (success) toast(success, 'check');
    return { ok: true, value };
  } catch (e) {
    console.error(e);
    const error = (e && e.message) || 'Something went wrong. Please try again.';
    toast(error, 'x', 6500);
    return { ok: false, error };
  } finally {
    if (btn && btn.isConnected) {
      btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = prev; btn.style.minWidth = '';
    }
  }
}

function daysUntil(s) {
  const d = store.sessionDate(s); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const n = Math.round((d - t) / 86400000);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}
function totalPhotos(sessions = store.getSessions()) { return sessions.reduce((a, s) => a + store.photoCount(s.id), 0); }
function catName(id) { return store.getCategory(id)?.name || 'No event'; }

function emptyState(iconName, title, text, actionHtml = '') {
  return `<div class="empty adm-empty">${icon(iconName)}<b>${esc(title)}</b><p>${esc(text)}</p>${actionHtml}</div>`;
}

/** Small confirmation dialog. typeToConfirm: the text the admin must type; ack: a checkbox they must tick. */
function confirmDialog({ title, body, confirmLabel, busyLabel, typeToConfirm, ack, action, success, danger = true }) {
  const m = openModal(`<form class="af af--sm" novalidate>
      <div class="af__head"><p class="eyebrow">${danger ? 'Please confirm' : 'Confirm'}</p><h2>${esc(title)}</h2></div>
      <div class="af__body">
        <div class="af__text">${body}</div>
        ${typeToConfirm ? `<label class="field"><span>Type <b class="af__code">${esc(typeToConfirm)}</b> to confirm</span>
          <input name="typed" autocomplete="off" autocapitalize="none" spellcheck="false"></label>` : ''}
        ${ack ? `<label class="check"><input type="checkbox" name="ack"><span>${esc(ack)}</span></label>` : ''}
        <p class="af__error" role="alert"></p>
      </div>
      <div class="af__foot">
        <button type="button" class="btn btn--ghost btn--sm" data-close>Cancel</button>
        <button type="submit" class="btn btn--sm ${danger ? 'btn--danger' : ''}" data-ok>${esc(confirmLabel)}</button>
      </div></form>`, { small: true, label: title });
  const form = $('form', m.panel);
  const ok = $('[data-ok]', form);
  const check = () => {
    let good = true;
    if (typeToConfirm) good = good && form.typed.value.trim().toLowerCase() === typeToConfirm.trim().toLowerCase();
    if (ack) good = good && form.ack.checked;
    ok.disabled = !good;
  };
  if (typeToConfirm || ack) { check(); form.addEventListener('input', check); form.addEventListener('change', check); }
  requestAnimationFrame(() => (form.typed || form.ack || ok).focus());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ok.disabled) return;
    const r = await run(ok, busyLabel || 'Working', action, success);
    if (r.ok) m.close(); else $('.af__error', form).textContent = r.error;
  });
  return m;
}

/* ---------------------------------------------------------- image picker */
function picker(name, label, ref, fallback, hint) {
  return `<div class="field up" data-up="${name}">
    <span class="label" id="up-${name}-label">${esc(label)}</span>
    <div class="up__preview" data-preview>${img(ref, fallback, label + ' preview')}</div>
    <div class="up__row">
      <label class="btn btn--ghost btn--sm up__btn">${icon('upload')}<span data-up-text>${ref || fallback ? 'Replace image' : 'Choose image'}</span>
        <input type="file" name="${name}" accept="image/*" class="sr-only" aria-labelledby="up-${name}-label"></label>
      <button type="button" class="btn btn--ghost btn--sm" data-up-undo hidden>Undo</button>
    </div>
    <small class="hint">${esc(hint)}</small>
  </div>`;
}
function wirePicker(root, name) {
  const box = $(`[data-up="${name}"]`, root);
  const input = $('input[type=file]', box);
  const preview = $('[data-preview]', box);
  const undo = $('[data-up-undo]', box);
  const original = preview.innerHTML;
  let url = null;
  const set = (file) => {
    if (url) URL.revokeObjectURL(url);
    url = null;
    if (!file) { preview.innerHTML = original; undo.hidden = true; return; }
    if (!/^image\//.test(file.type)) { toast('That file is not an image.', 'x'); input.value = ''; return; }
    url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" alt="New image preview">`;
    undo.hidden = false;
  };
  input.addEventListener('change', () => set(input.files[0]));
  undo.addEventListener('click', () => { input.value = ''; set(null); });
  preview.addEventListener('dragover', (e) => { e.preventDefault(); preview.classList.add('is-over'); });
  preview.addEventListener('dragleave', () => preview.classList.remove('is-over'));
  preview.addEventListener('drop', (e) => {
    e.preventDefault(); preview.classList.remove('is-over');
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; set(f);
  });
  return { file: () => input.files[0] || null, cleanup: () => url && URL.revokeObjectURL(url) };
}

/* ================================================================== theme */
function syncTheme() {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  $$('[data-theme-toggle]').forEach((b) => {
    b.innerHTML = icon(light ? 'moon' : 'sun');
    b.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  });
  $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.themeSet === 'light') === light)));
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = light ? '#FBF5EC' : '#0c0a09';
}
function setTheme(light) {
  if (light) document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem('spark.theme', light ? 'light' : 'dark'); } catch { /* private mode */ }
  syncTheme();
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-theme-toggle]')) setTheme(document.documentElement.getAttribute('data-theme') !== 'light');
  const set = e.target.closest('[data-theme-set]');
  if (set) setTheme(set.dataset.themeSet === 'light');
  const out = e.target.closest('[data-logout]');
  if (out) doLogout(out);
});

/* ================================================================== screens */
function showLogin() {
  st.screen = 'login';
  $('#boot').hidden = true; $('#dash').hidden = true; $('#login').hidden = false;
  document.title = 'Admin sign in | Spark Youth Club';
  requestAnimationFrame(() => $('#login-user').focus());
}
function showDash() {
  st.screen = 'dash';
  $('#boot').hidden = true; $('#login').hidden = true; $('#dash').hidden = false;
  $('#login-form').reset(); $('#login-error').textContent = '';
  renderBanner();
  route();
  if (store.admin.mode === 'firebase') loadRegs();
}
function sync() {
  const a = store.admin;
  if (a.loggedIn && st.screen !== 'dash') showDash();
  else if (!a.loggedIn && st.screen !== 'login') { st.regs.data = null; showLogin(); }
  else if (st.screen === 'dash') { renderBanner(); scheduleRender(); }
}
let raf = 0;
function scheduleRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; renderCurrent(); });
}

/* ---------------------------------------------------------------- login */
function wireLogin() {
  fillIcons($('#login'));
  const form = $('#login-form');
  const err = $('#login-error');
  const pass = $('#login-pass');
  const tog = $('#pw-toggle');
  tog.innerHTML = 'Show';
  tog.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    tog.textContent = show ? 'Hide' : 'Show';
    tog.setAttribute('aria-pressed', String(show));
    tog.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  form.addEventListener('input', () => { err.textContent = ''; form.classList.remove('is-shake'); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = form.username.value.trim();
    const pw = form.password.value;
    if (!user || !pw) { err.textContent = !user ? 'Enter your username.' : 'Enter your password.'; (!user ? form.username : form.password).focus(); return; }
    const btn = $('#login-submit');
    const prev = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="adm-spin" aria-hidden="true"></span><span>Signing in</span>';
    let r;
    try { r = await store.login(user, pw); } catch (ex) { r = { ok: false, message: ex.message || 'Could not sign in. Check your connection.' }; }
    btn.disabled = false; btn.innerHTML = prev;
    if (!r.ok) {
      err.textContent = r.message || 'Could not sign in.';
      form.classList.remove('is-shake'); void form.offsetWidth; form.classList.add('is-shake');
      form.password.select();
      return;
    }
    if (st.screen !== 'dash') sync();
    toast(r.mode === 'demo' ? 'Signed in. Demo mode: changes stay in this browser.' : (r.message || 'Signed in.'), 'check');
  });
}

async function doLogout(btn) {
  const r = await run(btn, 'Logging out', () => store.logout());
  if (r.ok) { st.regs.data = null; toast('Logged out.', 'logout'); }
}

function renderBanner() {
  const b = $('#demo-banner');
  const demo = store.admin.mode === 'demo';
  b.hidden = !demo;
  if (demo) {
    b.innerHTML = `${icon('lock')}<p><b>Demo mode.</b> Sign-in with Firebase is not set up yet, so changes are saved in this browser only and visitors will not see them. Follow the steps in <code>SETUP.md</code> to publish changes for everyone.</p>`;
  }
}

/* ================================================================== routing + nav */
function buildNav() {
  const item = (v, cls) => `<a class="${cls}" href="#${v.id}" data-nav="${v.id}">${icon(v.icon)}<span>${esc(v.label)}</span><b class="adm-nav__n" data-count="${v.id}"></b></a>`;
  $('#adm-nav').innerHTML = VIEWS.map((v) => item(v, 'adm-nav__item')).join('');
  $('#adm-tabs').innerHTML = VIEWS.filter((v) => !v.desktopOnly).map((v) => item(v, 'adm-tabs__item')).join('');
}
function updateCounts() {
  const sessions = store.getSessions();
  const counts = {
    events: store.getCategories().length,
    sessions: sessions.length,
    gallery: totalPhotos(sessions),
    registrations: st.regs.data?.items?.length || '',
  };
  $$('[data-count]').forEach((el) => { const v = counts[el.dataset.count]; el.textContent = v === undefined ? '' : String(v); });
}

function route() {
  if (st.screen !== 'dash') return;
  const [id, ...rest] = location.hash.slice(1).split('/');
  const v = VIEWS.find((x) => x.id === id) || VIEWS[0];
  const param = rest.length ? decodeURIComponent(rest.join('/')) : '';
  if (v.id === 'sessions' && param) st.sessions.cat = store.getCategory(param) ? param : '';
  if (v.id === 'gallery' && param) {
    const s = store.getSession(param);
    if (s) { st.gallery.sid = s.id; st.gallery.cat = s.categoryId; }
    else if (store.getCategory(param)) { st.gallery.cat = param; st.gallery.sid = ''; }
  }
  const changed = st.view !== v.id;
  st.view = v.id;
  $$('.adm-view').forEach((el) => { el.hidden = el.dataset.view !== v.id; });
  $$('[data-nav]').forEach((a) => { if (a.dataset.nav === v.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#view-title').textContent = v.label;
  $('#view-eyebrow').textContent = v.eyebrow;
  document.title = `${v.label} | Spark admin`;
  if (v.id === 'registrations' && store.admin.mode === 'firebase') loadRegs();
  renderCurrent();
  if (changed) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

function renderCurrent() {
  if (st.screen !== 'dash') return;
  const el = $(`.adm-view[data-view="${st.view}"]`);
  const R = RENDER[st.view];
  if (!st.built.has(st.view) && R.setup) { R.setup(el); st.built.add(st.view); }
  R.render(el);
  hydrate(el);
  updateCounts();
}

/* ================================================================== overview */
function renderOverview(el) {
  const cats = store.getCategories();
  const sessions = store.getSessions();
  const upcoming = store.getUpcoming();
  const next = upcoming[0];
  const photos = totalPhotos(sessions);
  const mode = store.admin.mode;
  const regs = st.regs.data;
  const regCount = mode !== 'firebase' ? '' : regs?.items ? String(regs.items.length) : (st.regs.loading ? '' : '');
  const regNote = mode !== 'firebase' ? 'Needs Firebase sign-in' : regs?.error ? 'Could not load' : !regs ? 'Loading' : 'Total sign-ups';

  const stat = (href, ic, label, value, note) => `<a class="stat card" href="${href}">
      <span class="stat__ic">${icon(ic)}</span>
      <span class="stat__label">${esc(label)}</span>
      <b class="stat__n">${value === '' ? '<span class="stat__dash">-</span>' : esc(value)}</b>
      <small>${esc(note)}</small></a>`;

  let regList;
  if (mode !== 'firebase') regList = emptyState('lock', 'Not available in demo mode', 'Registrations are stored in Firebase and can be read here once Firebase sign-in is set up.');
  else if (!regs) regList = `<div class="ov-loading"><span class="adm-spin" aria-hidden="true"></span> Loading registrations</div>`;
  else if (regs.error) regList = `<p class="muted ov-note">${regs.error === 'rules' ? 'Firebase refused to share registrations. Check the database rules in SETUP.md.' : 'Could not load registrations: ' + esc(regs.error)}</p>`;
  else if (!regs.items.length) regList = `<p class="muted ov-note">No registrations yet.</p>`;
  else regList = `<ul class="ov-regs">${regs.items.slice(0, 5).map((r) => `<li>
      <span class="ov-regs__av" aria-hidden="true">${esc((r.name || '?').trim().charAt(0).toUpperCase())}</span>
      <span class="ov-regs__main"><b>${esc(r.name)}</b><small>${esc(r.occupation || '')}${r.place ? ' at ' + esc(r.place) : ''}</small></span>
      <span class="ov-regs__when">${esc(r.formattedDate || '')}<small>${esc(r.formattedTime || '')}</small></span></li>`).join('')}</ul>`;

  el.innerHTML = `
    <div class="stats">
      ${stat('#events', 'flame', 'Events', String(cats.length), 'Shown on the home page')}
      ${stat('#sessions', 'calendar', 'Sessions', String(sessions.length), 'Across all events')}
      ${stat('#sessions', 'clock', 'Upcoming', String(upcoming.length), next ? 'Next: ' + daysUntil(next).toLowerCase() : 'None scheduled')}
      ${stat('#gallery', 'image', 'Photos', String(photos), plural(store.getAlbums().length, 'album'))}
      ${stat('#registrations', 'users', 'Registrations', regCount, regNote)}
    </div>
    <div class="ov-grid">
      <article class="card panel ov-next">
        <header class="panel__head"><h2 class="panel__title">Next session</h2>${next ? `<span class="chip chip--hot"><i class="dot-live"></i> ${esc(daysUntil(next))}</span>` : ''}</header>
        ${next ? `<div class="ov-next__body">
            <div class="ov-next__poster">${img(next.posterSm || next.poster, null, 'Poster: ' + next.title)}</div>
            <div class="ov-next__info">
              <span class="chip">${esc(catName(next.categoryId))}</span>
              <h3 class="h-card">${esc(next.title)}</h3>
              <ul class="meta-list">
                <li>${icon('calendar')} ${esc(fmtDate(next.date, 'long'))}</li>
                <li>${icon('clock')} ${esc(fmtTime(next.time) || 'Time not set')}</li>
                <li>${icon('pin')} ${esc(next.venue || 'Venue not set')}</li>
                ${next.speaker ? `<li>${icon('mic')} ${esc(next.speaker)}</li>` : ''}
              </ul>
              <div class="row-actions"><button class="btn btn--sm" data-edit-session="${esc(next.id)}">${icon('edit')} Edit session</button>
              <a class="btn btn--ghost btn--sm" href="#gallery/${encodeURIComponent(next.id)}">${icon('image')} Photos</a></div>
            </div></div>`
        : emptyState('calendar', 'No upcoming sessions', 'Add a session with a future date and it will show up here and on the website.', `<button class="btn btn--sm" data-new-session>${icon('plus')} New session</button>`)}
      </article>
      <article class="card panel ov-latest">
        <header class="panel__head"><h2 class="panel__title">Latest registrations</h2><a class="panel__link" href="#registrations">See all ${icon('chevron')}</a></header>
        ${regList}
      </article>
      <article class="card panel ov-quick">
        <header class="panel__head"><h2 class="panel__title">Quick actions</h2></header>
        <div class="quick">
          <button class="quick__item" data-new-session>${icon('calendar')}<span><b>New session</b><small>Date, venue and poster</small></span></button>
          <button class="quick__item" data-new-event>${icon('flame')}<span><b>New event</b><small>Appears on the home page</small></span></button>
          <a class="quick__item" href="#gallery">${icon('upload')}<span><b>Upload photos</b><small>Pick an event and a session</small></span></a>
          <a class="quick__item" href="#registrations">${icon('download')}<span><b>Export registrations</b><small>Download as CSV</small></span></a>
        </div>
      </article>
    </div>`;
}

/* ================================================================== events */
function setupEvents(el) {
  el.innerHTML = `<div class="toolbar">
      <p class="toolbar__text muted">Each event appears on the home page in this order. Sessions are added inside an event.</p>
      <button class="btn btn--sm toolbar__cta" data-new-event>${icon('plus')} New event</button>
    </div>
    <div data-list></div>`;
}
function renderEvents(el) {
  const list = $('[data-list]', el);
  const cats = store.getCategories();
  if (!cats.length) {
    list.innerHTML = emptyState('flame', 'No events yet', 'Create your first event, for example TGIS or Siksha. It will appear on the home page right away.', `<button class="btn btn--sm" data-new-event>${icon('plus')} New event</button>`);
    return;
  }
  list.innerHTML = `<div class="ev-grid">${cats.map((c, i) => {
    const ss = store.getSessions({ categoryId: c.id });
    const up = ss.filter(store.isUpcoming).length;
    const ph = totalPhotos(ss);
    return `<article class="card ev" style="--ev-accent:${esc(safeColor(c.accent))}">
      <div class="ev__cover">${img(c.coverSm || c.cover, null, 'Cover: ' + c.name)}
        <span class="ev__idx">${String(i + 1).padStart(2, '0')}</span></div>
      <div class="ev__body">
        <h3 class="ev__name">${esc(c.name)}</h3>
        ${c.tagline ? `<p class="ev__tag">${esc(c.tagline)}</p>` : ''}
        <div class="ev__stats">
          <span>${icon('calendar')} ${plural(ss.length, 'session')}</span>
          <span>${icon('clock')} ${up} upcoming</span>
          <span>${icon('image')} ${plural(ph, 'photo')}</span>
        </div>
      </div>
      <div class="ev__actions">
        <div class="ev__order" role="group" aria-label="Order of ${esc(c.name)}">
          <button class="icon-btn icon-btn--sm" data-move="${esc(c.id)}" data-dir="-1" aria-label="Move ${esc(c.name)} up" ${i === 0 ? 'disabled' : ''}><span class="rot-up">${icon('chevron')}</span></button>
          <button class="icon-btn icon-btn--sm" data-move="${esc(c.id)}" data-dir="1" aria-label="Move ${esc(c.name)} down" ${i === cats.length - 1 ? 'disabled' : ''}><span class="rot-down">${icon('chevron')}</span></button>
        </div>
        <a class="btn btn--ghost btn--sm" href="#sessions/${encodeURIComponent(c.id)}">Sessions</a>
        <button class="btn btn--ghost btn--sm" data-edit-event="${esc(c.id)}">${icon('edit')} Edit</button>
        <button class="icon-btn icon-btn--sm icon-btn--danger" data-del-event="${esc(c.id)}" aria-label="Delete ${esc(c.name)}">${icon('trash')}</button>
      </div>
    </article>`;
  }).join('')}</div>`;
}
function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#FF6F00'; }

async function moveEvent(id, dir, btn) {
  const cats = store.getCategories();
  const i = cats.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  const r = await run(btn, '', async () => {
    for (let k = 0; k < cats.length; k++) {
      if (cats[k].order !== k + 1) await store.saveCategory({ ...cats[k], order: k + 1 });
    }
  });
  if (r.ok) {
    requestAnimationFrame(() => {
      const again = $(`[data-move="${CSS.escape(id)}"][data-dir="${dir}"]:not([disabled])`) || $(`[data-move="${CSS.escape(id)}"]:not([disabled])`);
      again?.focus();
    });
  }
}

function eventForm(id) {
  const c = id ? store.getCategory(id) : null;
  if (id && !c) { toast('That event no longer exists.', 'x'); return; }
  const m = openModal(`<form class="af" novalidate>
      <div class="af__head"><p class="eyebrow">${c ? 'Edit event' : 'New event'}</p><h2>${c ? esc(c.name) : 'Create an event'}</h2></div>
      <div class="af__body af__cols">
        <div class="af__stack">
          <label class="field"><span>Name</span><input name="name" required maxlength="60" value="${esc(c?.name || '')}" placeholder="For example TGIS"></label>
          <label class="field"><span>Tagline</span><input name="tagline" maxlength="90" value="${esc(c?.tagline || '')}" placeholder="Thank God It's Saturday"></label>
          <label class="field"><span>Description</span><textarea name="description" rows="4" maxlength="600" placeholder="Two or three sentences for visitors">${esc(c?.description || '')}</textarea></label>
          <label class="field"><span>Tags</span><input name="tags" value="${esc((c?.tags || []).join(', '))}" placeholder="Discussion, Music, Dinner"><small class="hint">Separate tags with commas.</small></label>
          <div class="field"><span class="label" id="accent-label">Accent colour</span>
            <div class="accent"><input type="color" name="accent" value="${esc(safeColor(c?.accent))}" aria-labelledby="accent-label"><code data-accent-hex>${esc(safeColor(c?.accent))}</code></div></div>
        </div>
        ${picker('cover', 'Cover image', c?.cover, c?.coverSm, 'A wide photo works best. Large images are resized before upload.')}
      </div>
      <p class="af__error" role="alert"></p>
      <div class="af__foot">
        <button type="button" class="btn btn--ghost btn--sm" data-close>Cancel</button>
        <button type="submit" class="btn btn--sm" data-save>${icon('check')} ${c ? 'Save changes' : 'Create event'}</button>
      </div></form>`, { label: c ? `Edit ${c.name}` : 'New event' });
  m.el.classList.add('modal--form');
  const form = $('form', m.panel);
  hydrate(form);
  const pick = wirePicker(form, 'cover');
  const hex = $('[data-accent-hex]', form);
  form.accent.addEventListener('input', () => { hex.textContent = form.accent.value; });
  requestAnimationFrame(() => form.name.focus());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.af__error', form);
    err.textContent = '';
    const name = form.name.value.trim();
    if (!name) { err.textContent = 'Give the event a name.'; form.name.focus(); return; }
    const dupe = store.getCategories().find((x) => x.name.trim().toLowerCase() === name.toLowerCase() && x.id !== c?.id);
    if (dupe) { err.textContent = `An event called ${dupe.name} already exists.`; form.name.focus(); return; }
    const data = {
      name, tagline: form.tagline.value.trim(), description: form.description.value.trim(),
      tags: form.tags.value.split(',').map((t) => t.trim()).filter(Boolean), accent: form.accent.value,
    };
    if (c) data.id = c.id;
    const file = pick.file();
    const btn = $('[data-save]', form);
    const r = await run(btn, file ? 'Uploading cover' : 'Saving', async () => {
      if (file) {
        const { ref, thumb } = await store.uploadImage(file, { maxDim: 1600, thumbDim: 480 });
        data.cover = ref; data.coverSm = thumb;
      }
      return store.saveCategory(data);
    }, c ? 'Event saved.' : `${name} created. It is now on the home page.`);
    if (r.ok) { pick.cleanup(); m.close(); } else err.textContent = r.error;
  });
}

function deleteEventFlow(id) {
  const c = store.getCategory(id);
  if (!c) return;
  const ss = store.getSessions({ categoryId: id });
  const ph = totalPhotos(ss);
  confirmDialog({
    title: `Delete ${c.name}?`,
    body: `<p>This removes the event from the website${ss.length ? `, together with its <b>${plural(ss.length, 'session')}</b>${ph ? ` and <b>${plural(ph, 'photo')}</b>` : ''}` : ''}. This cannot be undone.</p>`,
    typeToConfirm: c.name,
    confirmLabel: 'Delete event',
    busyLabel: 'Deleting',
    success: `${c.name} deleted.`,
    action: () => store.deleteCategory(id),
  });
}

/* ================================================================== sessions */
function eventOptions(selected, { all } = {}) {
  const cats = store.getCategories();
  return (all ? `<option value="">${esc(all)}</option>` : '') + cats.map((c) => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}
function setupSessions(el) {
  el.innerHTML = `<div class="toolbar toolbar--filters">
      <label class="search"><span class="sr-only">Search sessions by title</span>${icon('search')}<input class="input" type="search" data-f="q" placeholder="Search by title" autocomplete="off"></label>
      <label class="sel"><span class="sr-only">Filter by event</span><select class="input" data-f="cat"></select></label>
      <label class="sel"><span class="sr-only">Show</span><select class="input" data-f="when">
        <option value="all">All dates</option><option value="upcoming">Upcoming</option><option value="past">Past</option></select></label>
      <label class="sel"><span class="sr-only">Sort by date</span><select class="input" data-f="order">
        <option value="desc">Newest first</option><option value="asc">Oldest first</option></select></label>
      <button class="btn btn--sm toolbar__cta" data-new-session>${icon('plus')} New session</button>
    </div>
    <p class="count-line muted" data-count-line aria-live="polite"></p>
    <div data-list></div>`;
  el.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    st.sessions[f] = e.target.value;
    if (f === 'cat') history.replaceState(null, '', st.sessions.cat ? `#sessions/${encodeURIComponent(st.sessions.cat)}` : '#sessions');
    renderSessions(el); hydrate(el);
  });
}
function renderSessions(el) {
  const f = st.sessions;
  if (f.cat && !store.getCategory(f.cat)) f.cat = '';
  const sel = $('[data-f="cat"]', el);
  sel.innerHTML = eventOptions(f.cat, { all: 'All events' });
  sel.value = f.cat;
  $('[data-f="when"]', el).value = f.when;
  $('[data-f="order"]', el).value = f.order;
  const qEl = $('[data-f="q"]', el);
  if (qEl.value !== f.q && document.activeElement !== qEl) qEl.value = f.q;

  const all = store.getSessions({ categoryId: f.cat || undefined, order: f.order });
  const q = f.q.trim().toLowerCase();
  const items = all.filter((s) => (!q || (s.title || '').toLowerCase().includes(q))
    && (f.when === 'all' || (f.when === 'upcoming') === store.isUpcoming(s)));
  const total = store.getSessions().length;
  $('[data-count-line]', el).textContent = items.length === total ? plural(total, 'session') : `Showing ${items.length} of ${plural(total, 'session')}`;

  const list = $('[data-list]', el);
  if (!store.getCategories().length) {
    list.innerHTML = emptyState('flame', 'Create an event first', 'Every session belongs to an event. Add an event such as TGIS, then add its sessions.', `<a class="btn btn--sm" href="#events">Go to Events</a>`);
    return;
  }
  if (!items.length) {
    list.innerHTML = total
      ? emptyState('search', 'No sessions match', 'Try a different search or clear the filters.', `<button class="btn btn--ghost btn--sm" data-clear-filters>Clear filters</button>`)
      : emptyState('calendar', 'No sessions yet', 'Add the first session with its date, venue and poster.', `<button class="btn btn--sm" data-new-session>${icon('plus')} New session</button>`);
    return;
  }
  list.innerHTML = `<div class="srows">${items.map((s) => {
    const up = store.isUpcoming(s);
    const n = store.photoCount(s.id);
    return `<article class="card srow">
      <div class="srow__img">${img(s.posterSm || s.poster, null, 'Poster: ' + s.title)}</div>
      <div class="srow__main">
        <div class="srow__chips"><span class="chip">${esc(catName(s.categoryId))}</span>${up ? '<span class="chip chip--hot"><i class="dot-live"></i> Upcoming</span>' : '<span class="chip chip--past">Past</span>'}</div>
        <h3 class="srow__title">${esc(s.title)}</h3>
        <p class="srow__meta">
          <span>${icon('calendar')} ${esc(fmtDate(s.date))}</span>
          <span>${icon('clock')} ${esc(fmtTime(s.time) || 'No time')}</span>
          <span class="srow__venue">${icon('pin')} ${esc(s.venue || 'No venue')}</span>
          ${s.speaker ? `<span>${icon('mic')} ${esc(s.speaker)}</span>` : ''}
        </p>
      </div>
      <div class="srow__actions">
        <a class="btn btn--ghost btn--sm" href="#gallery/${encodeURIComponent(s.id)}" aria-label="${esc(plural(n, 'photo'))} for ${esc(s.title)}">${icon('image')} Photos (${n})</a>
        <button class="btn btn--ghost btn--sm" data-edit-session="${esc(s.id)}" aria-label="Edit ${esc(s.title)}">${icon('edit')} Edit</button>
        <button class="icon-btn icon-btn--sm icon-btn--danger" data-del-session="${esc(s.id)}" aria-label="Delete ${esc(s.title)}">${icon('trash')}</button>
      </div>
    </article>`;
  }).join('')}</div>`;
}

function sessionForm(id, preset = {}) {
  const s = id ? store.getSession(id) : null;
  if (id && !s) { toast('That session no longer exists.', 'x'); return; }
  const cats = store.getCategories();
  if (!cats.length) { toast('Create an event first. Every session belongs to an event.', 'flame'); location.hash = '#events'; return; }
  const catId = s?.categoryId || preset.categoryId || st.sessions.cat || (st.view === 'gallery' && st.gallery.cat) || '';
  const m = openModal(`<form class="af" novalidate>
      <div class="af__head"><p class="eyebrow">${s ? 'Edit session' : 'New session'}</p><h2>${s ? esc(s.title) : 'Add a session'}</h2></div>
      <div class="af__body af__cols">
        <div class="af__stack">
          <label class="field"><span>Event</span><select name="categoryId" required>
            ${catId ? '' : '<option value="" selected disabled>Choose an event</option>'}${eventOptions(catId)}</select></label>
          <label class="field"><span>Title</span><input name="title" required maxlength="120" value="${esc(s?.title || '')}" placeholder="For example The Battle Inside"></label>
          <div class="af__pair">
            <label class="field"><span>Date</span><input type="date" name="date" required value="${esc(s?.date || '')}"></label>
            <label class="field"><span>Time</span><input type="time" name="time" value="${esc(s ? (s.time || '') : '19:00')}"></label>
          </div>
          <label class="field"><span>Venue</span><input name="venue" maxlength="140" value="${esc(s ? (s.venue || '') : DEFAULT_VENUE)}"></label>
          <label class="field"><span>Speaker <em>(optional)</em></span><input name="speaker" maxlength="80" value="${esc(s?.speaker || '')}"></label>
          <label class="field"><span>Description</span><textarea name="description" rows="5" maxlength="1200" placeholder="What happens at this session, in a few sentences">${esc(s?.description || '')}</textarea></label>
        </div>
        ${picker('poster', 'Poster', s?.poster, s?.posterSm, 'Portrait posters look best. Large images are resized before upload.')}
      </div>
      <p class="af__error" role="alert"></p>
      <div class="af__foot">
        <button type="button" class="btn btn--ghost btn--sm" data-close>Cancel</button>
        <button type="submit" class="btn btn--sm" data-save>${icon('check')} ${s ? 'Save changes' : 'Create session'}</button>
      </div></form>`, { label: s ? `Edit ${s.title}` : 'New session' });
  m.el.classList.add('modal--form');
  const form = $('form', m.panel);
  hydrate(form);
  const pick = wirePicker(form, 'poster');
  requestAnimationFrame(() => (catId ? form.title : form.categoryId).focus());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.af__error', form);
    err.textContent = '';
    const v = (n) => form[n].value.trim();
    const missing = [!v('categoryId') && ['categoryId', 'Choose an event.'], !v('title') && ['title', 'Give the session a title.'], !v('date') && ['date', 'Pick a date.']].find(Boolean);
    if (missing) { err.textContent = missing[1]; form[missing[0]].focus(); return; }
    const data = { categoryId: v('categoryId'), title: v('title'), date: v('date'), time: v('time'), venue: v('venue'), speaker: v('speaker'), description: v('description') };
    if (s) data.id = s.id;
    const file = pick.file();
    const btn = $('[data-save]', form);
    const r = await run(btn, file ? 'Uploading poster' : 'Saving', async () => {
      if (file) {
        const { ref, thumb } = await store.uploadImage(file, { maxDim: 1400, thumbDim: 420 });
        data.poster = ref; data.posterSm = thumb;
      }
      return store.saveSession(data);
    }, s ? 'Session saved.' : 'Session created.');
    if (r.ok) { pick.cleanup(); m.close(); } else err.textContent = r.error;
  });
}

function deleteSessionFlow(id) {
  const s = store.getSession(id);
  if (!s) return;
  const n = store.photoCount(id);
  confirmDialog({
    title: `Delete ${s.title}?`,
    body: `<p>The session${n ? ` and its <b>${plural(n, 'photo')}</b>` : ''} will be removed from the website. This cannot be undone.</p>`,
    confirmLabel: 'Delete session', busyLabel: 'Deleting', success: 'Session deleted.',
    action: () => store.deleteSession(id),
  });
}

/* ================================================================== gallery */
const queue = [];       // { key, sid, title, file, status: queued|uploading|done|error, error }
let uploading = false;
let qSeq = 0;

function setupGallery(el) {
  el.innerHTML = `<div class="toolbar toolbar--filters">
      <label class="sel sel--wide"><span class="sel__label">Event</span><select class="input" data-g="cat"></select></label>
      <label class="sel sel--wide"><span class="sel__label">Session</span><select class="input" data-g="sid"></select></label>
    </div>
    <div data-upload></div>
    <div class="queue" data-queue hidden></div>
    <div data-list></div>`;
  el.addEventListener('change', (e) => {
    const g = e.target.dataset.g;
    if (!g) return;
    if (g === 'cat') { st.gallery.cat = e.target.value; st.gallery.sid = ''; }
    else st.gallery.sid = e.target.value;
    history.replaceState(null, '', st.gallery.sid ? `#gallery/${encodeURIComponent(st.gallery.sid)}` : st.gallery.cat ? `#gallery/${encodeURIComponent(st.gallery.cat)}` : '#gallery');
    renderGallery(el); hydrate(el);
    if (g === 'cat' && st.gallery.cat) $('[data-g="sid"]', el).focus();
  });
  el.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick-session]');
    if (pick) { location.hash = `#gallery/${encodeURIComponent(pick.dataset.pickSession)}`; return; }
    const pc = e.target.closest('[data-pick-event]');
    if (pc) { location.hash = `#gallery/${encodeURIComponent(pc.dataset.pickEvent)}`; return; }
    if (e.target.closest('[data-clear-queue]')) { for (let i = queue.length - 1; i >= 0; i--) if (/done|error/.test(queue[i].status)) queue.splice(i, 1); renderQueue(el); }
  });
}

function renderGallery(el) {
  const g = st.gallery;
  if (g.sid && !store.getSession(g.sid)) g.sid = '';
  if (g.cat && !store.getCategory(g.cat)) { g.cat = ''; g.sid = ''; }
  const cats = store.getCategories();
  const catSel = $('[data-g="cat"]', el);
  catSel.innerHTML = `<option value="">Choose an event</option>` + cats.map((c) => `<option value="${esc(c.id)}">${esc(c.name)} (${plural(totalPhotos(store.getSessions({ categoryId: c.id })), 'photo')})</option>`).join('');
  catSel.value = g.cat;
  const sessions = g.cat ? store.getSessions({ categoryId: g.cat }) : [];
  const sidSel = $('[data-g="sid"]', el);
  sidSel.disabled = !g.cat;
  sidSel.innerHTML = `<option value="">${g.cat ? (sessions.length ? 'Choose a session' : 'This event has no sessions') : 'Choose an event first'}</option>`
    + sessions.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}, ${esc(fmtDate(s.date))} (${store.photoCount(s.id)})</option>`).join('');
  sidSel.value = g.sid;

  const up = $('[data-upload]', el);
  const list = $('[data-list]', el);
  renderQueue(el);

  if (!cats.length) {
    up.innerHTML = ''; delete up.dataset.sid;
    list.innerHTML = emptyState('flame', 'Create an event first', 'Photos belong to a session, and sessions belong to an event.', `<a class="btn btn--sm" href="#events">Go to Events</a>`);
    return;
  }
  if (!g.cat) {
    up.innerHTML = ''; delete up.dataset.sid;
    list.innerHTML = `<h2 class="sub-h">Pick an event</h2><div class="pick-grid">${cats.map((c) => {
      const ss = store.getSessions({ categoryId: c.id });
      return `<button class="card pick" data-pick-event="${esc(c.id)}">
        <span class="pick__img">${img(c.coverSm || c.cover, null)}</span>
        <span class="pick__body"><b>${esc(c.name)}</b><small>${plural(ss.length, 'session')}, ${plural(totalPhotos(ss), 'photo')}</small></span>${icon('chevron')}</button>`;
    }).join('')}</div>`;
    return;
  }
  if (!g.sid) {
    up.innerHTML = ''; delete up.dataset.sid;
    list.innerHTML = sessions.length
      ? `<h2 class="sub-h">Pick a session of ${esc(catName(g.cat))}</h2><div class="pick-grid">${sessions.map((s) => `<button class="card pick" data-pick-session="${esc(s.id)}">
          <span class="pick__img pick__img--poster">${img(s.posterSm || s.poster, null)}</span>
          <span class="pick__body"><b>${esc(s.title)}</b><small>${esc(fmtDate(s.date))}</small></span>
          <span class="pick__n" aria-label="${esc(plural(store.photoCount(s.id), 'photo'))}">${icon('image')} ${store.photoCount(s.id)}</span></button>`).join('')}</div>`
      : emptyState('calendar', 'No sessions in this event', 'Photos are uploaded to a session. Add a session to this event first.', `<button class="btn btn--sm" data-new-session>${icon('plus')} New session</button>`);
    return;
  }

  const s = store.getSession(g.sid);
  if (!up.dataset.sid || up.dataset.sid !== g.sid) {
    up.dataset.sid = g.sid;
    up.innerHTML = `<label class="drop" data-drop>
        <input type="file" accept="image/*" multiple class="sr-only" data-files aria-label="Choose photos to upload">
        <span class="drop__ic">${icon('upload')}</span>
        <span class="drop__text"><b>Drop photos here or <u>choose files</u></b>
        <small>They are added to <span data-drop-title></span>. JPG, PNG or WebP, resized automatically.</small></span>
      </label>`;
    wireDrop(el, up);
  }
  $('[data-drop-title]', up).textContent = s.title;

  const photos = store.getPhotos(g.sid);
  list.innerHTML = `<div class="sub-row"><h2 class="sub-h">${esc(s.title)} <small class="muted">${plural(photos.length, 'photo')}</small></h2>
      <a class="btn btn--ghost btn--sm" href="#gallery/${encodeURIComponent(g.cat)}">${icon('chevron-left')} All sessions</a></div>`
    + (photos.length
      ? `<ul class="photos">${photos.map((p, i) => `<li class="photo">
          <button class="photo__open" data-view-photo="${esc(p.id)}" aria-label="Open photo ${i + 1}">${img(p.thumb || p.src, null, p.caption || '')}</button>
          <button class="icon-btn icon-btn--sm icon-btn--danger photo__del" data-del-photo="${esc(p.id)}" aria-label="Delete photo ${i + 1}">${icon('trash')}</button>
        </li>`).join('')}</ul>`
      : emptyState('image', 'No photos in this album yet', 'Upload photos above. They appear in the website gallery under this session.'));
}

function wireDrop(el, up) {
  const drop = $('[data-drop]', up);
  const input = $('[data-files]', up);
  const add = (files) => {
    const imgs = [...files].filter((f) => /^image\//.test(f.type));
    if (files.length && !imgs.length) { toast('Those files are not images.', 'x'); return; }
    if (imgs.length < files.length) toast(`${files.length - imgs.length} file(s) skipped: not images.`, 'x');
    const s = store.getSession(st.gallery.sid);
    if (!s) return;
    imgs.forEach((file) => queue.push({ key: ++qSeq, sid: s.id, title: s.title, file, name: file.name, status: 'queued' }));
    renderQueue(el);
    processQueue(el);
  };
  input.addEventListener('change', () => { add(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); add(e.dataTransfer.files); });
}

async function processQueue(el) {
  if (uploading) return;
  uploading = true;
  let ok = 0; let bad = 0;
  for (let item = queue.find((q) => q.status === 'queued'); item; item = queue.find((q) => q.status === 'queued')) {
    item.status = 'uploading'; renderQueue(el);
    try { await store.addPhoto(item.sid, item.file); item.status = 'done'; ok++; } catch (e) { item.status = 'error'; item.error = e.message || 'Upload failed.'; bad++; }
    item.file = null;
    renderQueue(el);
  }
  uploading = false;
  if (ok) toast(`${plural(ok, 'photo')} uploaded.`, 'check');
  if (bad) toast(`${plural(bad, 'photo')} could not be uploaded.`, 'x', 6500);
}
window.addEventListener('beforeunload', (e) => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });

function renderQueue(el) {
  const box = $('[data-queue]', el);
  if (!box) return;
  if (!queue.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  const done = queue.filter((q) => q.status === 'done').length;
  const failed = queue.filter((q) => q.status === 'error').length;
  const finished = done + failed;
  const label = { queued: 'Waiting', uploading: 'Uploading', done: 'Done', error: 'Failed' };
  box.innerHTML = `<div class="queue__head">
      <b>${uploading ? `Uploading ${Math.min(finished + 1, queue.length)} of ${queue.length}` : `${done} of ${plural(queue.length, 'photo')} uploaded`}${failed ? `, ${failed} failed` : ''}</b>
      ${uploading ? '' : '<button class="btn btn--ghost btn--sm" data-clear-queue>Clear list</button>'}
    </div>
    <div class="bar" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="${queue.length}" aria-valuenow="${finished}"><i style="width:${(finished / queue.length) * 100}%"></i></div>
    <ul class="queue__list">${queue.map((q) => `<li class="qi qi--${q.status}">
      <span class="qi__ic">${q.status === 'done' ? icon('check') : q.status === 'error' ? icon('x') : q.status === 'uploading' ? '<span class="adm-spin" aria-hidden="true"></span>' : icon('image')}</span>
      <span class="qi__name">${esc(q.name || 'Photo')}<small>${esc(q.title)}${q.error ? ': ' + esc(q.error) : ''}</small></span>
      <span class="qi__bar"><i></i></span>
      <span class="qi__st">${label[q.status]}</span></li>`).join('')}</ul>`;
}

function viewPhoto(pid) {
  const p = store.getPhotos(st.gallery.sid).find((x) => x.id === pid);
  if (!p) return;
  const s = store.getSession(st.gallery.sid);
  const m = openModal(`<div class="pv"><div class="pv__img">${img(p.src, p.thumb, p.caption || 'Photo from ' + s.title)}</div>
      <div class="pv__foot"><span class="muted">${esc(s.title)}</span>
      <button class="btn btn--sm btn--danger" data-pv-del>${icon('trash')} Delete photo</button></div></div>`, { label: 'Photo' });
  m.el.classList.add('modal--photo');
  hydrate(m.panel);
  $('[data-pv-del]', m.panel).addEventListener('click', () => { m.close(); deletePhotoFlow(pid); });
}
function deletePhotoFlow(pid) {
  const sid = st.gallery.sid;
  confirmDialog({
    title: 'Delete this photo?',
    body: '<p>It will be removed from the website gallery. This cannot be undone.</p>',
    confirmLabel: 'Delete photo', busyLabel: 'Deleting', success: 'Photo deleted.',
    action: () => store.deletePhoto(sid, pid),
  });
}

/* ================================================================== registrations */
async function loadRegs(force) {
  if (st.regs.loading || (st.regs.data && !force)) return;
  st.regs.loading = true;
  if (st.view === 'registrations' || st.view === 'overview') scheduleRender();
  let data;
  try { data = await store.getRegistrations(); } catch (e) { data = { items: [], error: e.message || 'Unknown error' }; }
  st.regs.data = data; st.regs.loading = false;
  scheduleRender();
}

function setupRegs(el) {
  el.innerHTML = `<div class="toolbar toolbar--filters">
      <label class="search"><span class="sr-only">Search registrations</span>${icon('search')}<input class="input" type="search" data-r="q" placeholder="Search name, place or mobile" autocomplete="off"></label>
      <div class="seg seg--3" role="group" aria-label="Filter by occupation">
        <button type="button" data-occ="all" aria-pressed="true">All</button>
        <button type="button" data-occ="Student" aria-pressed="false">Student</button>
        <button type="button" data-occ="Working" aria-pressed="false">Working</button>
      </div>
      <div class="toolbar__end">
        <button class="btn btn--ghost btn--sm" data-reg-refresh>Refresh</button>
        <button class="btn btn--sm" data-reg-export>${icon('download')} Export CSV</button>
      </div>
    </div>
    <p class="count-line muted" data-count-line aria-live="polite"></p>
    <div data-list></div>`;
  $('[data-r="q"]', el).addEventListener('input', (e) => { st.regs.q = e.target.value; renderRegs(el); });
  el.addEventListener('click', async (e) => {
    const o = e.target.closest('[data-occ]');
    if (o) { st.regs.occ = o.dataset.occ; renderRegs(el); return; }
    const rf = e.target.closest('[data-reg-refresh]');
    if (rf) {
      if (store.admin.mode !== 'firebase') { toast('Registrations can be loaded once Firebase sign-in is set up.', 'lock'); return; }
      await run(rf, 'Refreshing', async () => { st.regs.data = null; await loadRegs(true); if (st.regs.data?.error) throw new Error(regError(st.regs.data.error).text); }, 'Registrations refreshed.');
      return;
    }
    const ex = e.target.closest('[data-reg-export]');
    if (ex) exportCsv(filteredRegs());
    const d = e.target.closest('[data-del-reg]');
    if (d) deleteRegFlow(d.dataset.delReg);
  });
}
function filteredRegs() {
  const items = st.regs.data?.items || [];
  const q = st.regs.q.trim().toLowerCase();
  return items.filter((r) => (st.regs.occ === 'all' || r.occupation === st.regs.occ)
    && (!q || [r.name, r.place, r.mobile].some((x) => String(x || '').toLowerCase().includes(q))));
}
function regError(code) {
  if (code === 'demo') return { title: 'Registrations need Firebase sign-in', text: 'Visitor sign-ups are saved safely in Firebase, but only a real Firebase admin session can read them. This is a demo session, so they cannot be shown here. Finish the sign-in setup in SETUP.md to see and export them.' };
  if (code === 'rules') return { title: 'Firebase refused to share registrations', text: 'You are signed in, but the database rules do not let the admin read registrations yet. Update the rules as described in SETUP.md, then refresh.' };
  return { title: 'Could not load registrations', text: `Firebase said: ${code}. Check your connection and refresh.` };
}
function renderRegs(el) {
  $$('[data-occ]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.occ === st.regs.occ)));
  const list = $('[data-list]', el);
  const line = $('[data-count-line]', el);
  const exportBtn = $('[data-reg-export]', el);
  const mode = store.admin.mode;
  const data = mode === 'firebase' ? st.regs.data : { items: [], error: 'demo' };
  if (!data) {
    line.textContent = '';
    exportBtn.disabled = true;
    list.innerHTML = `<div class="card table-skel" aria-busy="true"><span class="adm-spin" aria-hidden="true"></span> Loading registrations</div>`;
    return;
  }
  if (data.error) {
    line.textContent = '';
    exportBtn.disabled = true;
    const m = regError(data.error);
    list.innerHTML = emptyState(data.error === 'demo' ? 'lock' : 'users', m.title, m.text);
    return;
  }
  const all = data.items;
  const items = filteredRegs();
  exportBtn.disabled = !items.length;
  const students = all.filter((r) => r.occupation === 'Student').length;
  line.textContent = all.length ? `${items.length === all.length ? plural(all.length, 'registration') : `Showing ${items.length} of ${all.length}`}. ${students} students, ${all.length - students} working.` : '';
  if (!all.length) { list.innerHTML = emptyState('users', 'No registrations yet', 'When visitors sign up on the website, they appear here.'); return; }
  if (!items.length) { list.innerHTML = emptyState('search', 'No registrations match', 'Try a different search or filter.'); return; }
  list.innerHTML = `<div class="card table-wrap"><table class="rtable">
    <thead><tr><th scope="col">Name</th><th scope="col">Occupation</th><th scope="col">School, college or company</th><th scope="col">Mobile</th><th scope="col">Date</th><th scope="col">Time</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${items.map((r) => `<tr>
      <td data-label="Name"><b>${esc(r.name)}</b></td>
      <td data-label="Occupation"><span class="chip ${r.occupation === 'Working' ? '' : 'chip--hot'}">${esc(r.occupation || '')}</span></td>
      <td data-label="Place">${esc(r.place || '')}</td>
      <td data-label="Mobile"><a class="tel" href="tel:${esc(String(r.mobile || '').replace(/[^\d+]/g, ''))}">${esc(r.mobile || '')}</a></td>
      <td data-label="Date">${esc(r.formattedDate || '')}</td>
      <td data-label="Time">${esc(r.formattedTime || '')}</td>
      <td class="rtable__act"><button class="icon-btn icon-btn--sm icon-btn--danger" data-del-reg="${esc(r.id)}" aria-label="Delete registration of ${esc(r.name)}">${icon('trash')}</button></td>
    </tr>`).join('')}</tbody></table></div>`;
}
function csvCell(v) {
  let s = String(v ?? '');
  // Keep spreadsheet apps from treating text as a formula (phone numbers like +91 98765 stay as they are).
  if (/^[=@\t\r]/.test(s) || /^[+-](?![\d\s()-]*$)/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
function exportCsv(items) {
  if (!items.length) { toast('Nothing to export.', 'x'); return; }
  const head = ['Name', 'Occupation', 'School, college or company', 'Mobile', 'Date', 'Time', 'Timestamp (ISO)'];
  const rows = items.map((r) => [r.name, r.occupation, r.place, r.mobile, r.formattedDate, r.formattedTime, r.isoTimestamp]);
  const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `spark-registrations-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Exported ${plural(items.length, 'registration')}.`, 'download');
}
function deleteRegFlow(id) {
  const r = st.regs.data?.items?.find((x) => x.id === id);
  if (!r) return;
  confirmDialog({
    title: `Delete ${r.name}'s registration?`,
    body: '<p>It is removed from Firebase and from future exports. This cannot be undone.</p>',
    confirmLabel: 'Delete', busyLabel: 'Deleting', success: 'Registration deleted.',
    action: async () => {
      await store.deleteRegistration(id);
      st.regs.data.items = st.regs.data.items.filter((x) => x.id !== id);
      scheduleRender();
    },
  });
}

/* ================================================================== settings */
function renderSettings(el) {
  const a = store.admin;
  const demo = a.mode === 'demo';
  const src = { live: 'Published content from Firebase', local: 'Saved in this browser (demo mode)', cache: 'Last copy saved in this browser', seed: 'Built-in starter content' }[store.source] || store.source;
  el.innerHTML = `<div class="set-grid">
    <article class="card panel">
      <header class="panel__head"><h2 class="panel__title">Account</h2><span class="chip ${demo ? '' : 'chip--hot'}">${demo ? 'Demo mode' : 'Firebase'}</span></header>
      <dl class="dl">
        <div><dt>Signed in as</dt><dd>admin</dd></div>
        <div><dt>Where changes go</dt><dd>${demo ? 'This browser only. Visitors do not see them.' : 'Firebase. Visitors see changes right away.'}</dd></div>
        <div><dt>Content shown now</dt><dd>${esc(src)}</dd></div>
      </dl>
      <div class="row-actions"><button class="btn btn--ghost btn--sm" data-logout>${icon('logout')} Log out</button>
      <a class="btn btn--ghost btn--sm" href="index.html" target="_blank" rel="noopener">${icon('arrow-up-right')} View site</a></div>
    </article>
    <article class="card panel">
      <header class="panel__head"><h2 class="panel__title">Appearance</h2></header>
      <p class="muted panel__text">Applies to this admin panel and the website in this browser.</p>
      <div class="seg seg--2" role="group" aria-label="Theme">
        <button type="button" data-theme-set="dark" aria-pressed="false">${icon('moon')} Dark</button>
        <button type="button" data-theme-set="light" aria-pressed="false">${icon('sun')} Light</button>
      </div>
    </article>
    <article class="card panel panel--danger">
      <header class="panel__head"><h2 class="panel__title">Danger zone</h2></header>
      <div class="danger-row">
        <div><b>Restore starter content</b>
          <p class="muted">${demo
            ? 'Replaces the events, sessions and photos saved in this browser with the built-in starter content.'
            : 'Replaces all events, sessions and photos on the live website with the built-in starter content.'} Registrations are not affected.</p></div>
        <button class="btn btn--sm btn--danger" data-reset>Restore starter content</button>
      </div>
    </article>
  </div>`;
  syncTheme();
}
function resetFlow() {
  const demo = store.admin.mode === 'demo';
  confirmDialog({
    title: 'Restore starter content?',
    body: `<p>${demo ? 'Everything you changed in this browser' : 'Every event, session and photo on the live website'} will be replaced by the built-in starter content. Anything you added will be lost.</p>`,
    ack: 'I understand this replaces the current content and cannot be undone.',
    typeToConfirm: 'RESTORE',
    confirmLabel: 'Restore', busyLabel: 'Restoring', success: 'Starter content restored.',
    action: () => store.resetToSeed(),
  });
}

/* ================================================================== wiring */
const RENDER = {
  overview: { render: renderOverview },
  events: { setup: setupEvents, render: renderEvents },
  sessions: { setup: setupSessions, render: renderSessions },
  gallery: { setup: setupGallery, render: renderGallery },
  registrations: { setup: setupRegs, render: renderRegs },
  settings: { render: renderSettings },
};

// Delegated actions shared by several views.
document.addEventListener('click', (e) => {
  if (st.screen !== 'dash') return;
  const t = e.target;
  let b;
  if ((b = t.closest('[data-new-event]'))) eventForm();
  else if ((b = t.closest('[data-edit-event]'))) eventForm(b.dataset.editEvent);
  else if ((b = t.closest('[data-del-event]'))) deleteEventFlow(b.dataset.delEvent);
  else if ((b = t.closest('[data-move]'))) moveEvent(b.dataset.move, +b.dataset.dir, b);
  else if ((b = t.closest('[data-new-session]'))) sessionForm(null, { categoryId: st.view === 'gallery' ? st.gallery.cat : '' });
  else if ((b = t.closest('[data-edit-session]'))) sessionForm(b.dataset.editSession);
  else if ((b = t.closest('[data-del-session]'))) deleteSessionFlow(b.dataset.delSession);
  else if ((b = t.closest('[data-clear-filters]'))) { Object.assign(st.sessions, { cat: '', q: '', when: 'all' }); const q = $('[data-f="q"]'); if (q) q.value = ''; history.replaceState(null, '', '#sessions'); scheduleRender(); }
  else if ((b = t.closest('[data-view-photo]'))) viewPhoto(b.dataset.viewPhoto);
  else if ((b = t.closest('[data-del-photo]'))) deletePhotoFlow(b.dataset.delPhoto);
  else if ((b = t.closest('[data-reset]'))) resetFlow();
});

async function boot() {
  buildNav();
  fillIcons();
  syncTheme();
  wireLogin();
  store.subscribe(sync);
  await store.ready;
  sync();
}
boot();
