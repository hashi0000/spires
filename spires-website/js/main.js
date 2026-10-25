document.addEventListener('DOMContentLoaded', () => {
  initNavActive();
  initMobileMenu();
  initHeaderScroll();
  initFadeIn();
  initSmoothScroll();
  initMobileBookBar();
  initBookingTerms();
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

function initMobileBookBar() {
  if (document.querySelector('.mobile-book-bar')) return;
  const path = window.location.pathname;
  if (path.indexOf('office-jobs') !== -1) return;
  const bar = document.createElement('nav');
  bar.className = 'mobile-book-bar no-print';
  bar.setAttribute('aria-label', 'Book a journey');
  bar.innerHTML =
    '<a class="btn btn--primary" href="https://customer.spires-taxis.com" target="_blank" rel="noopener noreferrer">Book online</a>' +
    '<a class="btn btn--whatsapp" href="https://wa.me/447776897772?text=Hi%20Spires%20Taxis%2C%20I%27d%20like%20a%20quote%20please" target="_blank" rel="noopener noreferrer">WhatsApp</a>';
  document.body.appendChild(bar);
}

function initBookingTerms() {
  document.querySelectorAll("form.booking-form").forEach(function (form) {
    if (!form.querySelector("[name='termsAccepted']")) {
      var wrap = document.createElement("div");
      wrap.className = "terms-agreement";
      wrap.innerHTML =
        '<label class="terms-agreement__line">' +
        '<input type="checkbox" name="termsAccepted" value="yes" required aria-describedby="terms-agreement-error">' +
        '<span>I agree to the <a href="/terms/2026-10-25" target="_blank" rel="noopener noreferrer">Terms and Conditions</a>.</span>' +
        "</label>" +
        '<p class="terms-agreement__error" role="alert" hidden>Please agree to the Terms and Conditions before submitting.</p>';
      var button = form.querySelector("[type='submit']");
      if (button && button.parentNode) button.parentNode.insertBefore(wrap, button);
      else form.appendChild(wrap);
    }
    form.addEventListener("submit", function (event) {
      var box = form.querySelector("[name='termsAccepted']");
      var error = form.querySelector(".terms-agreement__error");
      if (!box || box.checked) {
        if (error) error.hidden = true;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (error) error.hidden = false;
      box.focus();
    }, true);
    var box = form.querySelector("[name='termsAccepted']");
    if (box) {
      box.addEventListener("invalid", function (event) {
        event.preventDefault();
        var error = form.querySelector(".terms-agreement__error");
        if (error) error.hidden = false;
      });
    }
  });
}

window.SpiresTaxis = { showNotification: () => {} };
