// Home page.
import { store } from '../store.js';
import { icon, esc, fmtDate, fmtTime, openSession } from '../ui.js';
import { scan, burst, scrollToEl, env } from '../fx.js';

let root, unsub, timers = [], cleanups = [];
const on = (target, ev, fn, opts) => { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); };

function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  let name = ''; try { name = (localStorage.getItem('spark.member') || '').split(' ')[0]; } catch { /* ignore */ }
  const next = store.getUpcoming()[0];
  let tail = 'Every Saturday at ISKCON Coimbatore';
  if (next) {
    const days = Math.ceil((store.sessionDate(next) - new Date()) / 864e5);
    const cat = store.getCategory(next.categoryId)?.name || 'Spark';
    tail = days <= 0 ? `${cat} is today at ${fmtTime(next.time)}` : days === 1 ? `${cat} is tomorrow` : `Next ${cat} in ${days} days`;
  }
  return `${part}${name ? ', ' + esc(name) : ''}. ${esc(tail)}`;
}
const chars = (text) => [...text].map((c) => (c === ' ' ? '<span class="ch">&nbsp;</span>' : `<span class="ch">${c}</span>`)).join('');

function heroHTML() {
  const words = ['Discussion', 'Music', 'Dinner', 'Real friends', 'Real conversations', 'Real growth', 'Real you', 'Every Saturday'];
  const run = words.map((w) => `<span>${w}</span>`).join('');
  return `<section class="hero" id="top">
    <div class="hero__aura"></div><div class="hero__grid"></div>
    <div class="container hero__inner">
      <button class="hero__greet" data-greet data-noburst aria-label="Make some sparks"><i class="dot-live"></i><span>${greeting()}</span></button>
      <h1 class="hero__title" aria-label="The spark in you">
        <span class="line line--fire" aria-hidden="true">${chars('The Spark')}</span>
        <span class="line line--out" aria-hidden="true">${chars('In You')}</span>
      </h1>
      <div class="hero__row">
        <p class="lead" data-hero-fade>A spark is all it takes to ignite a life-changing experience. Spark Youth Club is where young Coimbatore comes to ask big questions, make real friends and find out what they are made of.</p>
        <div class="hero__actions" data-hero-fade>
          <button class="btn btn--lg" data-register data-magnetic>Ignite your spark ${icon('arrow')}</button>
          <a class="btn btn--lg btn--ghost" href="#/" data-scroll="events">Explore events</a>
        </div>
      </div>
    </div>
    <div class="hero__scroll" aria-hidden="true"><i></i>Scroll</div>
    <div class="marquee" aria-hidden="true"><div class="marquee__track">${run}${run}${run}</div></div>
  </section>`;
}

function igniteHTML() {
  const sessions = store.getSessions().length, cats = store.getCategories().length;
  return `<section class="ignite"><div class="container">
    <div class="ignite__card" data-reveal="zoom" data-spot>
      <div>
        <span class="eyebrow">Free for ages 15 to 30</span>
        <h2 class="h-section" style="margin-top:16px">One evening can change the <span class="fire-text">direction</span> of a life.</h2>
        <div class="ignite__stats">
          <span class="chip">${icon('calendar')} Every Saturday, 6:30 PM</span>
          <span class="chip">${icon('flame')} ${sessions} sessions so far</span>
          <span class="chip">${icon('grid')} ${cats} kinds of events</span>
        </div>
      </div>
      <button class="btn btn--lg" data-register data-magnetic data-cursor="Join">Register now ${icon('arrow')}</button>
    </div></div></section>`;
}

function aboutHTML() {
  return `<section class="section" id="about"><div class="container mv">
    <div class="mv__row">
      <div class="mv__media" data-reveal="left"><img src="assets/img/mission.webp" alt="Young friends laughing together" loading="lazy" data-parallax="9"></div>
      <div class="mv__text">
        <div class="mv__num" aria-hidden="true" data-reveal>01</div>
        <span class="eyebrow" data-reveal>Our mission</span>
        <p class="big" data-split="read">To give every young person a place to belong: where honest questions are welcome, friendships run deep, and timeless wisdom turns into everyday strength.</p>
        <div class="pillars">
          <div class="pillar" data-reveal style="--i:0" data-spot>${icon('users')}<b>Real friends</b><span>Company that lifts you up, not drags you down.</span></div>
          <div class="pillar" data-reveal style="--i:1" data-spot>${icon('compass')}<b>Real conversations</b><span>No judgment. No pressure. Just purpose.</span></div>
          <div class="pillar" data-reveal style="--i:2" data-spot>${icon('heart')}<b>Real growth</b><span>Habits, clarity and a calm mind that lasts.</span></div>
        </div>
      </div>
    </div>
    <div class="mv__row">
      <div class="mv__media" data-reveal="right"><img src="assets/img/vision.webp" alt="A hiker watching the sun rise over the hills" loading="lazy" data-parallax="9"></div>
      <div class="mv__text">
        <div class="mv__num" aria-hidden="true" data-reveal>02</div>
        <span class="eyebrow" data-reveal>Our vision</span>
        <p class="big" data-split="read">A generation that is sharp in the world and steady within. Young leaders with character, compassion and devotion, lighting up their homes, campuses and city.</p>
        <p class="lead" style="margin-top:22px" data-reveal>Spark is the youth wing of ISKCON Coimbatore. We draw on the Bhagavad-gita, music and good food to help young people live with purpose.</p>
      </div>
    </div>
  </div></section>`;
}

