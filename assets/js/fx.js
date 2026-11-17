// Interaction engine: ember canvas, custom cursor, tilt / magnetic / spotlight,
// scroll reveals, parallax, smooth scrolling and the little spark sounds.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------ ember canvas */
const COLORS = ['#FFFFFF', '#FFE3C2', '#FFA24C', '#FF6F00', '#FF3D00', '#FFB300'];
let cv, ctx, W = 0, H = 0, dpr = 1;
const parts = [];
const mouse = { x: -999, y: -999, vx: 0, vy: 0, on: false };
let ambientMax = 50;
const MAX = 260;
let running = false, lastTrail = 0;

function resize() {
  W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
  cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ambientMax = reduce ? 14 : clamp(Math.floor((W * H) / 26000), 26, 70);
}
function spawn(x, y, kind = 'ambient') {
  if (parts.length >= MAX) return null;
  const p = {
    x, y, kind,
    vx: (Math.random() - 0.5) * (kind === 'trail' ? 1.6 : kind === 'ambient' ? 0.5 : 3.5),
    vy: kind === 'ambient' ? -Math.random() * 0.9 - 0.15 : kind === 'trail' ? -Math.random() * 1.2 : -Math.random() * 4 - 1,
    size: kind === 'trail' ? Math.random() * 2.2 + 0.8 : Math.random() * 2.1 + 0.7,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    alpha: kind === 'trail' ? 0.9 : Math.random() * 0.6 + 0.3,
    decay: kind === 'trail' ? 0.028 : kind === 'ambient' ? Math.random() * 0.0028 + 0.001 : 0.016,
    a: Math.random() * 6.28, as: (Math.random() - 0.5) * 0.03, g: kind === 'burst' ? 0.06 : 0,
  };
  parts.push(p); return p;
}
export function burst(x = W / 2, y = H / 2, n = 26, power = 6) {
  if (!cv) return;
  for (let i = 0; i < (reduce ? Math.min(n, 8) : n); i++) {
    const p = spawn(x, y, 'burst'); if (!p) break;
    const ang = Math.random() * 6.283, sp = Math.random() * power + 1.5;
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
    p.decay = Math.random() * 0.02 + 0.012; p.size = Math.random() * 3.2 + 1.2;
  }
  tone();
}
export function supernova() {
  burst(W / 2, H / 2, 110, 13);
  setTimeout(() => burst(W * 0.25, H * 0.4, 40, 8), 140);
  setTimeout(() => burst(W * 0.75, H * 0.45, 40, 8), 260);
  tone(true);
}
function frame() {
  if (!running) return;
  ctx.clearRect(0, 0, W, H);
  let amb = 0;
  for (const p of parts) if (p.kind === 'ambient') amb++;
  while (amb < ambientMax && parts.length < MAX) { spawn(Math.random() * W, H + 10, 'ambient'); amb++; }

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.a += p.as; p.vy += p.g;
    p.x += p.vx + Math.sin(p.a) * 0.3; p.y += p.vy;
    if (p.kind === 'burst') { p.vx *= 0.975; p.vy *= 0.975; }
    if (mouse.on) {
      const dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.hypot(dx, dy);
      if (d > 1 && d < 170) {
        const f = (170 - d) / 170;
        // swirl around the cursor and get dragged along with its motion
        p.x += (-dy / d) * f * 1.6 + mouse.vx * f * 0.12;
        p.y += (dx / d) * f * 1.6 + mouse.vy * f * 0.12;
        if (p.kind === 'ambient') p.alpha = Math.min(1, p.alpha + f * 0.02);
      }
    }
    p.alpha -= p.decay;
    if (p.alpha <= 0 || p.y < -30 || p.x < -30 || p.x > W + 30 || p.y > H + 60) parts.splice(i, 1);
  }
  mouse.vx *= 0.9; mouse.vy *= 0.9;

  // constellation links
  ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(255,111,0,0.14)'; ctx.beginPath();
  const n = parts.length;
  for (let i = 0; i < n; i++) {
    const a = parts[i]; if (a.alpha < 0.2) continue;
    for (let j = i + 1; j < n; j++) {
      const b = parts[j]; if (b.alpha < 0.2) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy < 3400) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    }
  }
  ctx.stroke();
  // lines from cursor to nearby embers
  if (mouse.on) {
    ctx.strokeStyle = 'rgba(255,160,64,0.22)'; ctx.beginPath();
    for (const p of parts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      if (dx * dx + dy * dy < 14000) { ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(p.x, p.y); }
    }
    ctx.stroke();
  }
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.alpha, 0, 1); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}
function initCanvas() {
  cv = document.getElementById('fx'); if (!cv) return;
  ctx = cv.getContext('2d'); resize();
  addEventListener('resize', resize);
  for (let i = 0; i < ambientMax; i++) spawn(Math.random() * W, Math.random() * H, 'ambient');
  addEventListener('pointermove', (e) => {
    if (mouse.on) { mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y; }
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
    const now = performance.now();
    if (!reduce && now - lastTrail > 34) { spawn(mouse.x, mouse.y, 'trail'); lastTrail = now; }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.on = false; });
  addEventListener('pointerdown', (e) => {
    if (e.target.closest('input,textarea,select,.modal__panel,[data-noburst]')) return;
    burst(e.clientX, e.clientY, e.target.closest('a,button') ? 14 : 24);
  }, { passive: true });
  const go = () => { const r = !document.hidden; if (r && !running) { running = true; requestAnimationFrame(frame); } else if (!r) running = false; };
  document.addEventListener('visibilitychange', go); go();
}

