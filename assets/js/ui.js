// Shared UI helpers: icons, formatting, toasts, modals and the session-details popup.
import { store } from './store.js';

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICONS = {
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4.5-4.5L5 21"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.300a2 2 0 0 1 2.1-.4c.9.3 1.800.6 2.800.7a2 2 0 0 1 1.700 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="m22 7-10 6L2 7"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.500 6.500h.010"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.900M16 3.100a4 4 0 0 1 0 7.800"/>',
  heart: '<path d="M20.800 4.600a5.500 5.500 0 0 0-7.800 0L12 5.700l-1-1.100a5.500 5.500 0 0 0-7.800 7.800l1 1.100L12 21.200l7.800-7.700 1-1.100a5.500 5.500 0 0 0 0-7.800z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.200 7.800-2.100 6.300-6.300 2.100 2.100-6.300 6.300-2.100z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4 12.500-12.500z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.300-4.300"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.500"/><rect x="14" y="3" width="7" height="7" rx="1.500"/><rect x="3" y="14" width="7" height="7" rx="1.500"/><rect x="14" y="14" width="7" height="7" rx="1.500"/>',
};
/** Inline SVG icon markup. Names: see ICONS above. */
export function icon(name) { return I(ICONS[name] || ICONS.zap); }

export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** fmtDate('2026-11-21') -> "Sat, 21 Nov 2026"; style 'long' -> "Saturday, 21 November 2026" */
export function fmtDate(date, style = 'short') {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  const o = style === 'long' ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', o);
}
/** fmtTime('18:30') -> "6:30 PM" */
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/* ---------------------------------------------------------------- toasts */
let toastBox;
export function toast(message, iconName = 'flame', ms = 3600) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; toastBox.setAttribute('aria-live', 'polite'); document.body.append(toastBox); }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
  toastBox.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, ms);
}

/* ---------------------------------------------------------------- modal */
let openModals = [];
/**
 * Open a modal. `html` is the panel content. opts: { small, label, onClose }.
 * Returns { el, panel, close }. Esc, the scrim and the X button all close it.
 */
export function openModal(html, opts = {}) {
  const el = document.createElement('div');
  el.className = 'modal' + (opts.small ? ' modal--sm' : '');
  el.innerHTML = `<div class="modal__scrim" data-close></div>
    <div class="modal__panel" role="dialog" aria-modal="true" aria-label="${esc(opts.label || 'Details')}" tabindex="-1" data-lenis-prevent>
      <button class="icon-btn modal__close" data-close aria-label="Close">${icon('x')}</button>${html}</div>`;
  document.body.append(el);
  const prevFocus = document.activeElement;
  const panel = el.querySelector('.modal__panel');
  const close = () => {
    if (!el.isConnected) return;
    el.classList.remove('is-open');
    openModals = openModals.filter((m) => m !== api);
    if (!openModals.length) { document.body.classList.remove('is-locked'); window.__lenis?.start(); }
    setTimeout(() => el.remove(), 500);
    prevFocus?.focus?.({ preventScroll: true });
    opts.onClose?.();
  };
  const api = { el, panel, close };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = [...panel.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  openModals.push(api);
  document.body.classList.add('is-locked'); window.__lenis?.stop();
  requestAnimationFrame(() => { el.classList.add('is-open'); panel.focus({ preventScroll: true }); });
  return api;
}

/* ---------------------------------------------------------------- session popup */
/** Open the details popup of a session (poster, date, time, venue, description, photos link). */
export function openSession(id) {
  const s = store.getSession(id);
  if (!s) { toast('That session is no longer available.'); return null; }
  const cat = store.getCategory(s.categoryId);
  const upcoming = store.isUpcoming(s);
  const nPhotos = store.photoCount(s.id);
  const posters = [s.poster, ...(s.altPosters || [])].filter(Boolean);
  const html = `<div class="sm">
    <div class="sm__poster"><img alt="Poster: ${esc(s.title)}" data-main>
      ${posters.length > 1 ? `<div class="sm__alts">${posters.map((p, i) => `<button data-alt="${i}" aria-pressed="${i === 0}" aria-label="Poster ${i + 1}"><img alt="" data-altimg="${i}"></button>`).join('')}</div>` : ''}
    </div>
    <div class="sm__body">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="chip chip--hot">${esc(cat?.name || 'Event')}</span>
        ${upcoming ? '<span class="chip"><i class="dot-live"></i> Upcoming</span>' : '<span class="chip">Past session</span>'}
      </div>
      <h2>${esc(s.title)}</h2>
      <div class="sm__facts">
        <div class="fact"><small>${icon('calendar')} Date</small><b>${esc(fmtDate(s.date))}</b></div>
        <div class="fact"><small>${icon('clock')} Time</small><b>${esc(fmtTime(s.time) || 'To be announced')}</b></div>
        <div class="fact fact--wide"><small>${icon('pin')} Location</small><b>${esc(s.venue || 'ISKCON Coimbatore')}</b></div>
        ${s.speaker ? `<div class="fact fact--wide"><small>${icon('mic')} Speaker</small><b>${esc(s.speaker)}</b></div>` : ''}
      </div>
      <p class="sm__desc">${esc(s.description || cat?.description || '')}</p>
      <div class="sm__actions">
        ${nPhotos ? `<a class="btn" href="#/gallery/${encodeURIComponent(s.id)}" data-close>${icon('image')} See ${nPhotos} photo${nPhotos > 1 ? 's' : ''}</a>` : ''}
        ${upcoming ? `<button class="btn${nPhotos ? ' btn--ghost' : ''}" data-register>Save my seat ${icon('arrow')}</button>` : ''}
        ${!nPhotos && !upcoming ? `<a class="btn btn--ghost" href="#/gallery" data-close>${icon('image')} Browse the gallery</a>` : ''}
        ${cat ? `<a class="btn btn--ghost" href="#/events/${encodeURIComponent(cat.id)}" data-close>More ${esc(cat.name)}</a>` : ''}
      </div>
    </div></div>`;
  const m = openModal(html, { label: s.title });
  const main = m.panel.querySelector('[data-main]');
  store.setImage(main, posters[0], s.posterSm);
  m.panel.querySelectorAll('[data-altimg]').forEach((im) => store.setImage(im, posters[+im.dataset.altimg]));
  m.panel.querySelectorAll('[data-alt]').forEach((b) => b.addEventListener('click', () => {
    m.panel.querySelectorAll('[data-alt]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    store.setImage(main, posters[+b.dataset.alt]);
  }));
  m.panel.querySelector('[data-register]')?.addEventListener('click', () => { m.close(); window.dispatchEvent(new CustomEvent('spark:register')); });
  return m;
}
