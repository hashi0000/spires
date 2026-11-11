const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const measurement = fs.readFileSync("spires-website/js/measurement.js", "utf8");

function matches(node, selector) {
  return selector.split(",").some((part) => {
    let rest = part.trim();
    let checked = false;
    if (rest.endsWith(":checked")) {
      checked = true;
      rest = rest.slice(0, -8);
    }
    let tag = "";
    const tagMatch = rest.match(/^[a-z]+/i);
    if (tagMatch && !rest.startsWith("[") && !rest.startsWith(".")) {
      tag = tagMatch[0];
      rest = rest.slice(tag.length);
    }
    if (tag && node.tag !== tag) return false;
    if (rest.startsWith(".")) {
      const name = rest.slice(1);
      if (!String(node.className || "").split(/\s+/).includes(name)) return false;
      rest = "";
    }
    if (rest.startsWith("[")) {
      const attr = rest.match(/^\[([^\]=]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
      if (!attr) return false;
      const actual = node.getAttribute(attr[1]);
      if (attr[2] !== undefined && String(actual) !== attr[2]) return false;
      if (attr[2] === undefined && (actual === null || actual === "")) return false;
    } else if (rest) return false;
    return !checked || node.checked === true;
  });
}

function page(pathname) {
  const ids = new Map();
  const cookies = new Map();
  cookies.set("spires_measurement_consent_v1", encodeURIComponent(JSON.stringify({ value: "granted", at: Date.now() })));
  function queryAll(root, selector) {
    const found = [];
    const visit = (node) => {
      (node.children || []).forEach((child) => {
        if (matches(child, selector)) found.push(child);
        visit(child);
      });
    };
    visit(root);
    return found;
  }
  function make(tag, attrs = {}) {
    const node = {
      tag,
      attrs: { ...attrs },
      children: [],
      style: {},
      hidden: false,
      disabled: false,
      checked: attrs.checked === true,
      value: attrs.value || "",
      name: attrs.name || "",
      id: attrs.id || "",
      type: attrs.type || "",
      className: attrs.className || "",
      textContent: attrs.text || "",
      dataset: {},
      listeners: {},
      classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
      setAttribute(key, value) { this.attrs[key] = value; },
      getAttribute(key) {
        if (key === "id") return this.id || null;
        if (key === "name") return this.name || null;
        if (key === "type") return this.type || null;
        if (key === "class") return this.className || null;
        return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null;
      },
      addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); },
      dispatch(name, event) { (this.listeners[name] || []).forEach((fn) => fn(event)); },
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
        if (child.id) ids.set(child.id, child);
        return child;
      },
      querySelector(selector) { return queryAll(this, selector)[0] || null; },
      querySelectorAll(selector) { return queryAll(this, selector); },
      focus() {},
      remove() {},
      replaceWith() {},
      removeAttribute() {},
    };
    if (node.id) ids.set(node.id, node);
    return node;
  }
  const body = make("body");
  const doc = {
    readyState: "complete",
    title: "Contact",
    referrer: "",
    body,
    head: make("head"),
    getElementById: (id) => ids.get(id) || null,
    querySelector: (selector) => queryAll(body, selector)[0] || null,
    querySelectorAll: (selector) => queryAll(body, selector),
    addEventListener() {},
    createElement: (tag) => make(tag),
  };
  Object.defineProperty(doc, "cookie", {
    get() { return [...cookies].map(([key, value]) => key + "=" + value).join("; "); },
    set(value) {
      const [pair, ...attrs] = value.split(";");
      const at = pair.indexOf("=");
      if (attrs.some((item) => /Max-Age=0$/.test(item.trim()))) cookies.delete(pair.slice(0, at));
      else cookies.set(pair.slice(0, at), pair.slice(at + 1));
    },
  });
  const fetches = [];
  let reply = { ok: true, status: 200, body: { ok: true, bookingNumber: "ST100", duplicate: false, contactBy: "email" } };
  const location = {
    protocol: "https:",
    hostname: "www.spires-taxis.com",
    origin: "https://www.spires-taxis.com",
    pathname,
    search: "",
    href: "https://www.spires-taxis.com" + pathname,
    assign(url) { this.href = url; },
  };
  const storage = new Map();
  const alerts = [];
  const win = {
    location,
    sessionStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval() {},
    alert: (message) => alerts.push(message),
    fetch: (url, options) => {
      fetches.push({ url, body: options && options.body });
      const current = reply;
      return Promise.resolve({ ok: current.ok, status: current.status, json: () => Promise.resolve(current.body) });
    },
    FormData: class {
      constructor(form) {
        this.rows = [];
        const visit = (node) => (node.children || []).forEach((child) => {
          if (child.name && !((child.type === "radio" || child.type === "checkbox") && !child.checked)) this.rows.push([child.name, child.value]);
          visit(child);
        });
        visit(form);
      }
      get(name) {
        const row = this.rows.find((item) => item[0] === name);
        return row ? row[1] : null;
      }
    },
  };
  const context = { window: win, document: doc, URL, URLSearchParams, Date, Promise, encodeURIComponent, Intl };
  win.window = win;
  win.document = doc;
  vm.runInNewContext(measurement, context);
  win.SpiresMeasurement.attribution = () => Promise.resolve(null);
  return {
    win, doc, body, make, fetches, alerts, ids,
    reply(next) { reply = next; },
    leads() { return (win.dataLayer || []).filter((row) => row[0] === "event" && row[1] === "generate_lead"); },
  };
}

