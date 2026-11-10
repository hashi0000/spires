/* Shared production measurement. Keep the portal copy byte-identical. */
(function (w, d) {
  'use strict';
  if (w.SpiresMeasurement) return;
  var hosts = ['www.spires-taxis.com', 'spires-taxis.com', 'customer.spires-taxis.com'];
  var live = w.location.protocol === 'https:' && hosts.indexOf(w.location.hostname) !== -1;
  var id = 'G-RSE4NNBP64', loaded = false, consent = '', context = null;
  var consentKey = 'spires_measurement_consent_v1';
  var contextKey = 'spires_measurement_context_v1';
  var now = function () { return Date.now(); };
  function read(name) {
    try { var row = d.cookie.split('; ').find(function (s) { return s.indexOf(name + '=') === 0; }); return row ? JSON.parse(decodeURIComponent(row.slice(name.length + 1))) : null; } catch (_) { return null; }
  }
  function write(name, value, seconds) {
    if (!live) return;
    try { d.cookie = name + '=' + encodeURIComponent(JSON.stringify(value)) + '; Max-Age=' + seconds + '; Path=/; Domain=spires-taxis.com; Secure; SameSite=Lax'; } catch (_) {}
  }
  function cleanPath() {
    return w.location.hostname === 'customer.spires-taxis.com' ? '/portal' : w.location.pathname;
  }
  function safeLocation() {
    var params = new URLSearchParams(w.location.search), safe = new URLSearchParams();
    // Only validated advertising identifiers are retained; never form contents, claim tokens or email.
    ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { var v = params.get(k); if (v && /^[A-Za-z0-9_.~-]{1,256}$/.test(v)) safe.set(k, v); });
    return w.location.origin + cleanPath() + (safe.toString() ? '?' + safe.toString() : '');
  }
  function raw() { w.dataLayer = w.dataLayer || []; w.dataLayer.push(arguments); }
  // Existing page scripts may call gtag; nothing is queued or sent before consent or on previews.
  w.gtag = function () { if (live && consent === 'granted') raw.apply(null, arguments); };
  function capture() {
    if (!live || consent !== 'granted') return null;
    var saved = read(contextKey);
    if (saved && saved.expiresAt > now()) context = saved;
    var p = new URLSearchParams(w.location.search), click = {};
    ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { var v = p.get(k); if (v && /^[A-Za-z0-9_.~-]{1,256}$/.test(v)) click[k] = v; });
    if (Object.keys(click).length) context = Object.assign({ capturedAt: now(), expiresAt: now() + 30 * 86400000 }, click);
    if (context) write(contextKey, context, Math.max(0, Math.floor((context.expiresAt - now()) / 1000)));
    return context;
  }
  function init() {
    if (!live || consent !== 'granted') return;
    capture();
    raw('consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' });
    if (loaded) return;
    loaded = true;
    raw('js', new Date());
    raw('config', id, { page_location: safeLocation(), page_referrer: '', page_title: w.location.hostname === 'customer.spires-taxis.com' ? 'Spires Customer Portal' : d.title, allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: true });
    var s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id; d.head.appendChild(s);
  }
  function choose(value) {
    consent = value;
    write(consentKey, { value: value, at: now() }, 180 * 86400);
    var panel = d.getElementById('spires-measurement-choice'); if (panel) panel.remove();
    if (value === 'granted') init();
    else {
      context = null; write(contextKey, {}, 0);
      if (loaded) raw('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      // Remove measurement cookies across both possible cookie scopes.
      d.cookie.split(';').forEach(function (part) { var name = part.trim().split('=')[0]; if (/^(_ga|_gcl)/.test(name)) { write(name, {}, 0); d.cookie = name + '=; Max-Age=0; Path=/; Secure; SameSite=Lax'; } });
    }
  }
  function showChoice() {
    if (!live || d.getElementById('spires-measurement-choice')) return;
    var panel = d.createElement('section'); panel.id = 'spires-measurement-choice'; panel.setAttribute('aria-label', 'Measurement preferences');
    panel.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;max-width:620px;background:#fff;color:#14243b;padding:20px;border:1px solid #a98b4c;border-radius:12px;box-shadow:0 4px 24px #0003;z-index:10000;font:15px/1.5 system-ui';
    var text = d.createElement('p'); text.textContent = 'Allow measurement cookies? We use Google Analytics and advertising click identifiers to understand enquiries and bookings. No ad personalisation. Booking works without these cookies.'; panel.appendChild(text);
    [['Allow measurement', 'granted'], ['Reject measurement', 'denied']].forEach(function (item) { var b = d.createElement('button'); b.type = 'button'; b.textContent = item[0]; b.style.cssText = 'margin:4px;padding:10px 14px;border:1px solid #14243b;border-radius:6px;background:white;color:#14243b;cursor:pointer;font:inherit'; b.onclick = function () { choose(item[1]); }; panel.appendChild(b); });
    d.body.appendChild(panel);
  }
  function lead(key, channel) {
    if (!live || consent !== 'granted' || !key) return;
    try { var k = 'spires_lead_' + key; if (w.sessionStorage.getItem(k)) return; w.sessionStorage.setItem(k, '1'); } catch (_) {}
    w.gtag('event', 'generate_lead', { lead_channel: channel === 'portal' ? 'portal' : 'website', transport_type: 'beacon', page_location: w.location.origin + cleanPath() });
  }
  function attribution() {
    return new Promise(function (resolve) {
      if (!live || consent !== 'granted') return resolve(null);
      var result = Object.assign({}, capture() || {}, { consent: 'granted', consentAt: now(), capturedAt: context ? context.capturedAt : now(), expiresAt: context ? context.expiresAt : now() + 30 * 86400000 });
      var done = false, timer = w.setTimeout(finish, 600);
      function finish() { if (done) return; done = true; w.clearTimeout(timer); resolve(result); }
      w.gtag('get', id, 'client_id', function (v) { if (!done && /^\d+\.\d+$/.test(String(v))) result.clientId = String(v); w.gtag('get', id, 'session_id', function (s) { if (!done && /^\d+$/.test(String(s))) { result.sessionId = String(s); result.sessionCapturedAt = Number(s) * 1000; } finish(); }); });
    });
  }
  w.SpiresMeasurement = { lead: lead, attribution: attribution, preferences: showChoice };
  if (!live) return;
  raw('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  var saved = read(consentKey); consent = saved && now() - saved.at < 180 * 86400000 ? saved.value : '';
  if (consent === 'granted') init();
  function ready() {
    var button = d.createElement('button'); button.type = 'button'; button.textContent = 'Cookie preferences'; button.style.cssText = 'position:fixed;bottom:4px;left:8px;z-index:9999;font:12px system-ui;background:white;color:#14243b;border:1px solid #aaa;border-radius:4px;padding:3px'; button.onclick = showChoice; d.body.appendChild(button);
    if (!consent) showChoice();
    d.addEventListener('click', function (event) { var a = event.target.closest && event.target.closest('a[href]'); if (!a || consent !== 'granted') return; var href = a.getAttribute('href') || ''; var name = /^tel:/i.test(href) ? 'phone_click' : /^https:\/\/(wa.me|api.whatsapp.com)\//i.test(href) ? 'whatsapp_click' : ''; if (name) w.gtag('event', name, { transport_type: 'beacon', page_location: w.location.origin + cleanPath() }); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready();
})(window, document);
