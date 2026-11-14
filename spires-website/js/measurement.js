/* Shared production measurement. Keep the portal copy byte-identical. */
(function (w, d) {
  'use strict';
  if (w.SpiresMeasurement) return;
  var hosts = ['www.spires-taxis.com', 'spires-taxis.com', 'customer.spires-taxis.com'];
  var live = w.location.protocol === 'https:' && hosts.indexOf(w.location.hostname) !== -1;
  var id = 'G-RSE4NNBP64', loaded = false, consent = '', context = null;
  var consentKey = 'spires_measurement_consent_v1';
  var contextKey = 'spires_measurement_context_v1';
  var withdrawalKey = 'spires_measurement_withdrawal_v1';
  var listeners = [], flushing = false;
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
    // Retain only validated advertising and campaign fields; never form contents, claim tokens or email.
    ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { var v = params.get(k); if (v && /^[A-Za-z0-9_.~-]{1,256}$/.test(v)) safe.set(k, v); });
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      var value = cleanCampaign(params.get(key));
      if (value) safe.set(key, value);
    });
    return w.location.origin + cleanPath() + (safe.toString() ? '?' + safe.toString() : '');
  }
  function safePath(pathname) {
    var parts = String(pathname || '').split('/');
    var kept = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) { kept.push(''); continue; }
      if (part.indexOf('@') !== -1 || /\d{6,}/.test(part) || (part.length >= 16 && /[a-z]/i.test(part) && /\d/.test(part)) || !/^[a-z0-9._~-]{1,80}$/i.test(part)) break;
      kept.push(part);
    }
    var path = kept.join('/');
    if (path.charAt(0) !== '/') path = '/' + path;
    return path === '/' ? '' : path;
  }
  function safeReferrer() {
    try {
      if (!d.referrer) return '';
      var url = new URL(d.referrer);
      if (url.protocol !== 'http:' && url.protocol !== 'https:' || url.username || url.password) return '';
      return url.origin + safePath(url.pathname);
    } catch (_) { return ''; }
  }
  function cleanCampaign(value) {
    var text = String(value || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 _+.|-]{0,79}$/.test(text)) return '';
    if (/@|\d{6,}|https?:|www\.|[<>]/i.test(text)) return '';
    return text;
  }
  function landingPath() {
    if (w.location.hostname === 'customer.spires-taxis.com') return '/portal';
    return safePath(w.location.pathname);
  }
  function referrerHost() {
    try {
      if (!d.referrer) return '';
      var url = new URL(d.referrer);
      var host = url.hostname.toLowerCase();
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      if (host === 'spires-taxis.com' || host.indexOf('.spires-taxis.com') === host.length - 17) return '';
      return /^[a-z0-9.-]{1,253}$/.test(host) ? host : '';
    } catch (_) { return ''; }
  }
  function pageTouch() {
    var touch = { capturedAt: now() };
    var params = new URLSearchParams(w.location.search);
    ['gclid', 'gbraid', 'wbraid'].forEach(function (key) { var value = params.get(key); if (value && /^[A-Za-z0-9_.~-]{1,256}$/.test(value)) touch[key] = value; });
    [['utmSource', 'utm_source'], ['utmMedium', 'utm_medium'], ['utmCampaign', 'utm_campaign'], ['utmContent', 'utm_content'], ['utmTerm', 'utm_term']].forEach(function (pair) {
      var value = cleanCampaign(params.get(pair[1]));
      if (value) touch[pair[0]] = value;
    });
    var path = landingPath();
    if (path) touch.landingPath = path;
    var host = referrerHost();
    if (host) touch.referrerHost = host;
    return touch;
  }
  function nonDirect(touch) {
    return !!(touch && (touch.gclid || touch.gbraid || touch.wbraid || touch.utmSource || touch.utmMedium || touch.utmCampaign || touch.utmContent || touch.utmTerm || touch.referrerHost));
  }
  function normalise(saved) {
    if (!saved || !saved.expiresAt || saved.expiresAt <= now()) return null;
    if (saved.first || saved.latest) return saved;
    var touch = { capturedAt: saved.capturedAt || now() };
    ['gclid', 'gbraid', 'wbraid'].forEach(function (key) { if (saved[key]) touch[key] = saved[key]; });
    return { capturedAt: touch.capturedAt, expiresAt: saved.expiresAt, first: touch, latest: touch };
  }
  function raw() { w.dataLayer = w.dataLayer || []; w.dataLayer.push(arguments); }
  function notifyConsent() { listeners.forEach(function(fn){try { fn(consent); } catch (_) {}}); }
  function flushWithdrawal() {
    var pending = read(withdrawalKey);
    if (!live || flushing || !pending || !pending.receipt || !w.fetch) return;
    flushing = true;
    w.fetch('https://us-central1-spires-taxis.cloudfunctions.net/revokeMeasurementConsent', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({receipt:pending.receipt}), keepalive:true })
      .then(function(response){if(response.ok){var current=read(withdrawalKey);if(current && current.receipt===pending.receipt)write(withdrawalKey,{},0);var status=d.getElementById('spires-withdrawal-status');if(status)status.remove();}})
      .catch(function(){})
      .then(function(){flushing=false;});
  }
  // Existing page scripts may call gtag; nothing is queued or sent before consent or on previews.
  function allowed() {
    var saved = read(consentKey);
    var granted = !!(saved && saved.value === 'granted' && saved.at > 0 && saved.at <= now() && now() - saved.at < 180 * 86400000);
    if (!granted && consent === 'granted') {
      consent = 'denied'; context = null;
      if (loaded) raw('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      notifyConsent();
    }
    return granted && consent === 'granted';
  }
  w.gtag = function () { if (live && allowed()) raw.apply(null, arguments); };
  function capture() {
    if (!live || !allowed()) return null;
    var saved = normalise(read(contextKey));
    context = saved;
    var touch = pageTouch();
    if (!context) context = { capturedAt: touch.capturedAt, expiresAt: touch.capturedAt + 30 * 86400000, first: touch, latest: touch };
    else if (nonDirect(touch)) {
      if (!context.first) context.first = touch;
      context.latest = touch;
      context.expiresAt = touch.capturedAt + 30 * 86400000;
    }
    if (!context.consentReceiptId && w.crypto && w.crypto.randomUUID) context.consentReceiptId=w.crypto.randomUUID();
    if (context) write(contextKey, context, Math.max(0, Math.floor((context.expiresAt - now()) / 1000)));
    return context;
  }
  function init() {
    if (!live || !allowed()) return;
    capture();
    raw('consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' });
    if (loaded) return;
    loaded = true;
    raw('js', new Date());
    raw('config', id, { page_location: safeLocation(), page_referrer: safeReferrer(), page_title: w.location.hostname === 'customer.spires-taxis.com' ? 'Spires Customer Portal' : d.title, cookie_domain: 'spires-taxis.com', allow_google_signals: false, allow_ad_personalization_signals: false, send_page_view: true });
    var s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id; d.head.appendChild(s);
  }
  function choose(value) {
    if(value==='granted' && read(withdrawalKey)) {
      flushWithdrawal();
      var pendingPanel=d.getElementById('spires-measurement-choice');
      if(pendingPanel && pendingPanel.children[0])pendingPanel.children[0].textContent='Your earlier withdrawal is still syncing. Booking works without measurement. Try allowing measurement again after you are online.';
      return;
    }
    var previous = read(contextKey);
    consent = value;
    write(consentKey, { value: value, at: now() }, 180 * 86400);
    var panel = d.getElementById('spires-measurement-choice'); if (panel) panel.remove();
    if (value === 'granted') init();
    else {
      if (previous && previous.consentReceiptId) {
        write(withdrawalKey,{receipt:previous.consentReceiptId,at:now()},180*86400);
        var status=d.getElementById('spires-withdrawal-status');
        if(!status){status=d.createElement('p');status.id='spires-withdrawal-status';status.setAttribute('role','status');status.textContent='Measurement is off in this browser. Saved booking preferences will sync when you are online.';d.body.appendChild(status);}
        flushWithdrawal();
      }
      context = null; write(contextKey, {}, 0);
      if (loaded) raw('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      // Remove measurement cookies across both possible cookie scopes.
      d.cookie.split(';').forEach(function (part) { var name = part.trim().split('=')[0]; if (/^(_ga|_gcl)/.test(name)) { write(name, {}, 0); d.cookie = name + '=; Max-Age=0; Path=/; Secure; SameSite=Lax'; } });
    }
    notifyConsent();
  }
  function showChoice() {
    if (!live || d.getElementById('spires-measurement-choice')) return;
    var panel = d.createElement('section'); panel.id = 'spires-measurement-choice'; panel.setAttribute('aria-label', 'Measurement preferences');
    panel.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;max-width:620px;background:#fff;color:#14243b;padding:20px;border:1px solid #a98b4c;border-radius:12px;box-shadow:0 4px 24px #0003;z-index:10000;font:15px/1.5 system-ui';
    var text = d.createElement('p'); text.textContent = 'Allow measurement cookies? We use Google Analytics and advertising click identifiers to understand enquiries and bookings. No ad personalisation. Booking works without these cookies.'; panel.appendChild(text);
    [['Allow measurement', 'granted'], ['Reject measurement', 'denied']].forEach(function (item) { var b = d.createElement('button'); b.type = 'button'; b.textContent = item[0]; b.style.cssText = 'margin:4px;padding:10px 14px;border:1px solid #14243b;border-radius:6px;background:white;color:#14243b;cursor:pointer;font:inherit'; b.onclick = function () { choose(item[1]); }; panel.appendChild(b); });
    d.body.appendChild(panel);
  }
  var lastClick = { key: '', at: 0 };
  var sentLead = Object.create(null);
  function lead(key, channel, type) {
    if (!live || !allowed() || !key) return;
    var id = String(key);
    if (sentLead[id]) return;
    var storageKey = 'spires_lead_' + id;
    try { if (w.sessionStorage.getItem(storageKey)) return; } catch (_) {}
    var kind = type === 'contact' || type === 'quote' || type === 'booking_request' ? type : (channel === 'portal' ? 'booking_request' : channel === 'contact' ? 'contact' : 'quote');
    sentLead[id] = true;
    try { w.sessionStorage.setItem(storageKey, '1'); } catch (_) {}
    w.gtag('event', 'generate_lead', { lead_channel: channel === 'portal' ? 'portal' : 'website', lead_type: kind, transport_type: 'beacon', page_location: w.location.origin + cleanPath() });
  }
  function bestTouch(saved) {
    if (!saved) return null;
    if (nonDirect(saved.latest)) return saved.latest;
    if (nonDirect(saved.first)) return saved.first;
    return saved.first || saved.latest || null;
  }
  function attribution() {
    return new Promise(function (resolve) {
      if (!live || !allowed()) return resolve(null);
      var saved = capture();
      var best = bestTouch(saved) || {};
      var result = {
        consent: 'granted', consentAt: now(), consentGrantedAt: read(consentKey).at, consentReceiptId:saved && saved.consentReceiptId,
        capturedAt: best.capturedAt || now(),
        expiresAt: (best.capturedAt || now()) + 30 * 86400000,
        first: saved && saved.first, latest: nonDirect(saved && saved.latest) ? saved.latest : (nonDirect(saved && saved.first) ? saved.first : saved && saved.first)
      };
      ['gclid', 'gbraid', 'wbraid', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm', 'landingPath', 'referrerHost'].forEach(function (key) { if (best[key]) result[key] = best[key]; });
      var done = false, timer = w.setTimeout(finish, 600);
      function finish() { if (done) return; done = true; w.clearTimeout(timer); resolve(allowed() ? result : null); }
      w.gtag('get', id, 'client_id', function (v) { if (!done && /^\d+\.\d+$/.test(String(v))) result.clientId = String(v); w.gtag('get', id, 'session_id', function (s) { if (!done && /^\d+$/.test(String(s))) { result.sessionId = String(s); result.sessionCapturedAt = Number(s) * 1000; } finish(); }); });
    });
  }
  function signup(key) {
    if (!live || !allowed() || !key || sentLead['signup_' + key]) return;
    var storageKey = 'spires_signup_' + key;
    try { if (w.sessionStorage.getItem(storageKey)) return; w.sessionStorage.setItem(storageKey, '1'); } catch (_) {}
    sentLead['signup_' + key] = true;
    w.gtag('event', 'sign_up', { method: 'email', page_location: w.location.origin + cleanPath() });
  }
  w.SpiresMeasurement = { lead: lead, signup: signup, attribution: attribution, preferences: showChoice, onConsentChange:function(fn){listeners.push(fn);fn(consent);return function(){listeners=listeners.filter(function(item){return item!==fn;});};} };
  if (w.addEventListener) {
    w.addEventListener('focus', function(){allowed();flushWithdrawal();});
    w.addEventListener('online',flushWithdrawal);
  }
  if (!live) return;
  raw('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  var saved = read(consentKey); consent = saved && saved.at > 0 && saved.at <= now() && now() - saved.at < 180 * 86400000 && ['granted', 'denied'].indexOf(saved.value) !== -1 ? saved.value : '';
  if (consent === 'granted') init();
  function ready() {
    flushWithdrawal();
    var button = d.createElement('button'); button.type = 'button'; button.textContent = 'Cookie preferences'; button.style.cssText = 'position:fixed;bottom:4px;left:8px;z-index:9999;font:12px system-ui;background:white;color:#14243b;border:1px solid #aaa;border-radius:4px;padding:3px'; button.onclick = showChoice; d.body.appendChild(button);
    if (!consent) showChoice();
    d.addEventListener('click', function (event) {
      var a = event.target.closest && event.target.closest('a[href]');
      if (!a || !allowed()) return;
      var href = a.getAttribute('href') || '';
      var name = /^tel:/i.test(href) ? 'phone_click' : /^mailto:/i.test(href) ? 'email_click' : /^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href) ? 'whatsapp_click' : '';
      if (!name) return;
      var key = name + '|' + href.split('?')[0].split('#')[0];
      if (lastClick.key === key && now() - lastClick.at < 1000) return;
      lastClick.key = key; lastClick.at = now();
      var params = { transport_type: 'beacon', page_location: w.location.origin + cleanPath() };
      var route = d.body && d.body.getAttribute && d.body.getAttribute('data-wa-route');
      if (route && /^[a-z0-9-]{1,64}$/.test(route)) params.airport_route = route;
      w.gtag('event', name, params);
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready();
})(window, document);
