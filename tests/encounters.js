/* Encounter system test: every Set 19 encounter starts a game correctly and its effect fires at the right time. */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; const res = [];
  const ok = (n, c, d = '') => { res.push(c); console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { TL.saveNow = () => {}; localStorage.clear(); }); await p.reload(); await p.waitForTimeout(500);
  const meta = await p.evaluate(() => ({ n: TL.data.encounters().length, sum: TL.data.encountersMeta().oddsSum, stage1: TL.data.rules().rounds.stage1, dmg4: TL.data.rules().stageDamage['4'], xp7: TL.data.rules().xpToNext['7'], seq: TL.data.rules().augmentTierSequences.length }));
  ok('Set 19 조우자 데이터 (25종, 확률 합 ≈100%)', meta.n === 25 && Math.abs(meta.sum - 100) < 0.2, JSON.stringify(meta));
  ok('Stage 1 = 조우자 + PvE 3 (1-1 회전초밥 없음)', meta.stage1.join() === 'encounter,pve,pve,pve');
  ok('Set 19 규칙: 4스테이지 피해 7, 7→8 XP 60, 증강 순서 18종', meta.dmg4 === 7 && meta.xp7 === 60 && meta.seq === 18);
  // every encounter: game starts at 1-1 encounter phase without errors and can advance
  const all = await p.evaluate(() => TL.data.encounters().map(e => e.id));
  const bad = [];
  for (const id of all) {
    const r = await p.evaluate(id => { try { TL.views.sim._api.newGame({ encounter: id }); const s = TL.state.sim; const ok1 = s.phase === 'encounter' && s.enc.id === id && s.augPlan.every(t => ['Silver', 'Gold', 'Prismatic'].includes(t)); TL.views.sim._api.nextRound(); return ok1 && s.stage === 1 && s.round === 2 ? null : JSON.stringify({ ph: s.phase, plan: s.augPlan }); } catch (e) { return e.message; } }, id);
    if (r) bad.push(id + ':' + r);
  }
  ok(`모든 조우자로 게임 시작·진행 (${all.length}종)`, !bad.length, bad.join(' | '));
  const run = (fn, arg) => p.evaluate(fn, arg);
  // starting champion variants
  let r = await run(() => { const A = TL.views.sim._api; const out = {}; for (const [id, k] of [['2-cost-start', 'c2'], ['3-cost-start', 'c3'], ['upgraded-start', 'up']]) { A.newGame({ encounter: id }); const u = TL.state.sim.bench.find(Boolean); out[k] = [TL.data.champ(u.champ).cost, u.star]; } return out; });
  ok('시작 챔피언: 2/3 Cost Start, Upgraded Start(2성)', r.c2[0] === 2 && r.c3[0] === 3 && r.up[1] === 2, JSON.stringify(r));
  r = await run(() => { TL.views.sim._api.newGame({ encounter: 'prismatic-tour' }); const s = TL.state.sim; const us = s.bench.filter(Boolean).map(u => TL.data.champ(u.champ)); return { n: us.length, cost1: us.every(c => c.cost === 1), band: us.every(c => c.traits.some(t => ['Pentakill', 'Ionic Spark', 'True Damage', 'Heartsteel', 'K/DA'].includes(t))), uniq: new Set(us.map(c => c.id)).size, plan: s.augPlan }; });
  ok('Prismatic Tour: 서로 다른 1코스트 밴드 멤버 3 + 프리즘×3', r.n === 3 && r.cost1 && r.band && r.uniq === 3 && r.plan.join() === 'Prismatic,Prismatic,Prismatic', JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; const o = {}; for (const id of ['augment-crescendo', 'golden-prelude', 'prismatic-finale']) { A.newGame({ encounter: id }); o[id] = TL.state.sim.augPlan; } return o; });
  ok('증강 등급 조우자 (Crescendo S→G→P, Prelude 첫 골드, Finale 마지막 프리즘)', r['augment-crescendo'].join() === 'Silver,Gold,Prismatic' && r['golden-prelude'][0] === 'Gold' && r['prismatic-finale'][2] === 'Prismatic', JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'emblem-ensemble' }); const em = TL.state.sim.items.filter(i => TL.data.item(i)?.type === 'emblem').length; A.newGame({ encounter: 'component-anvils' }); const cp = TL.state.sim.items.filter(i => TL.data.item(i)?.type === 'component').length; A.newGame({ encounter: 'completed-item-anvil' }); const cm = TL.state.sim.items.filter(i => TL.data.item(i)?.type === 'completed').length; return { em, cp, cm }; });
  ok('시작 지급: 상징 3 · 재료 2 · 완성 1', r.em === 3 && r.cp === 2 && r.cm === 1, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'cheaper-levels' }); const s = TL.state.sim; s.level = 7; s.xp = 0; s.gold = 100; s.phase = 'planning'; for (let i = 0; i < 15; i++) A.buyXp(); return { lv: s.level, xp: s.xp, spent: 100 - s.gold }; });
  ok('Cheaper Levels: 7→8 = 58 XP (60−2)', r.lv === 8 && r.spent === 60 && r.xp === 2, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'gold-subscription' }); const s = TL.state.sim; const row = s.enc.goldRow; s.stage = 2; s.round = 7; s.phase = 'planning'; s.gold = 0; s.lastResult = null; s.streak = 0; A.nextRound(); return { row, gold: s.gold, r: s.stage + '-' + s.round }; });
  ok('Gold Subscription: 스테이지 시작 골드 (표의 행 기준)', r.r === '3-1' && r.gold === 5 + r.row[2], JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'reroll-subscription' }); const s = TL.state.sim; s.stage = 2; s.round = 7; s.phase = 'planning'; A.nextRound(); const f = s.freeRerolls; s.gold = 0; A.reroll(); return { f, after: s.freeRerolls, gold: s.gold }; });
  ok('Reroll Subscription: 스테이지 시작 무료 새로고침 (골드 소모 없음)', r.f > 0 && r.after === r.f - 1 && r.gold === 0, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'item-forge' }); const s = TL.state.sim; s.stage = 3; s.round = 2; s.phase = 'planning'; const before = s.items.length; A.nextRound(); return { r: s.stage + '-' + s.round, got: s.items.length - before }; });
  ok('Item Forge: 3-3에 완성 아이템 2', r.r === '3-3' && r.got === 2, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'lucky-treasure' }); const s = TL.state.sim; s.stage = 3; s.round = 4; s.phase = 'carousel'; s.carousel = []; A.nextRound(); return { r: s.stage + '-' + s.round, radiant: s.items.filter(i => TL.data.item(i)?.type === 'radiant').length }; });
  ok('Lucky Treasure: 3-5에 찬란한 아이템', r.r === '3-5' && r.radiant === 1, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'gwens-gifts' }); const s = TL.state.sim; const got = []; for (let k = 0; k < 3; k++) { s.stage = 2 + k; s.round = 4; s.phase = 'carousel'; s.bench = Array(9).fill(null); const c = TL.data.champs().find(x => x.cost === 1); s.carousel = [{ champ: c.id, item: 'b-f-sword' }]; const n0 = s.items.length; A.pickCarousel(0); got.push(s.items.length - n0); } return got; });
  ok("Gwen's Gifts: 처음 2번의 회전초밥 후에만 재료 추가", r.join() === '2,2,1', JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'beat-drop' }); const s = TL.state.sim; s.stage = 4; s.round = 2; s.phase = 'planning'; s.hp = 50; const g0 = s.gold, i0 = s.items.length, b0 = s.bench.filter(Boolean).length; A.resolvePvp(false, 5, { me: 1, opp: 1, pWin: .5 }); const first = { hp: s.hp, got: (s.gold - g0) + (s.items.length - i0) + (s.bench.filter(Boolean).length - b0), done: s.enc.beatDone }; return first; });
  ok('Beat Drop: 체력 40 이하가 되면 1회 보상', r.hp <= 40 && r.done === true && r.got > 0, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'superstar' }); const s = TL.state.sim; const id = s.enc.startingChamp; A.nextRound(); for (let k = 0; k < 2; k++) { s.phase = 'planning'; A.fight(); } const copies = [...s.board, ...s.bench.filter(Boolean)].filter(u => u.champ === id).reduce((a, u) => a + (u.star === 2 ? 3 : u.star === 3 ? 9 : 1), 0); return { copies, combats: s.enc.combats }; });
  ok('Superstar: 전투 2회마다 시작 챔피언 복사본', r.combats === 2 && r.copies === 2, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'star-attraction' }); const s = TL.state.sim; const u = s.bench.find(x => x && x.lockedUntil); s.phase = 'planning'; s.level = 9; A.moveUnit(u.id, { zone: 'board', pos: 10 }); const early = s.board.includes(u); s.stage = 4; s.round = 6; A.moveUnit(u.id, { zone: 'board', pos: 10 }); return { cost: TL.data.champ(u.champ).cost, item: u.items.length, early, later: s.board.includes(u) }; });
  ok('Star Attraction: 5코스트 + 아이템, 4-6 전 배치 불가', r.cost === 5 && r.item === 1 && !r.early && r.later, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; A.newGame({ encounter: 'scouting-party' }); return TL.state.sim.augRerollsMax; });
  ok('Scouting Party: 증강 새로고침 +1', r === 2, 'max=' + r);
  r = await run(() => { const A = TL.views.sim._api; const n = 3000; const c = {}; for (let i = 0; i < n; i++) { A.newGame({}); const e = TL.state.sim.enc.id; c[e] = (c[e] || 0) + 1; } const top = TL.data.encounters()[0]; return { share: c[top.id] / n, odds: top.odds / 100, kinds: Object.keys(c).length }; });
  ok('무작위 조우자: 실제 등장 확률대로 (최다 조우자 비율 근사)', Math.abs(r.share - r.odds) < 0.025 && r.kinds >= 20, JSON.stringify(r));
  r = await run(() => { const A = TL.views.sim._api; const n = 4000; let g = 0, sv = 0, pr = 0; for (let i = 0; i < n; i++) { A.newGame({ encounter: 'scouting-party' }); const t = TL.state.sim.augPlan[0]; if (t === 'Gold') g++; else if (t === 'Silver') sv++; else pr++; } return { g: g / n, s: sv / n, p: pr / n }; });
  ok('첫 증강 등급 분포 ≈ 골드 65.1% · 실버 25.7% · 프리즘 9.2%', Math.abs(r.g - 0.651) < 0.03 && Math.abs(r.s - 0.257) < 0.03 && Math.abs(r.p - 0.092) < 0.02, JSON.stringify(r));
  ok('JS 오류 없음', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(`\n${res.filter(Boolean).length}/${res.length} passed`); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})();