/* ------------------------------------------------------------ sound */
let actx = null;
let sound = localStorage.getItem('spark.sound') === 'on';
export const isSoundOn = () => sound;
export function setSound(on) { sound = on; localStorage.setItem('spark.sound', on ? 'on' : 'off'); if (on) tone(true); }
export function tone(big = false) {
  if (!sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime, len = big ? 0.5 : 0.13;
    const f = big ? 520 : 780 + Math.random() * 420;
    o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + len);
    g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(t + len);
  } catch { /* audio is optional */ }
}

/* ------------------------------------------------------------ cursor */
function initCursor() {
  const el = document.querySelector('.cursor'); if (!el || !fine) return;
  const dot = el.querySelector('.cursor__dot'), ring = el.querySelector('.cursor__ring'), label = ring.querySelector('span');
  let x = 0, y = 0, rx = 0, ry = 0, seen = false;
  addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    if (!seen) { seen = true; rx = x; ry = y; el.classList.add('is-on'); }
    const t = e.target.closest?.('[data-cursor],a,button,[role="button"],input,label,select,textarea');
    const lab = t?.closest('[data-cursor]')?.dataset.cursor;
    el.classList.toggle('is-label', !!lab);
    el.classList.toggle('is-link', !!t && !lab);
    if (lab) label.textContent = lab;
  }, { passive: true });
  document.addEventListener('pointerleave', () => el.classList.remove('is-on'));
  document.addEventListener('pointerenter', () => seen && el.classList.add('is-on'));
  (function loop() {
    rx = lerp(rx, x, 0.17); ry = lerp(ry, y, 0.17);
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
    requestAnimationFrame(loop);
  })();
}

