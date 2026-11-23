/* Functional test suite — run: node tests/functional.js  (uses the preinstalled Playwright + Chromium)
   Drives the real UI over file:// (same as double-clicking index.html). */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
// App-logic tests run on a frozen fixture (snapshot of data/ incl. Set 19 PBE rules) so they stay deterministic when data/ is updated from PBE/live.
// USE_FIXTURE=0 runs them against the current data/. The current data itself is checked by tests/data_check.js.
const os = require('os');
const APP = (() => {
  if (process.env.USE_FIXTURE === '0') return path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tftlab-'));
  for (const f of ['index.html', 'css', 'js', 'legacy', 'assets']) fs.cpSync(path.resolve(__dirname, '..', f), path.join(dir, f), { recursive: true });
  fs.mkdirSync(path.join(dir, 'data')); fs.copyFileSync(path.resolve(__dirname, 'fixtures/bundle.fixture.js'), path.join(dir, 'data/bundle.js'));
  return dir;
})();
const URL = 'file://' + path.join(APP, 'index.html');
const OUT = path.resolve(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const results = []; let page, ctx, browser; const errors = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const S = (fn, arg) => page.evaluate(fn, arg);
const go = async v => { await page.click(`#nav button[data-view="${v}"]`); await page.waitForTimeout(120); };
const dnd = (src, dst) => page.evaluate(([a, b]) => { const s = document.querySelector(a), d = document.querySelector(b); if (!s || !d) throw new Error('dnd target missing ' + (!s ? a : b)); const dt = new DataTransfer(); s.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); d.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); d.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); }, [src, dst]).then(() => page.waitForTimeout(60));
const closeModal = async () => { if (await page.isVisible('#modal.show')) { await page.click('#modalClose'); await page.waitForTimeout(80); } };
const modalBtn = async label => { await page.click(`#modalFoot button:has-text("${label}")`); await page.waitForTimeout(150); };

