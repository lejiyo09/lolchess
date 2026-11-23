/* Game Simulator — round-by-round economy/shop/level practice.
   Real-rule parts (from data/game-rules.json & shop-odds.json): income, interest, streak gold, XP table, shop odds,
   pool sizes, sell values, stage damage, round structure, augment rounds, 3-copy upgrades, item recipes.
   Training-model parts (clearly labeled in UI): combat outcome estimate, opponents (7 bots), PvE loot, carousel offers,
   augment tier roll, other players' pool usage. */
'use strict';
(function (TL) {
  const V = {};
  const E = TL.engine;
  const S = () => TL.state.sim;
  let sel = null, selItem = null, calcTarget = null;
  const BOT_NAMES = ['Bot A', 'Bot B', 'Bot C', 'Bot D', 'Bot E', 'Bot F', 'Bot G'];
  const COSTW = { 1: 1, 2: 1.25, 3: 1.6, 4: 2.1, 5: 2.7, 7: 3.6 }, STARW = { 1: 1, 2: 1.8, 3: 3.2 };

  /* ---------- helpers ---------- */
  const rid = () => `${S().stage}-${S().round}`;
  const units = () => [...S().board, ...S().bench.filter(Boolean)];
  const findU = id => units().find(u => u.id === id);
  const cap = () => E.cap(S().level, S().board);
  const shopPool = () => TL.data.champs().filter(c => c.cost <= 5 && (!c.unlock || S().unlocked[c.id]));
  function log(t, type = '') { S().log.unshift({ r: rid(), t, type }); S().log = S().log.slice(0, 250); }
  function poolLeftObj() {
    const s = S();
    return { get: id => s.pool[id] || 0, tierTotal: cost => TL.sum(shopPool().filter(c => c.cost === cost).map(c => s.pool[c.id] || 0)) };
  }
  function ownedCopies(cid) { return TL.sum(units().filter(u => u.champ === cid).map(u => E.copies(u.star))); }

  /* ---------- new game ---------- */
  function newGame(opts = {}) {
    const R = TL.data.rules();
    const pool = {}; TL.data.champs().forEach(c => { const p = E.poolSize(c.cost); pool[c.id] = p == null ? 0 : p; });
    TL.state.sim = {
      id: TL.uid('g'), startedAt: new Date().toISOString(), dataVersion: TL.data.patch().dataVersion,
      stage: 1, round: 1, phase: 'carousel', hp: R.startingHp || 100, gold: 0, level: 1, xp: 0, streak: 0, lastResult: null,
      shop: [null, null, null, null, null], locked: false, board: [], bench: Array(R.benchSize || 9).fill(null), items: [],
      augments: [], augOffer: [], augRerolled: false, pool, botsHeld: {}, bots: BOT_NAMES.map(n => ({ name: n, hp: 100, alive: true })),
      unlocked: {}, guaranteed: [], carousel: [], history: [], log: [], decisions: [], levelLog: [{ level: 1, r: '1-1' }],
      stats: { rollGold: 0, rolls: 0, xpGold: 0, xpBuys: 0, buys: 0, sells: 0, interest: 0, streakGold: 0, winGold: 0, passive: 0, damage: 0, wins: 0, losses: 0, goldStarts: [] },
      combatMode: opts.combatMode || 'auto', contest: { champ: null, players: 0 }, placement: null, roundStart: null, pendingCheckpoint: null,
    };
    if (opts.scenario) applyScenario(opts.scenario);
    else { genCarousel(); log('게임 시작 — 1-1 회전초밥(공유 드래프트): 챔피언 1명을 고르세요.', 'sys'); }
    TL.save();
  }
  function applyScenario(sc) {
    const s = S();
    s.stage = sc.stage; s.round = sc.round; s.hp = sc.hp; s.gold = sc.gold; s.level = sc.level; s.xp = sc.xp || 0; s.streak = sc.streak || 0;
    s.levelLog = [{ level: s.level, r: rid() }];
    // random board appropriate to level using real shop odds; stars by stage (training model)
    const odds = E.oddsRow(s.level); const n = Math.min(s.level, 9);
    for (let i = 0; i < n; i++) {
      const cost = rollTier(odds); const list = shopPool().filter(c => c.cost === cost && s.pool[c.id] >= 3); if (!list.length) continue;
      const c = TL.pick(list); const star = Math.random() < Math.min(0.75, 0.15 * s.stage) ? 2 : 1; s.pool[c.id] -= E.copies(star);
      s.board.push({ id: TL.uid('u'), champ: c.id, star, items: [], pos: pickPos(c) });
    }
    const comps = TL.data.items().filter(i => i.type === 'component' && !['spatula', 'frying-pan'].includes(i.id));
    for (let i = 0; i < Math.max(2, s.stage * 2 - 1); i++) s.items.push(TL.pick(comps).id);
    botsTick(true);
    s.phase = 'planning'; startPlanning(true);
    log(`시나리오 시작: ${rid()} · 체력 ${s.hp} · ${s.gold}G · Lv${s.level} (보드/아이템은 무작위 생성)`, 'sys');
  }
  function pickPos(c) {
    const used = new Set(S().board.map(u => u.pos));
    const front = /Tank|Fighter/.test(c.role); const rows = front ? [0, 1, 2, 3] : [3, 2, 1, 0];
    for (const r of rows) for (const col of TL.shuffle([0, 1, 2, 3, 4, 5, 6])) { const p = r * 7 + col; if (!used.has(p)) return p; }
    return 0;
  }
  function rollTier(odds) { let r = Math.random() * 100, acc = 0; for (let i = 0; i < odds.length; i++) { acc += odds[i]; if (r < acc) return i + 1; } return 1; }

  /* ---------- shop ---------- */
  function drawChamp(level, excludeCounts = {}) {
    const odds = E.oddsRow(level);
    for (let tries = 0; tries < 12; tries++) {
      const cost = rollTier(odds);
      const list = shopPool().filter(c => c.cost === cost); const w = list.map(c => Math.max(0, (S().pool[c.id] || 0) - (excludeCounts[c.id] || 0)));
      const tot = TL.sum(w); if (!tot) continue;
      let r = Math.random() * tot; for (let i = 0; i < list.length; i++) { r -= w[i]; if (r < 0) return list[i].id; }
    }
    return null;
  }
  function refreshShop() {
    const s = S(); const shown = {};
    s.shop = Array.from({ length: 5 }, () => { const id = drawChamp(s.level, shown); if (id) shown[id] = (shown[id] || 0) + 1; return id; });
    if (s.guaranteed.length) { const g = s.guaranteed.shift(); if ((s.pool[g] || 0) > 0) { s.shop[TL.rand(5)] = g; log(`해금 보장: ${TL.data.champ(g)?.name} 상점 등장`, 'sys'); } }
  }
  function reroll() {
    const s = S(); if (s.phase !== 'planning') return;
    const cost = TL.data.rules().rerollCost ?? 2;
    if (s.gold < cost) return TL.toast(`골드 부족 (새로고침 ${cost}G)`, 'err');
    s.gold -= cost; s.stats.rollGold += cost; s.stats.rolls++; s.locked = false; refreshShop(); log(`새로고침 −${cost}G`, 'roll'); TL.save(); render();
  }
  function buyXp() {
    const s = S(); if (s.phase !== 'planning') return;
    const R = TL.data.rules(); const cost = R.xpBuyCost ?? 4;
    if (s.level >= (R.maxLevelByXp || 10)) return TL.toast('XP로 올릴 수 있는 최대 레벨이야.', 'err');
    if (s.gold < cost) return TL.toast(`골드 부족 (XP 구매 ${cost}G)`, 'err');
    s.gold -= cost; s.stats.xpGold += cost; s.stats.xpBuys++; addXp(R.xpPerBuy ?? 4); log(`XP 구매 +${R.xpPerBuy ?? 4} −${cost}G → Lv${s.level} (${s.xp}/${E.xpToNext(s.level) ?? '-'})`, 'xp'); TL.save(); render();
  }
  function addXp(n) {
    const s = S(); const R = TL.data.rules(); s.xp += n;
    while (s.level < (R.maxLevelByXp || 10)) { const need = E.xpToNext(s.level); if (need == null || s.xp < need) break; s.xp -= need; s.level++; s.levelLog.push({ level: s.level, r: rid() }); log(`레벨 업 → Lv${s.level}`, 'lvl'); }
    if (s.level >= (R.maxLevelByXp || 10)) s.xp = 0;
  }
  function benchFree() { return S().bench.findIndex(x => !x); }
  function buy(slot) {
    const s = S(); if (s.phase !== 'planning') return;
    const cid = s.shop[slot]; if (!cid) return; const c = TL.data.champ(cid);
    if (s.gold < c.cost) return TL.toast('골드 부족', 'err');
    const oneStars = units().filter(u => u.champ === cid && u.star === 1).length;
    const free = benchFree();
    if (free < 0 && oneStars < 2) return TL.toast('대기석이 가득 찼어 (3장째로 합성되는 경우만 구매 가능).', 'err');
    s.gold -= c.cost; s.pool[cid] = Math.max(0, (s.pool[cid] || 0) - 1); s.shop[slot] = null; s.stats.buys++;
    const u = { id: TL.uid('u'), champ: cid, star: 1, items: [] };
    if (free >= 0) s.bench[free] = u; else { s.bench.push(u); }
    log(`${c.name} 구매 −${c.cost}G`, 'buy'); merge(); s.bench = s.bench.slice(0, TL.data.rules().benchSize || 9); while (s.bench.length < (TL.data.rules().benchSize || 9)) s.bench.push(null);
    TL.save(); render();
  }
  function merge() {
    const s = S(); let changed = true;
    while (changed) {
      changed = false;
      for (const star of [1, 2]) {
        const groups = {}; units().forEach(u => { if (u.star === star) (groups[u.champ] = groups[u.champ] || []).push(u); });
        for (const [cid, arr] of Object.entries(groups)) {
          if (arr.length < 3) continue;
          const three = arr.sort((a, b) => (s.board.includes(b) ? 1 : 0) - (s.board.includes(a) ? 1 : 0)).slice(0, 3);
          const host = three[0]; const items = three.flatMap(u => u.items || []);
          three.slice(1).forEach(u => { const bi = s.board.indexOf(u); if (bi >= 0) s.board.splice(bi, 1); const si = s.bench.indexOf(u); if (si >= 0) s.bench[si] = null; });
          host.star = star + 1; host.items = [];
          items.forEach(i => { const r = TL.itemsUI.equip(host, i, 3); if (r.ok) host.items = r.items; else s.items.push(i); });
          log(`★ ${TL.data.champ(cid).name} ${host.star}성 완성!`, 'star'); TL.toast(`${TL.data.champ(cid).name} ${host.star}성!`, 'ok'); changed = true;
        }
      }
    }
  }
  function sell(uid) {
    const s = S(); if (!['planning', 'augment'].includes(s.phase)) return;
    const u = findU(uid); if (!u) return; const c = TL.data.champ(u.champ);
    const v = E.sellValue(c.cost, u.star); s.gold += v; s.pool[u.champ] = (s.pool[u.champ] || 0) + E.copies(u.star); s.stats.sells++;
    (u.items || []).forEach(i => s.items.push(i));
    const bi = s.board.indexOf(u); if (bi >= 0) s.board.splice(bi, 1); const si = s.bench.indexOf(u); if (si >= 0) s.bench[si] = null;
    if (sel === uid) sel = null; log(`${c.name} ${u.star}★ 판매 +${v}G${u.items?.length ? ' (아이템 반환)' : ''}`, 'sell'); TL.save(); render();
  }
  function moveUnit(uid, target) {
    const s = S(); const u = findU(uid); if (!u) return; const onBoard = s.board.includes(u);
    if (target.zone === 'board') {
      const occ = s.board.find(x => x.pos === target.pos);
      if (onBoard) { if (occ && occ !== u) occ.pos = u.pos; u.pos = target.pos; }
      else { const si = s.bench.indexOf(u); if (occ) { s.bench[si] = occ; s.board.splice(s.board.indexOf(occ), 1); delete occ.pos; } else { if (s.board.length >= cap()) return TL.toast(`배치 인원 초과 (Lv${s.level} → ${cap()}명)`, 'err'); s.bench[si] = null; } u.pos = target.pos; s.board.push(u); }
    } else if (target.zone === 'bench') {
      const occ = s.bench[target.slot];
      if (onBoard) { s.board.splice(s.board.indexOf(u), 1); const p = u.pos; delete u.pos; s.bench[target.slot] = u; if (occ) { occ.pos = p; s.board.push(occ); } }
      else { const si = s.bench.indexOf(u); s.bench[si] = occ || null; s.bench[target.slot] = u; }
    }
    TL.save(); render();
  }
  function equipFromBench(itemIdx, uid) {
    const s = S(); const u = findU(uid); const id = s.items[itemIdx]; if (!u || !id) return;
    const r = TL.itemsUI.equip(u, id, TL.data.rules().maxItemsPerUnit || 3); if (!r.ok) return TL.toast(r.msg, 'err');
    u.items = r.items; s.items.splice(itemIdx, 1); log(`${TL.data.item(id)?.nameKo || id} → ${TL.data.champ(u.champ).name}${r.combined ? ` (${r.combined.nameKo || r.combined.name} 완성)` : ''}`, 'item'); selItem = null; TL.save(); render();
  }
  function combineOnBench(i, j) {
    const s = S(); const a = s.items[i], b = s.items[j]; const r = TL.data.combine(a, b); if (!r) return TL.toast('조합법이 없는 재료 조합이야.', 'err');
    s.items = s.items.filter((_, k) => k !== i && k !== j); s.items.push(r.id); log(`아이템 조합: ${r.nameKo || r.name} (훈련 편의 기능 — 실제 게임은 유닛에 장착해 조합)`, 'item'); TL.save(); render();
  }

  /* ---------- round flow ---------- */
  function income() {
    const s = S(); const R = TL.data.rules();
    const interest = E.interest(s.gold), passive = E.passiveIncome(s.stage, s.round), streakG = E.streakGold(s.streak), win = s.lastResult === 'win' ? (R.pvpWinGold ?? 1) : 0;
    const total = interest + passive + streakG + win; s.gold += total;
    s.stats.interest += interest; s.stats.passive += passive; s.stats.streakGold += streakG; s.stats.winGold += win;
    log(`수입 +${total}G (기본 ${passive} · 이자 ${interest} · ${s.streak > 0 ? '연승' : s.streak < 0 ? '연패' : '연속'} ${streakG} · 승리 ${win})`, 'gold');
    s.lastResult = null;
  }
  function startPlanning(skipIncome) {
    const s = S(); s.phase = 'planning';
    if (!skipIncome) income();
    s.stats.goldStarts.push({ r: rid(), g: s.gold });
    if (!s.locked) refreshShop(); else log('상점 잠금 유지', 'sys');
    if (E.isAugmentRound(s.stage, s.round) && !s.augments.some(a => a.at === rid())) { s.phase = 'augment'; s.augOffer = []; s.augRerolled = false; }
    checkpoint();
    s.roundStart = null; s.roundStart = TL.clone({ ...s, roundStart: null, log: [], history: [] });
  }
  function checkpoint() {
    const s = S(); const r = rid(); let q = null;
    const CP = {
      '2-1': '첫 PvP 라운드. 4레벨(XP 4G) 갈 보드인가? 연승/연패 중 어느 쪽을 노릴지 결정해.',
      '2-5': '5레벨 타이밍. 현재 연속 기록과 이자(10/20/30G 구간)를 고려해 레벨업 여부를 정해.',
      '3-2': '6레벨 표준 타이밍. 보드를 안정시킬지, 이자를 유지할지?',
      '3-5': '7레벨 타이밍 — 레벨업 후 30G 이상(패배 중이면 40G) 남는가? (tft.ninja 기준 가이드)',
      '4-1': '8레벨 + 롤다운 표준 구간. 50G 확보 여부, 목표 4코스트 캐리 결정.',
      '4-2': '증강 + 8레벨 타이밍. 리롤 하한선(예: 10~20G)을 미리 정해.',
      '5-1': '후반 진입. 남은 체력으로 버틸 수 있는 패배 횟수를 계산해 지출을 결정해.',
    };
    if (CP[r]) q = CP[r];
    else if (s.hp <= 40 && !s.decisions.some(d => d.lowHp)) q = `체력 ${s.hp}: 스테이지 ${s.stage} 패배 시 기본 피해 ${E.stageDamage(s.stage)} + 생존 유닛 수. 몇 번 더 질 수 있는지 계산하고 지금 롤다운할지 결정해.`;
    s.pendingCheckpoint = q ? { r, q, lowHp: s.hp <= 40 && !CP[r] } : null;
  }
  function genCarousel() {
    const s = S(); const st = s.stage; const costs = st <= 1 ? [1] : st === 2 ? [1, 2] : st === 3 ? [2, 3] : st === 4 ? [3, 4] : [3, 4, 5];
    const comps = TL.data.items().filter(i => i.type === 'component' && !['spatula', 'frying-pan'].includes(i.id));
    const done = TL.data.items().filter(i => i.type === 'completed' && i.id !== TL.THIEF);
    const list = shopPool().filter(c => costs.includes(c.cost) && (s.pool[c.id] || 0) > 0);
    s.carousel = TL.shuffle(list).slice(0, 9).map(c => ({ champ: c.id, item: (st >= 5 && Math.random() < 0.5 ? TL.pick(done) : TL.pick(comps)).id }));
  }
  function pickCarousel(i) {
    const s = S(); const o = s.carousel[i]; if (!o) return;
    const free = benchFree(); const u = { id: TL.uid('u'), champ: o.champ, star: 1, items: [] };
    if (free >= 0) s.bench[free] = u; s.pool[o.champ] = Math.max(0, (s.pool[o.champ] || 0) - 1); s.items.push(o.item);
    log(`회전초밥: ${TL.data.champ(o.champ).name} + ${TL.data.item(o.item)?.nameKo || o.item}`, 'item'); merge();
    s.history.push({ r: rid(), type: 'carousel' });
    if (TL.data.rules().carouselGivesXp && !(s.stage === 1 && s.round === 1)) addXp(TL.data.rules().passiveXpPerRound ?? 2);
    nextRound();
  }
  function lootPvE() {
    const s = S(); const comps = TL.data.items().filter(i => i.type === 'component' && !['spatula', 'frying-pan'].includes(i.id));
    const done = TL.data.items().filter(i => i.type === 'completed' && i.id !== TL.THIEF);
    let got = [], gold = 0;
    if (s.stage === 1) { got.push(TL.pick(comps).id); gold = TL.rand(3); }
    else { const n = s.stage <= 4 ? 2 : 1; for (let k = 0; k < n; k++) got.push(TL.pick(comps).id); if (s.stage >= 5) got.push(TL.pick(done).id); gold = TL.rand(s.stage * 2 + 1); }
    s.items.push(...got); s.gold += gold;
    log(`PvE 전리품(훈련 모델): ${got.map(i => TL.data.item(i)?.nameKo || i).join(', ')}${gold ? ' + ' + gold + 'G' : ''}`, 'item');
  }
  function power(board, traitsList) {
    let p = 0; board.forEach(u => { const c = TL.data.champ(u.champ); if (!c) return; const done = (u.items || []).filter(i => TL.data.item(i)?.type !== 'component').length, cmp = (u.items || []).length - done; p += (COSTW[c.cost] || 1) * (STARW[u.star] || 1) * (1 + 0.12 * done + 0.04 * cmp); });
    const tb = TL.sum(traitsList.filter(t => t.active >= 0).map(t => t.trait?.type === 'unique' ? 0.04 : Math.min(0.24, 0.06 * (t.active + 1))));
    return { p: p * (1 + tb), base: p, tb };
  }
  function typicalOpp(stage, round) {
    const st = Math.min(stage, 7), k = `${stage}-${round}`;
    const lv = stage <= 1 ? 2 : stage === 2 ? (round >= 5 ? 5 : 4) : stage === 3 ? (round >= 5 ? 7 : round >= 2 ? 6 : 5) : stage === 4 ? (round >= 2 ? 8 : 7) : stage === 5 ? (round >= 5 ? 9 : 8) : 9;
    const cost = { 1: 1, 2: 1.5, 3: 2.1, 4: 2.8, 5: 3.3, 6: 3.7, 7: 4 }[st], star = { 1: 1, 2: 1.25, 3: 1.5, 4: 1.7, 5: 1.9, 6: 2.0, 7: 2.2 }[st], items = { 1: 0, 2: 0.3, 3: 0.6, 4: 0.9, 5: 1.1, 6: 1.3, 7: 1.4 }[st];
    const cw = COSTW[Math.floor(cost)] + (COSTW[Math.ceil(cost)] - COSTW[Math.floor(cost)]) * (cost - Math.floor(cost));
    const sw = STARW[Math.floor(star)] + ((STARW[Math.ceil(star)] || 3.2) - STARW[Math.floor(star)]) * (star - Math.floor(star));
    return { p: lv * cw * sw * (1 + 0.12 * items) * (1 + 0.2 + 0.03 * st), units: lv, key: k };
  }
  function fight() {
    const s = S(); if (s.phase !== 'planning') return;
    const type = E.roundType(s.stage, s.round);
    if (s.board.length > cap()) return TL.toast('배치 인원 초과 상태로는 전투를 시작할 수 없어.', 'err');
    if (type === 'pve') { lootPvE(); s.history.push({ r: rid(), type: 'pve', result: 'pve' }); log('PvE 라운드 승리 처리(연속 기록 유지)', 'sys'); return endRound(); }
    if (type === 'pvp') {
      const tr = E.traits(s.board); const me = power(s.board, tr); const typ = typicalOpp(s.stage, s.round);
      const mult = TL.clamp(1 + (Math.random() + Math.random() + Math.random() - 1.5) * 0.25, 0.7, 1.35); const opp = typ.p * mult;
      const pWin = 1 / (1 + Math.exp(-(me.p / opp - 1) * 6));
      if (s.combatMode === 'manual') return manualResult(me, opp, pWin, typ.units);
      const win = Math.random() < pWin; const surv = win ? 0 : Math.max(1, Math.min(typ.units, Math.round(typ.units * TL.clamp(0.25 + 0.6 * (1 - me.p / opp) + Math.random() * 0.2, 0.1, 1))));
      resolvePvp(win, surv, { me: me.p, opp, pWin });
    }
  }
  function manualResult(me, opp, pWin, oppUnits) {
    TL.modal(`${rid()} 전투 결과 입력 (수동 모드)`, `<p class="small">실제 게임/스크림의 결과를 재현하거나, 모델 추정치를 참고해 직접 결정해.</p><div class="notice purple tiny">훈련용 추정: 내 전투력 ${me.p.toFixed(1)} vs 상대 ${opp.toFixed(1)} → 승리 확률 약 ${(pWin * 100).toFixed(0)}%</div>
      <div class="row" style="margin-top:8px"><label>패배 시 상대 생존 유닛 수</label><input type="number" id="mSurv" min="1" max="12" value="${Math.max(1, Math.round(oppUnits / 2))}" style="width:70px"/></div>`,
    { buttons: [{ label: '승리', cls: 'primary', onClick: () => resolvePvp(true, 0, { me: me.p, opp, pWin }) }, { label: '패배', cls: 'danger', onClick: () => resolvePvp(false, TL.clamp(+TL.$('#mSurv').value || 1, 1, 12), { me: me.p, opp, pWin }) }] });
  }
  function resolvePvp(win, surv, info) {
    const s = S();
    let dmg = 0;
    if (win) { s.streak = s.streak > 0 ? s.streak + 1 : 1; s.lastResult = 'win'; s.stats.wins++; }
    else { dmg = E.stageDamage(s.stage) + surv; s.hp -= dmg; s.stats.damage += dmg; s.streak = s.streak < 0 ? s.streak - 1 : -1; s.lastResult = 'loss'; s.stats.losses++; }
    s.history.push({ r: rid(), type: 'pvp', result: win ? 'win' : 'loss', dmg, me: +info.me.toFixed(1), opp: +info.opp.toFixed(1), p: +info.pWin.toFixed(2), gold: s.gold, level: s.level, hp: s.hp });
    log(win ? `PvP 승리 (추정 승률 ${(info.pWin * 100).toFixed(0)}%) · ${s.streak}연승` : `PvP 패배 −${dmg} (기본 ${E.stageDamage(s.stage)} + 생존 ${surv}) · ${-s.streak}연패 · 체력 ${s.hp}`, win ? 'win' : 'loss');
    botsCombat();
    endRound();
  }
  function botsCombat() {
    const s = S(); s.bots.filter(b => b.alive).forEach(b => {
      if (Math.random() < 0.5) { b.hp -= E.stageDamage(s.stage) + 1 + TL.rand(Math.min(9, 2 + s.stage)); if (b.hp <= 0) { b.alive = false; b.hp = 0; b.out = rid(); releaseBot(); log(`${b.name} 탈락 (풀에 챔피언 반환)`, 'sys'); } }
    });
  }
  function releaseBot() { const s = S(); const alive = s.bots.filter(b => b.alive).length + 1; Object.keys(s.botsHeld).forEach(id => { const n = Math.round(s.botsHeld[id] / alive); s.botsHeld[id] -= n; s.pool[id] = (s.pool[id] || 0) + n; }); }
  function botsTick(init) {
    // Training model of other players' champion usage: keep ~target copies held by alive bots, drawn with stage-typical shop odds.
    const s = S(); const alive = s.bots.filter(b => b.alive).length; if (!alive) return;
    const per = { 1: 3, 2: 8, 3: 13, 4: 18, 5: 22, 6: 24, 7: 25 }[Math.min(s.stage, 7)];
    const target = per * alive; let held = TL.sum(Object.values(s.botsHeld));
    // churn: bots sell ~8% each round
    if (!init) Object.keys(s.botsHeld).forEach(id => { const n = s.botsHeld[id]; let k = 0; for (let i = 0; i < n; i++) if (Math.random() < 0.08) k++; s.botsHeld[id] -= k; s.pool[id] += k; held -= k; });
    const lvl = typicalOpp(s.stage, s.round).units; let guard = 0;
    while (held < target && guard++ < 600) { const id = drawChamp(Math.min(lvl, 10)); if (!id || (s.pool[id] || 0) <= 0) continue; s.pool[id]--; s.botsHeld[id] = (s.botsHeld[id] || 0) + 1; held++; }
    // contest scenario: other players stacking a chosen champion
    const ct = s.contest; if (ct.champ && ct.players > 0) { const want = Math.min(ct.players * 3, (E.poolSize(TL.data.champ(ct.champ)?.cost) || 0) - 1); while ((s.botsHeld[ct.champ] || 0) < want && (s.pool[ct.champ] || 0) > 0) { s.pool[ct.champ]--; s.botsHeld[ct.champ] = (s.botsHeld[ct.champ] || 0) + 1; } }
  }
  function endRound() {
    const s = S(); const R = TL.data.rules(); const type = E.roundType(s.stage, s.round);
    if (s.hp <= 0) return gameOver();
    if (type !== 'carousel' || R.carouselGivesXp) { if (!(s.stage === 1 && s.round === 1)) addXp(R.passiveXpPerRound ?? 2); }
    nextRound();
  }
  function nextRound() {
    const s = S(); const R = TL.data.rules();
    if (s.bots.every(b => !b.alive)) return gameOver();
    s.round++; if (s.round > E.roundsInStage(s.stage)) { s.stage++; s.round = 1; }
    botsTick(false);
    const type = E.roundType(s.stage, s.round);
    if (type === 'carousel') { if (R.carouselGivesIncome) income(); s.phase = 'carousel'; genCarousel(); log(`${rid()} 회전초밥`, 'sys'); s.stats.goldStarts.push({ r: rid(), g: s.gold }); }
    else startPlanning(false);
    sel = null; selItem = null; TL.save(); render();
  }
  function gameOver() {
    const s = S(); const alive = s.bots.filter(b => b.alive).length; s.placement = s.hp > 0 ? 1 : alive + 1; s.phase = 'over'; s.hp = Math.max(0, s.hp);
    log(`게임 종료 — ${s.placement}위`, 'sys');
    const tr = E.traits(s.board).filter(t => t.active >= 0).slice(0, 4).map(t => `${t.name} ${t.count}`);
    TL.state.simHistory.unshift({ id: s.id, date: new Date().toISOString(), placement: s.placement, end: rid(), level: s.level, hp: s.hp, traits: tr, augments: s.augments.map(a => a.name), stats: s.stats, levelLog: s.levelLog, decisions: s.decisions, dataVersion: s.dataVersion, mode: s.combatMode });
    TL.state.simHistory = TL.state.simHistory.slice(0, 100);
    TL.save(); render(); review();
  }

  /* ---------- augments ---------- */
  function genAugOffer(tier) {
    const s = S(); const owned = new Set(s.augments.map(a => a.id));
    const t = tier || TL.pick(['Silver', 'Gold', 'Prismatic']);
    const r = rid(); const pool = TL.data.augs().filter(a => a.tier === t && !owned.has(a.id)); const byRound = pool.filter(a => !(a.rounds && a.rounds.length) || a.rounds.includes(r));
    s.augTier = t; s.augOffer = TL.shuffle(byRound.length >= 3 ? byRound : pool).slice(0, 3).map(a => a.id);
  }
  function pickAug(id, reason) {
    const s = S(); const a = TL.data.aug(id); if (!a) return;
    s.augments.push({ id, name: a.name, tier: a.tier, at: rid(), reason });
    TL.state.augLab.history.unshift({ id: TL.uid('a'), date: new Date().toISOString(), offers: s.augOffer.map(x => TL.data.aug(x)?.name), picked: a.name, pickedTier: a.tier, reason, ctx: { stage: rid(), hp: s.hp, gold: s.gold, level: s.level, streak: s.streak, source: 'sim' } });
    log(`증강 선택: ${a.name} (${a.tier})`, 'aug'); s.augOffer = []; s.phase = 'planning'; TL.save(); render();
    TL.toast('증강 효과는 자동 적용되지 않아. 설명의 수치를 보고 필요하면 "수동 보정"으로 골드/아이템/XP를 반영해.', '');
  }

  /* ---------- render ---------- */
  function render() {
    const el = TL.$('#view-sim');
    if (!S()) return renderStart(el);
    const s = S(); const R = TL.data.rules();
    const need = E.xpToNext(s.level); const tr = E.traits(s.board); const type = E.roundType(s.stage, s.round);
    const nextInterest = E.interest(s.gold); const toNextThreshold = s.gold >= 50 ? 0 : 10 - (s.gold % 10);
    const me = power(s.board, tr), typ = typicalOpp(s.stage, s.round);
    el.innerHTML = `
    <div class="view-head"><div><h2>Game Simulator <span class="muted small">운영 시뮬레이터</span></h2><p>단축키: <span class="kbd">D</span> 새로고침 · <span class="kbd">F</span> XP 구매 · <span class="kbd">E</span> 선택 유닛 판매 · <span class="kbd">Space</span> 전투/다음 · 우클릭 = 판매</p></div>
      <div class="row"><span class="pill">${s.combatMode === 'auto' ? '전투: 자동 추정' : '전투: 수동 입력'}</span><button class="sm" id="sMode">모드 전환</button><button class="sm" id="sRestart">라운드 시작으로 되돌리기</button><button class="sm danger" id="sNew">새 게임</button></div></div>
    <div class="notice purple tiny" style="margin-bottom:10px"><b>실제 규칙 적용</b>: 수입·이자·연속 보너스·XP 표·상점 확률·풀 크기·판매가·스테이지 피해·라운드 구조·증강 라운드·3장 합성·아이템 조합표 (출처: game-rules/shop-odds — <b>Set 18 라이브 값, Set 19 미확인</b>). <b>훈련용 모델</b>: 전투 결과 추정, 상대 7명(봇), PvE 전리품, 회전초밥 구성, 증강 등급, 다른 플레이어의 풀 사용량.</div>
    <div class="hud">
      <div class="kpi"><span>라운드</span><b class="gold-t">${rid()}</b><small>${({ pvp: 'PvP', pve: 'PvE', carousel: '회전초밥' })[type]}${E.isAugmentRound(s.stage, s.round) ? ' · 증강' : ''}</small></div>
      <div class="kpi"><span>체력</span><b class="${s.hp <= 30 ? 'red-t' : ''}">${s.hp}</b><small>패배 피해 ${E.stageDamage(s.stage)}+α</small></div>
      <div class="kpi"><span>골드</span><b class="gold-t">${s.gold}G</b><small>이자 ${nextInterest}${toNextThreshold && s.gold < 50 ? ` · +${toNextThreshold}G→다음 구간` : ' (최대)'}</small></div>
      <div class="kpi"><span>레벨</span><b>Lv${s.level}</b><div class="xpbar"><i style="width:${need ? Math.min(100, s.xp / need * 100) : 100}%"></i></div><small>${need ? `${s.xp}/${need} XP · 필요 ${Math.ceil((need - s.xp) / (R.xpPerBuy || 4)) * (R.xpBuyCost || 4)}G` : '최대'}</small></div>
      <div class="kpi"><span>연속</span><b class="${s.streak > 0 ? 'green-t' : s.streak < 0 ? 'red-t' : ''}">${s.streak > 0 ? s.streak + '연승' : s.streak < 0 ? -s.streak + '연패' : '-'}</b><small>보너스 ${E.streakGold(s.streak)}G</small></div>
      <div class="kpi"><span>배치</span><b class="${s.board.length > cap() ? 'red-t' : ''}">${s.board.length}/${cap()}</b><small>대기석 ${s.bench.filter(Boolean).length}/${s.bench.length}</small></div>
      <div class="kpi"><span>생존 플레이어</span><b>${s.bots.filter(b => b.alive).length + (s.hp > 0 ? 1 : 0)}/8</b><small>${s.placement ? s.placement + '위 확정' : '훈련용 봇'}</small></div>
    </div>
    <div class="roundtrack" style="margin:8px 0">${trackHTML()}</div>
    <div class="split3">
      <div class="col" style="gap:12px">
        <div class="panel"><h3>행동</h3>
          <div class="row"><button class="primary" id="sFight" ${s.phase !== 'planning' ? 'disabled' : ''}>${type === 'pve' ? 'PvE 전투' : '전투 시작'} ▶</button></div>
          <div class="divider"></div>
          <div class="tiny">이번 라운드 종료 예상 수입(지출 없음 가정): 기본 ${E.passiveIncome(s.stage, s.round + 1 > E.roundsInStage(s.stage) ? 1 : s.round + 1)} + 이자 ${nextInterest} + 연속 ${E.streakGold(s.streak + (s.streak >= 0 ? 1 : -1))}(결과에 따라)</div>
          <div class="tiny" style="margin-top:4px">훈련용 전투력: 내 보드 <b>${me.p.toFixed(1)}</b> · 이 라운드 표준 상대 <b>${typ.p.toFixed(1)}</b> (Lv${typ.units} 기준)</div>
          ${s.pendingCheckpoint ? `<div class="notice" style="margin-top:8px"><b>판단 포인트 ${s.pendingCheckpoint.r}</b><br>${TL.esc(s.pendingCheckpoint.q)}<textarea id="sCpNote" rows="2" style="margin-top:6px" placeholder="내 계획과 이유 (복기 화면에 기록돼)"></textarea><div class="row" style="margin-top:4px"><button class="xs" id="sCpSave">기록</button><button class="xs ghost" id="sCpSkip">건너뛰기</button></div></div>` : ''}
        </div>
        <div class="panel"><h3>롤다운 확률 계산 <span class="pill st st-training-model">model</span></h3>${calcHTML()}</div>
        <div class="panel"><h3>해금 · 경쟁 설정</h3>
          <div class="tiny">해금 조건은 시뮬레이션하지 않아. 실제 게임처럼 조건을 달성했다고 판단되면 해금 처리 → 다음 상점에 1장 보장(Riot 공지).</div>
          <select id="sUnlockSel" style="width:100%;margin-top:6px"><option value="">해금형 챔피언 선택…</option>${TL.data.champs().filter(c => c.unlock && c.cost <= 5).map(c => `<option value="${c.id}" ${s.unlocked[c.id] ? 'disabled' : ''}>${c.cost}코 ${TL.esc(c.name)}${s.unlocked[c.id] ? ' (해금됨)' : ''}</option>`).join('')}</select>
          <div class="tiny" id="sUnlockCond" style="margin-top:4px"></div><button class="sm" id="sUnlock" style="margin-top:4px">해금 처리</button>
          <div class="tiny" style="margin-top:4px">7코스트 4명은 상점 확률/풀 미공개라 시뮬레이터 상점에서 제외.</div>
          <div class="divider"></div>
          <div class="tiny">경쟁 시나리오: 다른 플레이어가 특정 챔피언을 모으는 상황</div>
          <div class="row" style="margin-top:4px"><select id="sContestC" style="flex:1"><option value="">없음</option>${TL.data.champs().filter(c => c.cost <= 5 && !c.unlock).map(c => `<option value="${c.id}" ${s.contest.champ === c.id ? 'selected' : ''}>${c.cost}코 ${TL.esc(c.name)}</option>`).join('')}</select><select id="sContestN">${[0, 1, 2, 3].map(n => `<option ${s.contest.players === n ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="tiny">명</span></div>
        </div>
      </div>
      <div class="col" style="gap:12px">
        ${phaseHTML()}
        <div class="panel"><h3>내 보드 <span class="tiny">드래그로 배치 · 대기석 ↔ 보드 · 상점 영역으로 드래그 = 판매</span></h3>
          <div class="board" id="sBoard"></div><div class="bench" id="sBench"></div>
          <div class="divider"></div>
          <div class="row between"><b class="small">아이템 (${s.items.length})</b><span class="tiny">${selItem != null ? '<b class="gold-t">아이템 선택됨 → 유닛 클릭 / 다른 재료 클릭 시 조합</b>' : '클릭 선택 후 유닛 클릭, 또는 드래그'}</span></div>
          <div class="itembench" id="sItems" style="margin-top:4px">${s.items.map((i, k) => { const it = TL.data.item(i); return `<span class="itm icon ${it?.type} ${selItem === k ? 'sel' : ''}" draggable="true" data-item="${i}" data-from="sim" data-idx="${k}" title="${TL.esc((it?.nameKo || it?.name || '') + '\n' + (it?.description || '') + (it?.recipe ? '\n조합: ' + it.recipe.map(r => TL.data.item(r)?.nameKo).join(' + ') : ''))}">${TL.ui.item(i)}<span class="iname">${TL.esc(it?.nameKo || it?.name || i)}</span></span>`; }).join('') || '<span class="tiny">없음</span>'}</div>
          <div id="sSel" style="margin-top:8px"></div>
        </div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><h3>특성</h3>${E.traitsHTML(tr, false)}</div>
        <div class="panel"><h3>증강 (${s.augments.length})</h3>${s.augments.map(a => `<div class="tiny"><b class="tier-${a.tier}">${TL.esc(a.name)}</b> · ${a.at}${a.reason ? ' — ' + TL.esc(a.reason) : ''}</div>`).join('') || '<div class="tiny">아직 없음 (2-1 / 3-2 / 4-2)</div>'}
          <details><summary>수동 보정 (증강·특성 효과 반영)</summary><div class="tiny" style="margin:4px 0">증강/특성 효과(설명의 수치 참고)를 직접 반영. 모든 보정은 로그에 "수동"으로 기록돼.</div>
            <div class="row"><input type="number" id="adjG" placeholder="골드 ±" style="width:80px"/><button class="xs" id="adjGB">골드</button><input type="number" id="adjX" placeholder="XP +" style="width:70px"/><button class="xs" id="adjXB">XP</button><input type="number" id="adjH" placeholder="체력 ±" style="width:80px"/><button class="xs" id="adjHB">체력</button></div>
            <div class="row" style="margin-top:4px"><select id="adjI" style="flex:1">${TL.data.items().filter(i => i.type !== 'emblem' || true).map(i => `<option value="${i.id}">${TL.esc((i.nameKo || i.name) + ' (' + i.type + ')')}</option>`).join('')}</select><button class="xs" id="adjIB">아이템 추가</button></div></details>
        </div>
        <div class="panel"><h3>로그 <button class="xs" id="sReview">복기 보기</button></h3><div class="log" id="sLog">${s.log.slice(0, 120).map(l => `<div><b>${l.r}</b><span class="${l.type === 'loss' ? 'red-t' : l.type === 'win' ? 'green-t' : l.type === 'star' ? 'gold-t' : ''}">${TL.esc(l.t)}</span></div>`).join('')}</div></div>
      </div>
    </div>`;
    bind();
  }
  function trackHTML() {
    const s = S(); const out = [];
    for (let st = Math.max(1, s.stage - 1); st <= s.stage + 1; st++) for (let r = 1; r <= E.roundsInStage(st); r++) {
      const id = `${st}-${r}`; const h = s.history.find(x => x.r === id); const cur = st === s.stage && r === s.round;
      const t = E.roundType(st, r); out.push(`<span class="${cur ? 'cur' : ''} ${h ? 'done ' + (h.result === 'win' ? 'w' : h.result === 'loss' ? 'l' : '') : ''}" title="${t}${E.isAugmentRound(st, r) ? ' + 증강' : ''}">${id}${t === 'carousel' ? '🎠' : t === 'pve' ? '👾' : ''}${E.isAugmentRound(st, r) ? '✦' : ''}${h?.result === 'win' ? '✓' : h?.result === 'loss' ? '✗' : ''}</span>`);
    }
    return out.join('');
  }
  function phaseHTML() {
    const s = S();
    if (s.phase === 'over') return `<div class="panel"><h3>게임 종료 — <span class="gold-t">${s.placement}위</span></h3><div class="row"><button class="primary" id="sReview2">복기 보기</button><button id="sNew2">새 게임</button></div></div>`;
    if (s.phase === 'carousel') return `<div class="panel"><h3>${rid()} 회전초밥 <span class="pill st st-training-model">구성: training-model</span></h3><div class="shop" style="grid-template-columns:repeat(3,minmax(0,1fr))">${s.carousel.map((o, i) => { const c = TL.data.champ(o.champ), it = TL.data.item(o.item); return shopCard(c, { attr: `data-car="${i}"`, extra: `<span class="own" style="display:flex;align-items:center;gap:3px">${TL.ui.item(o.item)}${TL.esc(it?.nameKo || it?.name || '')}</span>`, noCoin: true }); }).join('')}</div><div class="tiny" style="margin-top:6px">실제 회전초밥 순서는 체력 낮은 순(1-1은 동시) — 여기서는 원하는 1명을 고르는 연습만 해.</div></div>`;
    if (s.phase === 'augment') {
      if (!s.augOffer.length) return `<div class="panel"><h3>${rid()} 증강 선택</h3><div class="tiny" style="margin-bottom:6px">증강 등급 출현 확률은 공개되지 않아 직접 고르거나 무작위(동일 확률)로 뽑아. (training-model)</div><div class="row">${['Silver', 'Gold', 'Prismatic'].map(t => `<button class="sm" data-augt="${t}"><span class="tier-${t}">${t}</span></button>`).join('')}<button class="sm" data-augt="">무작위</button></div></div>`;
      return `<div class="panel"><h3>${rid()} 증강 선택 · <span class="tier-${s.augTier}">${s.augTier}</span> <button class="xs" id="sAugRe" ${s.augRerolled ? 'disabled' : ''}>선택지 새로고침(1회, 훈련용)</button></h3><div class="grid g3">${s.augOffer.map(id => { const a = TL.data.aug(id); return `<button class="aug ${a.tier}" data-aug="${id}"><span class="an">${TL.esc(a.name)}</span><span class="tiny">${TL.esc(a.description)}</span><span class="chips">${a.categories.map(c => `<span class="chip">${c}</span>`).join('')}${a.relatedTraits.map(t => `<span class="chip">${TL.esc(t)}</span>`).join('')}</span></button>`; }).join('')}</div><textarea id="sAugReason" rows="2" style="margin-top:8px" placeholder="선택 이유 (현재 체력/골드/보드/아이템 관점)"></textarea><div class="tiny">증강 연구실에서 같은 선택지를 상황별로 비교할 수 있어. 설명은 현재 데이터(${TL.esc(TL.data.bundle().augments.meta.patch)}) 원문(영문). 이 라운드에 등장 가능한 증강만 제시(데이터에 등장 라운드가 있을 때).</div></div>`;
    }
    const s2 = S();
    const R2 = TL.data.rules(); const need = E.xpToNext(s2.level);
    return `<div class="panel" id="sShopPanel"><h3>상점 <span class="row"><span class="tiny">Lv${s2.level} 확률 ${E.oddsRow(s2.level).map((p, i) => `<span class="cost-${i + 1}" style="color:var(--cc);font-weight:700">${p}%</span>`).join(' · ')}</span>${TL.ui.coin(s2.gold)}</span></h3>
      <div class="shopbar"><div class="sb-left">
        <button class="sb-btn" id="sXp" ${s2.phase !== 'planning' ? 'disabled' : ''}><span>XP 구매<small>F · Lv${s2.level} ${need ? s2.xp + '/' + need : 'MAX'}</small></span>${TL.ui.coin(R2.xpBuyCost ?? 4)}</button>
        <button class="sb-btn" id="sRoll" ${s2.phase !== 'planning' ? 'disabled' : ''}><span>새로고침<small>D</small></span>${TL.ui.coin(R2.rerollCost ?? 2)}</button>
        <button class="sb-btn ${s2.locked ? 'on' : ''}" id="sLock"><span>${s2.locked ? '🔒 잠김' : '🔓 잠금'}<small>다음 라운드 유지</small></span></button>
      </div><div class="shop">${s2.shop.map((id, i) => { if (!id) return '<div class="card empty"></div>'; const c = TL.data.champ(id); const own = ownedCopies(id); return shopCard(c, { attr: `data-buy="${i}" ${s2.gold < c.cost ? 'style="opacity:.5;filter:grayscale(.5)"' : ''}`, extra: `${own ? `<span class="own">보유 ${own}</span>` : ''}<span class="pool">풀 ${s2.pool[id]}</span>` }); }).join('')}</div></div></div>`;
  }
  function shopCard(c, o = {}) {
    const art = TL.img.champ(c.id);
    return `<button class="card cost-${c.cost}" ${o.attr || ''}>${art ? `<img class="cd-art" src="${art}" alt="" draggable="false">` : ''}<span class="cd-traits">${c.traits.map(t => `<span class="tl">${TL.ui.trait(t, 'none', 'xs')}${TL.esc(t)}</span>`).join('')}</span>${o.extra || ''}<span class="cd-bot"><span class="nm">${TL.esc(TL.data.name(c))}</span>${o.noCoin ? '' : TL.ui.coin(c.cost)}</span></button>`;
  }
  function calcHTML() {
    const s = S(); const opts = TL.data.champs().filter(c => c.cost <= 5 && (!c.unlock || s.unlocked[c.id]));
    const cid = calcTarget || (s.board[0]?.champ) || opts[0].id; const c = TL.data.champ(cid); const pl = poolLeftObj();
    const own = ownedCopies(cid), next = own >= 3 ? 9 - own : 3 - own;
    const per = E.shopHitChance(s.level, cid, pl);
    return `<select id="sCalcC" style="width:100%">${opts.map(o => `<option value="${o.id}" ${o.id === cid ? 'selected' : ''}>${o.cost}코 ${TL.esc(o.name)}${ownedCopies(o.id) ? ' · 보유 ' + ownedCopies(o.id) : ''}</option>`).join('')}</select>
      <div class="tiny" style="margin-top:4px">풀 남은 수 <b>${s.pool[cid]}</b>/${E.poolSize(c.cost) ?? '?'} · 내 보유 ${own} · 다른 플레이어(봇) 보유 ${s.botsHeld[cid] || 0}</div>
      <div class="tiny">Lv${s.level} 상점 1회에 1장 이상 볼 확률 ≈ <b class="gold-t">${(per * 100).toFixed(1)}%</b></div>
      <div class="row" style="margin-top:4px"><label class="tiny">목표 ${next}장 · 예산</label><input type="number" id="sCalcG" value="${Math.max(0, s.gold)}" style="width:70px"/><button class="xs" id="sCalcRun">계산</button></div><div class="tiny" id="sCalcOut"></div>`;
  }
  function selHTML() {
    const u = findU(sel); if (!u) return '';
    const c = TL.data.champ(u.champ); const v = E.sellValue(c.cost, u.star);
    return `<div class="notice blue"><b>${TL.esc(c.name)} ${'★'.repeat(u.star)}</b> · ${c.traits.join(' / ')} · ${(u.items || []).map(i => TL.esc(TL.data.item(i)?.nameKo || i)).join(', ') || '아이템 없음'} <button class="xs danger" id="sSell">판매 +${v}G</button></div>`;
  }
  function bind() {
    const s = S();
    const q = (id, fn) => { const e = TL.$(id); if (e) e.onclick = fn; };
    q('#sNew', () => TL.confirm('새 게임', '진행 중인 게임을 버리고 새로 시작할까?', () => { TL.state.sim = null; TL.save(); render(); }, '새 게임', 'danger'));
    q('#sNew2', () => { TL.state.sim = null; TL.save(); render(); });
    q('#sMode', () => { s.combatMode = s.combatMode === 'auto' ? 'manual' : 'auto'; TL.save(); render(); });
    q('#sRestart', () => { if (!s.roundStart) return TL.toast('되돌릴 시작 상태가 없어.'); TL.confirm('라운드 시작으로 되돌리기', `${s.roundStart.stage}-${s.roundStart.round} 계획 단계 시작 상태로 되돌릴까? (같은 상황 반복 연습용 · 실제 게임엔 없는 기능)`, () => { const keepLog = s.log, keepHist = s.history; const rs = s.roundStart; TL.state.sim = TL.clone(rs); TL.state.sim.log = keepLog; TL.state.sim.history = keepHist; TL.state.sim.roundStart = TL.clone(rs); log('라운드 시작 상태로 되돌림(연습)', 'sys'); TL.save(); render(); }); });
    q('#sFight', fight); q('#sRoll', reroll); q('#sXp', buyXp);
    q('#sLock', () => { s.locked = !s.locked; TL.save(); render(); });
    q('#sReview', review); q('#sReview2', review);
    q('#sCpSave', () => { s.decisions.push({ r: s.pendingCheckpoint.r, q: s.pendingCheckpoint.q, note: TL.$('#sCpNote').value, hp: s.hp, gold: s.gold, level: s.level, lowHp: s.pendingCheckpoint.lowHp }); s.pendingCheckpoint = null; TL.save(); render(); });
    q('#sCpSkip', () => { if (s.pendingCheckpoint.lowHp) s.decisions.push({ r: s.pendingCheckpoint.r, q: s.pendingCheckpoint.q, note: '(건너뜀)', lowHp: true }); s.pendingCheckpoint = null; TL.save(); render(); });
    TL.$$('[data-car]').forEach(b => b.onclick = () => pickCarousel(+b.dataset.car));
    TL.$$('[data-buy]').forEach(b => b.onclick = () => buy(+b.dataset.buy));
    TL.$$('[data-augt]').forEach(b => b.onclick = () => { genAugOffer(b.dataset.augt || null); TL.save(); render(); });
    q('#sAugRe', () => { s.augRerolled = true; genAugOffer(s.augTier); TL.save(); render(); });
    TL.$$('[data-aug]').forEach(b => b.onclick = () => pickAug(b.dataset.aug, TL.$('#sAugReason')?.value || ''));
    const shopPanel = TL.$('#sShopPanel'); if (shopPanel) { shopPanel.ondragover = e => e.preventDefault(); shopPanel.ondrop = e => { let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } if (d.kind === 'unit') sell(d.uid); }; }
    const click = zone => (p, uid) => {
      if (selItem != null && uid) return equipFromBench(selItem, uid);
      if (uid) { sel = sel === uid ? null : uid; return render(); }
      if (sel) return moveUnit(sel, zone === 'board' ? { zone, pos: p } : { zone, slot: p });
    };
    const drop = (d, t) => { if (d.kind === 'unit' && d.uid !== t.uid) return moveUnit(d.uid, t); if (d.kind === 'item' && d.from === 'sim') { if (!t.uid) return TL.toast('아이템은 유닛 위에 놓아 줘.'); return equipFromBench(+d.idx, t.uid); } };
    const busy = s.phase === 'over';
    TL.board.render(TL.$('#sBoard'), s.board, { selected: sel, onClick: busy ? null : click('board'), onDrop: busy ? null : drop, onRemove: busy ? null : sell });
    TL.board.renderBench(TL.$('#sBench'), s.bench, { selected: sel, onClick: busy ? null : click('bench'), onDrop: busy ? null : drop, onRemove: busy ? null : sell });
    TL.$('#sSel').innerHTML = selHTML(); q('#sSell', () => sell(sel));
    TL.$$('#sItems [data-idx]').forEach(x => { x.onclick = () => { const k = +x.dataset.idx; if (selItem != null && selItem !== k) { const a = TL.data.item(s.items[selItem]), b = TL.data.item(s.items[k]); if (a?.type === 'component' && b?.type === 'component') { const i = selItem; selItem = null; return combineOnBench(i, k); } } selItem = selItem === k ? null : k; render(); }; x.ondragstart = e => e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'item', from: 'sim', idx: x.dataset.idx, item: x.dataset.item })); });
    const us = TL.$('#sUnlockSel'); if (us) us.onchange = () => { const c = TL.data.champ(us.value); TL.$('#sUnlockCond').textContent = c ? '조건: ' + (c.unlockCondition || '미공개') : ''; };
    q('#sUnlock', () => { const id = TL.$('#sUnlockSel').value; if (!id) return; s.unlocked[id] = true; s.guaranteed.push(id); log(`해금 처리: ${TL.data.champ(id).name} (다음 상점 1장 보장)`, 'sys'); TL.save(); render(); });
    const cc = TL.$('#sContestC'), cn = TL.$('#sContestN'); if (cc) { const upd = () => { s.contest = { champ: cc.value || null, players: +cn.value }; botsTick(true); log(`경쟁 설정: ${cc.value ? TL.data.champ(cc.value).name + ' × ' + cn.value + '명' : '없음'}`, 'sys'); TL.save(); render(); }; cc.onchange = upd; cn.onchange = upd; }
    const calcSel = TL.$('#sCalcC'); if (calcSel) calcSel.onchange = () => { calcTarget = calcSel.value; render(); };
    q('#sCalcRun', () => { const cid = TL.$('#sCalcC').value; const own = ownedCopies(cid); const need = own >= 3 ? 9 - own : 3 - own; const r = E.rolldown({ level: s.level, champId: cid, need, gold: +TL.$('#sCalcG').value || 0, otherHeld: (E.poolSize(TL.data.champ(cid).cost) || 0) - (s.pool[cid] || 0) - own, ownedHeld: own, sims: 2000 }); TL.$('#sCalcOut').innerHTML = r.error ? r.error : `${need}장 확보 확률 <b class="gold-t">${(r.p * 100).toFixed(1)}%</b>${r.avgGold != null ? ` · 성공 시 평균 ${r.avgGold.toFixed(0)}G / ${r.avgRolls.toFixed(1)}회` : ''} <span class="dim">(몬테카를로 ${r.sims}회, 같은 코스트 다른 챔피언 풀은 가득 찬 것으로 가정)</span>`; });
    const adj = (key, fn) => q(key, fn);
    adj('#adjGB', () => { const v = +TL.$('#adjG').value || 0; s.gold = Math.max(0, s.gold + v); log(`수동 보정: 골드 ${v >= 0 ? '+' : ''}${v}`, 'sys'); TL.save(); render(); });
    adj('#adjXB', () => { const v = Math.max(0, +TL.$('#adjX').value || 0); addXp(v); log(`수동 보정: XP +${v}`, 'sys'); TL.save(); render(); });
    adj('#adjHB', () => { const v = +TL.$('#adjH').value || 0; s.hp = Math.min(100, s.hp + v); log(`수동 보정: 체력 ${v >= 0 ? '+' : ''}${v}`, 'sys'); if (s.hp <= 0) return gameOver(); TL.save(); render(); });
    adj('#adjIB', () => { const id = TL.$('#adjI').value; s.items.push(id); log(`수동 보정: ${TL.data.item(id)?.nameKo || id} 추가`, 'sys'); TL.save(); render(); });
  }
  function renderStart(el) {
    const hist = TL.state.simHistory;
    const avg = hist.length ? (TL.sum(hist.map(h => h.placement)) / hist.length).toFixed(2) : '-';
    el.innerHTML = `<div class="view-head"><div><h2>Game Simulator <span class="muted small">운영 시뮬레이터</span></h2><p>1-1부터 끝까지 라운드를 진행하며 골드·레벨·리롤·배치·아이템·증강 판단을 연습해.</p></div></div>
    <div class="grid g2">
      <div class="panel"><h3>새 게임</h3>
        <div class="field"><label>전투 결과 처리</label><select id="ngMode"><option value="auto">자동 추정 (훈련용 전투력 모델)</option><option value="manual">수동 입력 (매 PvP마다 승/패 직접 입력)</option></select></div>
        <div class="row" style="margin-top:8px"><button class="primary" id="ngStart">1-1부터 시작</button></div>
        <div class="divider"></div>
        <h4>상황 시나리오로 시작</h4><div class="tiny">특정 상황(예: 4-1, 체력 35, 50G, Lv7)을 반복 연습. 보드/아이템은 해당 레벨의 실제 상점 확률로 무작위 생성.</div>
        <div class="fgrid" style="margin-top:6px"><div class="field"><label>스테이지</label><input type="number" id="scS" value="4" min="2" max="7"/></div><div class="field"><label>라운드</label><input type="number" id="scR" value="1" min="1" max="7"/></div><div class="field"><label>체력</label><input type="number" id="scH" value="35" min="1" max="100"/></div><div class="field"><label>골드</label><input type="number" id="scG" value="50" min="0" max="200"/></div><div class="field"><label>레벨</label><input type="number" id="scL" value="7" min="2" max="10"/></div><div class="field"><label>XP</label><input type="number" id="scX" value="0" min="0" max="80"/></div><div class="field"><label>연속(+승/−패)</label><input type="number" id="scK" value="0" min="-12" max="12"/></div></div>
        <div class="row" style="margin-top:6px"><button id="scStart">시나리오 시작</button>${[['3-2 표준', 3, 2, 70, 30, 5, 4, 0], ['4-1 롤다운', 4, 1, 55, 50, 7, 20, -1], ['4-1 체력35', 4, 1, 35, 50, 7, 0, -3], ['5-1 9레벨?', 5, 1, 60, 60, 8, 30, 2]].map(p => `<button class="sm" data-preset='${JSON.stringify(p.slice(1))}'>${p[0]}</button>`).join('')}</div>
      </div>
      <div class="panel"><h3>지난 시뮬레이션 <span class="pill">${hist.length}게임 · 평균 ${avg}위</span></h3>
        <div class="scroll" style="max-height:420px">${hist.length ? `<table class="table"><thead><tr><th>날짜</th><th>순위</th><th>종료</th><th>Lv</th><th>특성</th><th>리롤/XP 지출</th><th>이자 합</th></tr></thead><tbody>${hist.map(h => `<tr><td>${TL.fmtDate(h.date)}</td><td><b class="${h.placement <= 4 ? 'green-t' : 'red-t'}">${h.placement}</b></td><td>${h.end}</td><td>${h.level}</td><td class="tiny">${TL.esc(h.traits.join(', '))}</td><td>${h.stats.rollGold}G / ${h.stats.xpGold}G</td><td>${h.stats.interest}G</td></tr>`).join('')}</tbody></table>` : '<div class="empty">아직 완료한 게임이 없어.</div>'}</div>
      </div>
    </div>`;
    TL.$('#ngStart').onclick = () => { newGame({ combatMode: TL.$('#ngMode').value }); render(); };
    TL.$('#scStart').onclick = () => { const sc = { stage: TL.clamp(+TL.$('#scS').value, 2, 7), round: TL.clamp(+TL.$('#scR').value, 1, 7), hp: TL.clamp(+TL.$('#scH').value, 1, 100), gold: TL.clamp(+TL.$('#scG').value, 0, 300), level: TL.clamp(+TL.$('#scL').value, 2, 10), xp: TL.clamp(+TL.$('#scX').value, 0, 80), streak: TL.clamp(+TL.$('#scK').value, -12, 12) }; if (E.roundType(sc.stage, sc.round) === 'carousel') sc.round++; newGame({ combatMode: TL.$('#ngMode').value, scenario: sc }); render(); };
    TL.$$('[data-preset]').forEach(b => b.onclick = () => { const [st, r, h, g, l, x, k] = JSON.parse(b.dataset.preset); TL.$('#scS').value = st; TL.$('#scR').value = r; TL.$('#scH').value = h; TL.$('#scG').value = g; TL.$('#scL').value = l; TL.$('#scX').value = x; TL.$('#scK').value = k; });
  }
  function review() {
    const s = S(); if (!s) return;
    const st = s.stats; const gs = st.goldStarts; const avgGold = gs.length ? (TL.sum(gs.map(x => x.g)) / gs.length).toFixed(1) : '-';
    const bench = [['4', '2-1 (보드가 이길 수 있을 때)'], ['5', '2-5 (2-1에 4레벨을 갔다면)'], ['6', '3-2'], ['7', '3-5 (레벨업 후 30G↑, 패배 중이면 40G↑) 또는 3-7'], ['8', '4-1/4-2 (롤다운) 또는 4-5/5-1'], ['9', '2성 탱커+2성 캐리 확보 후 (4코스트 보드)']];
    const hit = lv => s.levelLog.find(x => x.level === +lv)?.r || '-';
    const pvp = s.history.filter(h => h.type === 'pvp');
    TL.modal(`복기 · ${s.placement ? s.placement + '위' : rid() + ' 진행 중'}`, `
      <div class="kpis"><div class="kpi"><span>순위</span><b class="gold-t">${s.placement ?? '-'}</b></div><div class="kpi"><span>PvP 전적</span><b>${st.wins}승 ${st.losses}패</b></div><div class="kpi"><span>받은 피해</span><b>${st.damage}</b></div><div class="kpi"><span>이자 합계</span><b>${st.interest}G</b></div><div class="kpi"><span>연속 보너스</span><b>${st.streakGold}G</b></div><div class="kpi"><span>리롤 지출</span><b>${st.rollGold}G</b><small>${st.rolls}회</small></div><div class="kpi"><span>XP 지출</span><b>${st.xpGold}G</b><small>${st.xpBuys}회</small></div><div class="kpi"><span>라운드 시작 평균 골드</span><b>${avgGold}</b></div></div>
      <h4>레벨 타이밍 vs 일반 가이드</h4><table class="table"><thead><tr><th>레벨</th><th>내 도달</th><th>참고 타이밍 (tft.ninja leveling 가이드, Set 18)</th></tr></thead><tbody>${bench.map(([l, t]) => `<tr><td>Lv${l}</td><td><b>${hit(l)}</b></td><td class="tiny">${t}</td></tr>`).join('')}</tbody></table>
      <h4>판단 포인트 기록</h4>${s.decisions.length ? s.decisions.map(d => `<div class="tiny" style="margin-bottom:4px"><b class="gold-t">${d.r}</b> ${TL.esc(d.q)}<br>→ ${TL.esc(d.note || '(메모 없음)')} ${d.hp != null ? `<span class="dim">(체력 ${d.hp}, ${d.gold}G, Lv${d.level})</span>` : ''}</div>`).join('') : '<div class="tiny">기록 없음</div>'}
      <h4>PvP 결과 (훈련용 전투력 추정)</h4><div class="scroll" style="max-height:200px"><table class="table"><thead><tr><th>라운드</th><th>결과</th><th>피해</th><th>내/상대 전투력</th><th>추정 승률</th><th>골드</th><th>Lv</th></tr></thead><tbody>${pvp.map(h => `<tr><td>${h.r}</td><td class="${h.result === 'win' ? 'green-t' : 'red-t'}">${h.result === 'win' ? '승' : '패'}</td><td>${h.dmg || ''}</td><td>${h.me} / ${h.opp}</td><td>${Math.round(h.p * 100)}%</td><td>${h.gold}</td><td>${h.level}</td></tr>`).join('')}</tbody></table></div>
      <div class="notice tiny" style="margin-top:8px">체크: ① 50G 이상을 오래 들고 있었는지(초과 골드는 이자 없음) ② 롤다운 전 레벨을 먼저 올렸는지 ③ 체력 40 이하에서 지출을 미루지 않았는지 ④ 판단 포인트 메모와 실제 행동이 일치했는지.</div>`);
  }
  V.hotkey = e => {
    const s = S(); if (!s) return; const k = e.key.toLowerCase();
    if (k === 'd') { e.preventDefault(); reroll(); }
    else if (k === 'f') { e.preventDefault(); buyXp(); }
    else if (k === 'e' && sel) { e.preventDefault(); sell(sel); }
    else if (k === ' ' && s.phase === 'planning') { e.preventDefault(); fight(); }
  };
  V.render = render;
  V._api = { newGame, buy, reroll, buyXp, sell, fight, merge, pickCarousel, genAugOffer, pickAug, resolvePvp, moveUnit, equipFromBench, nextRound, power };
  TL.views.sim = V;
})(window.TL);
