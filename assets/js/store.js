// Spark Youth Club data layer.
// Public content lives in Firebase Realtime Database under /site (public read, admin write),
// uploaded images under /media (public read, admin write), sign-ups under /registrations
// (anyone may add, only the admin may read). See SETUP.md for the database rules.
//
// If Firebase is unreachable or the rules are not set up yet, the site falls back to the
// built-in seed content so visitors never see an empty page.

import { SEED } from './seed.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCeKK7OrgEDJ-bYwqmYtjqj7I3bPvW6KR4',
  authDomain: 'spark-web-site.firebaseapp.com',
  databaseURL: 'https://spark-web-site-default-rtdb.firebaseio.com',
  projectId: 'spark-web-site',
  storageBucket: 'spark-web-site.firebasestorage.app',
  messagingSenderId: '246779989622',
  appId: '1:246779989622:web:8ce8076793f3f8c1091957',
  measurementId: 'G-45ERJNRMCL',
};

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
export const ADMIN_USER = 'admin';
export const ADMIN_EMAIL = 'admin@sparkyouthcbe.in';
// SHA-256 of the accepted admin passwords, used only for the offline/demo fallback and
// to decide whether a first login may create the admin account.
const PASS_HASHES = [
  'e47a06a7ffe421525c08c6a3dee56868876bd64c083f792f6cf14e70b6b90048',
  '92f55da1cdca0fd9811daa0bc97455c9e9e2b16d29e4e142c56e5924a1446175',
];

const CACHE_KEY = 'spark.site.v1';
const LOCAL_KEY = 'spark.local.v1';     // demo-mode edits (this browser only)

let fb = null;            // { app, db, auth, dbm, authm }
let site = normalise(readJSON(CACHE_KEY) || SEED);
let source = 'seed';      // 'seed' | 'cache' | 'live' | 'local'
// mode: 'firebase' (changes go to the live database) | 'demo' (offline: this browser only).
// secured: true only when signed in through Firebase Authentication.
const OPEN_KEY = 'spark.admin.open';
let adminState = { loggedIn: false, mode: null, email: null, secured: false };
try { if (sessionStorage.getItem(OPEN_KEY) === '1') adminState = { loggedIn: true, mode: 'firebase', email: null, secured: false }; } catch { /* ignore */ }
const listeners = new Set();
const mediaCache = new Map();

function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

function normalise(raw) {
  const s = raw || {};
  return { categories: s.categories || {}, sessions: s.sessions || {}, photos: s.photos || {} };
}
function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

