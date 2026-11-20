/* Data-agnostic check of the CURRENT data/ (run after every data update):
   validator, every menu renders, a full simulator game completes, builder/augment/drill basics, no JS errors. */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = []; const res = [];
  const ok = (n, c, d = '') => { res.push(c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { TL.saveNow = () => {}; localStorage.clear(); }); await p.reload(); await p.waitForTimeout(500);
  const v = await p.evaluate(() => { const r = TL.data.validate(TL.data.bundle()); const pi = TL.data.patch(); return { e: r.errors, w: r.warnings.length, ch: TL.data.champs().length, tr: TL.data.traits().length, au: TL.data.augs().length, it: TL.data.items().length, ver: pi.dataVersion, patch: pi.currentDataPatch, status: TL.data.bundle().champions.meta.status }; });
  ok('데이터 검증 오류 0', !v.e.length, v.e.slice(0, 5).join('; '));
  console.log('INFO', JSON.stringify(v));
  for (const view of ['dashboard', 'builder', 'sim', 'augments', 'scout', 'drill', 'records', 'settings']) { await p.evaluate(x => TL.go(x), view); await p.waitForTimeout(80); ok(`메뉴 렌더: ${view}`, !(await p.isVisible('.notice.red:has-text("화면을 그리는 중 오류")'))); }
  await p.evaluate(() => TL.go('builder'));
  const ids = await p.$$eval('#bRoster [data-champ]', e => e.slice(0, 6).map(x => x.dataset.champ));
  for (const id of ids) await p.click(`#bRoster [data-champ="${id}"]`);
  ok('팀 빌더 배치 + 특성 집계', await p.evaluate(() => TL.state.builder.board.length > 0 && TL.engine.traits(TL.state.builder.board).length > 0));
  ok('모든 아이템 조합법 해석 가능', await p.evaluate(() => TL.data.items().filter(i => i.recipe && i.recipe.length === 2).every(i => TL.data.combine(i.recipe[0], i.recipe[1]))));
  await p.evaluate(() => TL.go('sim')); await p.click('#ngStart');
  for (let i = 0; i < 80; i++) {
    const ph = await p.evaluate(() => TL.state.sim.phase); if (ph === 'over') break;
    if (ph === 'carousel') await p.click('[data-car="0"]');
    else if (ph === 'augment') { await p.click('[data-augt=""]'); await p.click('[data-aug]'); }
    else { await p.evaluate(() => { const s = TL.state.sim; s.shop.forEach((c, k) => { if (c && s.gold >= 10) TL.views.sim._api.buy(k); }); }); await p.click('#sFight'); }
    await p.waitForTimeout(15);
  }
  const sim = await p.evaluate(() => ({ ph: TL.state.sim.phase, pl: TL.state.sim.placement, r: TL.state.sim.stage + '-' + TL.state.sim.round }));
  ok('시뮬레이터 1게임 완주', sim.ph === 'over' && sim.pl >= 1, JSON.stringify(sim));
  await p.click('#modalClose').catch(() => {});
  ok('상점 후보 챔피언 존재', await p.evaluate(() => TL.data.champs().some(c => c.cost <= 5 && !c.unlock)));
  await p.evaluate(() => TL.go('augments')); await p.click('#aRoll'); ok('증강 선택지 생성', (await p.$$('[data-pickaug]')).length === 3);
  await p.evaluate(() => TL.go('drill')); await p.click('[data-mode="gen"]'); await p.waitForTimeout(300); ok('상황 생성기 동작', (await p.$$('[data-gans]')).length >= 3);
  ok('JS 오류 없음', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
