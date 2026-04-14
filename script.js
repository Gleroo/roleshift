/* =========================================
   ROLESHIFT — HOMEPAGE SCRIPT
   ========================================= */

// --- THEME -------------------------------
const html = document.documentElement;
const stored = localStorage.getItem('rs-theme');
if (stored === 'dark' || stored === 'light') html.setAttribute('data-theme', stored);
document.getElementById('themeToggle')?.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('rs-theme', next);
});

// --- MOBILE MENU -------------------------
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
menuToggle?.addEventListener('click', () => mobileMenu?.classList.toggle('open'));
mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));

// --- STICKY HEADER -----------------------
const header = document.getElementById('header');
window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 8), { passive: true });

// --- SMOOTH ANCHORS ----------------------
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const hh = 64;
    window.scrollTo({ top: target.getBoundingClientRect().top + scrollY - hh - 20, behavior: 'smooth' });
  });
});

// --- SCROLL REVEAL -----------------------
const revealObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target); } });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// --- HERO BAR ANIMATION ------------------
const heroBars = document.querySelectorAll('.hv-fill[data-w]');
const heroObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    heroBars.forEach(b => {
      const w = b.dataset.w;
      b.style.width = '0';
      requestAnimationFrame(() => setTimeout(() => { b.style.width = w + '%'; }, 280));
    });
    heroObs.disconnect();
  });
}, { threshold: 0.3 });
const heroEl = document.querySelector('.hero');
if (heroEl) heroObs.observe(heroEl);

// --- PREVIEW RESULT BAR ANIMATION --------
const previewBars = document.querySelectorAll('.animate-preview[data-w]');
const previewObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    previewBars.forEach(b => {
      b.style.width = '0';
      requestAnimationFrame(() => setTimeout(() => { b.style.width = b.dataset.w + '%'; }, 150));
    });
    previewObs.disconnect();
  });
}, { threshold: 0.2 });
const previewEl = document.querySelector('.section-preview');
if (previewEl) previewObs.observe(previewEl);

// --- READINESS BAR IN PREVIEW ------------
const readinessPreview = document.querySelector('.preview-readiness .readiness-fill[data-w]');
if (readinessPreview && previewEl) {
  const rObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      setTimeout(() => { readinessPreview.style.width = readinessPreview.dataset.w + '%'; }, 400);
      rObs.disconnect();
    });
  }, { threshold: 0.2 });
  rObs.observe(previewEl);
}

// --- HERO INFINITE GRID ------------------
(function () {
  const hero     = document.getElementById('hero');
  const base     = document.getElementById('heroGridBase');
  const reveal   = document.getElementById('heroGridReveal');
  const pBase    = document.getElementById('heroGridPatternBase');
  const pReveal  = document.getElementById('heroGridPatternReveal');
  if (!hero || !base || !reveal) return;

  const CELL = 40;
  let offsetX = 0, offsetY = 0;
  let mouseX = -9999, mouseY = -9999;
  let rafId = null;

  // Animate scrolling offset
  function tick() {
    offsetX = (offsetX + 0.4) % CELL;
    offsetY = (offsetY + 0.4) % CELL;
    pBase.setAttribute('x', offsetX);
    pBase.setAttribute('y', offsetY);
    pReveal.setAttribute('x', offsetX);
    pReveal.setAttribute('y', offsetY);
    rafId = requestAnimationFrame(tick);
  }

  // Mouse-following reveal mask
  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    const mask = `radial-gradient(280px circle at ${mouseX}px ${mouseY}px, black, transparent)`;
    reveal.style.webkitMaskImage = mask;
    reveal.style.maskImage = mask;
  }, { passive: true });

  hero.addEventListener('mouseleave', () => {
    reveal.style.webkitMaskImage = 'radial-gradient(0px circle at -999px -999px, black, transparent)';
    reveal.style.maskImage        = 'radial-gradient(0px circle at -999px -999px, black, transparent)';
  }, { passive: true });

  // Only run animation when hero is visible
  const gridObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { if (!rafId) rafId = requestAnimationFrame(tick); }
      else { cancelAnimationFrame(rafId); rafId = null; }
    });
  }, { threshold: 0 });
  gridObs.observe(hero);
})();

// --- HOW IT WORKS: auto-rotate + hover pause --
const howSteps  = document.querySelectorAll('.how-step[data-step]');
const howPanels = document.querySelectorAll('.how-vis-panel[data-vis]');
const howWrap   = document.querySelector('.how-sticky-wrap');

let howCurrent  = 1;
let howPaused   = false;
let howTimer    = null;
const HOW_INTERVAL = 3200;

function setHowStep(n) {
  howCurrent = n;
  howSteps.forEach(s => s.classList.toggle('how-step--active', +s.dataset.step === n));
  howPanels.forEach(p => p.classList.toggle('how-vis-hidden', +p.dataset.vis !== n));
}

function howNext() {
  if (howPaused) return;
  const max = howSteps.length;
  setHowStep(howCurrent >= max ? 1 : howCurrent + 1);
}

function startHowTimer() {
  clearInterval(howTimer);
  howTimer = setInterval(howNext, HOW_INTERVAL);
}

// Initialize
setHowStep(1);
startHowTimer();

// Pause on hover, resume on leave
howSteps.forEach(step => {
  step.addEventListener('mouseenter', () => {
    howPaused = true;
    setHowStep(+step.dataset.step);
  });
});

howWrap?.addEventListener('mouseleave', () => {
  howPaused = false;
  startHowTimer();
});

