function flag(name) {
  return String(process.env[name] || "false").toLowerCase() === "true";
}

module.exports = (req, res) => {
  const enabled = flag("SPIRES_SHARE_HOMEPAGE") && flag("SPIRES_SHARE_ENABLED") && flag("SPIRES_SHARE_PILOT");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (!enabled) {
    res.statusCode = 404;
    res.end(JSON.stringify({ enabled: false }));
    return;
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ enabled: true, listUrl: "https://us-central1-spires-taxis.cloudfunctions.net/spiresSharePublicList" }));
};
