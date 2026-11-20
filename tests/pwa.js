/* PWA test, served like GitHub Pages under a subpath (/lolchess/):
   manifest parsed by Chrome, installability errors (CDP), service worker active, offline reload, all icons reachable. */
const { chromium } = require('playwright'); const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'); const BASE = '/lolchess/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (!u.startsWith(BASE)) { r.writeHead(404); return r.end(); }
  let f = path.join(ROOT, u.slice(BASE.length)); if (u.endsWith('/')) f = path.join(f, 'index.html');
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0, async () => {
  const url = `http://127.0.0.1:${srv.address().port}${BASE}`; const res = []; const ok = (n, c, d = '') => { res.push(c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(p);
  const man = await cdp.send('Page.getAppManifest');
  ok('manifest 로드·파싱 오류 없음', man.url && man.url.endsWith('manifest.webmanifest') && !(man.errors || []).length, (man.errors || []).map(e => e.message).join('; '));
  let inst = { installabilityErrors: [] }; try { inst = await cdp.send('Page.getInstallabilityErrors'); } catch (e) { inst.installabilityErrors = [{ errorId: 'cdp-unavailable:' + e.message }]; }
  ok('Chrome 설치 가능 판정 (installability errors 0)', !inst.installabilityErrors.length, inst.installabilityErrors.map(e => e.errorId).join(', '));
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const ic of m.icons) { const r = await p.request.get(url + ic.src); ok(`아이콘 ${ic.src} (${ic.purpose})`, r.ok()); }
  ok('서비스 워커 활성', await p.evaluate(async () => !!(await navigator.serviceWorker.ready).active));
  const cached = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('tft-lab-'))); return (await c.keys()).length; });
  ok('앱 셸 사전 캐시', cached >= 20, cached + ' files');
  await p.reload(); await p.waitForTimeout(500);
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(800);
  ok('오프라인 새로고침 동작', await p.evaluate(() => !!(window.TL && TL.state) && document.querySelector('#view-dashboard').innerText.includes('Dashboard')));
  await p.goto(url + 'index.html#sim'); await p.waitForTimeout(600);
  ok('오프라인 바로가기 URL (#sim)', await p.evaluate(() => TL.current === 'sim'));
  await ctx.setOffline(false);
  ok('JS 오류 없음', !errs.length, errs.join(' | '));
  console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); await b.close(); srv.close(); process.exit(res.every(Boolean) ? 0 : 1);
});