function field(pageApi, form, tag, attrs) {
  const node = pageApi.make(tag, attrs);
  form.appendChild(node);
  return node;
}

function eventFor() {
  return { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {}, target: { closest: () => null } };
}

async function flush() {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

function saved(pageApi) {
  return JSON.stringify(pageApi.leads());
}

test("contact page quote fires once after the booking is saved", async () => {
  const api = page("/contact");
  const form = api.make("form", { id: "booking-form", className: "booking-form" });
  api.body.appendChild(form);
  field(api, form, "input", { id: "name", name: "name", value: "Ada Example" });
  field(api, form, "input", { id: "email", name: "email", value: "private@example.com" });
  field(api, form, "input", { id: "phone", name: "phone", value: "07700900000" });
  field(api, form, "textarea", { name: "message", value: "Please call about the school run private@example.com" });
  field(api, form, "input", { name: "vehicleType", type: "radio", value: "standard", checked: true });
  field(api, form, "input", { name: "termsAccepted", type: "checkbox", checked: true });
  field(api, form, "button", { id: "booking-submit", type: "submit" });
  field(api, form, "p", { id: "booking-status" });
  field(api, form, "p", { id: "contact-error" });
  field(api, form, "p", { id: "terms-agreement-error" });
  field(api, form, "div", { id: "booking-result" });
  vm.runInNewContext(fs.readFileSync("spires-website/js/guest-booking.js", "utf8"), api.win);
  api.win.document.getElementById("name").value = "";
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(api.fetches.length, 0);
  assert.equal(api.leads().length, 0);
  api.win.document.getElementById("name").value = "Ada Example";
  api.reply({ ok: false, status: 500, body: { error: "We could not save your request." } });
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(api.fetches.length, 1);
  assert.equal(api.leads().length, 0);
  api.reply({ ok: true, status: 200, body: { ok: true, bookingNumber: "ST100", duplicate: false } });
  form.dispatch("submit", eventFor());
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(api.fetches.length, 2);
  assert.equal(api.leads().length, 1);
  assert.equal(api.leads()[0][2].lead_type, "quote");
  assert.equal(saved(api).includes("private@example.com"), false);
  assert.equal(saved(api).includes("school run"), false);

  const retry = page("/contact");
  const retryForm = retry.make("form", { id: "booking-form" });
  retry.body.appendChild(retryForm);
  field(retry, retryForm, "input", { id: "name", name: "name", value: "Ada Example" });
  field(retry, retryForm, "input", { id: "phone", name: "phone", value: "07700900000" });
  field(retry, retryForm, "input", { name: "vehicleType", type: "radio", value: "standard", checked: true });
  field(retry, retryForm, "input", { name: "termsAccepted", type: "checkbox", checked: true });
  field(retry, retryForm, "button", { id: "booking-submit", type: "submit" });
  field(retry, retryForm, "p", { id: "booking-status" });
  vm.runInNewContext(fs.readFileSync("spires-website/js/guest-booking.js", "utf8"), retry.win);
  retry.reply({ ok: true, status: 200, body: { ok: true, bookingNumber: "ST100", duplicate: true } });
  retryForm.dispatch("submit", eventFor());
  await flush();
  assert.equal(retry.leads().length, 0);
});

test("event quote and unused quote form wait for a saved reference", async () => {
  const eventPage = page("/oxford-to-lords-cricket-ground");
  const eventForm = eventPage.make("form", { className: "event-quote" });
  eventPage.body.appendChild(eventForm);
  field(eventPage, eventForm, "input", { name: "name", value: "Ada Example" });
  field(eventPage, eventForm, "input", { name: "email", value: "private@example.com" });
  field(eventPage, eventForm, "input", { name: "phone", value: "07700900000" });
  field(eventPage, eventForm, "textarea", { name: "message", value: "Extra note private@example.com" });
  field(eventPage, eventForm, "select", { name: "bookingType", value: "one_way" });
  field(eventPage, eventForm, "input", { name: "vehicleType", type: "radio", value: "standard", checked: true });
  field(eventPage, eventForm, "input", { name: "termsAccepted", type: "checkbox", checked: true });
  field(eventPage, eventForm, "button", { type: "submit" });
  field(eventPage, eventForm, "p", { "data-quote-status": "yes" });
  field(eventPage, eventForm, "p", { "data-contact-error": "yes" });
  field(eventPage, eventForm, "p", { "data-terms-error": "yes" });
  eventPage.body.appendChild(eventPage.make("div", { id: "event-quote-result" }));
  vm.runInNewContext(fs.readFileSync("spires-website/js/event-quote.js", "utf8"), eventPage.win);
  eventPage.reply({ ok: false, status: 400, body: { error: "We could not send the request." } });
  eventForm.dispatch("submit", eventFor());
  await flush();
  assert.equal(eventPage.leads().length, 0);
  eventPage.reply({ ok: true, status: 200, body: { ok: true, bookingNumber: "EV200", duplicate: false } });
  eventForm.dispatch("submit", eventFor());
  await flush();
  assert.equal(eventPage.leads().length, 1);
  assert.equal(eventPage.leads()[0][2].lead_type, "quote");
  assert.equal(saved(eventPage).includes("private@example.com"), false);

  const quotePage = page("/quote");
  const quoteForm = quotePage.make("form", { id: "booking-form" });
  quotePage.body.appendChild(quoteForm);
  field(quotePage, quoteForm, "input", { name: "name", value: "Ada Example" });
  field(quotePage, quoteForm, "input", { name: "termsAccepted", type: "checkbox", checked: false });
  field(quotePage, quoteForm, "button", { type: "submit" });
  quotePage.body.appendChild(quotePage.make("p", { id: "terms-agreement-error" }));
  vm.runInNewContext(fs.readFileSync("spires-website/js/quote-form.js", "utf8"), quotePage.win);
  quoteForm.dispatch("submit", eventFor());
  await flush();
  assert.equal(quotePage.fetches.length, 0);
  assert.equal(quotePage.leads().length, 0);
  quoteForm.querySelector("[name='termsAccepted']").checked = true;
  quotePage.reply({ ok: true, status: 200, body: { ok: true } });
  quoteForm.dispatch("submit", eventFor());
  await flush();
  assert.equal(quotePage.leads().length, 0);
  quotePage.reply({ ok: true, status: 200, body: { ok: true, bookingNumber: "Q300", duplicate: false } });
  quoteForm.dispatch("submit", eventFor());
  await flush();
  assert.equal(quotePage.leads().length, 1);
  assert.equal(quotePage.leads()[0][2].lead_type, "quote");
  assert.equal(quotePage.win.location.href, "/thank-you");
});

test("business enquiry and translated forms use contact or quote after a confirmed save", async () => {
  const business = page("/business-accounts");
  const form = business.make("form", { id: "business-account-form", action: "https://formspree.io/f/meozaolo" });
  form.reportValidity = () => true;
  business.body.appendChild(form);
  field(business, form, "input", { name: "organisation", value: "Oxford Example Ltd" });
  field(business, form, "input", { name: "name", value: "Ada Example" });
  field(business, form, "input", { name: "email", value: "private@example.com" });
  field(business, form, "input", { name: "phone", value: "07700900000" });
  field(business, form, "textarea", { name: "travelNeeds", value: "Airport runs for visiting staff" });
  field(business, form, "textarea", { name: "message", value: "Do not send this sentence to Google" });
  field(business, form, "input", { name: "_gotcha", value: "" });
  field(business, form, "button", { type: "submit", text: "Send enquiry" });
  business.body.appendChild(business.make("p", { id: "business-enquiry-status" }));
  business.body.appendChild(business.make("p", { id: "business-enquiry-success" }));
  vm.runInNewContext(fs.readFileSync("spires-website/js/business-account-form.js", "utf8"), business.win);
  form.reportValidity = () => false;
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(business.fetches.length, 0);
  form.reportValidity = () => true;
  form.querySelector("[name='_gotcha']").value = "bot";
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(business.fetches.length, 0);
  assert.equal(business.leads().length, 0);
  form.querySelector("[name='_gotcha']").value = "";
  business.reply({ ok: false, status: 500, body: { error: "We could not send your enquiry." } });
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(business.leads().length, 0);
  business.reply({ ok: true, status: 200, body: { ok: true } });
  form.dispatch("submit", eventFor());
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(business.fetches.length, 2);
  assert.equal(business.leads().length, 1);
  assert.equal(business.leads()[0][2].lead_type, "contact");
  assert.equal(saved(business).includes("Do not send"), false);
  assert.equal(saved(business).includes("private@example.com"), false);

  const translated = page("/de/contact");
  vm.runInNewContext(fs.readFileSync("spires-website/js/main.js", "utf8"), translated.win);
  const contact = translated.make("form", { action: "https://formspree.io/f/meozaolo" });
  contact.checkValidity = () => true;
  translated.body.appendChild(contact);
  field(translated, contact, "input", { name: "service", value: "contact" });
  field(translated, contact, "input", { name: "_next", value: "https://www.spires-taxis.com/thank-you" });
  field(translated, contact, "input", { name: "_gotcha", value: "" });
  field(translated, contact, "textarea", { name: "message", value: "Nachricht private@example.com" });
  field(translated, contact, "button", { type: "submit" });
  translated.win.SpiresEnquiryLead.bind(contact);
  contact.checkValidity = () => false;
  contact.dispatch("submit", eventFor());
  await flush();
  assert.equal(translated.fetches.length, 0);
  contact.checkValidity = () => true;
  translated.reply({ ok: false, status: 422, body: { error: "validation" } });
  contact.dispatch("submit", eventFor());
  await flush();
  assert.equal(translated.leads().length, 0);
  translated.reply({ ok: true, status: 200, body: { ok: true } });
  contact.dispatch("submit", eventFor());
  contact.dispatch("submit", eventFor());
  await flush();
  assert.equal(translated.fetches.length, 2);
  assert.equal(translated.leads().length, 1);
  assert.equal(translated.leads()[0][2].lead_type, "contact");
  assert.equal(translated.win.location.href, "https://www.spires-taxis.com/thank-you");
  assert.equal(saved(translated).includes("Nachricht"), false);

  const airport = page("/de/oxford-to-heathrow-taxi");
  vm.runInNewContext(fs.readFileSync("spires-website/js/main.js", "utf8"), airport.win);
  const quote = airport.make("form", { action: "https://formspree.io/f/meozaolo" });
  quote.checkValidity = () => true;
  airport.body.appendChild(quote);
  field(airport, quote, "input", { name: "service", value: "airport-transfer" });
  field(airport, quote, "button", { type: "submit" });
  airport.win.SpiresEnquiryLead.bind(quote);
  quote.dispatch("submit", eventFor());
  await flush();
  assert.equal(airport.leads()[0][2].lead_type, "quote");
});

test("twickenham quote and portal booking request follow the same save rule", async () => {
  const api = page("/oxford-to-twickenham-taxi");
  api.win.SPIRES_TWICKENHAM_FIXTURES = [{ id: "eng1", title: "England", date: "2027-06-01", kickoff: "15:00", dayLabel: "1 June", grandFinal: false }];
  const form = api.make("form", { id: "twickenham-form" });
  api.body.appendChild(form);
  field(api, form, "select", { id: "tw-fixture", value: "eng1" });
  [["tw-name", "Ada Example"], ["tw-email", "private@example.com"], ["tw-phone", "07700900000"], ["tw-pickup", "1 High Street"], ["tw-postcode", "OX1 1AA"], ["tw-collect", "09:00"], ["tw-arrival", "11:00"], ["tw-return", "18:00"], ["tw-passengers", "2"], ["tw-luggage", "1"], ["tw-notes", "Window seat private@example.com"]].forEach(([id, value]) => {
    field(api, form, "input", { id, name: id, value });
  });
  field(api, form, "input", { name: "vehicleType", type: "radio", value: "standard", checked: true });
  field(api, form, "input", { name: "termsAccepted", type: "checkbox", checked: true });
  field(api, form, "button", { id: "tw-submit", type: "submit" });
  field(api, form, "p", { id: "tw-status" });
  field(api, form, "p", { id: "tw-contact-error" });
  field(api, form, "p", { id: "tw-terms-error" });
  field(api, form, "div", { id: "tw-result" });
  vm.runInNewContext(fs.readFileSync("spires-website/js/twickenham.js", "utf8"), api.win);
  api.win.document.getElementById("tw-name").value = "A";
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(api.fetches.length, 0);
  api.win.document.getElementById("tw-name").value = "Ada Example";
  api.reply({ ok: false, status: 500, body: { error: "We could not save your request." } });
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(api.leads().length, 0);
  api.reply({ ok: true, status: 200, body: { ok: true, bookingNumber: "TW400", duplicate: false, contactBy: "email" } });
  form.dispatch("submit", eventFor());
  form.dispatch("submit", eventFor());
  await flush();
  assert.equal(api.fetches.length, 2);
  assert.equal(api.leads().length, 1);
  assert.equal(api.leads()[0][2].lead_type, "quote");
  assert.equal(saved(api).includes("private@example.com"), false);
  assert.equal(saved(api).includes("Window seat"), false);

  const code = fs.readFileSync("customer-app/src/savedLead.js", "utf8").replace("export function", "function");
  const portal = {};
  vm.runInNewContext(code + "\nthis.record = recordPortalLead;", portal);
  const portalPage = page("/portal");
  portal.record(portalPage.win.SpiresMeasurement, { ok: false });
  portal.record(portalPage.win.SpiresMeasurement, { ok: true, duplicate: true, bookingId: "same" });
  portal.record(portalPage.win.SpiresMeasurement, { ok: true });
  portal.record(portalPage.win.SpiresMeasurement, { ok: true, bookingId: "book1" });
  portal.record(portalPage.win.SpiresMeasurement, { ok: true, bookingId: "book1" });
  assert.equal(portalPage.leads().length, 1);
  assert.equal(String(portalPage.leads()[0][2].lead_type), "booking_request");
  assert.equal(String(portalPage.leads()[0][2].lead_channel), "portal");
});
