const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html'));
  await p.waitForTimeout(800);
  for (const v of ['dashboard', 'builder', 'sim', 'augments', 'scout', 'drill', 'records', 'settings']) {
    await p.click(`#nav button[data-view="${v}"]`); await p.waitForTimeout(250);
    const txt = await p.$eval('#view-' + v, e => e.innerText.slice(0, 80).replace(/\n/g, ' | '));
    const bad = await p.$eval('#view-' + v, e => !!e.querySelector('.notice.red') && e.innerText.includes('오류'));
    console.log(v, bad ? 'RENDER-ERROR' : 'ok', '-', txt);
    await p.screenshot({ path: path.resolve(__dirname, `shots/${v}.png`) });
  }
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await b.close();
})();
