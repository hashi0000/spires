const fs = require("fs");
const path = require("path");
const https = require("https");

function flag(name) {
  return String(process.env[name] || "false").toLowerCase() === "true";
}

function eventSlugFromUrl(url) {
  const match = String(url || "").match(/\/share\/event\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function fetchEvents() {
  return new Promise((resolve) => {
    const req = https.get("https://us-central1-spires-taxis.cloudfunctions.net/spiresSharePublicList", { timeout: 2500 }, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve(Array.isArray(data.events) ? data.events : []);
        } catch (err) {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.on("timeout", () => {
      req.destroy();
      resolve([]);
    });
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function injectEventMeta(html, event) {
  if (!event) return html;
  const venue = event.venueName || event.destinationRegion || "event";
  const title = `${event.eventName || venue} | Oxford to ${venue} | Spires Share`;
  const fare = event.outboundFarePence ? `£${(Number(event.outboundFarePence) / 100).toFixed(0)} per passenger. ` : "";
  const description = `Oxford → ${venue}. ${event.eventDate || event.travelDate || ""} ${fare}Maximum five passengers. Register interest with Spires Share.`.trim();
  const url = `https://www.spires-taxis.com/share/event/${event.eventSlug}`;
  return html
    .replace("<title>Spires Share | Shared journeys from Oxford</title>", `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
}

module.exports = async (req, res) => {
  const enabled = flag("SPIRES_SHARE_ENABLED") && flag("SPIRES_SHARE_PILOT");
  const slug = eventSlugFromUrl(req.url);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (!enabled) {
    const html = fs.readFileSync(path.join(process.cwd(), "share.html"), "utf8");
    res.statusCode = 200;
    res.end(html);
    return;
  }

  if (slug) {
    const events = await fetchEvents();
    const event = events.find((row) => row.eventSlug === slug);
    if (!event) {
      const html = fs.readFileSync(path.join(process.cwd(), "404.html"), "utf8");
      res.statusCode = 404;
      res.setHeader("X-Robots-Tag", "noindex, follow");
      res.end(html);
      return;
    }
    const html = injectEventMeta(
      fs.readFileSync(path.join(process.cwd(), "share.html"), "utf8"),
      event
    );
    res.statusCode = 200;
    res.end(html);
    return;
  }

  const html = fs.readFileSync(path.join(process.cwd(), "share.html"), "utf8");
  res.statusCode = 200;
  res.end(html);
};