function eventsHTML() {
  const cats = store.getCategories();
  const strips = cats.map((c, i) => {
    const n = store.getSessions({ categoryId: c.id }).length;
    return `<article class="strip${i === 0 ? ' is-open' : ''}" data-cat="${esc(c.id)}" style="--accent:${esc(c.accent || '#FFA040')}" tabindex="0" role="link" aria-label="${esc(c.name)}: ${esc(c.tagline || '')}" data-cursor="Open">
      <img class="strip__img" alt="" loading="lazy" data-cover="${i}">
      <span class="strip__idx" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      <span class="chip strip__count">${n} session${n === 1 ? '' : 's'}</span>
      <span class="strip__vert" aria-hidden="true">${esc(c.name)}</span>
      <div class="strip__body">
        <span class="tag">${esc(c.tagline || '')}</span>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.description || '')}</p>
        <div class="strip__tags">${(c.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
        <a class="btn" href="#/events/${encodeURIComponent(c.id)}" tabindex="-1">See the posters ${icon('arrow')}</a>
      </div>
    </article>`;
  }).join('');
  return `<section class="section" id="events"><div class="container">
    <div class="sec-head">
      <div><span class="eyebrow" data-reveal>Events</span>
        <h2 class="h-section" data-split style="margin-top:14px">Pick your kind of evening</h2></div>
      <p class="lead" data-reveal>Peek in, then step inside. Every event has its own flavour, and all of them end with dinner.</p>
    </div>
    ${cats.length ? `<div class="strips" data-reveal>${strips}</div>` : '<div class="empty">Events will appear here soon.</div>'}
  </div></section>`;
}

function nextHTML() {
  const up = store.getUpcoming()[0];
  const s = up || store.getSessions()[0];
  if (!s) return '';
  const cat = store.getCategory(s.categoryId);
  return `<section class="section" id="next"><div class="container next">
    <button class="next__poster" data-open="${esc(s.id)}" data-tilt="10" data-reveal="zoom" data-cursor="Details" aria-label="Details: ${esc(s.title)}"><img alt="Poster: ${esc(s.title)}" data-poster></button>
    <div>
      <span class="eyebrow" data-reveal>${up ? 'Next up' : 'Most recent'}</span>
      <h2 class="h-section" data-split style="margin-top:14px">${esc(s.title)}</h2>
      ${up ? `<div class="count" data-count="${store.sessionDate(s).getTime()}" data-reveal aria-label="Countdown">
        <div><b data-d>00</b><span>Days</span></div><div><b data-h>00</b><span>Hours</span></div><div><b data-m>00</b><span>Min</span></div><div><b data-s>00</b><span>Sec</span></div></div>` : ''}
      <ul class="meta-list" data-reveal>
        <li>${icon('calendar')} ${esc(fmtDate(s.date, 'long'))}</li>
        <li>${icon('clock')} ${esc(fmtTime(s.time))}</li>
        <li>${icon('pin')} ${esc(s.venue || 'ISKCON Coimbatore')}</li>
      </ul>
      <p class="lead" data-reveal>${esc(s.description || '')}</p>
      <div class="hero__actions" style="margin-top:26px" data-reveal>
        ${up ? `<button class="btn" data-register data-magnetic>Save my seat ${icon('arrow')}</button>` : ''}
        <button class="btn btn--ghost" data-open="${esc(s.id)}">${esc(cat?.name || 'Session')} details</button>
      </div>
    </div>
  </div></section>`;
}

