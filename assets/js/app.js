// Shell: loading screen, router, navigation, theme, registration popup.
import { store } from './store.js';
import { icon, esc, toast, openModal } from './ui.js';
import { initFx, scan, burst, supernova, scrollToEl, scrollTop, isSoundOn, setSound, env } from './fx.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');

/* ------------------------------------------------------------ loading screen */
function runLoader() {
  const el = $('#loader');
  if (!el) return Promise.resolve();
  const letters = [...el.querySelectorAll('.loader__word span')];
  const bar = el.querySelector('.loader__bar i'), pct = el.querySelector('.loader__pct'), flash = el.querySelector('.loader__flash');
  const cv = $('#loaderFx'), c = cv.getContext('2d');
  let W, H; const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const size = () => { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);

  const seen = sessionStorage.getItem('spark.seen'); sessionStorage.setItem('spark.seen', '1');
  const DURATION = env.reduce ? 500 : seen ? 1300 : 3000;
  const cols = ['#FFFFFF', '#FFE3C2', '#FFA24C', '#FF6F00', '#FF3D00', '#FFB300'];
  const sparks = [];
  const add = () => {
    const ang = Math.random() * 6.283, rad = Math.max(W, H) * (0.45 + Math.random() * 0.35);
    sparks.push({ ang, rad, spin: (Math.random() * 0.016 + 0.008) * (Math.random() < 0.5 ? -1 : 1), pull: Math.random() * 0.012 + 0.009, s: Math.random() * 2 + 0.6, col: cols[(Math.random() * cols.length) | 0], px: null, py: null });
  };
  let progress = 0, done = false, exploding = 0;
  const t0 = performance.now();

  return new Promise((resolve) => {
    let dataReady = false; store.ready.then(() => { dataReady = true; });
    (function tick(now) {
      const t = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - t, 2.2);
      progress = Math.min(dataReady ? 1 : 0.92, eased);
      if (t >= 1 && !dataReady && now - t0 > DURATION + 1500) progress = 1; // never hang
      const n = Math.round(progress * 100);
      pct.textContent = String(n).padStart(3, '0'); bar.style.transform = `scaleX(${progress})`;
      letters.forEach((l, i) => l.classList.toggle('lit', progress >= (i + 1) / letters.length - 0.02));

      // vortex of sparks collapsing into one bright core
      c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(12,10,9,0.22)'; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';
      const cx = W / 2, cy = H / 2;
      if (!exploding && !env.reduce) for (let i = 0; i < 5; i++) if (sparks.length < 380) add();
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        if (exploding) { s.rad += (s.v = (s.v || 6 + Math.random() * 26) * 1.04); } else { s.rad *= 1 - s.pull * (1 + progress * 1.6); s.ang += s.spin * (1 + 260 / (s.rad + 40)); }
        const x = cx + Math.cos(s.ang) * s.rad, y = cy + Math.sin(s.ang) * s.rad * 0.72;
        if (s.px !== null) { c.strokeStyle = s.col; c.lineWidth = s.s; c.globalAlpha = exploding ? 0.9 : Math.min(1, 0.25 + 160 / (s.rad + 60)); c.beginPath(); c.moveTo(s.px, s.py); c.lineTo(x, y); c.stroke(); }
        s.px = x; s.py = y;
        if ((!exploding && s.rad < 6) || s.rad > Math.max(W, H)) sparks.splice(i, 1);
      }
      c.globalAlpha = 1;
      const core = 30 + progress * 150 + Math.sin(now / 90) * 6;
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, core);
      g.addColorStop(0, `rgba(255,236,200,${0.5 + progress * 0.4})`); g.addColorStop(0.25, 'rgba(255,120,0,0.42)'); g.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, core, 0, 6.283); c.fill();

      if (progress >= 1 && !done) {
        done = true; exploding = 1;
        flash.animate([{ opacity: 0, transform: 'scale(.1)' }, { opacity: 1, transform: 'scale(1.4)', offset: 0.45 }, { opacity: 0, transform: 'scale(3.2)' }], { duration: env.reduce ? 200 : 1000, easing: 'cubic-bezier(.22,1,.36,1)' });
        el.querySelector('.loader__core').animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 600, fill: 'forwards', easing: 'cubic-bezier(.6,0,.4,1)' });
        setTimeout(() => {
          document.body.classList.remove('is-locked'); el.classList.add('is-done');
          resolve();
          const out = el.animate([{ clipPath: 'circle(150% at 50% 50%)', opacity: 1 }, { clipPath: 'circle(0% at 50% 50%)', opacity: 1 }], { duration: env.reduce ? 200 : 1100, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
          out.onfinish = () => { el.remove(); removeEventListener('resize', size); };
        }, env.reduce ? 100 : 420);
      }
      if (el.isConnected) requestAnimationFrame(tick);
    })(t0);
  });
}

