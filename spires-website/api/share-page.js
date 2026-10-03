const fs = require("fs");
const path = require("path");

function flag(name) {
  return String(process.env[name] || "false").toLowerCase() === "true";
}

module.exports = (req, res) => {
  const enabled = flag("SPIRES_SHARE_ENABLED") && flag("SPIRES_SHARE_PILOT");
  const file = enabled ? "share.html" : "404.html";
  const html = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  res.statusCode = enabled ? 200 : 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!enabled) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  }
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
};