function teasersHTML() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const byDay = {};
  store.getSessions().forEach((s) => { const d = store.sessionDate(s); if (d.getFullYear() === y && d.getMonth() === m) byDay[d.getDate()] = s; });
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<i style="opacity:.25"></i>';
  for (let d = 1; d <= days; d++) cells += byDay[d] ? `<i class="has" data-mini="${esc(byDay[d].id)}"></i>` : '<i></i>';
  const photos = store.getAlbums().flatMap((a) => store.getPhotos(a.id)).slice(0, 3);
  const nPhotos = store.getAlbums().reduce((n, a) => n + store.photoCount(a.id), 0);
  return `<section class="section" style="padding-top:0"><div class="container teasers">
    <a class="teaser" href="#/calendar" data-reveal data-spot data-cursor="Open">
      <div><span class="eyebrow">Program calendar</span><h3>${now.toLocaleDateString('en-IN', { month: 'long' })} at a glance</h3><p>Every session on one page. Tap a date to see its poster and details.</p></div>
      <span class="btn btn--sm teaser__go">Open the calendar ${icon('arrow')}</span>
      <div class="teaser__mini" aria-hidden="true">${cells}</div>
    </a>
    <a class="teaser" href="#/gallery" data-reveal style="--i:1" data-spot data-cursor="Open">
      <div><span class="eyebrow">Gallery</span><h3>${nPhotos ? `${nPhotos} moments and counting` : 'Moments from Spark'}</h3><p>Photos from our evenings, sorted by event and session.</p></div>
      <span class="btn btn--sm teaser__go">Browse the photos ${icon('arrow')}</span>
      <div class="teaser__stack" aria-hidden="true">${photos.map((p, i) => `<img alt="" loading="lazy" data-thumb="${i}">`).join('')}</div>
    </a>
  </div></section>`;
}

function contactHTML() {
  const item = (href, ic, label, value, ext) => `<a class="contact__item" href="${href}" ${ext ? 'target="_blank" rel="noopener"' : ''} data-reveal data-spot><i>${icon(ic)}</i><span><small>${label}</small><b>${value}</b></span><span class="go">${icon('arrow-up-right')}</span></a>`;
  return `<section class="section" id="contact"><div class="container contact">
    <div>
      <span class="eyebrow" data-reveal>Contact us</span>
      <h2 class="h-section" data-split style="margin-top:14px">Come say hare krishna</h2>
      <p class="lead" data-reveal style="margin-top:16px">Questions, ideas, or just want to know what to expect on your first Saturday? Reach out. A real person replies.</p>
      <div class="contact__list">
        ${item('https://www.google.com/maps/search/?api=1&query=ISKCON+Temple+Coimbatore', 'pin', 'Location', 'ISKCON Temple, Coimbatore, Tamil Nadu, India', true)}
        ${item('tel:+919876543210', 'phone', 'Mobile', '+91 98765 43210')}
        ${item('mailto:spark@iskconcoimbatore.org', 'mail', 'Mail', 'spark@iskconcoimbatore.org')}
        ${item('https://www.instagram.com/sparkcbe/', 'instagram', 'Instagram', '@sparkcbe', true)}
      </div>
    </div>
    <div class="contact__media" data-reveal="right"><img src="assets/img/contact.webp" alt="Misty hills of the Western Ghats" loading="lazy"><div><b>Your first evening is on us.</b><span>Walk in any Saturday. Leave with friends.</span></div></div>
  </div></section>`;
}

function render() {
  const y = scrollY;
  root.innerHTML = heroHTML() + igniteHTML() + aboutHTML() + eventsHTML() + nextHTML() + teasersHTML() + contactHTML();
  // images that may live in the database
  const cats = store.getCategories();
  root.querySelectorAll('[data-cover]').forEach((img) => store.setImage(img, cats[+img.dataset.cover]?.cover));
  const s = store.getUpcoming()[0] || store.getSessions()[0];
  const poster = root.querySelector('[data-poster]'); if (poster && s) store.setImage(poster, s.poster, s.posterSm);
  const photos = store.getAlbums().flatMap((a) => store.getPhotos(a.id)).slice(0, 3);
  root.querySelectorAll('[data-thumb]').forEach((img) => store.setImage(img, photos[+img.dataset.thumb]?.thumb || photos[+img.dataset.thumb]?.src));
  root.querySelectorAll('[data-mini]').forEach((el) => { const ss = store.getSession(el.dataset.mini); if (ss?.posterSm && !ss.posterSm.startsWith('media:')) el.style.backgroundImage = `url("${ss.posterSm}")`; });
  scan(root);
  if (document.documentElement.classList.contains('is-entered')) { heroIntro(true); if (y) scrollTo(0, y); }
  tick();
}