/* ------------------------------------------------------------ router */
const VIEWS = {
  home: () => import('./views/home.js'),
  events: () => import('./views/events.js'),
  calendar: () => import('./views/calendar.js'),
  gallery: () => import('./views/gallery.js'),
};
let current = { name: null, mod: null };
let pendingScroll = null;
let navToken = 0;

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
  const name = VIEWS[parts[0]] ? parts[0] : 'home';
  return { name, params: VIEWS[parts[0]] ? parts.slice(1) : [] };
}
function markNav(name) {
  document.querySelectorAll('.nav__links a').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === name && !a.dataset.scroll));
  document.title = { home: 'Spark Youth Club | The Spark In You', events: 'Events | Spark Youth Club', calendar: 'Program calendar | Spark Youth Club', gallery: 'Gallery | Spark Youth Club' }[name];
}
async function swap(name, params, entered) {
  let mod;
  try { mod = (await VIEWS[name]()).default; } catch (e) {
    console.error(e);
    mod = { mount(root) { root.innerHTML = `<section class="section container" style="padding-top:calc(var(--nav-h) + 80px)"><div class="empty"><p>This page could not be loaded. Check your connection and try again.</p><p style="margin-top:16px"><a class="btn btn--sm" href="#/">Back home</a></p></div></section>`; } };
  }
  try { current.mod?.unmount?.(); } catch (e) { console.error(e); }
  app.innerHTML = '';
  app.dataset.view = name;
  current = { name, mod };
  mod.mount(app, params, { entered });
  markNav(name);
  scan(app);
}
async function route(first = false) {
  const token = ++navToken;
  const { name, params } = parseHash();
  closeMenu();
  const sameView = current.name === name;
  if (first) { await swap(name, params, false); return; }
  if (sameView && (name === 'calendar' || name === 'gallery' || name === 'home')) {
    if (name !== 'home') await swap(name, params, true);
    if (pendingScroll) { const t = pendingScroll; pendingScroll = null; scrollToEl('#' + t); }
    return;
  }
  const veil = $('.veil');
  const dur = env.reduce ? 1 : 520;
  veil.style.transformOrigin = '50% 100%';
  await veil.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: dur, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' }).finished;
  if (token !== navToken) return;
  await swap(name, params, true);
  scrollTop();
  if (pendingScroll) { const t = pendingScroll; pendingScroll = null; requestAnimationFrame(() => scrollToEl('#' + t)); }
  veil.style.transformOrigin = '50% 0%';
  veil.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: dur + 120, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
}

/* ------------------------------------------------------------ nav, theme, sound */
function closeMenu() { const n = $('#nav'); n.classList.remove('is-open'); $('#burger').setAttribute('aria-expanded', 'false'); if (!document.querySelector('.modal.is-open') && !$('#loader')) document.body.classList.remove('is-locked'); }
function initChrome() {
  $('#year').textContent = new Date().getFullYear();
  $('#adminLink').insertAdjacentHTML('afterbegin', icon('lock'));
  const burger = $('#burger'); burger.innerHTML = icon('menu');
  burger.addEventListener('click', () => {
    const open = $('#nav').classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open); burger.innerHTML = icon(open ? 'x' : 'menu');
    document.body.classList.toggle('is-locked', open);
  });

  const themeBtn = $('#themeBtn');
  const paintTheme = () => { themeBtn.innerHTML = icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun'); };
  paintTheme();
  themeBtn.addEventListener('click', (e) => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    const apply = () => { if (next === 'light') document.documentElement.dataset.theme = 'light'; else delete document.documentElement.dataset.theme; localStorage.setItem('spark.theme', next); paintTheme(); $('meta[name=theme-color]').content = next === 'light' ? '#FBF5EC' : '#0c0a09'; };
    if (document.startViewTransition && !env.reduce) {
      // the new theme spreads out from the button like light from a spark
      const x = e.clientX, y = e.clientY, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.startViewTransition(apply).ready.then(() => {
        document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 700, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' });
      });
    } else apply();
  });

  const soundBtn = $('#soundBtn');
  const paintSound = () => { soundBtn.innerHTML = icon(isSoundOn() ? 'volume' : 'mute'); soundBtn.setAttribute('aria-pressed', isSoundOn()); };
  paintSound();
  soundBtn.addEventListener('click', () => { setSound(!isSoundOn()); paintSound(); toast(isSoundOn() ? 'Spark sounds on. Click anywhere.' : 'Spark sounds off.', isSoundOn() ? 'volume' : 'mute'); });

  // in-page section links (About / Events / Contact)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scroll]'); if (!a) return;
    e.preventDefault();
    const id = a.dataset.scroll;
    closeMenu();
    if (current.name === 'home') scrollToEl('#' + id);
    else { pendingScroll = id; location.hash = '#/'; }
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-register]')) openRegister(); });
  addEventListener('spark:register', openRegister);
  addEventListener('hashchange', () => route());
}

