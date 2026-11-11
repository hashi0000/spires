import http from "http";
import fs from "fs";
import path from "path";

const root = process.cwd();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const candidates = [];
  if (clean.endsWith("/")) candidates.push(clean + "index.html");
  else {
    candidates.push(clean);
    if (!path.extname(clean)) candidates.push(clean + ".html");
  }
  for (const candidate of candidates) {
    const file = path.normalize(path.join(root, candidate.replace(/^\//, "")));
    if (!file.startsWith(root)) continue;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}

http.createServer((req, res) => {
  const file = fileFor(req.url || "/");
  if (!file) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(8910, "127.0.0.1", () => {
  console.log("preview http://127.0.0.1:8910/");
});
