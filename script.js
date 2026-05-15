/* =========================================
   ROLESHIFT — HOMEPAGE SCRIPT
   ========================================= */

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
  if (window.innerWidth <= 800) return; // visuelle Panels auf Mobile versteckt
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

// --- FAQ ACCORDION (single mode) ---------
const faqItems = document.querySelectorAll('.faq-item');
document.querySelectorAll('.faq-trigger').forEach(trigger => {
  trigger.addEventListener('click', () => {
    const item = trigger.closest('.faq-item');
    if (!item) return;
    const isOpen = item.dataset.state === 'open';
    // Close all
    faqItems.forEach(i => {
      i.dataset.state = 'closed';
      i.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
    });
    // Open this one if it was closed
    if (!isOpen) {
      item.dataset.state = 'open';
      trigger.setAttribute('aria-expanded', 'true');
    }
  });
});