/* ------------------------------------------------------------ registration */
export function memberName() { try { return localStorage.getItem('spark.member') || ''; } catch { return ''; } }
function openRegister() {
  if (document.querySelector('.modal .reg')) return;
  const known = memberName();
  const m = openModal(`<div class="reg">
      <span class="eyebrow">Join the club</span>
      <h2>${known ? `Good to see you again, ${esc(known.split(' ')[0])}` : 'Ignite your spark'}</h2>
      <p class="muted">${known ? 'You are already on our list. Bringing a friend? Add them here.' : 'Tell us who you are and we will keep a seat warm for you this Saturday. It is free.'}</p>
      <form novalidate>
        <label class="field"><span>Name</span><input name="name" required autocomplete="name" placeholder="Your full name" maxlength="80"></label>
        <div class="field"><span id="occLabel">I am</span>
          <div class="seg" data-value="Student" role="group" aria-labelledby="occLabel"><i class="seg__pill"></i>
            <button type="button" data-occ="Student" aria-pressed="true">Student</button>
            <button type="button" data-occ="Working" aria-pressed="false">Working</button>
          </div></div>
        <label class="field"><span data-place-label>School / college name</span><input name="place" required placeholder="Name of your school or college" maxlength="120" autocomplete="organization"></label>
        <label class="field"><span>Mobile number</span><input name="mobile" required type="tel" inputmode="tel" autocomplete="tel" placeholder="10 digit mobile number" maxlength="16"></label>
        <p class="field"><span class="error" role="alert" hidden></span></p>
        <button class="btn btn--lg" type="submit">Complete registration ${icon('arrow')}</button>
        <p class="muted" style="font-size:12.500px;text-align:center">We only use this to tell you about Spark programs.</p>
      </form></div>`, { small: true, label: 'Register for Spark Youth Club' });
  const form = m.panel.querySelector('form'), seg = m.panel.querySelector('.seg'), err = m.panel.querySelector('.error');
  let occ = 'Student';
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-occ]'); if (!b) return;
    occ = b.dataset.occ; seg.dataset.value = occ;
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    m.panel.querySelector('[data-place-label]').textContent = occ === 'Student' ? 'School / college name' : 'Company name';
    form.place.placeholder = occ === 'Student' ? 'Name of your school or college' : 'Name of your company';
  });
  setTimeout(() => form.name.focus(), 350);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim(), place = form.place.value.trim(), mobile = form.mobile.value.replace(/[\s-]/g, '');
    const fail = (msg, field) => { err.textContent = msg; err.hidden = false; field?.focus(); };
    if (name.length < 2) return fail('Please tell us your name.', form.name);
    if (place.length < 2) return fail(occ === 'Student' ? 'Please tell us where you study.' : 'Please tell us where you work.', form.place);
    if (!/^(\+?91)?[6-9]\d{9}$/.test(mobile)) return fail('That mobile number does not look right. Use a 10 digit Indian number.', form.mobile);
    err.hidden = true;
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Registering…';
    try {
      await store.addRegistration({ name, occupation: occ, place, mobile });
      try { localStorage.setItem('spark.member', name); } catch { /* private mode */ }
      supernova();
      m.panel.querySelector('.reg').innerHTML = `<div class="reg__done"><div class="burst">${icon('check')}</div>
        <h2>You are in, ${esc(name.split(' ')[0])}</h2>
        <p class="muted" style="margin:10px auto 24px;max-width:34ch">Your spark is lit. We will see you at ISKCON Coimbatore. Bring a friend, dinner is on us.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn" href="#/calendar" data-close>See what is coming ${icon('arrow')}</a><a class="btn btn--ghost" href="https://www.instagram.com/sparkcbe/" target="_blank" rel="noopener">${icon('instagram')} Follow us</a></div></div>`;
      dispatchEvent(new CustomEvent('spark:member'));
    } catch (ex) {
      console.error(ex);
      btn.disabled = false; btn.innerHTML = `Complete registration ${icon('arrow')}`;
      fail('We could not save that just now. Check your connection and try again, or message us on Instagram.');
    }
  });
}

/* ------------------------------------------------------------ the site notices you */
function initPresence() {
  // a gentle nudge the first time someone goes quiet for a while
  let idle, nudged = sessionStorage.getItem('spark.nudged');
  const lines = ['Still there? Move your cursor, the sparks follow you.', 'Psst. Saturday evening is better with friends.', 'Tip: click anywhere to make sparks.'];
  const arm = () => { clearTimeout(idle); if (nudged) return; idle = setTimeout(() => { if (document.hidden || document.querySelector('.modal.is-open')) return; nudged = '1'; sessionStorage.setItem('spark.nudged', '1'); toast(lines[(Math.random() * lines.length) | 0], 'zap', 5200); burst(innerWidth - 80, innerHeight - 80, 18); }, 16000); };
  ['pointermove', 'keydown', 'scroll', 'touchstart'].forEach((ev) => addEventListener(ev, arm, { passive: true }));
  arm();
  // tab title changes when you look away
  const base = () => document.title;
  let saved = '';
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saved = base(); document.title = 'Your spark is waiting…'; } else if (saved) { document.title = saved; saved = ''; } });
}

/* ------------------------------------------------------------ boot */
initChrome();
initFx();
const loaded = runLoader();
route(true).then(() => loaded).then(() => {
  dispatchEvent(new CustomEvent('spark:entered'));
  document.documentElement.classList.add('is-entered');
  initPresence();
});
