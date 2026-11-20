/* Team Builder — 7×4 hex board, drag & drop, bench, stars, items, traits, unlocks, comps, compare, PNG export */
'use strict';
(function (TL) {
  const V = {};
  let itemTab = 'component', unlockMode = false, pendingItem = null;
  const B = () => TL.state.builder;
  const allUnits = () => [...B().board, ...B().bench.filter(Boolean)];
  const findUnit = id => allUnits().find(u => u.id === id);
  const cap = () => TL.engine.cap(B().level, B().board);
  const mk = champ => ({ id: TL.uid('u'), champ, star: 1, items: [], role: null });

  function freeHex() { const used = new Set(B().board.map(u => u.pos)); for (let i = 0; i < 28; i++) if (!used.has(i)) return i; return -1; }
  function freeSlot() { return B().bench.findIndex(x => !x); }
  function detach(id) {
    const b = B(); const bi = b.board.findIndex(u => u.id === id); if (bi >= 0) return b.board.splice(bi, 1)[0];
    const si = b.bench.findIndex(u => u && u.id === id); if (si >= 0) { const u = b.bench[si]; b.bench[si] = null; return u; } return null;
  }
  function addChamp(cid, target) {
    const c = TL.data.champ(cid); if (!c) return;
    if (unlockMode) { if (c.unlock) { B().unlocked[cid] = !B().unlocked[cid]; TL.save(); render(); TL.toast(`${c.name}: ${B().unlocked[cid] ? '해금 완료로 표시' : '미해금으로 표시'}`); } else TL.toast('기본 상점 챔피언은 해금이 필요 없어.'); return; }
    const u = mk(cid);
    if (target && target.zone === 'board') { if (B().board.length >= cap() && !target.uid) return TL.toast(`배치 인원 초과 (레벨 ${B().level} → 최대 ${cap()}명)`, 'err'); if (target.uid) { const old = detach(target.uid); const s = freeSlot(); if (old && s >= 0) B().bench[s] = old; } u.pos = target.pos; B().board.push(u); }
    else if (target && target.zone === 'bench') { if (target.uid) return TL.toast('빈 대기석 칸에 놓아 줘.'); B().bench[target.slot] = u; }
    else if (B().board.length < cap() && freeHex() >= 0) { u.pos = freeHex(); B().board.push(u); }
    else { const s = freeSlot(); if (s < 0) return TL.toast('보드와 대기석이 가득 찼어.', 'err'); B().bench[s] = u; TL.toast('배치 인원 상한 → 대기석에 추가'); }
    if (c.unlock && !B().unlocked[cid]) TL.toast(`${c.name}은(는) 해금형이야 — 해금 조건: ${c.unlockCondition || '미공개'}`);
    B().selected = u.id; TL.save(); render();
  }
  function moveUnit(id, target) {
    const b = B(); const u = findUnit(id); if (!u) return;
    const onBoard = b.board.includes(u);
    if (target.zone === 'board') {
      const occ = b.board.find(x => x.pos === target.pos);
      if (onBoard) { if (occ && occ !== u) occ.pos = u.pos; u.pos = target.pos; }
      else { // bench -> board
        const si = b.bench.indexOf(u);
        if (occ) { b.bench[si] = occ; b.board.splice(b.board.indexOf(occ), 1); delete occ.pos; }
        else { if (b.board.length >= cap()) return TL.toast(`배치 인원 초과 (최대 ${cap()}명)`, 'err'); b.bench[si] = null; }
        u.pos = target.pos; b.board.push(u);
      }
    } else if (target.zone === 'bench') {
      const occ = b.bench[target.slot];
      if (onBoard) { b.board.splice(b.board.indexOf(u), 1); const p = u.pos; delete u.pos; b.bench[target.slot] = u; if (occ) { occ.pos = p; b.board.push(occ); } }
      else { const si = b.bench.indexOf(u); b.bench[si] = occ || null; b.bench[target.slot] = u; }
    }
    TL.save(); render();
  }
  function equip(uid, itemId) {
    const u = findUnit(uid); if (!u) return;
    const r = TL.itemsUI.equip(u, itemId, TL.data.rules().maxItemsPerUnit || 3);
    if (!r.ok) return TL.toast(r.msg, 'err');
    u.items = r.items; if (r.msg) TL.toast(r.msg, 'ok'); TL.save(); render();
  }
  function onDrop(d, target) {
    if (d.kind === 'champ') return addChamp(d.champ, target);
    if (d.kind === 'unit') { if (d.uid === target.uid) return; return moveUnit(d.uid, target); }
    if (d.kind === 'item') { if (!target.uid) return TL.toast('아이템은 유닛 위에 놓아 줘.'); return equip(target.uid, d.item); }
  }
  function remove(uid) { detach(uid); if (B().selected === uid) B().selected = null; TL.save(); render(); }

  function render() {
    const el = TL.$('#view-builder'); const b = B();
    const list = TL.roster.list(b.filters, b.unlocked);
    const traits = TL.engine.traits(b.board, { collab: b.collab });
    const unlockCount = TL.data.champs().filter(c => c.unlock).length, unlocked = Object.values(b.unlocked).filter(Boolean).length;
    const totalCost = TL.sum(b.board.map(u => (TL.data.champ(u.champ)?.cost || 0) * TL.engine.copies(u.star)));
    el.innerHTML = `
    <div class="view-head"><div><h2>Team Builder <span class="muted small">덱 구성 연구실</span></h2><p>드래그 앤 드롭 또는 클릭으로 배치 · 우클릭 = 제거 · 아이템은 유닛 위로 드래그(완성 아이템 자동 조합) · 특성은 단계(브레이크포인트)를 계산하고, 데이터에 있으면 단계별 효과 수치를 보여 줘.</p></div>
      <div class="row">${TL.statusPill(TL.data.bundle().champions.meta.status)}<span class="tiny">${TL.esc(TL.data.bundle().champions.meta.patch)}</span></div></div>
    <div class="split3">
      <div class="panel" id="bRosterPanel">
        <h3>챔피언 <span class="row"><span class="pill">${list.length} / ${TL.data.champs().length}</span><button class="xs ${unlockMode ? 'on' : ''}" id="bUnlockMode" title="켜면 카드 클릭이 해금 상태 토글이 돼">🔓 해금 관리</button></span></h3>
        ${TL.roster.filterHTML('b', b.filters)}
        <div class="tiny" style="margin-bottom:6px">해금 완료 ${unlocked}/${unlockCount} · ${unlockMode ? '<b class="gold-t">해금 관리 모드: 해금형 카드를 클릭해 상태 전환</b>' : '카드 클릭 = 추가, 보드로 드래그 가능'}</div>
        <div class="roster" id="bRoster">${TL.roster.cardsHTML(list, { unlocked: b.unlocked, dimLocked: true })}</div>
        <div class="divider"></div>
        <h3 style="margin-bottom:6px">아이템 ${TL.statusPill(TL.data.bundle().items.meta.status)}</h3>
        <div class="tabs-mini">${[['component', '재료'], ['completed', '완성'], ['emblem', '상징'], ['special', '특수'], ['artifact', '유물'], ['radiant', '찬란한'], ['support', '지원']].filter(([k]) => TL.data.items().some(i => i.type === k)).map(([k, l]) => `<button data-itab="${k}" class="${itemTab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
        <div class="itembench" id="bItems" style="max-height:170px;overflow:auto">${TL.itemsUI.paletteHTML(itemTab)}</div>
        <div class="tiny" style="margin-top:6px">${pendingItem ? `<b class="gold-t">선택된 아이템: ${TL.esc(TL.data.item(pendingItem)?.nameKo || pendingItem)}</b> → 유닛을 클릭해 장착` : '아이템을 유닛에 드래그하거나, 유닛 선택 후 아이템 클릭.'} 표준 조합표는 Set 18 라이브 기준(Set 19 미확인). 상징 조합법 미공개.</div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel">
          <div class="row between" style="margin-bottom:8px">
            <div class="row"><div class="field" style="width:96px"><label>플레이어 레벨</label><select id="bLevel">${Array.from({ length: 11 }, (_, i) => i + 1).map(l => `<option ${l === b.level ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <div class="kpi" style="padding:4px 10px"><span>배치</span><b class="${b.board.length > cap() ? 'red-t' : 'gold-t'}" style="font-size:16px">${b.board.length} / ${cap()}</b></div>
              <div class="kpi" style="padding:4px 10px"><span>보드 가치</span><b style="font-size:16px">${totalCost}G</b></div></div>
            <div class="row"><button class="sm" id="bSnap" title="현재 배치를 '변경 전'으로 저장">📸 변경 전 저장</button><button class="sm" id="bSnapCmp" ${b.snapshot ? '' : 'disabled'}>전후 비교</button><button class="sm" id="bPng">🖼 이미지</button><button class="sm danger" id="bClear">비우기</button></div>
          </div>
          ${b.board.length > cap() ? `<div class="notice red" style="margin-bottom:6px">레벨 ${b.level} 상한(${cap()}명)을 초과했어. 유닛을 대기석으로 옮기거나 레벨을 올려 줘.</div>` : ''}
          <div class="board" id="bBoard"></div>
          <div class="tiny" style="margin-top:4px">위쪽 = 1행(최전방), 아래쪽 = 4행(후방). 실제 게임 화면 기준으로 상대는 1행 쪽에서 진입해.</div>
          <div class="bench" id="bBench"></div>
        </div>
        <div class="panel" id="bSel"></div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><h3>특성 <span class="tiny">${traits.filter(t => t.active >= 0).length}개 활성</span></h3>${TL.engine.traitsHTML(traits)}
          <details><summary>Collab 지정 (게임마다 바뀜)</summary><div class="tiny" style="margin:4px 0">Riot: "Each game a different set of champions gain the Collab trait!" 이번 게임의 Collab 챔피언을 직접 지정해.</div><div class="chips">${[...new Set(b.board.map(u => u.champ))].map(id => `<span class="chip ${b.collab.includes(id) ? 'on' : ''}" data-collab="${id}">${TL.esc(TL.data.name(TL.data.champ(id)))}</span>`).join('') || '<span class="tiny">보드에 챔피언을 먼저 배치해.</span>'}</div></details>
        </div>
        <div class="panel"><h3>조합 저장</h3>
          <div class="field"><label>조합 이름</label><input id="bName" placeholder="예: K/DA 8레벨 · 아리 캐리"/></div>
          <div class="g2 grid" style="margin-top:6px;gap:6px"><div class="field"><label>장점</label><textarea id="bPros" rows="2" placeholder="강한 구간, 상성"></textarea></div><div class="field"><label>단점</label><textarea id="bCons" rows="2" placeholder="약점, 경쟁 위험"></textarea></div></div>
          <div class="field" style="margin-top:6px"><label>핵심 아이템 조합 / 메모</label><textarea id="bKey" rows="2" placeholder="캐리: 구인수+... / 탱커: ... / 전환 경로"></textarea></div>
          <div class="row" style="margin-top:6px"><button class="gold sm" id="bSave">새로 저장</button><button class="sm" id="bExport">조합 JSON</button><button class="sm" id="bImportBtn">JSON 불러오기</button><input type="file" id="bImport" accept="application/json,.json" hidden/></div>
        </div>
        <div class="panel"><h3>저장된 조합 <span class="row"><span class="pill">${TL.state.comps.length}</span><button class="xs" id="bCompare" ${b.compare.length >= 2 ? '' : 'disabled'}>비교 (${b.compare.length})</button></span></h3><div id="bComps" style="max-height:320px;overflow:auto"></div></div>
      </div>
    </div>`;
    bind(traits);
  }

  function selHTML() {
    const b = B(); const u = findUnit(b.selected);
    if (!u) return '<h3>선택 유닛</h3><div class="tiny">보드/대기석의 유닛을 클릭하면 별 레벨, 아이템, 역할(캐리/탱커)을 편집할 수 있어. 선택 상태에서 빈 칸을 클릭하면 이동.</div>';
    const c = TL.data.champ(u.champ); const onBoard = b.board.includes(u);
    return `<h3>${TL.esc(c.name)} ${c.nameKo ? `<span class="muted small">${TL.esc(c.nameKo)}</span>` : ''} <span class="row"><span class="pill cost-${c.cost}" style="color:var(--cc)">${c.cost}코스트</span>${TL.statusPill(c.status)}</span></h3>
      <div class="tiny">${TL.esc(c.role)} · ${c.traits.map(TL.esc).join(' / ')} ${c.effects?.length ? '· 효과: ' + c.effects.join(', ') : ''}</div>
      ${c.unlock ? `<div class="tiny gold-t">해금 조건: ${TL.esc(c.unlockCondition || '미공개')}${c.unlockConditionStatus ? ` <span class="dim">(${TL.esc(c.unlockConditionStatus)})</span>` : ''}</div>` : ''}
      ${c.stats && c.stats.hp ? `<div class="tiny">체력 ${c.stats.hp} · 공격력 ${c.stats.ad ?? '-'} · 공속 ${c.stats.as ?? '-'} · 방어 ${c.stats.armor ?? '-'} · 마저 ${c.stats.mr ?? '-'} · 사거리 ${c.stats.range ?? '-'}${c.ability && c.ability.manaCost != null ? ` · 마나 ${c.ability.manaStart ?? 0}/${c.ability.manaCost}` : ''} <span class="dim">(1성 기준)</span></div>` : ''}
      ${c.ability && c.ability.desc ? `<details style="margin-top:4px"><summary>스킬: ${TL.esc(c.ability.name || '')}</summary><div class="tiny">${TL.esc(c.ability.desc)}</div>${c.heroVariant ? `<div class="tiny gold-t" style="margin-top:4px">Hero 증강 형태 (${TL.esc(c.heroVariant.role)}): ${TL.esc(c.heroVariant.ability?.name || '')} — ${TL.esc(c.heroVariant.ability?.desc || '')}</div>` : ''}</details>` : ''}
      <div class="row" style="margin-top:8px"><button class="sm" id="buDown">★−</button><span class="pill gold">${'★'.repeat(u.star)}</span><button class="sm" id="buUp">★+</button>
        <button class="sm ${u.role === 'carry' ? 'on' : ''}" id="buCarry">⚔ 핵심 딜러</button><button class="sm ${u.role === 'tank' ? 'on' : ''}" id="buTank">🛡 핵심 탱커</button>
        <button class="sm" id="buBench">${onBoard ? '대기석으로' : '보드로'}</button><button class="sm danger" id="buDel">제거</button></div>
      <div class="row" style="margin-top:8px">${(u.items || []).map((i, k) => { const it = TL.data.item(i); return `<span class="itm ${it?.type}" title="${TL.esc(it?.description || '')}">${TL.esc(it?.nameKo || it?.name || i)} <button class="xs ghost" data-unequip="${k}" title="해제">✕</button></span>`; }).join('') || '<span class="tiny">아이템 없음 (최대 3개)</span>'}</div>`;
  }

  function bind(traits) {
    const b = B(), el = TL.$('#view-builder');
    const refilter = () => { b.filters.q = TL.$('#bQ').value; b.filters.cost = TL.$('#bCost').value; b.filters.trait = TL.$('#bTrait').value; b.filters.unlock = TL.$('#bUnlock').value; TL.save(); const list = TL.roster.list(b.filters, b.unlocked); TL.$('#bRoster').innerHTML = TL.roster.cardsHTML(list, { unlocked: b.unlocked, dimLocked: true }); TL.roster.bind(TL.$('#bRoster'), id => addChamp(id)); };
    TL.$('#bQ').oninput = TL.debounce(refilter, 120); ['#bCost', '#bTrait', '#bUnlock'].forEach(s => TL.$(s).onchange = refilter);
    TL.roster.bind(TL.$('#bRoster'), id => addChamp(id));
    const rp = TL.$('#bRosterPanel'); rp.ondragover = e => e.preventDefault(); rp.ondrop = e => { let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } if (d.kind === 'unit') { remove(d.uid); TL.toast('유닛 제거'); } };
    TL.$('#bUnlockMode').onclick = () => { unlockMode = !unlockMode; render(); };
    TL.$$('[data-itab]').forEach(x => x.onclick = () => { itemTab = x.dataset.itab; render(); });
    TL.itemsUI.bind(TL.$('#bItems'), (id) => { if (b.selected && findUnit(b.selected)) { equip(b.selected, id); } else { pendingItem = pendingItem === id ? null : id; render(); } });
    TL.$('#bLevel').onchange = e => { b.level = +e.target.value; TL.save(); render(); };
    const marks = Object.fromEntries(allUnits().filter(u => u.role).map(u => [u.id, u.role]));
    const click = (zone) => (posOrSlot, uid) => {
      if (pendingItem && uid) { const it = pendingItem; pendingItem = null; return equip(uid, it); }
      if (uid) { b.selected = b.selected === uid ? null : uid; TL.save(); return render(); }
      if (b.selected) { const target = zone === 'board' ? { zone, pos: posOrSlot } : { zone, slot: posOrSlot }; return moveUnit(b.selected, target); }
    };
    TL.board.render(TL.$('#bBoard'), b.board, { selected: b.selected, marks, onClick: click('board'), onDrop, onRemove: remove });
    TL.board.renderBench(TL.$('#bBench'), b.bench, { selected: b.selected, onClick: click('bench'), onDrop, onRemove: remove });
    TL.$('#bSel').innerHTML = selHTML();
    const u = findUnit(b.selected);
    if (u) {
      TL.$('#buDown').onclick = () => { u.star = Math.max(1, u.star - 1); TL.save(); render(); };
      TL.$('#buUp').onclick = () => { u.star = Math.min(3, u.star + 1); TL.save(); render(); };
      TL.$('#buCarry').onclick = () => { u.role = u.role === 'carry' ? null : 'carry'; TL.save(); render(); };
      TL.$('#buTank').onclick = () => { u.role = u.role === 'tank' ? null : 'tank'; TL.save(); render(); };
      TL.$('#buDel').onclick = () => remove(u.id);
      TL.$('#buBench').onclick = () => { if (b.board.includes(u)) { const s = freeSlot(); if (s < 0) return TL.toast('대기석이 가득 찼어.', 'err'); moveUnit(u.id, { zone: 'bench', slot: s }); } else { const p = freeHex(); if (p < 0) return; moveUnit(u.id, { zone: 'board', pos: p }); } };
      TL.$$('[data-unequip]').forEach(x => x.onclick = () => { u.items.splice(+x.dataset.unequip, 1); TL.save(); render(); });
    }
    TL.$$('[data-collab]').forEach(x => x.onclick = () => { const id = x.dataset.collab; b.collab = b.collab.includes(id) ? b.collab.filter(y => y !== id) : [...b.collab, id]; TL.save(); render(); });
    TL.$('#bClear').onclick = () => TL.confirm('보드 비우기', '보드와 대기석의 모든 유닛을 지울까? (저장된 조합은 유지)', () => { b.board = []; b.bench = Array(9).fill(null); b.selected = null; TL.save(); render(); }, '비우기', 'danger');
    TL.$('#bSnap').onclick = () => { b.snapshot = { board: TL.clone(b.board), at: new Date().toISOString() }; TL.save(); TL.toast('변경 전 배치를 저장했어. 배치를 바꾼 뒤 "전후 비교"를 눌러.', 'ok'); render(); };
    TL.$('#bSnapCmp').onclick = () => compareSnapshot();
    TL.$('#bPng').onclick = () => exportPNG(b.board, traits, TL.$('#bName').value || '현재 보드');
    TL.$('#bSave').onclick = () => saveComp();
    TL.$('#bExport').onclick = () => TL.download('tft19-board.json', { type: 'tft-lab-comp', set: 19, dataVersion: TL.data.patch().dataVersion, comp: compFromBoard(TL.$('#bName').value || '내보낸 보드') });
    TL.$('#bImportBtn').onclick = () => TL.$('#bImport').click();
    TL.$('#bImport').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const o = JSON.parse(await TL.readFile(f)); const comps = o.comps || (o.comp ? [o.comp] : []); if (!comps.length) throw Error('comp 없음'); let n = 0; comps.forEach(c => { const v = sanitizeComp(c); if (v) { TL.state.comps.unshift(v); n++; } }); TL.save(); render(); TL.toast(`${n}개 조합을 불러왔어.`, 'ok'); } catch (err) { TL.toast('조합 JSON 형식 오류: ' + err.message, 'err'); } e.target.value = ''; };
    renderComps();
    TL.$('#bCompare').onclick = () => compareComps();
  }

  function compFromBoard(name) {
    const b = B();
    return { id: TL.uid('c'), name, board: TL.clone(b.board), bench: TL.clone(b.bench), level: b.level, collab: b.collab.slice(), notes: { pros: TL.$('#bPros')?.value || '', cons: TL.$('#bCons')?.value || '', memo: '' }, keyItems: TL.$('#bKey')?.value || '', created: new Date().toISOString(), updated: new Date().toISOString(), dataVersion: TL.data.patch().dataVersion };
  }
  function sanitizeComp(c) {
    if (!c || !Array.isArray(c.board)) return null;
    const ok = u => u && TL.data.champ(u.champ) && Number.isInteger(u.pos) && u.pos >= 0 && u.pos < 28;
    const board = c.board.filter(ok).map(u => ({ id: TL.uid('u'), champ: u.champ, star: TL.clamp(+u.star || 1, 1, 3), items: (u.items || []).filter(i => TL.data.item(i)).slice(0, 3), pos: u.pos, role: ['carry', 'tank'].includes(u.role) ? u.role : null }));
    const bench = Array(9).fill(null).map((_, i) => { const u = (c.bench || [])[i]; return u && TL.data.champ(u.champ) ? { id: TL.uid('u'), champ: u.champ, star: TL.clamp(+u.star || 1, 1, 3), items: (u.items || []).filter(i2 => TL.data.item(i2)).slice(0, 3), role: null } : null; });
    return { id: TL.uid('c'), name: String(c.name || '가져온 조합').slice(0, 80), board, bench, level: TL.clamp(+c.level || 8, 1, 11), collab: (c.collab || []).filter(x => TL.data.champ(x)), notes: { pros: String(c.notes?.pros || ''), cons: String(c.notes?.cons || ''), memo: String(c.notes?.memo || '') }, keyItems: String(c.keyItems || ''), created: c.created || new Date().toISOString(), updated: new Date().toISOString() };
  }
  function saveComp() {
    const b = B(); if (!b.board.length) return TL.toast('먼저 보드에 챔피언을 배치해.', 'err');
    const name = TL.$('#bName').value.trim() || `연구 조합 ${TL.state.comps.length + 1}`;
    TL.state.comps.unshift(compFromBoard(name)); TL.save(); render(); TL.toast(`"${name}" 저장`, 'ok');
  }
  function compSummary(c) {
    const tr = TL.engine.traits(c.board, { collab: c.collab }).filter(t => t.active >= 0);
    const carry = c.board.filter(u => u.role === 'carry').map(u => TL.data.name(TL.data.champ(u.champ)));
    const tank = c.board.filter(u => u.role === 'tank').map(u => TL.data.name(TL.data.champ(u.champ)));
    return { tr, carry, tank, cost: TL.sum(c.board.map(u => (TL.data.champ(u.champ)?.cost || 0) * TL.engine.copies(u.star))) };
  }
  function renderComps() {
    const host = TL.$('#bComps'); const b = B();
    if (!TL.state.comps.length) { host.innerHTML = '<div class="empty">저장된 조합이 없어.</div>'; return; }
    host.innerHTML = TL.state.comps.map(c => { const s = compSummary(c); return `<div style="border:1px solid var(--line);border-radius:9px;padding:7px;margin-bottom:6px">
      <div class="row between"><label class="row" style="color:var(--text)"><input type="checkbox" data-cmp="${c.id}" ${b.compare.includes(c.id) ? 'checked' : ''}/> <b>${TL.esc(c.name)}</b></label><span class="tiny">Lv${c.level} · ${c.board.length}명 · ${s.cost}G</span></div>
      <div class="tiny">${s.tr.slice(0, 6).map(t => `${TL.esc(t.name)} ${t.count}`).join(' · ') || '활성 특성 없음'}</div>
      ${s.carry.length || s.tank.length ? `<div class="tiny">⚔ ${TL.esc(s.carry.join(', ') || '-')} · 🛡 ${TL.esc(s.tank.join(', ') || '-')}</div>` : ''}
      ${c.migrated ? '<div class="tiny gold-t">v0.1.0에서 이전됨</div>' : ''}
      <div class="row" style="margin-top:4px"><button class="xs" data-load="${c.id}">불러오기</button><button class="xs" data-over="${c.id}" title="현재 보드/메모로 덮어쓰기">덮어쓰기</button><button class="xs" data-edit="${c.id}">메모</button><button class="xs" data-dup="${c.id}">복제</button><button class="xs danger" data-del="${c.id}">삭제</button></div></div>`; }).join('');
    const get = id => TL.state.comps.find(c => c.id === id);
    TL.$$('[data-cmp]', host).forEach(x => x.onchange = () => { const id = x.dataset.cmp; b.compare = x.checked ? [...new Set([...b.compare, id])].slice(-3) : b.compare.filter(y => y !== id); TL.save(); render(); });
    TL.$$('[data-load]', host).forEach(x => x.onclick = () => { const c = get(x.dataset.load); TL.confirm('조합 불러오기', `현재 보드를 "${TL.esc(c.name)}"로 바꿀까?`, () => { b.board = TL.clone(c.board).filter(u => TL.data.champ(u.champ)); b.bench = TL.clone(c.bench || Array(9).fill(null)).map(u => (u && TL.data.champ(u.champ)) ? u : null); while (b.bench.length < 9) b.bench.push(null); b.level = c.level || 8; b.collab = c.collab || []; b.selected = null; TL.save(); render(); TL.$('#bName').value = c.name; TL.$('#bPros').value = c.notes?.pros || ''; TL.$('#bCons').value = c.notes?.cons || ''; TL.$('#bKey').value = c.keyItems || ''; }); });
    TL.$$('[data-over]', host).forEach(x => x.onclick = () => { const c = get(x.dataset.over); TL.confirm('덮어쓰기', `"${TL.esc(c.name)}"를 현재 보드와 입력한 메모로 덮어쓸까?`, () => { const n = compFromBoard(TL.$('#bName').value.trim() || c.name); Object.assign(c, { ...n, id: c.id, created: c.created }); TL.save(); render(); TL.toast('덮어쓰기 완료', 'ok'); }); });
    TL.$$('[data-dup]', host).forEach(x => x.onclick = () => { const c = TL.clone(get(x.dataset.dup)); c.id = TL.uid('c'); c.name += ' (복제)'; c.created = new Date().toISOString(); TL.state.comps.unshift(c); TL.save(); render(); });
    TL.$$('[data-del]', host).forEach(x => x.onclick = () => { const c = get(x.dataset.del); TL.confirm('조합 삭제', `"${TL.esc(c.name)}"를 삭제할까?`, () => { TL.state.comps = TL.state.comps.filter(y => y.id !== c.id); b.compare = b.compare.filter(y => y !== c.id); TL.save(); render(); }, '삭제', 'danger'); });
    TL.$$('[data-edit]', host).forEach(x => x.onclick = () => { const c = get(x.dataset.edit); TL.modal('조합 메모 · ' + c.name, `<div class="field"><label>이름</label><input id="mN" value="${TL.esc(c.name)}"/></div><div class="g2 grid" style="margin-top:6px"><div class="field"><label>장점</label><textarea id="mP" rows="4">${TL.esc(c.notes?.pros || '')}</textarea></div><div class="field"><label>단점</label><textarea id="mC" rows="4">${TL.esc(c.notes?.cons || '')}</textarea></div></div><div class="field" style="margin-top:6px"><label>핵심 아이템 / 메모</label><textarea id="mK" rows="3">${TL.esc(c.keyItems || '')}</textarea></div><div class="field" style="margin-top:6px"><label>운영 메모 (레벨업/리롤 타이밍, 전환 경로)</label><textarea id="mM" rows="3">${TL.esc(c.notes?.memo || '')}</textarea></div>`, { buttons: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: () => { c.name = TL.$('#mN').value || c.name; c.notes = { pros: TL.$('#mP').value, cons: TL.$('#mC').value, memo: TL.$('#mM').value }; c.keyItems = TL.$('#mK').value; c.updated = new Date().toISOString(); TL.save(); render(); } }] }); });
  }
  function compareComps() {
    const cs = B().compare.map(id => TL.state.comps.find(c => c.id === id)).filter(Boolean);
    if (cs.length < 2) return;
    const allTraits = [...new Set(cs.flatMap(c => compSummary(c).tr.map(t => t.name)))];
    const html = `<div class="grid" style="grid-template-columns:repeat(${cs.length},minmax(0,1fr))">${cs.map(c => { const s = compSummary(c); return `<div><b class="gold-t">${TL.esc(c.name)}</b><div class="tiny">Lv${c.level} · ${c.board.length}명 · 보드 가치 ${s.cost}G</div><div class="mini-board board" data-mini="${c.id}" style="margin:6px 0"></div>
      <div class="tiny"><b>⚔ 딜러</b> ${TL.esc(s.carry.join(', ') || '미지정')}<br><b>🛡 탱커</b> ${TL.esc(s.tank.join(', ') || '미지정')}</div>
      <div class="tiny" style="margin-top:4px"><b>장점</b> ${TL.esc(c.notes?.pros || '-')}<br><b>단점</b> ${TL.esc(c.notes?.cons || '-')}<br><b>핵심 아이템</b> ${TL.esc(c.keyItems || '-')}</div></div>`; }).join('')}</div>
      <h4>특성 비교</h4><table class="table"><thead><tr><th>특성</th>${cs.map(c => `<th>${TL.esc(c.name)}</th>`).join('')}</tr></thead><tbody>${allTraits.map(t => `<tr><td>${TL.esc(t)}</td>${cs.map(c => { const x = compSummary(c).tr.find(y => y.name === t); return `<td>${x ? `<b class="gold-t">${x.count}</b> <span class="tiny">(${x.tiers[x.active]})</span>` : '<span class="dim">-</span>'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>
      <h4>공유 챔피언 (풀 경쟁 주의)</h4><div class="tiny">${(() => { const sets = cs.map(c => new Set(c.board.map(u => u.champ))); const shared = [...sets[0]].filter(id => sets.every(s => s.has(id))); return shared.map(id => TL.esc(TL.data.name(TL.data.champ(id)))).join(', ') || '없음'; })()}</div>`;
    TL.modal('조합 비교', html, { onOpen: body => cs.forEach(c => TL.board.render(TL.$(`[data-mini="${c.id}"]`, body), c.board, { mini: true, marks: Object.fromEntries(c.board.filter(u => u.role).map(u => [u.id, u.role])) })) });
  }
  function compareSnapshot() {
    const b = B(); if (!b.snapshot) return;
    const before = b.snapshot.board, after = b.board;
    const moved = {}; after.forEach(u => { const o = before.find(x => x.id === u.id); if (!o || o.pos !== u.pos) moved[u.pos] = 'moved'; });
    const movedBefore = {}; before.forEach(u => { const n = after.find(x => x.id === u.id); if (!n || n.pos !== u.pos) movedBefore[u.pos] = 'moved'; });
    const added = after.filter(u => !before.some(x => x.id === u.id)).map(u => TL.data.name(TL.data.champ(u.champ)));
    const removed = before.filter(u => !after.some(x => x.id === u.id)).map(u => TL.data.name(TL.data.champ(u.champ)));
    const tb = TL.engine.traits(before, { collab: b.collab }).filter(t => t.active >= 0), ta = TL.engine.traits(after, { collab: b.collab }).filter(t => t.active >= 0);
    TL.modal('배치 변경 전후 비교', `<div class="g2 grid"><div><b>변경 전</b> <span class="tiny">${TL.fmtDate(b.snapshot.at)}</span><div class="board mini-board" id="snapA" style="margin-top:6px"></div></div><div><b>변경 후 (현재)</b><div class="board mini-board" id="snapB" style="margin-top:6px"></div></div></div>
      <div class="tiny" style="margin-top:8px">하늘색 = 위치가 바뀐 유닛 · 추가: ${TL.esc(added.join(', ') || '-')} · 제거: ${TL.esc(removed.join(', ') || '-')}</div>
      <div class="tiny">특성 변화: ${TL.esc(tb.map(t => t.name + ' ' + t.count).join(', ') || '-')} → ${TL.esc(ta.map(t => t.name + ' ' + t.count).join(', ') || '-')}</div>`, { onOpen: body => { TL.board.render(TL.$('#snapA', body), before, { mini: true, highlight: movedBefore }); TL.board.render(TL.$('#snapB', body), after, { mini: true, highlight: moved }); } });
  }
  function exportPNG(board, traits, title) {
    const W = 1200, H = 640, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.fillStyle = '#0b1026'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f6d58e'; g.font = 'bold 26px system-ui, sans-serif'; g.fillText(title, 30, 44);
    g.fillStyle = '#8e98c2'; g.font = '14px system-ui, sans-serif'; g.fillText(`TFT Set 19 · Lv${B().level} · ${board.length}명 · 데이터 ${TL.data.patch().dataVersion} (${TL.data.patch().currentDataPatch}) · TFT Tournament Lab`, 30, 68);
    const R = 46, w = Math.sqrt(3) * R, ox = 60, oy = 120;
    const costCol = { 1: '#9aa4b8', 2: '#3fbf75', 3: '#3d8fe0', 4: '#b05ce8', 5: '#e8b85a', 7: '#ff6f91' };
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
      const cx = ox + c * w + (r % 2 ? w / 2 : 0) + w / 2, cy = oy + r * R * 1.5 + R; const pos = r * 7 + c; const u = board.find(x => x.pos === pos); const ch = u && TL.data.champ(u.champ);
      g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 180 * (60 * k - 90); g.lineTo(cx + (R - 3) * Math.cos(a), cy + (R - 3) * Math.sin(a)); } g.closePath();
      g.fillStyle = u ? '#1d2a5e' : '#141c40'; g.fill(); g.lineWidth = u ? 3 : 1; g.strokeStyle = u ? (costCol[ch?.cost] || '#556') : '#2a3466'; g.stroke();
      if (u) {
        g.fillStyle = '#e9ecfb'; g.font = 'bold 13px system-ui, sans-serif'; g.textAlign = 'center'; const nm = TL.data.name(ch); g.fillText(nm.length > 9 ? nm.slice(0, 9) + '…' : nm, cx, cy - 4);
        g.fillStyle = '#f6d58e'; g.font = '13px system-ui'; g.fillText('★'.repeat(u.star), cx, cy + 13);
        if (u.role) { g.fillStyle = '#5ad1e6'; g.font = '11px system-ui'; g.fillText(u.role === 'carry' ? 'CARRY' : 'TANK', cx, cy - 22); }
        g.fillStyle = '#c3cbec'; g.font = '10px system-ui'; (u.items || []).forEach((i, k) => { const it = TL.data.item(i); const t = (it?.nameKo || it?.name || i); g.fillText(t.length > 8 ? t.slice(0, 8) : t, cx, cy + 27 + k * 11); });
        g.textAlign = 'left';
      }
    }
    g.fillStyle = '#f6d58e'; g.font = 'bold 16px system-ui'; g.fillText('활성 특성', 900, 120);
    traits.filter(t => t.active >= 0).slice(0, 18).forEach((t, k) => { g.fillStyle = { bronze: '#c08a5a', silver: '#c0cad8', gold: '#f0c76a', prism: '#d6b3ff', unique: '#e8b85a' }[t.style] || '#8e98c2'; g.font = '14px system-ui'; g.fillText(`${t.count}  ${t.name}  (${t.tiers.slice(0, t.active + 1).join('/')})`, 900, 148 + k * 24); });
    g.fillStyle = '#66709a'; g.font = '11px system-ui'; g.fillText('Unofficial fan-made practice tool · not endorsed by Riot Games', 30, H - 18);
    cv.toBlob(blob => { if (blob) TL.download(`tft19-board-${TL.today()}.png`, blob, 'image/png'); });
  }
  V.render = render;
  V.exportPNG = exportPNG;
  TL.views.builder = V;
})(window.TL);
