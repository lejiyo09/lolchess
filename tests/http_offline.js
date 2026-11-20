/* GitHub Pages mode: serve over HTTP, check load, then go offline and reload (service worker cache). */
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html'; if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(0, async () => {
  const port = srv.address().port; const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html`); await p.waitForTimeout(800);
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  await p.reload(); await p.waitForTimeout(500);
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(800);
  const offlineOk = await p.evaluate(() => !!(window.TL && TL.state && document.querySelector('#view-dashboard').innerText.includes('Dashboard')));
  console.log(JSON.stringify({ http: true, serviceWorker: sw, offlineReload: offlineOk, errors: errs }));
  await b.close(); srv.close(); process.exit(sw && offlineOk && !errs.length ? 0 : 1);
});
