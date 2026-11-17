// Program calendar view: #/calendar and #/calendar/2026-11
import { store } from '../store.js';
import { icon, esc, fmtDate, fmtTime, openSession } from '../ui.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const scan = () => window.dispatchEvent(new CustomEvent('spark:scan'));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let S = null; // state of the mounted view

function parseMonth(p) {
  const m = /^(\d{4})-(\d{2})$/.exec(p || '');
  return m && +m[2] >= 1 && +m[2] <= 12 ? { y: +m[1], m: +m[2] - 1 } : null;
}

function on(target, ev, fn, opts) {
  target.addEventListener(ev, fn, opts);
  S.off.push(() => target.removeEventListener(ev, fn, opts));
}

function loadData() {
  const list = store.getSessions({ categoryId: S.cat || undefined, order: 'asc' });
  const map = new Map();
  list.forEach((s) => { if (!map.has(s.date)) map.set(s.date, []); map.get(s.date).push(s); });
  S.data = { list, map };
}

function signature() {
  return JSON.stringify([
    store.getCategories().map((c) => [c.id, c.name]),
    store.getSessions().map((s) => [s.id, s.title, s.date, s.time, s.venue, s.categoryId, s.posterSm, s.poster]),
  ]);
}

/* ------------------------------------------------------------------ mount */
function mount(root, params = []) {
  if (S) unmount();
  const now = new Date();
  const pm = parseMonth(params[0]);
  S = { root, y: pm ? pm.y : now.getFullYear(), m: pm ? pm.m : now.getMonth(), cat: '', focus: null, off: [], data: null, sig: '', tick: 0 };
  root.classList.add('cal-page');
  root.innerHTML = `
  <section class="cal container">
    <header class="cal-head">
      <span class="eyebrow" data-reveal>Program calendar</span>
      <h1 class="h-section" data-reveal style="--i:1">Every session, <span class="fire-text">on one page</span></h1>
      <p class="lead" data-reveal style="--i:2">Tap a glowing poster to see the details. The dates in saffron are where the fun happens.</p>
    </header>
    <div class="cal-filters filters" data-filters role="group" aria-label="Filter by event" data-reveal style="--i:3"></div>
    <div class="cal-layout">
      <div class="cal-main" data-reveal style="--i:3">
        <div class="cal-bar">
          <h2 class="cal-title" data-title aria-live="polite"></h2>
          <div class="cal-bar__btns">
            <button class="icon-btn" data-nav="prev" aria-label="Previous month">${icon('chevron-left')}</button>
            <button class="btn btn--ghost btn--sm" data-nav="today" data-magnetic>Today</button>
            <button class="icon-btn" data-nav="next" aria-label="Next month">${icon('chevron')}</button>
          </div>
        </div>
        <div class="cal-year" data-year></div>
        <div class="cal-gridwrap" data-wrap>
          <div class="cal-grid" data-grid role="group" aria-label="Calendar days"></div>
        </div>
        <p class="cal-hint muted">Arrow keys move between days, Enter opens a session, Page Up and Page Down change month.</p>
      </div>
      <aside class="cal-side">
        <div data-next></div>
        <div data-list></div>
      </aside>
    </div>
  </section>`;

  S.tip = document.createElement('div');
  S.tip.className = 'cal-tip'; S.tip.setAttribute('role', 'tooltip');
  S.pop = document.createElement('div');
  S.pop.className = 'cal-pop'; S.pop.setAttribute('role', 'dialog'); S.pop.setAttribute('aria-label', 'Sessions on this day');
  S.pop.setAttribute('data-lenis-prevent', '');
  document.body.append(S.tip, S.pop);

  S.el = {
    filters: root.querySelector('[data-filters]'), title: root.querySelector('[data-title]'),
    year: root.querySelector('[data-year]'), grid: root.querySelector('[data-grid]'),
    wrap: root.querySelector('[data-wrap]'), next: root.querySelector('[data-next]'), list: root.querySelector('[data-list]'),
  };

  loadData();
  S.sig = signature();
  renderAll(0);
  bind();
  S.unsub = store.subscribe(() => {
    const sig = signature();
    if (sig === S.sig) return;
    S.sig = sig;
    if (S.cat && !store.getCategory(S.cat)) S.cat = '';
    loadData(); renderAll(0);
  });
  S.timer = setInterval(tickCountdown, 1000);
  scan();
}

function unmount() {
  if (!S) return;
  S.off.forEach((f) => f());
  S.unsub?.();
  clearInterval(S.timer);
  S.tip?.remove(); S.pop?.remove();
  S.root.classList.remove('cal-page');
  S = null;
}