/* ------------------------------------------------------------ tilt / magnetic / spotlight (delegated) */
function initPointerFx() {
  if (!fine) return;
  let tiltEl = null, magEl = null;
  addEventListener('pointermove', (e) => {
    const t = e.target.closest ? e.target : null; if (!t) return;
    const spot = t.closest('[data-spot]');
    if (spot) { const r = spot.getBoundingClientRect(); spot.style.setProperty('--mx', `${e.clientX - r.left}px`); spot.style.setProperty('--my', `${e.clientY - r.top}px`); }
    const tilt = reduce ? null : t.closest('[data-tilt]');
    if (tiltEl && tiltEl !== tilt) { tiltEl.style.transform = ''; tiltEl = null; }
    if (tilt) {
      const r = tilt.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      const max = +tilt.dataset.tilt || 9;
      tilt.style.transform = `perspective(900px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(12px)`;
      tilt.style.setProperty('--mx', `${px * 100}%`); tilt.style.setProperty('--my', `${py * 100}%`);
      tiltEl = tilt;
    }
    const mag = reduce ? null : t.closest('[data-magnetic]');
    if (magEl && magEl !== mag) { magEl.style.transform = ''; magEl = null; }
    if (mag) {
      const r = mag.getBoundingClientRect();
      mag.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.28}px, ${(e.clientY - r.top - r.height / 2) * 0.38}px)`;
      magEl = mag;
    }
  }, { passive: true });
  // footer wordmark glow follows the cursor
  addEventListener('pointermove', (e) => {
    const big = document.querySelector('.footer__big'); if (!big) return;
    const r = big.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) { big.style.setProperty('--mx', `${e.clientX - r.left}px`); big.style.setProperty('--my', `${e.clientY - r.top}px`); }
  }, { passive: true });
}

/* ------------------------------------------------------------ reveals, split text, parallax, reading light */
let io;
function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  el.setAttribute('aria-label', el.textContent.trim());
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok.trim()) { frag.append(tok); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          if (el.dataset.split === 'read') w.textContent = tok;
          else { const inner = document.createElement('i'); inner.textContent = tok; inner.style.setProperty('--i', i++); w.append(inner); }
          frag.append(w);
        });
        c.replaceWith(frag);
      } else if (c.nodeType === 1) walk(c);
    });
  };
  walk(el);
  el.classList.add('split');
}
/** Wire up newly added DOM: [data-reveal], [data-split], [data-parallax]. Safe to call repeatedly. */
export function scan(root = document) {
  root.querySelectorAll('[data-split]').forEach(splitWords);
  root.querySelectorAll('[data-reveal]:not(.in), .split:not(.in):not([data-split="read"])').forEach((el) => {
    if (reduce || !io) el.classList.add('in'); else io.observe(el);
  });
  window.__lenis?.resize();
  measure();
}
let parallaxEls = [], readEls = [];
function measure() {
  parallaxEls = [...document.querySelectorAll('[data-parallax]')];
  readEls = [...document.querySelectorAll('[data-split="read"]')];
  onScroll();
}
let lastY = 0, ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    const bar = document.querySelector('.progress'); if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    const nav = document.querySelector('.nav');
    if (nav) {
      nav.classList.toggle('is-scrolled', y > 30);
      if (!nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > lastY && y > 500);
    }
    lastY = y;
    if (!reduce) for (const el of parallaxEls) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) continue;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.style.transform = `translate3d(0, ${(-p * (+el.dataset.parallax || 8)).toFixed(2)}%, 0)`;
    }
    for (const el of readEls) {
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue;
      const p = clamp((innerHeight * 0.88 - r.top) / (innerHeight * 0.5 + r.height), 0, 1);
      const ws = el.querySelectorAll('.w'), k = Math.round(p * ws.length);
      ws.forEach((w, i) => w.classList.toggle('on', i < k));
    }
  });
}

/* ------------------------------------------------------------ smooth scroll */
export function scrollToEl(target, offset = -70, settled = false) {
  const el = typeof target === 'string' ? document.querySelector(target) : target; if (!el) return;
  if (window.__lenis) { window.__lenis.resize(); window.__lenis.scrollTo(el, { offset, duration: 1.3 }); }
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: reduce ? 'auto' : 'smooth' });
  // images above the target may still be loading and push it down: correct once things settle
  // (skipped if the visitor has already scrolled somewhere else)
  const aim = el.getBoundingClientRect().top + scrollY + offset;
  if (!settled) setTimeout(() => { if (el.isConnected && Math.abs(scrollY - aim) < 250 && Math.abs(el.getBoundingClientRect().top + offset) > 60) scrollToEl(el, offset, true); }, 1500);
}
export function scrollTop() { if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true }); window.scrollTo(0, 0); }
function initLenis() {
  if (reduce || !window.Lenis || !fine) return;
  try {
    const lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    window.__lenis = lenis;
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  } catch { /* native scrolling is fine */ }
}

export function initFx() {
  initCanvas(); initCursor(); initPointerFx(); initLenis();
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  addEventListener('spark:scan', () => scan(document));
  scan(document);
}
export const env = { reduce, fine };
