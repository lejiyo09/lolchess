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
    else if (ph === 'encounter') await p.click('#sEncGo');
    else if (ph === 'augment') { if (!(await p.$('[data-aug]'))) await p.click('[data-augt=""]'); await p.click('[data-aug]'); }
    else { await p.evaluate(() => { const s = TL.state.sim; s.shop.forEach((c, k) => { if (c && s.gold >= 10) TL.views.sim._api.buy(k); }); }); await p.click('#sFight'); }
    await p.waitForTimeout(15);
  }
  const sim = await p.evaluate(() => ({ ph: TL.state.sim.phase, pl: TL.state.sim.placement, r: TL.state.sim.stage + '-' + TL.state.sim.round }));
  ok('시뮬레이터 1게임 완주', sim.ph === 'over' && sim.pl >= 1, JSON.stringify(sim));
  await p.click('#modalClose').catch(() => {});
  ok('상점 후보 챔피언 존재', await p.evaluate(() => TL.data.champs().some(c => c.cost <= 5 && !c.unlock)));
  await p.evaluate(() => TL.go('augments')); await p.click('#aRoll'); ok('증강 선택지 생성', (await p.$$('[data-pickaug]')).length === 3);
  await p.evaluate(() => TL.go('drill')); await p.click('[data-mode="gen"]'); await p.waitForTimeout(300); ok('상황 생성기 동작', (await p.$$('[data-gans]')).length >= 3);
  // meta comps (optional data file)
  const mc = await p.evaluate(() => { const M = TL.data.meta(); if (!M) return null; const badU = [], badI = []; M.comps.forEach(c => c.units.forEach(u => { if (!TL.data.champ(u.champ)) badU.push(u.champ); u.items.forEach(i => { if (!TL.data.item(i)) badI.push(i); }); })); return { n: M.comps.length, badU, badI }; });
  if (mc) {
    ok('메타 덱: 유닛·아이템 ID 모두 데이터와 일치', !mc.badU.length && !mc.badI.length, `${mc.n}개 · 불일치 유닛 ${mc.badU.slice(0, 5)} 아이템 ${mc.badI.slice(0, 5)}`);
    await p.evaluate(() => TL.go('meta')); await p.waitForTimeout(150);
    const cards = (await p.$$('.mc')).length; ok('메타 덱 메뉴 렌더', cards > 0, cards + ' cards');
    await p.selectOption('#mTier', 'S'); await p.waitForTimeout(150);
    ok('메타 덱 등급 필터', await p.evaluate(() => [...document.querySelectorAll('.mc-tier')].every(e => e.textContent.trim() === 'S')));
    await p.click('[data-open]'); await p.waitForTimeout(100); ok('메타 덱 상세 열기', (await p.$$('.mc-detail')).length === 1);
    await p.click('[data-load]'); await p.click('#modalFoot button:has-text("불러오기")'); await p.waitForTimeout(300);
    ok('메타 덱 → 팀 빌더 불러오기', await p.evaluate(() => TL.current === 'builder' && TL.state.builder.board.length >= 5 && new Set(TL.state.builder.board.map(u => u.pos)).size === TL.state.builder.board.length));
  }
  ok('챔피언 초상화 에셋 (현재 데이터 전체)', await p.evaluate(() => TL.data.champs().every(c => TL.img.champ(c.id))));
  ok('JS 오류 없음', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
