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

// --- HERO INTERACTIVE PARTICLES ----------
(function () {
  const canvas = document.getElementById('heroParticleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const COUNT         = 55;
  const REPEL_RADIUS  = 140;
  const REPEL_FORCE   = 5.5;
  let time = 0;
  const mouse = { x: -9999, y: -9999 };
  const particles = [];

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    canvas.width  = canvas.offsetWidth  || window.innerWidth;
    canvas.height = canvas.offsetHeight || window.innerHeight;
  }

  function spawn() {
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x:     Math.random() * (canvas.width  || window.innerWidth),
        y:     Math.random() * (canvas.height || window.innerHeight),
        vx:    (Math.random() - 0.5) * 0.22,
        vy:    (Math.random() - 0.5) * 0.22,
        r:     Math.random() * 2.2 + 1.0,
        alpha: Math.random() * 0.22 + 0.07,
        phase: Math.random() * Math.PI * 2,
        freq:  Math.random() * 0.5 + 0.2,
      });
    }
  }

  function stepParticle(p) {
    if (!prefersReduced) {
      p.x += p.vx + Math.sin(time * 0.001 * p.freq + p.phase) * 0.16;
      p.y += p.vy + Math.cos(time * 0.0009 * p.freq + p.phase) * 0.13;
    }

    // Repulsion from mouse
    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d < REPEL_RADIUS && d > 0.1) {
      const strength = (1 - d / REPEL_RADIUS) * REPEL_FORCE;
      p.x += (dx / d) * strength;
      p.y += (dy / d) * strength;
    }

    // Wrap edges
    const w = canvas.width, h = canvas.height;
    if (p.x < -10) p.x = w + 10;
    else if (p.x > w + 10) p.x = -10;
    if (p.y < -10) p.y = h + 10;
    else if (p.y > h + 10) p.y = -10;
  }

  function drawParticle(p) {
    const glow = p.r * 7;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
    g.addColorStop(0,   `rgba(252,86,60,${p.alpha})`);
    g.addColorStop(0.4, `rgba(252,86,60,${p.alpha * 0.4})`);
    g.addColorStop(1,   `rgba(252,86,60,0)`);
    ctx.beginPath();
    ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function animate() {
    time++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { stepParticle(p); drawParticle(p); });
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

  resize();
  spawn();
  requestAnimationFrame(animate);
}());

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