/* ------------------------------------------------------------------ render */
function renderAll(dir) {
  renderFilters(); renderBar(); renderYear(); renderGrid(dir); renderNext(); renderList();
}

function renderFilters() {
  const cats = store.getCategories();
  S.el.filters.innerHTML = [`<button type="button" data-cat="" aria-pressed="${!S.cat}">All events</button>`]
    .concat(cats.map((c) => `<button type="button" data-cat="${esc(c.id)}" aria-pressed="${S.cat === c.id}">${esc(c.name)}</button>`)).join('');
}

function renderBar() {
  const t = S.el.title;
  const html = `${MONTHS[S.m]} <span class="cal-title__y">${S.y}</span>`;
  if (t.innerHTML !== html) {
    t.innerHTML = html;
    if (!reduced()) { t.classList.remove('is-swap'); void t.offsetWidth; t.classList.add('is-swap'); }
  }
}

function monthCounts(y) {
  const c = Array(12).fill(0);
  S.data.list.forEach((s) => { const [sy, sm] = s.date.split('-').map(Number); if (sy === y) c[sm - 1]++; });
  return c;
}

function renderYear() {
  const counts = monthCounts(S.y);
  const total = counts.reduce((a, b) => a + b, 0);
  S.el.year.innerHTML = `
    <div class="cal-year__head">
      <button class="cal-year__nav" data-nav="yprev" aria-label="Previous year">${icon('chevron-left')}</button>
      <b>${S.y}</b>
      <button class="cal-year__nav" data-nav="ynext" aria-label="Next year">${icon('chevron')}</button>
      <span class="muted">${plural(total, 'session')} this year</span>
    </div>
    <div class="cal-year__months">${counts.map((n, i) => `
      <button type="button" class="cal-ym${n ? ' has' : ''}${i === S.m ? ' is-on' : ''}" data-ym="${S.y}-${i}" aria-pressed="${i === S.m}" aria-label="${MONTHS[i]} ${S.y}, ${n ? plural(n, 'session') : 'no sessions'}">
        <span>${MONTHS[i].slice(0, 3)}</span>
        <i>${n ? `<em>${n}</em>` : ''}</i>
      </button>`).join('')}
    </div>`;
}

function renderGrid(dir) {
  const { y, m } = S;
  const map = S.data.map;
  const now = new Date();
  const todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const total = Math.ceil((lead + days) / 7) * 7;

  let focusStr = S.focus && S.focus.startsWith(`${y}-${pad(m + 1)}-`) ? S.focus : null;
  if (!focusStr) {
    if (todayStr.startsWith(`${y}-${pad(m + 1)}-`)) focusStr = todayStr;
    else { const first = [...map.keys()].sort().find((k) => k.startsWith(`${y}-${pad(m + 1)}-`)); focusStr = first || ymd(y, m, 1); }
  }
  S.focus = focusStr;

  let html = DOW.map((d) => `<div class="cal-dow" aria-hidden="true">${d}</div>`).join('');
  for (let i = 0; i < total; i++) {
    const day = i - lead + 1;
    if (day < 1 || day > days) {
      html += `<div class="cal-cell cal-cell--out" aria-hidden="true"><span class="cal-num">${new Date(y, m, day).getDate()}</span></div>`;
      continue;
    }
    const date = ymd(y, m, day);
    const ss = map.get(date) || [];
    const cls = ['cal-cell'];
    if (ss.length) cls.push('has');
    if (ss.length > 1) cls.push('multi');
    if (date === todayStr) cls.push('is-today');
    if (ss.length) cls.push(ss.some((s) => store.isUpcoming(s)) ? 'is-up' : 'is-past');
    const label = fmtDate(date, 'long') + (ss.length ? `: ${ss.map((s) => s.title).join(', ')}` : '') + (date === todayStr ? ' (today)' : '');
    const orbs = ss.slice(0, 2).map((s) => `<span class="cal-orb"><img alt="" decoding="async" data-sid="${esc(s.id)}"></span>`).join('');
    html += `<button type="button" class="${cls.join(' ')}" data-date="${date}" style="--c:${i}" tabindex="${date === focusStr ? 0 : -1}" aria-label="${esc(label)}"${ss.length ? ` data-cursor="${ss.length > 1 ? 'View' : 'Open'}"` : ''}>
      <span class="cal-num">${day}</span>
      ${ss.length ? `<span class="cal-orbs" data-n="${Math.min(ss.length, 2)}">${orbs}</span>${ss.length > 1 ? `<span class="cal-badge" aria-hidden="true">${ss.length}</span>` : ''}` : ''}
    </button>`;
  }
  const g = S.el.grid;
  g.innerHTML = html;
  g.querySelectorAll('img[data-sid]').forEach((img) => {
    const s = store.getSession(img.dataset.sid);
    if (s) store.setImage(img, s.posterSm || s.poster);
  });
  g.classList.remove('is-next', 'is-prev');
  if (dir) { void g.offsetWidth; g.classList.add(dir > 0 ? 'is-next' : 'is-prev'); }
  hideTip(); closePop();
}

