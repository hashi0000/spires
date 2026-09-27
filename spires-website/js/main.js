document.addEventListener('DOMContentLoaded', () => {
  initNavActive();
  initMobileMenu();
  initHeaderScroll();
  initFadeIn();
  initSmoothScroll();
});

function initNavActive() {
  const page = document.body.dataset.page;
  if (!page) return;
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((el) => el.classList.add('is-active'));
}

function initMobileMenu() {
  const toggle = document.querySelector('.site-menu-toggle');
  const close = document.querySelector('.site-menu__close');
  const menu = document.querySelector('.site-menu');
  const overlay = document.querySelector('.site-menu-overlay');
  if (!toggle || !menu || !overlay) return;

  const open = () => {
    menu.classList.add('is-open');
    overlay.classList.add('is-open');
    overlay.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-menu-open');
    document.body.style.overflow = 'hidden';
  };

  const shut = () => {
    menu.classList.remove('is-open');
    overlay.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-menu-open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 280);
  };

  toggle.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) shut();
    else open();
  });
  close?.addEventListener('click', shut);
  overlay.addEventListener('click', shut);
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', shut));
  window.addEventListener('resize', () => { if (window.innerWidth > 900) shut(); });
}

function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function initFadeIn() {
  const els = document.querySelectorAll('.fade-in');
  if (!els.length) return;

  const show = (el) => el.classList.add('is-visible');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(show);
    return;
  }

  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.92 && r.bottom > 0;
  };

  els.forEach((el) => {
    if (el.closest('.hero') || el.classList.contains('trust-strip') || inView(el)) {
      show(el);
    }
  });

  if (!('IntersectionObserver' in window)) {
    els.forEach(show);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          show(e.target);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px 0px 0px' }
  );

  els.forEach((el) => {
    if (!el.classList.contains('is-visible')) io.observe(el);
  });
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const header = document.querySelector('.site-header, header');
      const offset = header ? header.offsetHeight + 12 : 0;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

// Legacy mobile menu (old header on unmigrated pages)
document.addEventListener('DOMContentLoaded', () => {
  const legacyToggle = document.querySelector('.mobile-menu-toggle');
  const legacyOverlay = document.querySelector('.mobile-nav-overlay');
  const legacyPanel = document.querySelector('.mobile-nav-panel');
  if (!legacyToggle || !legacyOverlay || !legacyPanel || document.querySelector('.site-header')) return;

  const close = () => {
    legacyOverlay.classList.remove('active');
    legacyPanel.classList.remove('active');
    legacyToggle.classList.remove('active');
    document.body.style.overflow = '';
  };
  const open = () => {
    legacyOverlay.classList.add('active');
    legacyPanel.classList.add('active');
    legacyToggle.classList.add('active');
    document.body.style.overflow = 'hidden';
  };
  legacyToggle.addEventListener('click', (e) => {
    e.preventDefault();
    legacyPanel.classList.contains('active') ? close() : open();
  });
  legacyOverlay.addEventListener('click', close);
  legacyPanel.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
});

window.SpiresTaxis = { showNotification: () => {} };
