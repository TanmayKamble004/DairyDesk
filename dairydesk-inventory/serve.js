/**
 * Tiny static server so the dashboard runs on a real port instead of file://.
 * No dependencies — plain Node.
 *
 *   node serve.js          -> http://localhost:8080
 *   node serve.js 3000     -> http://localhost:3000
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.argv[2]) || 8080;
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split("?")[0]);
    if (rel === "/") rel = "/index.html";

    // Keep requests inside this folder.
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(body);
    });
  })
  .listen(PORT, () => {
    console.log(`\n  DairyDesk Inventory running at:\n`);
    console.log(`  ➜  http://localhost:${PORT}\n`);
    console.log(`  Press Ctrl+C to stop.\n`);
  });