function renderNext() {
  const up = S.data.list.find((s) => store.isUpcoming(s));
  if (!up) {
    S.el.next.innerHTML = `<div class="cal-next cal-next--empty card" data-reveal="zoom">
      <span class="chip">${icon('calendar')} Next up</span>
      <h3 class="h-card">Nothing on the calendar yet</h3>
      <p class="muted">${S.cat ? 'No upcoming sessions for this event right now. Try another event or all events.' : 'New sessions appear here the moment they are announced. Meanwhile, relive the last one.'}</p>
      <a class="btn btn--ghost btn--sm" href="#/gallery">${icon('image')} Browse the gallery</a>
    </div>`;
    scan();
    return;
  }
  const cat = store.getCategory(up.categoryId);
  S.nextId = up.id;
  S.el.next.innerHTML = `<div class="cal-next card" data-spot data-reveal="zoom">
    <div class="cal-next__top">
      <button type="button" class="cal-next__poster" data-open="${esc(up.id)}" aria-label="Open details: ${esc(up.title)}"><img alt="Poster: ${esc(up.title)}" data-nextimg></button>
      <div class="cal-next__info">
        <span class="chip chip--hot"><i class="dot-live"></i> Next up</span>
        <h3 class="h-card">${esc(up.title)}</h3>
        <p class="muted">${esc(cat?.name || '')}${cat ? ' · ' : ''}${esc(fmtDate(up.date))}, ${esc(fmtTime(up.time))}</p>
      </div>
    </div>
    <div class="cal-count" data-count aria-label="Time until this session"></div>
    <div class="cal-next__actions">
      <button class="btn btn--sm" data-open="${esc(up.id)}" data-magnetic>Details ${icon('arrow')}</button>
      <button class="btn btn--ghost btn--sm" data-jump="${esc(up.date)}">Show on calendar</button>
    </div>
  </div>`;
  store.setImage(S.el.next.querySelector('[data-nextimg]'), up.posterSm || up.poster);
  tickCountdown(true);
  scan();
}

function tickCountdown(rebuild) {
  const box = S?.el?.next.querySelector('[data-count]');
  if (!box || !S.nextId) return;
  const s = store.getSession(S.nextId);
  if (!s) return;
  const diff = store.sessionDate(s) - Date.now();
  if (diff <= 0) { box.innerHTML = '<p class="cal-today"><i class="dot-live"></i> Happening today. Come along!</p>'; return; }
  const v = { Days: Math.floor(diff / 864e5), Hours: Math.floor(diff / 36e5) % 24, Mins: Math.floor(diff / 6e4) % 60, Secs: Math.floor(diff / 1e3) % 60 };
  if (rebuild === true || !box.querySelector('b')) {
    box.innerHTML = Object.entries(v).map(([k, n]) => `<div><b>${pad(n)}</b><span>${k}</span></div>`).join('');
  } else {
    box.querySelectorAll('b').forEach((b, i) => { b.textContent = pad(Object.values(v)[i]); });
  }
}

function renderList() {
  const prefix = `${S.y}-${pad(S.m + 1)}-`;
  const items = S.data.list.filter((s) => s.date.startsWith(prefix));
  let body;
  if (items.length) {
    body = `<ol class="cal-list">${items.map((s, i) => {
      const cat = store.getCategory(s.categoryId);
      return `<li data-reveal style="--i:${Math.min(i, 6)}"><button type="button" class="cal-item" data-open="${esc(s.id)}" data-date="${s.date}">
        <span class="cal-item__thumb"><img alt="" loading="lazy" decoding="async" data-lid="${esc(s.id)}"></span>
        <span class="cal-item__txt">
          <b>${esc(s.title)}</b>
          <small>${esc(fmtDate(s.date))} · ${esc(fmtTime(s.time) || 'Time to be announced')}</small>
          <small class="cal-item__venue">${icon('pin')} ${esc(s.venue || 'ISKCON Coimbatore')}${cat ? ` · ${esc(cat.name)}` : ''}</small>
        </span>
        ${store.isUpcoming(s) ? '<i class="dot-live" title="Upcoming"></i>' : ''}
      </button></li>`;
    }).join('')}</ol>`;
  } else {
    const nextBusy = S.data.list.find((s) => s.date > `${prefix}31`) || [...S.data.list].reverse().find((s) => s.date < `${prefix}01`);
    body = `<div class="empty cal-empty">
      <p>No sessions in ${MONTHS[S.m]} ${S.y}${S.cat ? ' for this event' : ''}.</p>
      ${nextBusy ? `<button class="btn btn--ghost btn--sm" data-jump="${esc(nextBusy.date)}">Jump to ${esc(MONTHS[+nextBusy.date.slice(5, 7) - 1])} ${nextBusy.date.slice(0, 4)}</button>` : ''}
    </div>`;
  }
  S.el.list.innerHTML = `<div class="cal-listbox">
    <div class="cal-listbox__head"><h3 class="h-card">In this month</h3><span class="chip">${plural(items.length, 'session')}</span></div>${body}</div>`;
  S.el.list.querySelectorAll('img[data-lid]').forEach((img) => {
    const s = store.getSession(img.dataset.lid);
    if (s) store.setImage(img, s.posterSm || s.poster);
  });
}