function heroIntro(instant) {
  const letters = [...root.querySelectorAll('.hero__title .ch')];
  const fades = [...root.querySelectorAll('[data-hero-fade], .hero__greet, .hero__scroll')];
  if (instant || env.reduce) return;
  letters.forEach((ch, i) => ch.animate([{ transform: 'translateY(110%) rotate(8deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1100, delay: 120 + i * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
  fades.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 700 + i * 120, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
  // a wave of light runs through the title once
  letters.forEach((ch, i) => { timers.push(setTimeout(() => { ch.classList.add('hot'); setTimeout(() => ch.classList.remove('hot'), 420); }, 1300 + i * 70)); });
}

function tick() {
  const el = root?.querySelector('[data-count]'); if (!el) return;
  let diff = Math.max(0, +el.dataset.count - Date.now());
  const d = Math.floor(diff / 864e5); diff -= d * 864e5;
  const h = Math.floor(diff / 36e5); diff -= h * 36e5;
  const m = Math.floor(diff / 6e4); diff -= m * 6e4;
  const set = (k, v) => { const b = el.querySelector(`[data-${k}]`); const t = String(v).padStart(2, '0'); if (b.textContent !== t) { b.textContent = t; if (!env.reduce) b.animate([{ transform: 'translateY(-30%)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 350, easing: 'ease-out' }); } };
  set('d', d); set('h', h); set('m', m); set('s', Math.floor(diff / 1000));
}

export default {
  mount(el, params, ctx = {}) {
    root = el;
    render();
    if (!document.documentElement.classList.contains('is-entered')) on(window, 'spark:entered', () => heroIntro(false), { once: true });
    else if (ctx.entered) heroIntro(false);

    // re-render when the admin publishes something (skip identical data)
    let sig = JSON.stringify([store.getCategories(), store.getSessions().length, store.getUpcoming()[0]?.id]);
    unsub = store.subscribe(() => {
      const next = JSON.stringify([store.getCategories(), store.getSessions().length, store.getUpcoming()[0]?.id]);
      if (next !== sig) { sig = next; render(); }
    });
    on(window, 'spark:member', () => { const g = root.querySelector('[data-greet] span'); if (g) g.innerHTML = greeting(); });

    // hero: aura follows the cursor, letters heat up near it
    let rects = null;
    const measure = () => { rects = [...root.querySelectorAll('.hero__title .ch')].map((ch) => { const r = ch.getBoundingClientRect(); return { ch, x: r.left + r.width / 2, y: r.top + r.height / 2 + scrollY }; }); };
    on(window, 'resize', () => { rects = null; });
    on(window, 'pointermove', (e) => {
      const hero = root.querySelector('.hero'); if (!hero || scrollY > innerHeight) return;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--hx', `${e.clientX - r.left}px`); hero.style.setProperty('--hy', `${e.clientY - r.top}px`);
      if (!env.fine) return;
      if (!rects || !rects.length || !rects[0].ch.isConnected) measure();
      const py = e.clientY + scrollY;
      for (const c of rects) c.ch.classList.toggle('hot', Math.hypot(c.x - e.clientX, c.y - py) < 110);
    }, { passive: true });

    // marquee drifts, and speeds up with the scroll
    let mx = 0, last = performance.now(), vel = 0, lastY = scrollY, raf;
    const loop = (now) => {
      const track = root.querySelector('.marquee__track');
      if (track && !env.reduce) {
        const dt = Math.min(50, now - last); last = now;
        vel = vel * 0.92 + (scrollY - lastY) * 0.08; lastY = scrollY;
        mx -= (0.05 + Math.min(1.2, Math.abs(vel) * 0.03)) * dt;
        const w = track.scrollWidth / 3; if (w && -mx > w) mx += w;
        track.style.transform = `translate3d(${mx}px,0,0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); cleanups.push(() => cancelAnimationFrame(raf));

    // delegated clicks
    on(root, 'click', (e) => {
      const open = e.target.closest('[data-open]'); if (open) { openSession(open.dataset.open); return; }
      if (e.target.closest('[data-greet]')) { const r = e.target.closest('[data-greet]').getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 40, 8); return; }
      const strip = e.target.closest('.strip'); if (!strip) return;
      if (e.target.closest('a')) return;
      if (strip.classList.contains('is-open')) location.hash = `#/events/${encodeURIComponent(strip.dataset.cat)}`;
      else openStrip(strip);
    });
    const openStrip = (strip) => { root.querySelectorAll('.strip').forEach((s) => { s.classList.toggle('is-open', s === strip); s.querySelector('a').tabIndex = s === strip ? 0 : -1; }); };
    on(root, 'pointerover', (e) => { if (!env.fine) return; const s = e.target.closest('.strip'); if (s && !s.classList.contains('is-open')) openStrip(s); });
    on(root, 'focusin', (e) => { const s = e.target.closest('.strip'); if (s && !s.classList.contains('is-open')) openStrip(s); });
    on(root, 'keydown', (e) => { const s = e.target.closest?.('.strip'); if (s && e.target === s && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); location.hash = `#/events/${encodeURIComponent(s.dataset.cat)}`; } });

    timers.push(setInterval(tick, 1000));
    void scrollToEl;
  },
  unmount() {
    unsub?.(); unsub = null;
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    cleanups.forEach((fn) => fn()); cleanups = [];
    root = null;
  },
};