(async () => {
  browser = await chromium.launch();
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  /* ---------- 0. legacy v0.1.0 migration ---------- */
  await page.goto(URL); await page.waitForTimeout(400);
  await S(() => { TL.saveNow = () => {}; localStorage.clear(); localStorage.setItem('tftLab19', JSON.stringify({ board: [{ id: 'u1', champId: 'c0', star: 2, items: ['Infinity Edge'], pos: 3 }], boardCap: 7, comps: [{ id: 1, name: '옛 조합', board: [{ id: 'u2', champId: 'c49', star: 1, items: [], pos: 24 }], cap: 8, created: '2026-11-16T00:00:00Z' }], scrims: [{ date: '2026-11-16', patch: '19.1', place: 3, score: 6, lobby: '연습', note: '테스트' }], augmentHistory: [{ name: 'Backup Bows', tier: 'Silver', stage: '2-1', date: 'x', reason: 'r' }], checklist: [true, false, false, false], eventDate: '2026-12-19', scoreMap: [8, 7, 6, 5, 4, 3, 2, 1] })); });
  await page.reload(); await page.waitForTimeout(500);
  const mig = await S(() => ({ comps: TL.state.comps.length, compChamp: TL.state.comps[0]?.board[0]?.champ, board: TL.state.builder.board[0], games: TL.state.records.games.length, place: TL.state.records.games[0]?.myPlace, aug: TL.state.augLab.history.length, date: TL.state.settings.eventDate, ck: TL.state.checklist[0].d }));
  ok('v0.1.0 저장 데이터 마이그레이션', mig.comps === 1 && mig.compChamp === 'ahri' && mig.board?.champ === 'elise' && mig.board?.items[0] === 'infinity-edge' && mig.games === 1 && mig.place === 3 && mig.aug === 1 && mig.date === '2026-12-19' && mig.ck, JSON.stringify(mig));
  // fresh start for the rest
  await S(() => { TL.saveNow = () => {}; localStorage.clear(); indexedDB.deleteDatabase('tftLab19'); }); await page.reload(); await page.waitForTimeout(500);

  /* ---------- 1. data validation ---------- */
  const val = await S(() => { const v = TL.data.validate(TL.data.bundle()); const b = TL.data.bundle(); return { e: v.errors, w: v.warnings.length, ch: b.champions.champions.length, tr: b.traits.traits.length, au: b.augments.augments.length, it: b.items.items.length, metaOk: TL.DATA_FILES.slice(1).every(f => ['set', 'patch', 'source', 'updated', 'status'].every(k => b[f].meta && b[f].meta[k] !== undefined)) }; });
  ok('내장 데이터 검증 오류 0', val.e.length === 0, val.e.join('; '));
  ok('데이터 규모 (챔피언 94/특성 47/증강 330+)', val.ch === 94 && val.tr === 47 && val.au >= 330, JSON.stringify(val));
  ok('모든 데이터 파일 meta(set/patch/source/updated/status)', val.metaOk);
  const dataFacts = await S(() => ({ kda: TL.data.trait('K/DA').countMode, td: TL.data.trait('True Damage').tiers.map(t => t.min), collab: TL.data.trait('Collab').type, odds8: TL.data.odds().odds['8'].join('/'), xp8: TL.data.rules().xpToNext['8'], ie: TL.data.combine('b-f-sword', 'sparring-gloves')?.name, kr: TL.data.combine('recurve-bow', 'negatron-cloak')?.name }));
  ok('데이터 고증 포인트 (K/DA 별합, True Damage 3/5, Collab 순환, Lv8 확률, XP, 조합법)', dataFacts.kda === 'stars' && dataFacts.td.join() === '3,5' && dataFacts.collab === 'rotating' && dataFacts.odds8 === '15/20/32/30/3' && dataFacts.xp8 === 68 && dataFacts.ie === 'Infinity Edge' && dataFacts.kr === "Kraken's Fury", JSON.stringify(dataFacts));

  /* ---------- 2. Team Builder ---------- */
  await go('builder');
  await page.click('#bRoster [data-champ="ziggs"]');
  await page.click('#bRoster [data-champ="zoe"]');
  let tb = await S(() => TL.state.builder.board.map(u => [u.champ, u.pos]));
  ok('클릭으로 챔피언 배치', tb.length === 2 && tb[0][1] === 0 && tb[1][1] === 1, JSON.stringify(tb));
  await page.dragAndDrop('#bRoster [data-champ="annie"]', '#bBoard .hex[data-pos="24"]');
  tb = await S(() => TL.state.builder.board.find(u => u.champ === 'annie')?.pos);
  ok('로스터 → 보드 드래그 앤 드롭', tb === 24, 'pos=' + tb);
  await page.dragAndDrop('#bBoard .hex[data-pos="0"]', '#bBoard .hex[data-pos="1"]');
  tb = await S(() => Object.fromEntries(TL.state.builder.board.map(u => [u.champ, u.pos])));
  ok('보드 내 이동(스왑)', tb.ziggs === 1 && tb.zoe === 0, JSON.stringify(tb));
  await page.dragAndDrop('#bBoard .hex[data-pos="24"]', '#bBench .slot[data-slot="2"]');
  tb = await S(() => ({ bench: TL.state.builder.bench[2]?.champ, onBoard: TL.state.builder.board.some(u => u.champ === 'annie') }));
  ok('보드 → 대기석 이동', tb.bench === 'annie' && !tb.onBoard, JSON.stringify(tb));
  await page.dragAndDrop('#bBench .slot[data-slot="2"]', '#bBoard .hex[data-pos="10"]');
  tb = await S(() => TL.state.builder.board.find(u => u.champ === 'annie')?.pos);
  ok('대기석 → 보드 이동', tb === 10);
  // click-select move
  await S(() => { TL.state.builder.selected = null; TL.views.builder.render(); });
  await page.click('#bBoard .hex[data-pos="10"]'); await page.click('#bBoard .hex[data-pos="20"]');
  tb = await S(() => TL.state.builder.board.find(u => u.champ === 'annie')?.pos);
  ok('클릭 선택 후 이동 (터치 대체 조작)', tb === 20);
  // traits: Arcanist Ziggs+Zoe+Annie = 3 (tiers 2/4/6 -> active 2)
  let tr = await S(() => { const x = TL.engine.traits(TL.state.builder.board).find(t => t.name === 'Arcanist'); return x && { c: x.count, a: x.active, txt: document.querySelector('#view-builder .traits').innerText.includes('Arcanist') }; });
  ok('특성 활성화 계산 (Arcanist 3 → 2단계 활성)', tr && tr.c === 3 && tr.a === 0 && tr.txt, JSON.stringify(tr));
  // duplicate champ counts once
  await page.click('#bRoster [data-champ="ziggs"]');
  tr = await S(() => TL.engine.traits(TL.state.builder.board).find(t => t.name === 'Arcanist').count);
  ok('같은 챔피언 중복은 특성 1회만 집계', tr === 3, 'count=' + tr);
  // K/DA counts star levels: Lillia 2★ + Neeko 1★ = 3 → POP/STARS active
  await S(() => { const B = TL.state.builder; B.board.push({ id: 'k1', champ: 'lillia', star: 2, items: [], pos: 14 }, { id: 'k2', champ: 'neeko', star: 1, items: [], pos: 15 }); TL.save(); });
  tr = await S(() => { const x = TL.engine.traits(TL.state.builder.board).find(t => t.name === 'K/DA'); return [x.count, x.active]; });
  ok('K/DA 총 별 레벨 집계 (2★+1★=3 → 활성)', tr[0] === 3 && tr[1] === 0, JSON.stringify(tr));
  // level cap
  await page.selectOption('#bLevel', '3'); await page.waitForTimeout(100);
  const capTxt = await page.innerText('#view-builder');
  await page.click('#bRoster [data-champ="gnar"]');
  tb = await S(() => ({ n: TL.state.builder.board.length, benchGnar: TL.state.builder.bench.some(u => u && u.champ === 'gnar') }));
  ok('레벨별 배치 인원 제한 (Lv3 초과 시 대기석으로)', capTxt.includes('상한') && tb.benchGnar, JSON.stringify(tb));
  await page.selectOption('#bLevel', '8'); await page.waitForTimeout(100);
  // stars + items via UI: select ziggs (pos1), star up, equip components by drag → combine
  await S(() => { TL.state.builder.selected = null; TL.views.builder.render(); });
  await page.click('#bBoard .hex[data-pos="1"]');
  await page.click('#buUp'); await page.waitForTimeout(60);
  await page.click('[data-itab="component"]');
  await dnd('#bItems [data-item="b-f-sword"]', '#bBoard .hex[data-pos="1"]');
  await dnd('#bItems [data-item="sparring-gloves"]', '#bBoard .hex[data-pos="1"]');
  let it = await S(() => TL.state.builder.board.find(u => u.pos === 1));
  ok('별 레벨 설정', it.star === 2);
  ok('아이템 장착 + 재료 2개 자동 조합 (B.F.+장갑 = 무한의 대검)', it.items.length === 1 && it.items[0] === 'infinity-edge', JSON.stringify(it.items));
  await page.click('[data-itab="emblem"]');
  await dnd('#bItems [data-item="arcanist-emblem"]', '#bBoard .hex[data-pos="1"]');
  it = await S(() => TL.state.builder.board.find(u => u.pos === 1).items);
  ok('상징 장착 규칙 (이미 가진 특성의 상징은 거부)', !it.includes('arcanist-emblem'), JSON.stringify(it));
  await dnd('#bItems [data-item="rock-emblem"]', '#bBoard .hex[data-pos="1"]');
  tr = await S(() => TL.engine.traits(TL.state.builder.board).find(t => t.name === 'Rock')?.count);
  ok('상징으로 특성 추가 (Rock +1)', tr === 1);
  await page.click('[data-unequip="1"]');
  it = await S(() => TL.state.builder.board.find(u => u.pos === 1).items);
  ok('아이템 해제', it.length === 1 && it[0] === 'infinity-edge', JSON.stringify(it));
  await page.click('#buCarry');
  // unlock management
  await page.click('#bUnlockMode'); await page.click('#bRoster [data-champ="kobuko"]'); await page.click('#bUnlockMode');
  const unl = await S(() => TL.state.builder.unlocked.kobuko);
  ok('해금 챔피언 상태 관리', unl === true);
  // filters
  await page.selectOption('#bCost', '5'); await page.waitForTimeout(150);
  let n = await page.$$eval('#bRoster [data-champ]', e => e.length);
  ok('코스트 필터 (5코스트 19명)', n === 19, 'n=' + n);
  await page.selectOption('#bCost', 'all'); await page.selectOption('#bTrait', 'Pentakill'); await page.waitForTimeout(150);
  n = await page.$$eval('#bRoster [data-champ]', e => e.length);
  ok('특성 필터 (Pentakill 7명)', n === 7, 'n=' + n);
  await page.selectOption('#bTrait', 'all'); await page.selectOption('#bUnlock', 'unlocked'); await page.waitForTimeout(150);
  n = await page.$$eval('#bRoster [data-champ]', e => e.length);
  ok('해금 상태 필터 (해금 완료 1명)', n === 1, 'n=' + n);
  await page.selectOption('#bUnlock', 'all'); await page.fill('#bQ', '아리'); await page.waitForTimeout(300);
  n = await page.$$eval('#bRoster [data-champ]', e => e.map(x => x.dataset.champ));
  ok('한글 검색 (아리)', n.includes('ahri'), JSON.stringify(n));
  await page.fill('#bQ', ''); await page.waitForTimeout(300);
  // save comp
  await page.fill('#bName', '테스트 조합 A'); await page.fill('#bPros', '초반 강함'); await page.fill('#bCons', '후반 약함'); await page.fill('#bKey', '무한의 대검');
  await page.click('#bSave'); await page.waitForTimeout(100);
  const boardBefore = await S(() => TL.state.builder.board.length);
  await page.click('#bClear'); await modalBtn('비우기');
  let cnt = await S(() => TL.state.builder.board.length);
  await page.click('[data-load]'); await modalBtn('확인');
  const after = await S(() => ({ n: TL.state.builder.board.length, comp: TL.state.comps[0] }));
  ok('조합 저장 → 비우기 → 불러오기', cnt === 0 && after.n === boardBefore && after.comp.name === '테스트 조합 A' && after.comp.notes.pros === '초반 강함' && after.comp.keyItems === '무한의 대검', `before=${boardBefore} after=${after.n}`);
  // second comp + compare
  await page.click('[data-dup]'); await page.waitForTimeout(80);
  await page.check(`[data-cmp="${await S(() => TL.state.comps[0].id)}"]`); await page.waitForTimeout(80);
  await page.check(`[data-cmp="${await S(() => TL.state.comps[1].id)}"]`); await page.waitForTimeout(80);
  await page.click('#bCompare'); await page.waitForTimeout(150);
  const cmpTxt = await page.innerText('#modalBody');
  ok('여러 조합 비교', cmpTxt.includes('특성 비교') && cmpTxt.includes('공유 챔피언'));
  await closeModal();
  // snapshot before/after
  await page.click('#bSnap'); await page.dragAndDrop('#bBoard .hex[data-pos="0"]', '#bBoard .hex[data-pos="27"]');
  await page.click('#bSnapCmp'); await page.waitForTimeout(150);
  const moved = await page.$$eval('#snapB .hex.moved', e => e.length);
  ok('배치 변경 전후 비교 (이동 유닛 강조)', moved >= 1, 'moved=' + moved);
  await closeModal();
  // PNG export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bPng')]);
  const pngPath = path.join(OUT, 'board.png'); await dl.saveAs(pngPath);
  const sig = fs.readFileSync(pngPath).slice(1, 4).toString();
  ok('보드 이미지(PNG) 내보내기', sig === 'PNG' && fs.statSync(pngPath).size > 5000, fs.statSync(pngPath).size + ' bytes');
  // comp JSON export/import
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#bExport')]);
  const compPath = path.join(OUT, 'comp.json'); await dl2.saveAs(compPath);
  const compsBefore = await S(() => TL.state.comps.length);
  await page.setInputFiles('#bImport', compPath); await page.waitForTimeout(200);
  ok('조합 JSON 내보내기/가져오기', (await S(() => TL.state.comps.length)) === compsBefore + 1);

  /* ---------- 3. Game Simulator ---------- */
  await go('sim');
  await page.selectOption('#ngEnc', 'golden-gala');
  await page.click('#ngStart'); await page.waitForTimeout(150);
  let sm = await S(() => ({ ph: TL.state.sim.phase, r: TL.state.sim.stage + '-' + TL.state.sim.round, enc: TL.state.sim.enc?.id, plan: TL.state.sim.augPlan, bench: TL.state.sim.bench.filter(Boolean).map(u => TL.data.champ(u.champ).cost) }));
  ok('새 게임 1-1 조우자 (회전초밥 없음) + 시작 챔피언(1코스트)', sm.ph === 'encounter' && sm.r === '1-1' && sm.enc === 'golden-gala' && sm.bench.length === 1 && sm.bench[0] === 1, JSON.stringify(sm));
  ok('조우자 효과: Golden Gala → 증강 등급 순서 골드×3', JSON.stringify(sm.plan) === '["Gold","Gold","Gold"]', JSON.stringify(sm.plan));
  ok('조우자 화면 표시 (진행자 초상화·설명)', (await page.innerText('#view-sim')).includes('Golden Gala') && (await page.$$('.enc-card img.cp')).length >= 1);
  await page.click('#sEncGo'); await page.waitForTimeout(100);
  sm = await S(() => ({ r: TL.state.sim.stage + '-' + TL.state.sim.round, g: TL.state.sim.gold, bench: TL.state.sim.bench.filter(Boolean).length, items: TL.state.sim.items.length, lv: TL.state.sim.level }));
  ok('1-1 → 1-2, 기본 수입 2G (규칙)', sm.r === '1-2' && sm.g === 2 && sm.bench === 1 && sm.items === 0 && sm.lv === 1, JSON.stringify(sm));
  // round progression through stage 1 (PvE)
  for (let i = 0; i < 3; i++) { await page.click('#sFight'); await page.waitForTimeout(80); }
  sm = await S(() => ({ r: TL.state.sim.stage + '-' + TL.state.sim.round, lv: TL.state.sim.level, xp: TL.state.sim.xp, ph: TL.state.sim.phase, items: TL.state.sim.items.length }));
  ok('라운드 진행 1-2→2-1 + 패시브 XP (2-1에 Lv3 2/6)', sm.r === '2-1' && sm.lv === 3 && sm.xp === 2, JSON.stringify(sm));
  ok('2-1 증강 라운드 진입', sm.ph === 'augment');
  ok('PvE 전리품 지급(훈련 모델)', sm.items >= 3, 'items=' + sm.items);
  ok('증강 선택지 자동 제시 (미리 정해진 등급 순서)', (await page.$$('[data-aug]')).length === 3 && (await S(() => TL.state.sim.augTier)) === 'Gold');
  await page.fill('#sAugReason', '테스트 이유');
  const augId = await page.getAttribute('[data-aug]', 'data-aug');
  await page.click(`[data-aug="${augId}"]`); await page.waitForTimeout(100);
  sm = await S(() => ({ aug: TL.state.sim.augments[0], ph: TL.state.sim.phase, lab: TL.state.augLab.history[0] }));
  ok('증강체 선택 (시뮬레이터) + 증강 기록 연동', sm.aug?.id === augId && sm.aug.tier === 'Gold' && sm.ph === 'planning' && sm.lab?.reason === '테스트 이유', JSON.stringify(sm.aug));
  // gold/xp math: set a known state
  await S(() => { const s = TL.state.sim; s.gold = 30; s.level = 3; s.xp = 2; s.streak = 0; TL.save(); TL.views.sim.render(); });
  await page.click('#sXp'); await page.waitForTimeout(60);
  sm = await S(() => ({ g: TL.state.sim.gold, lv: TL.state.sim.level, xp: TL.state.sim.xp }));
  ok('XP 구매: 4G → 4XP, Lv3 2/6 → Lv4 0/10', sm.g === 26 && sm.lv === 4 && sm.xp === 0, JSON.stringify(sm));
  await page.keyboard.press('f'); await page.waitForTimeout(60);
  sm = await S(() => ({ g: TL.state.sim.gold, xp: TL.state.sim.xp }));
  ok('단축키 F (XP 구매)', sm.g === 22 && sm.xp === 4, JSON.stringify(sm));
  const shop1 = await S(() => TL.state.sim.shop.join());
  await page.click('#sRoll'); await page.waitForTimeout(60);
  sm = await S(() => ({ g: TL.state.sim.gold, shop: TL.state.sim.shop.join(), n: TL.state.sim.shop.filter(Boolean).length }));
  ok('상점 리롤: −2G, 5칸 새로 생성', sm.g === 20 && sm.n === 5 && sm.shop !== shop1, JSON.stringify(sm));
  await page.keyboard.press('d'); await page.waitForTimeout(60);
  ok('단축키 D (리롤)', (await S(() => TL.state.sim.gold)) === 18);
  // shop odds respected at level 4 (no 4/5-costs) over many rolls
  const oddsChk = await S(() => { const s = TL.state.sim; const save = TL.clone(s); let hi = 0, c = { 1: 0, 2: 0, 3: 0 }; for (let i = 0; i < 400; i++) { s.gold = 10; TL.views.sim._api.reroll(); s.shop.forEach(id => { const cost = TL.data.champ(id)?.cost; if (cost >= 4) hi++; else if (cost) c[cost]++; }); } TL.state.sim = save; TL.save(); TL.views.sim.render(); const tot = c[1] + c[2] + c[3]; return { hi, p1: c[1] / tot, p2: c[2] / tot, p3: c[3] / tot }; });
  ok('상점 확률 준수 (Lv4: 55/30/15, 4·5코스트 0)', oddsChk.hi === 0 && Math.abs(oddsChk.p1 - 0.55) < 0.05 && Math.abs(oddsChk.p2 - 0.30) < 0.05 && Math.abs(oddsChk.p3 - 0.15) < 0.04, JSON.stringify(oddsChk));
  // buy champion → bench, pool decrement; 3 copies merge
  const buy = await S(() => { const s = TL.state.sim; s.gold = 20; s.shop = ['ziggs', 'ziggs', 'ziggs', null, null]; s.bench = Array(9).fill(null); s.board = []; const p0 = s.pool.ziggs; TL.views.sim.render(); return p0; });
  await page.click('[data-buy="0"]'); await page.click('[data-buy="1"]');
  let mid = await S(() => ({ g: TL.state.sim.gold, n: TL.state.sim.bench.filter(Boolean).length }));
  await page.click('[data-buy="2"]'); await page.waitForTimeout(60);
  sm = await S(() => ({ g: TL.state.sim.gold, units: TL.state.sim.bench.filter(Boolean).map(u => u.champ + u.star), pool: TL.state.sim.pool.ziggs }));
  ok('챔피언 구매 (골드 차감·풀 감소)', mid.g === 18 && mid.n === 2 && sm.pool === buy - 3, JSON.stringify(mid));
  ok('3장 자동 합성 → 2성', sm.units.length === 1 && sm.units[0] === 'ziggs2', JSON.stringify(sm.units));
  // sell 2-star 1-cost = 3G full value
  const uid = await S(() => TL.state.sim.bench.find(Boolean).id);
  await page.click(`#sBench .slot[data-uid="${uid}"]`); await page.keyboard.press('e'); await page.waitForTimeout(60);
  sm = await S(() => ({ g: TL.state.sim.gold, pool: TL.state.sim.pool.ziggs, n: TL.state.sim.bench.filter(Boolean).length }));
  ok('챔피언 판매 (1코스트 2성 = 3G 전액, 풀 3장 반환)', sm.g === 20 && sm.pool === buy && sm.n === 0, JSON.stringify(sm));
  const sv = await S(() => [TL.engine.sellValue(3, 2), TL.engine.sellValue(4, 2), TL.engine.sellValue(4, 1), TL.engine.sellValue(2, 3)]);
  ok('판매가 규칙 (3코 2성 8 / 4코 2성 11 / 1성 전액 / 2코 3성 17)', sv.join() === '8,11,4,17', sv.join());
  // board placement in sim with cap
  await S(() => { const s = TL.state.sim; s.level = 4; s.bench = Array(9).fill(null); ['annie', 'lux', 'elise', 'zoe', 'taric'].forEach((c, i) => s.bench[i] = { id: 'b' + i, champ: c, star: 1, items: [] }); s.board = []; TL.views.sim.render(); });
  for (let i = 0; i < 5; i++) await page.dragAndDrop(`#sBench .slot[data-slot="${i}"]`, `#sBoard .hex[data-pos="${21 + i}"]`);
  sm = await S(() => ({ board: TL.state.sim.board.length, bench: TL.state.sim.bench.filter(Boolean).length }));
  ok('시뮬레이터 보드 배치 + 레벨 상한(Lv4 → 4명)', sm.board === 4 && sm.bench === 1, JSON.stringify(sm));
  // item combine in sim
  await S(() => { const s = TL.state.sim; s.items = ['needlessly-large-rod', 'needlessly-large-rod']; TL.views.sim.render(); });
  await dnd('#sItems [data-idx="0"]', '#sBoard .hex[data-pos="21"]');
  await dnd('#sItems [data-idx="0"]', '#sBoard .hex[data-pos="21"]');
  sm = await S(() => ({ items: TL.state.sim.board.find(u => u.pos === 21).items, left: TL.state.sim.items.length }));
  ok('시뮬레이터 아이템 조합 (지팡이+지팡이 = 라바돈)', sm.items[0] === 'rabadons-deathcap' && sm.left === 0, JSON.stringify(sm));
  // income math: interest + streak + passive + win
  const inc = await S(() => { const s = TL.state.sim; s.stage = 3; s.round = 1; s.gold = 47; s.streak = 5; s.phase = 'planning'; const before = s.gold; TL.views.sim._api.resolvePvp(true, 0, { me: 1, opp: 1, pWin: .5 }); return { before, after: TL.state.sim.gold, r: TL.state.sim.stage + '-' + TL.state.sim.round, streak: TL.state.sim.streak, last: TL.state.sim.log.find(l => l.type === 'gold').t }; });
  // 3-1 win: streak 6 → +3, interest 4 (47G), passive 5 (3-2), win +1 = 13
  ok('라운드 수입 계산 (기본5 + 이자4 + 6연승3 + 승리1 = 13)', inc.after - inc.before === 13 && inc.r === '3-2' && inc.streak === 6, JSON.stringify(inc));
  const dmg = await S(() => { const s = TL.state.sim; s.phase = s.phase === 'augment' ? 'planning' : s.phase; s.stage = 4; s.round = 3; s.hp = 60; s.streak = 2; s.gold = 10; TL.views.sim._api.resolvePvp(false, 5, { me: 1, opp: 1, pWin: .5 }); return { hp: TL.state.sim.hp, streak: TL.state.sim.streak }; });
  ok('패배 피해 (Set 19: 4스테이지 기본 7 + 생존 5 = 12), 연승 → 연패 전환', dmg.hp === 48 && dmg.streak === -1, JSON.stringify(dmg));
  // carousel at x-4
  sm = await S(() => ({ ph: TL.state.sim.phase, r: TL.state.sim.stage + '-' + TL.state.sim.round }));
  ok('4-4 회전초밥 라운드 진입', sm.ph === 'carousel' && sm.r === '4-4', JSON.stringify(sm));
  await page.click('[data-car="0"]');
  // checkpoint note + manual combat mode
  await S(() => { TL.state.sim.combatMode = 'manual'; TL.views.sim.render(); });
  await page.click('#sFight'); await page.waitForTimeout(100);
  await page.fill('#mSurv', '3'); await modalBtn('패배');
  sm = await S(() => TL.state.sim.history.at(-1));
  ok('수동 전투 결과 입력 (패배, 생존 3 → 7+3=10 피해)', sm.result === 'loss' && sm.dmg === 10, JSON.stringify(sm));
  // round-start rewind
  const g0 = await S(() => TL.state.sim.gold);
  await S(() => { TL.state.sim.gold += 0; }); await page.click('#sRoll').catch(() => { });
  await page.click('#sRestart'); await modalBtn('확인');
  ok('라운드 시작 상태로 되돌리기', (await S(() => TL.state.sim.gold)) === g0);
  // play to game over quickly with auto mode
  await S(() => { TL.state.sim.combatMode = 'auto'; TL.state.sim.hp = 3; TL.views.sim.render(); });
  for (let i = 0; i < 40 && (await S(() => TL.state.sim.phase)) !== 'over'; i++) {
    const ph = await S(() => TL.state.sim.phase);
    if (ph === 'carousel') await page.click('[data-car="0"]'); else if (ph === 'encounter') await page.click('#sEncGo'); else if (ph === 'augment') { if (!(await page.$('[data-aug]'))) await page.click('[data-augt=""]'); await page.click('[data-aug]'); } else await page.click('#sFight');
    await page.waitForTimeout(40);
  }
  sm = await S(() => ({ ph: TL.state.sim.phase, pl: TL.state.sim.placement, hist: TL.state.simHistory.length }));
  ok('게임 종료 → 순위·복기 저장', sm.ph === 'over' && sm.pl >= 1 && sm.pl <= 8 && sm.hist === 1, JSON.stringify(sm));
  const rv = await page.innerText('#modalBody').catch(() => '');
  ok('복기 화면 (레벨 타이밍·PvP 기록)', rv.includes('레벨 타이밍') && rv.includes('PvP 결과'));
  await closeModal();
  // scenario start
  await page.click('#sNew2'); await page.click('[data-preset]'); await page.click('#scStart'); await page.waitForTimeout(100);
  sm = await S(() => ({ r: TL.state.sim.stage + '-' + TL.state.sim.round, hp: TL.state.sim.hp, lv: TL.state.sim.level, board: TL.state.sim.board.length }));
  ok('상황 시나리오 시작 (3-2 표준)', sm.r === '3-2' && sm.hp === 70 && sm.lv === 5 && sm.board >= 3, JSON.stringify(sm));
  // rolldown calculator
  await page.click('#sCalcRun'); await page.waitForTimeout(300);
  ok('롤다운 확률 계산기', /확보 확률/.test(await page.innerText('#sCalcOut')));

  /* ---------- 4. Augment Lab ---------- */
  await go('augments');
  await page.click('#aRoll'); await page.waitForTimeout(80);
  let offers = await page.$$eval('[data-pickaug]', e => e.length);
  await page.click('[data-pickaug]'); await page.waitForTimeout(80);
  const scoreShown = await page.$$eval('#aBody .bar', e => e.length);
  await page.fill('#aReason', '경제 우선'); await page.click('#aSave'); await page.waitForTimeout(80);
  const ah = await S(() => TL.state.augLab.history[0]);
  ok('증강 선택 연습 (3개 → 선택 → 적합도 공개 → 기록)', offers === 3 && scoreShown === 3 && ah.reason === '경제 우선' && ah.scores.length === 3, `offers=${offers} bars=${scoreShown}`);
  const ev = await S(() => { const a = TL.data.augs().find(x => x.categories.includes('econ') && !x.categories.includes('combat')); const e1 = TL.views.augments.evaluate(a, { stage: '2-1', hp: 100, plan: 'econ' }, []).score; const e2 = TL.views.augments.evaluate(a, { stage: '4-2', hp: 25, plan: 'flex' }, []).score; return [e1, e2]; });
  ok('상황별 효율 변화 (경제 증강: 2-1/체력100 > 4-2/체력25)', ev[0] > ev[1], JSON.stringify(ev));
  await page.click('[data-atab="db"]'); await page.waitForTimeout(100);
  n = await page.$$eval('#aBody .aug', e => e.length);
  const augN = await S(() => TL.data.augs().length); ok(`증강 전체 데이터베이스 ${augN}개 표시`, n === augN, 'n=' + n);
  await page.selectOption('#dTier', 'Prismatic'); await page.waitForTimeout(150);
  n = await page.$$eval('#aBody .aug', e => e.length);
  const prN = await S(() => TL.data.augs().filter(a => a.tier === 'Prismatic').length); ok(`등급별 분류 (Prismatic ${prN})`, n === prN, 'n=' + n);
  await page.click('#aBody [data-note]'); await page.fill('#nR', 'Rock 7'); await page.fill('#nM', '체력 높을 때'); await modalBtn('저장');
  ok('추천 조합/상황 메모 저장', (await S(() => Object.values(TL.state.augLab.notes)[0]?.rec)) === 'Rock 7');
  await page.click('#aBody [data-cmpadd]'); await page.click('[data-atab="compare"]'); await page.waitForTimeout(80);
  ok('증강 비교 탭', (await page.$$eval('#aBody .aug', e => e.length)) >= 1);

  /* ---------- 5. Scouting ---------- */
  await go('scout');
  await page.selectOption('#eTarget', 'enemy');
  await page.dragAndDrop('#sRoster [data-champ="briar"]', '#eBoard .hex[data-pos="3"]');
  await page.click('#sRoster [data-champ="jinx"]');
  await page.click('#eBoard .hex[data-pos="27"]').catch(() => { });
  const en = await S(() => TL.state.scout.opponents[0].board.map(u => u.champ));
  ok('상대 보드 구성 (드래그/클릭)', en.includes('briar') && en.includes('jinx'), JSON.stringify(en));
  await S(() => { const o = TL.state.scout.opponents[0]; o.board.find(u => u.champ === 'jinx').role = 'carry'; TL.state.scout.myBoard = [{ id: 'm1', champ: 'jinx', star: 2, items: ['infinity-edge'], pos: 21, role: 'carry' }, { id: 'm2', champ: 'braum', star: 2, items: [], pos: 0, role: 'tank' }]; TL.state.scout.scenario = 'assassin'; TL.save(); TL.views.scout.render(); });
  let risk = await S(() => TL.views.scout.analyze(TL.state.scout.myBoard, TL.state.scout.opponents[0].board, 'assassin').risk);
  await page.click('#mSaveL'); await page.fill('#lN', '구석 배치'); await modalBtn('저장');
  await page.dragAndDrop('#mBoard .hex[data-pos="21"]', '#mBoard .hex[data-pos="16"]');
  const risk2 = await S(() => TL.views.scout.analyze(TL.state.scout.myBoard, TL.state.scout.opponents[0].board, 'assassin').risk);
  await page.click('#mSaveL'); await page.fill('#lN', '안쪽 배치'); await modalBtn('저장');
  ok('암살자 대응 배치 비교 (구석 캐리 위험 > 3행 안쪽)', risk > risk2, `corner=${risk} inner=${risk2}`);
  ok('배치안 저장/비교 표', (await page.$$eval('[data-lload]', e => e.length)) === 2);
  await page.selectOption('#scen', 'aoe'); await page.waitForTimeout(80);
  ok('광역 대응 시나리오 전환', (await page.innerText('#view-scout')).includes('밀집'));
  await page.click('#oAdd'); ok('로비 상대 추가', (await S(() => TL.state.scout.opponents.length)) === 2);

  /* ---------- 6. Decision Training ---------- */
  await go('drill');
  await page.fill('#dReason', '30G 이자와 연패 보너스'); await page.click('[data-ans="1"]'); await page.waitForTimeout(80);
  let dr = await S(() => TL.state.drill.answers.e1);
  const fb = await page.innerText('#dBody');
  ok('판단 문제 답변 → 점수·이유·기회비용 해설', dr.score === 3 && dr.reason.includes('30G') && fb.includes('기회비용'), JSON.stringify(dr));
  await page.click('[data-key="0"]'); dr = await S(() => TL.state.drill.answers.e1.keys);
  ok('핵심 근거 자기 점검', dr.includes(0));
  await page.click('[data-mode="gen"]'); await page.waitForTimeout(400);
  await page.click('[data-gans="0"]'); await page.waitForTimeout(80);
  ok('데이터 기반 상황 생성기', (await S(() => TL.state.drill.genHistory.length)) === 1 && (await page.innerText('#dBody')).includes('확률'));

  /* ---------- 7. Tournament Records ---------- */
  await go('records');
  const names = ['나', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
  const addGame = async (places, comp, patch) => { for (let i = 0; i < 8; i++) { await page.fill(`[data-ln="${i}"]`, names[i]); await page.selectOption(`[data-lp="${i}"]`, String(places[i])); } await page.fill('#rComp', comp); await page.fill('#rPatch', patch); await page.fill('#rAug0', 'Backup Bows'); await page.click('#rSave'); await page.waitForTimeout(80); };
  await addGame([1, 2, 3, 4, 5, 6, 7, 8], 'K/DA', '19.1');
  await addGame([4, 1, 2, 3, 5, 6, 7, 8], 'K/DA', '19.2');
  await addGame([6, 1, 2, 3, 4, 5, 7, 8], 'Rock', '19.2');
  const rs = await S(() => { const g = TL.state.records.games; const a = TL.views.records.agg(g); const st = TL.views.records.standings(g); return { n: a.n, avg: a.avg, wins: a.wins, top4: a.top4, pts: a.pts, lead: st[0].name, leadPts: st[0].pts }; });
  ok('대회 기록 저장 + 자동 통계 (3경기, 평균 3.67, 1등 1, TOP4 67%)', rs.n === 3 && Math.abs(rs.avg - 11 / 3) < 0.01 && rs.wins === 1 && Math.abs(rs.top4 - 2 / 3) < 0.01 && rs.pts === 8 + 5 + 3, JSON.stringify(rs));
  ok('로비 순위표 (P2 = 7+8+8=23점 1위)', rs.lead === 'P2' && rs.leadPts === 23, JSON.stringify(rs));
  const rtxt = await page.innerText('#view-records');
  ok('조합별/패치별/증강별 성적 + 추세 그래프', rtxt.includes('조합별 성적') && rtxt.includes('패치별 성적') && (await page.$$('svg.spark')).length === 1);
  // duplicate place validation
  for (let i = 0; i < 8; i++) await page.selectOption(`[data-lp="${i}"]`, '1');
  await page.click('#rSave'); await page.waitForTimeout(80);
  ok('순위 중복 입력 검증', (await S(() => TL.state.records.games.length)) === 3);
  // edit score preset → recalculation
  await go('settings');
  await page.click('#pAdd'); await page.waitForTimeout(80);
  const pid = await S(() => TL.state.settings.scorePresets[1].id);
  const vals = [10, 8, 7, 6, 4, 3, 2, 1];
  for (let i = 0; i < 8; i++) await page.fill(`[data-pv="${pid}"][data-pi="${i}"]`, String(vals[i]));
  await page.check(`input[name="preset"][value="${pid}"]`); await page.click('#pSave'); await page.waitForTimeout(80);
  ok('대회 점수 체계 수정 → 자동 재계산 (10+6+3=19)', (await S(() => TL.views.records.agg(TL.state.records.games).pts)) === 19);

  /* ---------- 8. persistence after reload ---------- */
  const snap = await S(() => ({ comps: TL.state.comps.length, games: TL.state.records.games.length, sim: TL.state.sim?.stage, aug: TL.state.augLab.history.length, scout: TL.state.scout.layouts.length, drill: Object.keys(TL.state.drill.answers).length, unl: TL.state.builder.unlocked.kobuko }));
  await page.reload(); await page.waitForTimeout(600);
  const snap2 = await S(() => ({ comps: TL.state.comps.length, games: TL.state.records.games.length, sim: TL.state.sim?.stage, aug: TL.state.augLab.history.length, scout: TL.state.scout.layouts.length, drill: Object.keys(TL.state.drill.answers).length, unl: TL.state.builder.unlocked.kobuko }));
  ok('새로고침 후 데이터 유지 (조합/기록/시뮬/증강/정찰/훈련/해금)', JSON.stringify(snap) === JSON.stringify(snap2), JSON.stringify(snap2));

  /* ---------- 9. JSON backup & restore ---------- */
  await go('settings');
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('#aExport')]);
  const bkPath = path.join(OUT, 'state-backup.json'); await bk.saveAs(bkPath);
  const bkObj = JSON.parse(fs.readFileSync(bkPath, 'utf8'));
  ok('전체 기록 JSON 내보내기', bkObj.version === 2 && bkObj.records.games.length === 3 && bkObj.comps.length === snap.comps);
  await page.click('#aReset'); await modalBtn('초기화'); await page.waitForTimeout(200);
  const wiped = await S(() => TL.state.records.games.length + TL.state.comps.length);
  await page.setInputFiles('#aImport', bkPath); await page.waitForTimeout(150); await modalBtn('확인'); await page.waitForTimeout(200);
  const rest = await S(() => ({ games: TL.state.records.games.length, comps: TL.state.comps.length }));
  ok('초기화 → JSON 복원', wiped === 0 && rest.games === 3 && rest.comps === snap.comps, JSON.stringify(rest));
  const bks = await S(async () => (await TL.idb.backups()).map(b => b.kind + ':' + b.note));
  ok('IndexedDB 자동 백업 (초기화 전/복원 전)', bks.some(x => x.includes('초기화 전')) && bks.some(x => x.includes('복원 전')), bks.join(' | '));
  // invalid state file
  const badPath = path.join(OUT, 'bad.json'); fs.writeFileSync(badPath, '{"hello":1}');
  await page.setInputFiles('#aImport', badPath); await page.waitForTimeout(150);
  ok('잘못된 백업 파일 거부', (await page.innerText('#modalBody')).includes('형식'));
  await closeModal();

  /* ---------- 10. dataset import / validation / repair / version ---------- */
  // export single file, modify (patch → 19.1 live, change a breakpoint), import → diff + changelog
  const [d1] = await Promise.all([page.waitForEvent('download'), page.click('[data-exp="traits"]')]);
  const trPath = path.join(OUT, 'traits.json'); await d1.saveAs(trPath);
  const trObj = JSON.parse(fs.readFileSync(trPath, 'utf8'));
  trObj.meta.patch = '19.1 live (test)'; trObj.meta.status = 'live'; trObj.traits.find(t => t.name === 'Arcanist').tiers = [{ min: 2, effect: '' }, { min: 4, effect: '' }, { min: 6, effect: '' }, { min: 8, effect: '' }];
  fs.writeFileSync(trPath, JSON.stringify(trObj));
  await page.setInputFiles('#dImport', trPath); await page.waitForTimeout(200);
  const prev = await page.innerText('#modalBody');
  ok('개별 데이터 파일 가져오기 → 변경 내역 미리 보기', prev.includes('Arcanist: 2/4/6 → 2/4/6/8'));
  await modalBtn('적용'); await page.waitForTimeout(300);
  const ap = await S(() => ({ ov: TL.data.isOverridden(), tiers: TL.data.trait('Arcanist').tiers.length, log: TL.state.importLog.length, st: TL.data.bundle().traits.meta.status }));
  ok('데이터 교체 적용 + 가져오기 기록', ap.ov && ap.tiers === 4 && ap.log === 1 && ap.st === 'live', JSON.stringify(ap));
  await page.reload(); await page.waitForTimeout(600);
  ok('교체 데이터 새로고침 후 유지 (IndexedDB)', (await S(() => TL.data.trait('Arcanist').tiers.length)) === 4);
  ok('교체 후에도 기존 화면 정상 동작', (await (async () => { for (const v of ['builder', 'sim', 'augments', 'scout']) { await go(v); } return !(await page.isVisible('.notice.red:has-text("오류:")')); })()));
  await go('settings');
  // invalid dataset → repair
  const badData = await S(() => { const b = TL.clone(TL.data.bundle()); b.champions.champions[0].traits.push('Nonexistent Trait'); b.champions.champions[1].cost = 42; b['shop-odds'].odds['5'] = [50, 50, 50, 0, 0]; return b; });
  const bdPath = path.join(OUT, 'bad-bundle.json'); fs.writeFileSync(bdPath, JSON.stringify(badData));
  await page.setInputFiles('#dImport', bdPath); await page.waitForTimeout(200);
  const bp = await page.innerText('#modalBody');
  ok('유효성 검사: 잘못된 데이터 감지 (없는 특성/코스트/확률 합)', bp.includes('존재하지 않는 특성') && bp.includes('코스트 42') && bp.includes('합계 150'));
  await modalBtn('자동 복구 후 적용'); await page.waitForTimeout(300);
  const rp = await S(() => ({ v: TL.data.validate(TL.data.bundle()).errors.length, n: TL.data.champs().length, odds5: TL.sum(TL.data.odds().odds['5']) }));
  ok('잘못된 데이터 자동 복구', rp.v === 0 && rp.n === 93 && Math.abs(rp.odds5 - 100) < 0.6, JSON.stringify(rp));
  await closeModal();
  // legacy v0.1 dataset import
  await page.setInputFiles('#dImport', path.resolve(__dirname, '../legacy/tft-set19-dataset_v0.1.0.json')); await page.waitForTimeout(200);
  const lp = await page.innerText('#modalBody');
  ok('v0.1.0 데이터셋 가져오기 인식 (True Damage 3/5/10 차이 표시)', lp.includes('True Damage: 3/5 → 3/5/10'));
  await closeModal();
  // backup list + restore built-in
  const dsBk = await S(async () => (await TL.idb.backups()).filter(b => b.kind === 'dataset').length);
  ok('데이터셋 교체 전 자동 백업', dsBk >= 2, 'dataset backups=' + dsBk);
  await page.click('#dReset'); await modalBtn('확인'); await page.waitForTimeout(300);
  ok('내장 데이터로 되돌리기', !(await S(() => TL.data.isOverridden())) && (await S(() => TL.data.champs().length)) === 94);
  // full bundle round-trip
  const [d2] = await Promise.all([page.waitForEvent('download'), page.click('#dExportAll')]);
  const bPath = path.join(OUT, 'bundle.json'); await d2.saveAs(bPath);
  const bObj = JSON.parse(fs.readFileSync(bPath, 'utf8'));
  ok('전체 데이터 번들 내보내기', ['patch-info', 'champions', 'traits', 'items', 'augments', 'shop-odds', 'game-rules'].every(k => bObj[k]));
  // CDragon converter on a minimal synthetic sample (format check)
  const cd = await S(() => { const o = { sets: {}, items: [{ apiName: 'A1', name: 'Test Aug', desc: 'Gain @Gold@ gold', effects: { Gold: 5 }, associatedTraits: [] }], setData: [{ mutator: 'TFTSet19', number: 19, champions: [{ apiName: 'TFT19_X', name: 'Elise', cost: 1, traits: ['Ionic Spark'], role: 'Magic Tank' }], traits: [{ apiName: 'TFT19_IS', name: 'Ionic Spark', desc: 'x', effects: [{ minUnits: 3 }, { minUnits: 5 }] }], augments: ['A1'] }] }; const b = TL.convert.cdragon(o, 'TFTSet19', 'pbe', '19.1 PBE'); return { kind: TL.convert.detect(o), ch: b.champions.champions.length, tr: b.traits.traits[0].tiers.map(t => t.min).join('/'), aug: b.augments.augments[0].description, st: b.champions.meta.status, valid: TL.data.validate(b).errors.length }; });
  ok('CommunityDragon 형식 변환기', cd.kind === 'cdragon' && cd.ch === 1 && cd.tr === '3/5' && cd.aug === 'Gain 5 gold' && cd.st === 'pbe' && cd.valid === 0, JSON.stringify(cd));

  /* ---------- 11. responsive / Chromebook / mobile ---------- */
  for (const [w, h, label] of [[1366, 768, 'Chromebook 1366×768'], [390, 844, '모바일 390×844']]) {
    await page.setViewportSize({ width: w, height: h });
    let overflow = [];
    for (const v of ['dashboard', 'builder', 'sim', 'augments', 'scout', 'drill', 'records', 'settings']) { await page.evaluate(v2 => TL.go(v2), v); await page.waitForTimeout(80); const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); if (sw > 2) overflow.push(v + ':' + sw); if (v === 'builder' || v === 'sim') await page.screenshot({ path: path.join(OUT, `${label.split(' ')[0]}-${v}.png`), fullPage: false }); }
    ok(`${label} 가로 스크롤 없음`, !overflow.length, overflow.join(','));
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ---------- 12. perf / memory ---------- */
  const perf = await page.evaluate(async () => { const t0 = performance.now(); for (let i = 0; i < 20; i++) TL.go(['builder', 'sim', 'augments', 'records'][i % 4]); const t1 = performance.now(); return { avgRenderMs: (t1 - t0) / 20, heapMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null }; });
  ok('렌더 성능 (화면 전환 평균 < 60ms)', perf.avgRenderMs < 60, JSON.stringify(perf));

  ok('페이지 JS 오류 없음', errors.length === 0, errors.slice(0, 5).join(' | '));
  const pass = results.filter(r => r.pass).length;
  console.log(`\n${pass}/${results.length} passed`);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ date: new Date().toISOString(), pass, total: results.length, results, perf }, null, 2));
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(async e => { console.error('TEST CRASH', e); try { await page.screenshot({ path: path.join(OUT, 'crash.png') }); } catch (x) { } await browser?.close(); process.exit(2); });