/* ------------------------------------------------------------------ navigation */
function goMonth(y, m, { focus, fromKey } = {}) {
  const d = new Date(y, m, 1); y = d.getFullYear(); m = d.getMonth();
  const dir = Math.sign((y * 12 + m) - (S.y * 12 + S.m));
  S.y = y; S.m = m;
  S.focus = focus || null;
  history.replaceState(null, '', `#/calendar/${y}-${pad(m + 1)}`);
  renderBar(); renderYear(); renderGrid(dir); renderList();
  scan();
  if (fromKey || focus) focusCell(S.focus);
}

function focusCell(date) {
  const c = S.el.grid.querySelector(`[data-date="${date}"]`);
  if (c) c.focus({ preventScroll: false });
}

/* ------------------------------------------------------------------ tooltip + popover */
function showTip(cell) {
  const ss = S.data.map.get(cell.dataset.date);
  if (!ss) return;
  S.tip.innerHTML = ss.map((s) => `<div><b>${esc(s.title)}</b><span>${esc(fmtTime(s.time))}${s.venue ? ` · ${esc(s.venue.split(',')[0])}` : ''}</span></div>`).join('');
  S.tip.classList.add('is-on');
  const r = cell.getBoundingClientRect();
  const tw = S.tip.offsetWidth, th = S.tip.offsetHeight;
  const left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
  let top = r.top - th - 8;
  if (top < 80) top = r.bottom + 8;
  S.tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}
function hideTip() { S?.tip?.classList.remove('is-on'); }

function openPop(cell) {
  const ss = S.data.map.get(cell.dataset.date) || [];
  hideTip();
  S.pop.innerHTML = `<p class="cal-pop__h">${esc(fmtDate(cell.dataset.date, 'long'))}</p>` + ss.map((s) => `
    <button type="button" class="cal-pop__item" data-pid="${esc(s.id)}">
      <span class="cal-pop__thumb"><img alt="" data-popimg="${esc(s.id)}"></span>
      <span><b>${esc(s.title)}</b><small>${esc(fmtTime(s.time))}</small></span>
    </button>`).join('');
  S.pop.querySelectorAll('[data-popimg]').forEach((img) => {
    const s = store.getSession(img.dataset.popimg);
    if (s) store.setImage(img, s.posterSm || s.poster);
  });
  S.pop.classList.add('is-on');
  const r = cell.getBoundingClientRect();
  const pw = S.pop.offsetWidth, ph = S.pop.offsetHeight;
  const left = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2));
  let top = r.bottom + 8;
  if (top + ph > innerHeight - 8) top = Math.max(80, r.top - ph - 8);
  S.pop.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  S.popCell = cell;
  S.pop.querySelector('button')?.focus({ preventScroll: true });
}
function closePop(restore) {
  if (!S?.pop.classList.contains('is-on')) return;
  S.pop.classList.remove('is-on');
  if (restore) S.popCell?.focus({ preventScroll: true });
  S.popCell = null;
}

