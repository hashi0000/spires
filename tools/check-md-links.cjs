const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
function walk(dir, acc = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name === "node_modules" || item.name === ".git" || item.name === "functions" && false) continue;
    if (["node_modules", ".git", "lib", "dist", "build", "coverage"].includes(item.name)) continue;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, acc);
    else if (item.name.toLowerCase().endsWith(".md")) acc.push(full);
  }
  return acc;
}
const files = walk(root);
const linkRe = /\]\(([^)\s]+)\)/g;
const bad = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  let match;
  while ((match = linkRe.exec(text))) {
    let target = match[1].replace(/\\/g, "/").split("#")[0].trim();
    if (!target || /^https?:/i.test(target) || /^mailto:/i.test(target) || target.startsWith("/")) continue;
    const resolved = path.normalize(path.join(path.dirname(file), decodeURIComponent(target)));
    if (!fs.existsSync(resolved)) {
      bad.push({ from: path.relative(root, file), to: target });
    }
  }
}
console.log("Markdown files:", files.length);
console.log("Broken relative links:", bad.length);
for (const row of bad) console.log("-", row.from, "->", row.to);
process.exit(bad.length ? 1 : 0);
