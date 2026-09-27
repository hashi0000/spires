(async () => {
  const pages = [
    '/',
    '/airport-transfers',
    '/rates',
    '/oxford-to-heathrow-taxi',
    '/heathrow-to-oxford-taxi',
    '/oxford-to-gatwick-taxi',
    '/oxford-to-luton-taxi',
    '/how-airport-pickup-works',
    '/student-taxis',
    '/corporate-taxis',
    '/our-vehicles',
    '/oxford-taxis',
    '/abingdon-taxis',
    '/bicester-taxis',
    '/banbury-to-oxford-taxi',
    '/contact',
    '/about',
    '/reviews',
    '/terms-and-conditions',
    '/offer-terms',
    '/thank-you',
    '/404.html'
  ];
  const width = Number(window.__QA_WIDTH || 360);
  const height = 780;
  const out = [];

  function inspect(win, doc, path) {
    const h1 = doc.querySelector('h1');
    let lines = [];
    if (h1) {
      const range = doc.createRange();
      range.selectNodeContents(h1);
      lines = [...range.getClientRects()].map((b) => ({
        w: Math.round(b.width),
        h: Math.round(b.height),
        t: Math.round(b.top)
      }));
    }
    const wa = doc.querySelector('.whatsapp-float');
    const wr = wa ? wa.getBoundingClientRect() : null;
    const overlap = [];
    if (wr && wr.width) {
      doc.querySelectorAll('h1, .hero__lead, a.btn, .btn, input, select, textarea, label, table, .site-footer__bottom, .site-footer__license').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > height) return;
        const hit = !(r.right < wr.left + 2 || r.left > wr.right - 2 || r.bottom < wr.top + 2 || r.top > wr.bottom - 2);
        if (hit) overlap.push((el.tagName + '.' + (el.className || '').toString().split(' ')[0]).slice(0, 40));
      });
    }
    const tables = [...doc.querySelectorAll('table')].map((t) => ({
      w: Math.round(t.getBoundingClientRect().width),
      parentOverflow: getComputedStyle(t.parentElement).overflowX
    }));
    return {
      path,
      inner: win.innerWidth,
      overflow: doc.documentElement.scrollWidth > win.innerWidth + 1,
      scrollW: doc.documentElement.scrollWidth,
      h1: h1 ? h1.innerText.replace(/\s+/g, ' ').slice(0, 90) : null,
      h1Size: h1 ? getComputedStyle(h1).fontSize : null,
      h1LineCount: lines.length,
      lastLineNarrow: lines.length > 1 && lines[lines.length - 1].w < 90,
      overlap: [...new Set(overlap)],
      tables,
      hasForm: !!doc.querySelector('form'),
      hasFaq: !!doc.querySelector('.faq'),
      crumbs: !!doc.querySelector('.breadcrumbs') && getComputedStyle(doc.querySelector('.breadcrumbs')).position !== 'absolute',
      labelShown: !!(doc.querySelector('.hero__label') && getComputedStyle(doc.querySelector('.hero__label')).display !== 'none')
    };
  }

  for (const path of pages) {
    const iframe = docCreate();
    iframe.src = path;
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 7000);
      iframe.onload = () => { clearTimeout(t); setTimeout(resolve, 150); };
    });
    try {
      out.push(inspect(iframe.contentWindow, iframe.contentDocument, path));
    } catch (e) {
      out.push({ path, error: String(e) });
    }
    iframe.remove();
  }
  function docCreate() {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;left:-2000px;top:0;width:' + width + 'px;height:' + height + 'px;border:0;background:#fff';
    document.body.appendChild(iframe);
    return iframe;
  }
  return out;
})()