/* ------------------------------------------------------------------ events */
function bind() {
  const root = S.root;

  on(root, 'click', (e) => {
    const t = e.target;
    const cat = t.closest('[data-cat]');
    if (cat) { S.cat = cat.dataset.cat; loadData(); renderFilters(); renderYear(); renderGrid(0); renderNext(); renderList(); scan(); return; }
    const nav = t.closest('[data-nav]');
    if (nav) {
      const k = nav.dataset.nav;
      if (k === 'prev') goMonth(S.y, S.m - 1);
      else if (k === 'next') goMonth(S.y, S.m + 1);
      else if (k === 'yprev') goMonth(S.y - 1, S.m);
      else if (k === 'ynext') goMonth(S.y + 1, S.m);
      else if (k === 'today') { const n = new Date(); goMonth(n.getFullYear(), n.getMonth(), { focus: ymd(n.getFullYear(), n.getMonth(), n.getDate()) }); }
      return;
    }
    const ym = t.closest('[data-ym]');
    if (ym) { const [y, m] = ym.dataset.ym.split('-').map(Number); goMonth(y, m); return; }
    const jump = t.closest('[data-jump]');
    if (jump) { const [y, m] = jump.dataset.jump.split('-').map(Number); goMonth(y, m - 1, { focus: jump.dataset.jump }); return; }
    const open = t.closest('[data-open]');
    if (open) { openSession(open.dataset.open); return; }
    const cell = t.closest('.cal-cell.has');
    if (cell) {
      S.focus = cell.dataset.date;
      const ss = S.data.map.get(cell.dataset.date) || [];
      if (ss.length === 1) openSession(ss[0].id); else if (ss.length) openPop(cell);
    }
  });

  // tooltip
  on(root, 'mouseover', (e) => { const c = e.target.closest('.cal-cell.has'); if (c) showTip(c); });
  on(root, 'mouseout', (e) => { const c = e.target.closest('.cal-cell.has'); if (c && !c.contains(e.relatedTarget)) hideTip(); });
  on(root, 'focusin', (e) => { const c = e.target.closest('.cal-cell.has'); if (c) showTip(c); });
  on(root, 'focusout', (e) => { if (e.target.closest('.cal-cell')) hideTip(); });
  on(window, 'scroll', () => { hideTip(); closePop(); }, { passive: true });
  on(window, 'resize', () => { hideTip(); closePop(); });

  // list item hover highlights its day
  const hl = (e, v) => {
    const it = e.target.closest('.cal-item');
    S.el.grid.querySelectorAll('.is-hl').forEach((n) => n.classList.remove('is-hl'));
    if (it && v) S.el.grid.querySelector(`[data-date="${it.dataset.date}"]`)?.classList.add('is-hl');
  };
  on(S.el.list, 'mouseover', (e) => hl(e, true));
  on(S.el.list, 'mouseout', (e) => hl(e, false));
  on(S.el.list, 'focusin', (e) => hl(e, true));
  on(S.el.list, 'focusout', (e) => hl(e, false));

  // popover
  on(S.pop, 'click', (e) => {
    const b = e.target.closest('[data-pid]');
    if (b) { const id = b.dataset.pid; closePop(); openSession(id); }
  });
  on(document, 'pointerdown', (e) => {
    if (S.pop.classList.contains('is-on') && !S.pop.contains(e.target) && !S.popCell?.contains(e.target)) closePop();
  });
  on(S.pop, 'keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); closePop(true); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const bs = [...S.pop.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
    }
  });

  // keyboard
  on(root, 'keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'PageUp') { e.preventDefault(); goMonth(S.y, S.m - 1, { fromKey: true }); return; }
    if (e.key === 'PageDown') { e.preventDefault(); goMonth(S.y, S.m + 1, { fromKey: true }); return; }
    const cell = e.target.closest?.('.cal-cell[data-date]');
    if (!cell) return;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const [y, m, d] = cell.dataset.date.split('-').map(Number);
      const dt = new Date(y, m - 1, d); const wd = (dt.getDay() + 6) % 7;
      return moveTo(new Date(y, m - 1, d + (e.key === 'Home' ? -wd : 6 - wd)));
    }
    if (!delta) return;
    e.preventDefault();
    const [y, m, d] = cell.dataset.date.split('-').map(Number);
    moveTo(new Date(y, m - 1, d + delta));
  });

  // swipe
  let sx = 0, sy = 0, st = 0;
  on(S.el.wrap, 'touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  on(S.el.wrap, 'touchend', (e) => {
    const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - st < 700) goMonth(S.y, S.m + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

function moveTo(dt) {
  const date = ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
  if (dt.getFullYear() !== S.y || dt.getMonth() !== S.m) { goMonth(dt.getFullYear(), dt.getMonth(), { focus: date, fromKey: true }); return; }
  S.focus = date;
  S.el.grid.querySelectorAll('.cal-cell[tabindex="0"]').forEach((c) => c.setAttribute('tabindex', '-1'));
  const c = S.el.grid.querySelector(`[data-date="${date}"]`);
  if (c) { c.setAttribute('tabindex', '0'); c.focus(); }
}

export default { mount, unmount };