export function slugify(str) {
  return String(str || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ------------------------------------------------------------------ Firebase */
async function loadFirebase() {
  if (fb) return fb;
  const [appm, dbm, authm] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-database.js`),
    import(`${FB}/firebase-auth.js`),
  ]);
  const app = appm.initializeApp(firebaseConfig);
  fb = { app, db: dbm.getDatabase(app), auth: authm.getAuth(app), dbm, authm };
  return fb;
}

let resolveReady;
const ready = new Promise((r) => { resolveReady = r; });

async function init() {
  if (readJSON(CACHE_KEY)) source = 'cache';
  const local = readJSON(LOCAL_KEY);
  try {
    const f = await loadFirebase();
    f.authm.onAuthStateChanged(f.auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) adminState = { loggedIn: true, mode: 'firebase', email: user.email, secured: true };
      else if (adminState.secured) adminState = { loggedIn: false, mode: null, email: null, secured: false };
      emit();
    });
    f.dbm.onValue(f.dbm.ref(f.db, 'site'), (snap) => {
      const val = snap.val();
      const demoLocal = adminState.mode === 'demo' && readJSON(LOCAL_KEY);
      if (demoLocal) {
        site = normalise(demoLocal); source = 'local';
      } else if (val && val.categories) {
        site = normalise(val); source = 'live';
        writeJSON(CACHE_KEY, val);
      } else if (local) {
        site = normalise(local); source = 'local';
      } else {
        site = normalise(SEED); source = 'seed';
      }
      resolveReady(); emit();
    }, () => {
      // permission denied / offline
      site = normalise(local || SEED); source = local ? 'local' : 'seed';
      resolveReady(); emit();
    });
  } catch (e) {
    console.warn('Firebase unavailable, using built-in content.', e);
    site = normalise(local || readJSON(CACHE_KEY) || SEED); source = local ? 'local' : 'seed';
    resolveReady(); emit();
  }
  // never block the UI for long
  setTimeout(resolveReady, 3500);
}

/* ------------------------------------------------------------------ Reads */
function list(obj) { return Object.entries(obj || {}).map(([id, v]) => ({ ...v, id })); }

function getCategories() {
  return list(site.categories).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
}
function getCategory(id) { return site.categories[id] ? { ...site.categories[id], id } : null; }

/** Sessions, newest first by default. opts: { categoryId, order: 'asc'|'desc' } */
function getSessions(opts = {}) {
  let out = list(site.sessions);
  if (opts.categoryId) out = out.filter((s) => s.categoryId === opts.categoryId);
  const dir = opts.order === 'asc' ? 1 : -1;
  return out.sort((a, b) => dir * (`${a.date} ${a.time || ''}`).localeCompare(`${b.date} ${b.time || ''}`));
}
function getSession(id) { return site.sessions[id] ? { ...site.sessions[id], id } : null; }

/** Photos of one session, oldest first. Each: { id, sessionId, src, thumb, caption, createdAt } */
function getPhotos(sessionId) {
  return list(site.photos[sessionId]).map((p) => ({ ...p, sessionId })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
function photoCount(sessionId) { return Object.keys(site.photos[sessionId] || {}).length; }
/** Sessions that have at least one photo, newest first. */
function getAlbums() { return getSessions().filter((s) => photoCount(s.id) > 0); }

function sessionDate(s) {
  const [y, m, d] = (s.date || '1970-01-01').split('-').map(Number);
  const [hh, mm] = (s.time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}
function isUpcoming(s) { const d = sessionDate(s); d.setHours(23, 59, 59); return d >= new Date(); }
function getUpcoming() { return getSessions({ order: 'asc' }).filter(isUpcoming); }

/**
 * Turn an image reference into something usable as <img src>.
 * Plain paths/URLs/data URLs resolve immediately; "media:ID" is fetched from the database.
 */
async function resolveImage(ref) {
  if (!ref) return '';
  if (!ref.startsWith('media:')) return ref;
  const id = ref.slice(6);
  if (mediaCache.has(id)) return mediaCache.get(id);
  const p = (async () => {
    const localMedia = readJSON(LOCAL_KEY + '.media') || {};
    if (localMedia[id]) return localMedia[id];
    try {
      const f = await loadFirebase();
      const snap = await f.dbm.get(f.dbm.ref(f.db, `media/${id}`));
      return snap.val() || '';
    } catch { return ''; }
  })();
  mediaCache.set(id, p);
  return p;
}
/** Set img.src from a reference (handles async media). Shows `fallback` first if given. */
function setImage(img, ref, fallback) {
  if (!ref) { if (fallback) img.src = fallback; return; }
  if (!ref.startsWith('media:')) { img.src = ref; return; }
  if (fallback) img.src = fallback;
  resolveImage(ref).then((url) => { if (url) img.src = url; });
}

/* ------------------------------------------------------------------ Registrations */
async function addRegistration({ name, occupation, place, mobile }) {
  const now = new Date();
  const data = {
    name: String(name).trim(), occupation, place: String(place).trim(), mobile: String(mobile).trim(),
    isoTimestamp: now.toISOString(),
    formattedDate: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    formattedTime: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
  };
  const f = await loadFirebase();
  await f.dbm.push(f.dbm.ref(f.db, 'registrations'), { ...data, createdAt: f.dbm.serverTimestamp() });
  return data;
}

/* ------------------------------------------------------------------ Admin */
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Log in. Resolves { ok, mode, message }.
 * mode 'firebase' = real, secured session. mode 'demo' = Firebase Auth is not set up yet;
 * edits are kept in this browser only (see SETUP.md).
 */
async function login(username, password) {
  if (String(username).trim().toLowerCase() !== ADMIN_USER) return { ok: false, message: 'Unknown username.' };
  const known = PASS_HASHES.includes(await sha256(String(password)));
  let f;
  try { f = await loadFirebase(); } catch {
    if (known) { adminState = { loggedIn: true, mode: 'demo', email: null }; emit(); return { ok: true, mode: 'demo', message: 'Offline: demo mode.' }; }
    return { ok: false, message: 'Wrong password.' };
  }
  const openLogin = async (note) => {
    // Firebase Authentication is not set up: password-only login, changes go straight to the database.
    adminState = { loggedIn: true, mode: 'firebase', email: null, secured: false };
    try { sessionStorage.setItem(OPEN_KEY, '1'); } catch { /* ignore */ }
    emit();
    const warn = await seedIfEmpty();
    return { ok: true, mode: 'firebase', secured: false, message: warn || note || 'Signed in.' };
  };
  try {
    await f.authm.signInWithEmailAndPassword(f.auth, ADMIN_EMAIL, password);
    adminState = { loggedIn: true, mode: 'firebase', email: ADMIN_EMAIL, secured: true }; emit();
    await seedIfEmpty();
    return { ok: true, mode: 'firebase', secured: true };
  } catch (e) {
    const code = e.code || '';
    const notSetUp = /operation-not-allowed|configuration-not-found|admin-restricted/.test(code);
    if (!notSetUp && known && /invalid-credential|user-not-found/.test(code)) {
      // First ever login with Authentication enabled: create the admin account.
      try {
        await f.authm.createUserWithEmailAndPassword(f.auth, ADMIN_EMAIL, password);
        adminState = { loggedIn: true, mode: 'firebase', email: ADMIN_EMAIL, secured: true }; emit();
        await seedIfEmpty();
        return { ok: true, mode: 'firebase', secured: true, message: 'Admin account created.' };
      } catch (e2) {
        if (/email-already-in-use/.test(e2.code || '')) return { ok: false, message: 'Wrong password.' };
        if (known) return openLogin();
      }
    }
    if (known && notSetUp) return openLogin();
    if (known && /network/.test(code)) { adminState = { loggedIn: true, mode: 'demo', email: null, secured: false }; emit(); return { ok: true, mode: 'demo', message: 'Offline: demo mode.' }; }
    return { ok: false, message: /too-many-requests/.test(code) ? 'Too many attempts. Try again later.' : 'Wrong password.' };
  }
}
async function logout() {
  if (adminState.secured && fb) await fb.authm.signOut(fb.auth);
  try { sessionStorage.removeItem(OPEN_KEY); } catch { /* ignore */ }
  adminState = { loggedIn: false, mode: null, email: null, secured: false }; emit();
}

const RULES_HELP = 'Firebase refused the change. In the Firebase console open Realtime Database > Rules and allow writing (see SETUP.md).';
/** Publish the starter content the first time. Returns a warning message, or '' when fine. */
async function seedIfEmpty() {
  try {
    if (!fb) await loadFirebase();
    const snap = await fb.dbm.get(fb.dbm.ref(fb.db, 'site/categories'));
    if (!snap.exists()) await fb.dbm.set(fb.dbm.ref(fb.db, 'site'), normalise(readJSON(LOCAL_KEY) || SEED));
    return '';
  } catch (e) {
    console.warn('Could not publish starter content:', e.message);
    return /permission/i.test(e.message) ? 'Signed in, but the database is read-only. ' + RULES_HELP : '';
  }
}

/** Write helper: Firebase when really signed in, otherwise this browser only. */
async function write(path, value) {
  if (!adminState.loggedIn) throw new Error('Not signed in.');
  if (adminState.mode === 'firebase') {
    if (!fb) await loadFirebase();
    const r = fb.dbm.ref(fb.db, path);
    try {
      if (value === null) await fb.dbm.remove(r); else await fb.dbm.set(r, value);
    } catch (e) {
      if (/permission/i.test(e.message)) throw new Error(RULES_HELP);
      throw e;
    }
    return;
  }
  // demo mode
  if (path.startsWith('media/')) {
    const m = readJSON(LOCAL_KEY + '.media') || {};
    if (value === null) delete m[path.slice(6)]; else m[path.slice(6)] = value;
    if (!writeJSON(LOCAL_KEY + '.media', m)) throw new Error('Browser storage is full (demo mode). Finish the Firebase setup to upload more.');
    return;
  }
  const parts = path.split('/').slice(1); // drop "site"
  const next = parts.length ? JSON.parse(JSON.stringify(site)) : JSON.parse(JSON.stringify(value));
  if (!parts.length) { writeJSON(LOCAL_KEY, next); site = normalise(next); source = 'local'; emit(); return; }
  let node = next;
  parts.slice(0, -1).forEach((k) => { node[k] = node[k] || {}; node = node[k]; });
  const last = parts[parts.length - 1];
  if (value === null) delete node[last]; else node[last] = value;
  if (!writeJSON(LOCAL_KEY, next)) throw new Error('Browser storage is full (demo mode). Finish the Firebase setup to upload more.');
  site = normalise(next); source = 'local'; emit();
}

function clean(obj) {
  const o = {};
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && k !== 'id') o[k] = v; });
  return o;
}

async function dropMedia(oldRef, newRef) {
  if (oldRef && oldRef !== newRef && oldRef.startsWith('media:')) await write(`media/${oldRef.slice(6)}`, null).catch(() => {});
}

/** Create or update a category. Returns its id. Fields: name, tagline, description, tags[], cover, accent, order */
async function saveCategory(cat) {
  if (!cat.name) throw new Error('A category needs a name.');
  let id = cat.id;
  if (!id) { id = slugify(cat.name); if (site.categories[id]) id += '-' + uid().slice(-4); }
  const order = cat.order ?? site.categories[id]?.order ?? (Math.max(0, ...getCategories().map((c) => c.order || 0)) + 1);
  const old = site.categories[id]?.cover;
  await write(`site/categories/${id}`, clean({ ...site.categories[id], ...cat, order }));
  if (cat.cover !== undefined) await dropMedia(old, cat.cover);
  return id;
}
/** Deletes the category together with its sessions and their photos. */
async function deleteCategory(id) {
  for (const s of getSessions({ categoryId: id })) await deleteSession(s.id);
  await dropMedia(site.categories[id]?.cover, null);
  await write(`site/categories/${id}`, null);
}

/** Create or update a session. Fields: categoryId, title, date (YYYY-MM-DD), time (HH:MM), venue, speaker, description, poster, posterSm */
async function saveSession(s) {
  if (!s.title || !s.categoryId || !s.date) throw new Error('A session needs a title, an event and a date.');
  let id = s.id;
  if (!id) { id = slugify(s.title); if (site.sessions[id]) id += '-' + uid().slice(-4); }
  const old = site.sessions[id]?.poster;
  await write(`site/sessions/${id}`, clean({ ...site.sessions[id], ...s }));
  if (s.poster !== undefined) await dropMedia(old, s.poster);
  return id;
}
async function deleteSession(id) {
  const s = site.sessions[id];
  for (const p of getPhotos(id)) await deletePhoto(id, p.id);
  if (s?.poster?.startsWith('media:')) await write(`media/${s.poster.slice(6)}`, null).catch(() => {});
  await write(`site/sessions/${id}`, null);
}

/** Read a File, downscale it, return a JPEG data URL. */
function compressImage(file, maxDim = 1400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0c0a09'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not a readable image.')); };
    img.src = url;
  });
}

/**
 * Upload an image file. Returns { ref: 'media:ID', thumb: dataURL }.
 * `ref` goes in session.poster / category.cover / photo.src, `thumb` in posterSm / photo.thumb.
 */
async function uploadImage(file, { maxDim = 1400, thumbDim = 420 } = {}) {
  const [full, thumb] = await Promise.all([compressImage(file, maxDim, 0.8), compressImage(file, thumbDim, 0.62)]);
  const id = uid();
  await write(`media/${id}`, full);
  mediaCache.set(id, Promise.resolve(full));
  return { ref: `media:${id}`, thumb };
}

/** Add a photo (File) to a session's gallery album. */
async function addPhoto(sessionId, file, caption = '') {
  const s = site.sessions[sessionId];
  if (!s) throw new Error('Pick a session first.');
  const { ref, thumb } = await uploadImage(file, { maxDim: 1600, thumbDim: 480 });
  const id = uid();
  await write(`site/photos/${sessionId}/${id}`, clean({ src: ref, thumb, caption, categoryId: s.categoryId, createdAt: Date.now() }));
  return id;
}
async function deletePhoto(sessionId, photoId) {
  const p = site.photos[sessionId]?.[photoId];
  if (p?.src?.startsWith('media:')) await write(`media/${p.src.slice(6)}`, null).catch(() => {});
  await write(`site/photos/${sessionId}/${photoId}`, null);
}

/** Admin only. Newest first. In demo mode this cannot be read and returns { error }. */
async function getRegistrations() {
  if (adminState.mode !== 'firebase') return { error: 'demo', items: [] };
  try {
    if (!fb) await loadFirebase();
    const snap = await fb.dbm.get(fb.dbm.ref(fb.db, 'registrations'));
    const items = list(snap.val()).sort((a, b) => String(b.isoTimestamp || '').localeCompare(String(a.isoTimestamp || '')));
    return { items };
  } catch (e) {
    return { error: /permission/i.test(e.message) ? 'rules' : e.message, items: [] };
  }
}
async function deleteRegistration(id) {
  if (adminState.mode !== 'firebase') throw new Error('Not available in demo mode.');
  if (!fb) await loadFirebase();
  await fb.dbm.remove(fb.dbm.ref(fb.db, `registrations/${id}`));
}
/** Replace everything published with the built-in starter content. */
async function resetToSeed() { await write('site', normalise(SEED)); }

export const store = {
  ready,
  get source() { return source; },
  get admin() { return { ...adminState }; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  getCategories, getCategory, getSessions, getSession, getPhotos, photoCount, getAlbums, getUpcoming,
  sessionDate, isUpcoming, resolveImage, setImage,
  addRegistration,
  login, logout, saveCategory, deleteCategory, saveSession, deleteSession,
  uploadImage, addPhoto, deletePhoto, getRegistrations, deleteRegistration, resetToSeed,
};

init();
