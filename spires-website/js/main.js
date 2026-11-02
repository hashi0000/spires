document.addEventListener('DOMContentLoaded', () => {
  initNavActive();
  initDesktopNav();
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
  const groups = {
    services: ['oxford', 'rates', 'business', 'share', 'vehicles', 'student', 'corporate', 'long-distance', 'local'],
    airport: ['airport', 'heathrow', 'heathrow-in', 'pickup', 'gatwick', 'stansted', 'luton', 'birmingham', 'london-city', 'bristol'],
    events: ['events', 'twickenham', 'silverstone'],
    about: ['about', 'reviews', 'contact']
  };
  document.querySelectorAll('[data-nav-group]').forEach((el) => {
    const names = groups[el.getAttribute('data-nav-group')] || [];
    if (names.indexOf(page) !== -1) el.classList.add('is-active');
  });
}

function initDesktopNav() {
  const items = Array.prototype.slice.call(document.querySelectorAll('.site-nav__details'));
  if (!items.length) return;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = () => fine.matches && window.innerWidth >= 1280;

  const finishClose = (item) => {
    window.clearTimeout(item._navTimer);
    const panel = item.querySelector('.site-nav__panel');
    if (panel) panel.classList.remove('is-leaving');
    item.open = false;
  };

  const openItem = (item) => {
    window.clearTimeout(item._navTimer);
    items.forEach((other) => { if (other !== item) finishClose(other); });
    const panel = item.querySelector('.site-nav__panel');
    if (panel) panel.classList.remove('is-leaving');
    item.open = true;
  };

  const scheduleClose = (item) => {
    window.clearTimeout(item._navTimer);
    if (!item.open) return;
    if (reduce.matches) {
      finishClose(item);
      return;
    }
    const panel = item.querySelector('.site-nav__panel');
    if (panel) panel.classList.add('is-leaving');
    item._navTimer = window.setTimeout(() => finishClose(item), 220);
  };

  items.forEach((item) => {
    const summary = item.querySelector('summary');
    const panel = item.querySelector('.site-nav__panel');
    item.addEventListener('toggle', () => {
      if (item.open) items.forEach((other) => { if (other !== item) finishClose(other); });
    });
    item.addEventListener('mouseenter', () => {
      if (!desktop()) return;
      window.clearTimeout(item._navTimer);
      const panel = item.querySelector('.site-nav__panel');
      if (panel) panel.classList.remove('is-leaving');
      item._navTimer = window.setTimeout(() => openItem(item), 70);
    });
    item.addEventListener('mouseleave', () => {
      if (!desktop()) return;
      window.clearTimeout(item._navTimer);
      item._navTimer = window.setTimeout(() => scheduleClose(item), 120);
    });
    item.addEventListener('focusout', (event) => {
      if (!item.contains(event.relatedTarget)) finishClose(item);
    });
    if (summary) {
      summary.addEventListener('click', (event) => {
        if (!desktop() || !item.open) return;
        event.preventDefault();
        scheduleClose(item);
      });
      summary.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' && panel) {
          event.preventDefault();
          openItem(item);
          const first = panel.querySelector('a');
          if (first) first.focus();
        }
      });
    }
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        finishClose(item);
        if (summary) summary.focus();
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.site-nav__details')) items.forEach(finishClose);
  });
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
    if (close) close.focus();
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
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      shut();
      toggle.focus();
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !menu.classList.contains('is-open')) return;
    const focusable = menu.querySelectorAll('a, button, summary');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener('resize', () => { if (window.innerWidth >= 1280) shut(); });
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
    if (form.id === "business-account-form") return;
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
