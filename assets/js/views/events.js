// One event (category) page: its story and all of its session posters.
import { store } from '../store.js';
import { icon, esc, fmtDate, fmtTime, openSession } from '../ui.js';
import { scan } from '../fx.js';

let root, unsub, catId, filter = 'all', onClick;

function card(s, i) {
  const up = store.isUpcoming(s), n = store.photoCount(s.id);
  return `<button class="poster" data-open="${esc(s.id)}" data-tilt="8" data-reveal style="--i:${i % 6}" data-cursor="Details" aria-label="${esc(s.title)}, ${esc(fmtDate(s.date))}. Open details">
    <img alt="Poster: ${esc(s.title)}" loading="lazy" data-sm="${esc(s.id)}">
    <span class="poster__shine"></span>
    ${up ? `<span class="chip poster__badge"><i class="dot-live" style="background:#fff"></i> Upcoming</span>` : ''}
    <span class="poster__info">
      <b>${esc(s.title)}</b>
      <span>${icon('calendar')} ${esc(fmtDate(s.date))}${s.time ? ' · ' + esc(fmtTime(s.time)) : ''}</span>
      <span>${icon('pin')} ${esc(s.venue || 'ISKCON Coimbatore')}</span>
      ${n ? `<span>${icon('image')} ${n} photo${n > 1 ? 's' : ''}</span>` : ''}
    </span>
  </button>`;
}

function render() {
  const cat = store.getCategory(catId);
  if (!cat) {
    const cats = store.getCategories();
    root.innerHTML = `<section class="section container" style="padding-top:calc(var(--nav-h) + 70px)">
      <span class="eyebrow">Events</span><h1 class="h-section" style="margin:14px 0 30px">${catId ? 'We could not find that event' : 'All events'}</h1>
      <div class="filters">${cats.map((c) => `<a class="btn btn--ghost" href="#/events/${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join('')}</div></section>`;
    return;
  }
  const all = store.getSessions({ categoryId: cat.id });
  const upcoming = all.filter(store.isUpcoming), past = all.filter((s) => !store.isUpcoming(s));
  if (filter === 'upcoming' && !upcoming.length) filter = 'all';
  const shown = filter === 'upcoming' ? upcoming.slice().reverse() : filter === 'past' ? past : [...upcoming.slice().reverse(), ...past];
  const others = store.getCategories().filter((c) => c.id !== cat.id);
  const f = (key, label, n) => `<button aria-pressed="${filter === key}" data-filter="${key}">${label} <span style="opacity:.6">${n}</span></button>`;

  root.innerHTML = `<section class="page-hero" style="--accent:${esc(cat.accent || '#FFA040')}">
      <img class="page-hero__img" alt="" data-cover data-parallax="6">
      <div class="container">
        <a class="back" href="#/" data-scroll="events">${icon('arrow-left')} All events</a>
        <span class="eyebrow" style="display:flex">${esc(cat.tagline || 'Event')}</span>
        <h1 data-split>${esc(cat.name)}</h1>
        <p class="lead">${esc(cat.description || '')}</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:22px">${(cat.tags || []).map((t) => `<span class="chip" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.2)">${esc(t)}</span>`).join('')}</div>
      </div></section>
    <section class="section" style="padding-top:clamp(36px,5vw,64px)"><div class="container">
      <div class="sec-head" style="align-items:center">
        <h2 class="h-card">${all.length} session${all.length === 1 ? '' : 's'}. Tap a poster for the details.</h2>
        <div class="filters" role="group" aria-label="Filter sessions">${f('all', 'All', all.length)}${upcoming.length ? f('upcoming', 'Upcoming', upcoming.length) : ''}${past.length && upcoming.length ? f('past', 'Past', past.length) : ''}</div>
      </div>
      ${shown.length ? `<div class="posters">${shown.map(card).join('')}</div>` : `<div class="empty">No sessions here yet. New posters land every week, so check back soon.</div>`}
      ${others.length ? `<div style="margin-top:clamp(50px,8vw,100px)"><span class="eyebrow">Keep exploring</span>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px">${others.map((c) => `<a class="btn btn--ghost" href="#/events/${encodeURIComponent(c.id)}" data-magnetic>${esc(c.name)} ${icon('arrow')}</a>`).join('')}
        <a class="btn" href="#/calendar">Program calendar ${icon('calendar')}</a></div></div>` : ''}
    </div></section>`;
  store.setImage(root.querySelector('[data-cover]'), cat.cover);
  root.querySelectorAll('[data-sm]').forEach((img) => { const s = store.getSession(img.dataset.sm); store.setImage(img, s.posterSm || s.poster); });
  scan(root);
}

export default {
  mount(el, params) {
    root = el; catId = params[0]; filter = 'all';
    render();
    let sig = JSON.stringify([store.getCategory(catId), store.getSessions({ categoryId: catId })]);
    unsub = store.subscribe(() => { const n = JSON.stringify([store.getCategory(catId), store.getSessions({ categoryId: catId })]); if (n !== sig) { sig = n; render(); } });
    onClick = (e) => {
      const o = e.target.closest('[data-open]'); if (o) { openSession(o.dataset.open); return; }
      const fb = e.target.closest('[data-filter]'); if (fb) { filter = fb.dataset.filter; render(); root.querySelectorAll('[data-reveal]').forEach((n) => n.classList.add('in')); }
    };
    root.addEventListener('click', onClick);
  },
  unmount() { unsub?.(); root?.removeEventListener('click', onClick); root = null; },
};
