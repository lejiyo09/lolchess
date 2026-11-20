/* Scouting — opponent boards (lobby of 7), my positioning layouts, heuristic threat checks (assassin / AoE / carry protection), contest overview */
'use strict';
(function (TL) {
  const V = {};
  let rf = { q: '', cost: 'all', trait: 'all' }, selE = null, selM = null, itemTab = 'completed', editTarget = 'enemy';
  const SC = () => TL.state.scout;
  const opp = () => SC().opponents.find(o => o.id === SC().activeId) || null;
  const SCEN = { assassin: '암살자 대응', aoe: '광역 공격 대응', protect: '주요 딜러 보호', all: '종합' };

  function ensureOpp() { if (!SC().opponents.length) { const o = { id: TL.uid('o'), name: '상대 1', comp: '', notes: '', board: [] }; SC().opponents.push(o); SC().activeId = o.id; } if (!opp()) SC().activeId = SC().opponents[0].id; }
  function boardOf(t) { return t === 'enemy' ? opp().board : SC().myBoard; }
  function free(board) { const u = new Set(board.map(x => x.pos)); for (const p of [21, 22, 23, 24, 25, 26, 27, 14, 15, 16, 17, 18, 19, 20, 7, 8, 9, 10, 11, 12, 13, 0, 1, 2, 3, 4, 5, 6]) if (!u.has(p)) return p; return -1; }
  function add(cid, pos) {
    const b = boardOf(editTarget); const p = pos ?? free(b); if (p < 0) return TL.toast('빈 칸 없음', 'err');
    const occ = b.find(x => x.pos === p); if (occ) b.splice(b.indexOf(occ), 1);
    const u = { id: TL.uid('u'), champ: cid, star: 2, items: [], pos: p, role: null }; b.push(u);
    if (editTarget === 'enemy') selE = u.id; else selM = u.id; TL.save(); render();
  }
  function move(board, uid, pos) { const u = board.find(x => x.id === uid); if (!u) return; const occ = board.find(x => x.pos === pos); if (occ && occ !== u) occ.pos = u.pos; u.pos = pos; TL.save(); render(); }

  /* ---------- heuristic analysis (not a combat sim) ---------- */
  function analyze(my, enemy, scen) {
    const out = { risk: 0, notes: [], hl: {} };
    const champ = u => TL.data.champ(u.champ);
    const isAssassin = u => /Assassin/i.test(champ(u)?.role || '') || u.flag === 'assassin';
    const isAoe = u => u.flag === 'aoe' || (/Caster|Specialist/i.test(champ(u)?.role || '') && (u.items || []).length >= 2);
    const isFront = u => /Tank|Fighter/i.test(champ(u)?.role || '');
    const myCarries = my.filter(u => u.role === 'carry'); const carries = myCarries.length ? myCarries : my.filter(u => !isFront(u)).sort((a, b) => (b.items || []).length - (a.items || []).length || (champ(b)?.cost || 0) - (champ(a)?.cost || 0)).slice(0, 1);
    const row = p => Math.floor(p / 7), col = p => p % 7;
    if (!my.length) { out.notes.push(['info', '내 보드가 비어 있어. "팀 빌더 보드 가져오기"를 누르거나 직접 배치해.']); return out; }
    const enemyAss = enemy.filter(isAssassin), enemyAoe = enemy.filter(isAoe);
    const eCarries = enemy.filter(u => u.role === 'carry');
    // enemy summary
    if (eCarries.length) eCarries.forEach(u => { const side = col(u.pos) <= 2 ? '왼쪽' : col(u.pos) >= 4 ? '오른쪽' : '중앙'; out.notes.push(['info', `상대 핵심 딜러 ${TL.data.name(champ(u))}: ${row(u.pos) + 1}행 ${side} (내 화면 기준 ${side === '왼쪽' ? '오른쪽' : side === '오른쪽' ? '왼쪽' : '중앙'} 방향에서 공격)`]); });
    if (scen === 'assassin' || scen === 'all') {
      if (!enemyAss.length) out.notes.push(['ok', '상대 보드에 암살자 역할(데이터 role=Assassin 또는 직접 표시) 없음.']);
      else {
        out.notes.push(['warn', `상대 암살자 ${enemyAss.map(u => TL.data.name(champ(u))).join(', ')} — 일반적으로 전투 시작 시 후열로 진입해.`]);
        for (let c = 0; c < 7; c++) out.hl[21 + c] = 'warn';
        carries.forEach(u => {
          if (row(u.pos) === 3) { const corner = col(u.pos) === 0 || col(u.pos) === 6; const guards = TL.board.neighbors(u.pos).filter(p => my.some(x => x.pos === p && isFront(x))).length; out.risk += corner && !guards ? 3 : 2; out.hl[u.pos] = 'threat'; out.notes.push(['bad', `핵심 딜러 ${TL.data.name(champ(u))}이(가) 4행${corner ? ' 구석' : ''}에 있음${guards ? ` (인접 전방 유닛 ${guards})` : ' — 주변 보호 유닛 없음'}. 3행 안쪽으로 한 칸 당기거나, 구석에 미끼/탱커를 두는 배치를 비교해 봐.`]); }
          else out.notes.push(['ok', `핵심 딜러 ${TL.data.name(champ(u))}: ${row(u.pos) + 1}행 — 후열 진입 첫 타깃이 될 가능성 낮음(휴리스틱).`]);
        });
      }
    }
    if (scen === 'aoe' || scen === 'all') {
      let worst = 0, worstU = null;
      my.forEach(u => { const n = TL.board.neighbors(u.pos).filter(p => my.some(x => x.pos === p)).length; if (n > worst) { worst = n; worstU = u; } });
      const cn = carries.map(u => [u, TL.board.neighbors(u.pos).filter(p => my.some(x => x.pos === p)).length]);
      if (enemyAoe.length) out.notes.push(['warn', `상대 광역 위협(마법사/특수 역할에 아이템 2개↑ 또는 직접 표시): ${enemyAoe.map(u => TL.data.name(champ(u))).join(', ')}`]);
      cn.forEach(([u, n]) => { if (n >= 3) { out.risk += enemyAoe.length ? 2 : 1; out.hl[u.pos] = out.hl[u.pos] || 'warn'; out.notes.push([enemyAoe.length ? 'bad' : 'warn', `핵심 딜러 주변에 아군 ${n}명 밀집 — 광역 스킬 한 번에 같이 맞을 위험. 1칸 간격을 두는 배치를 비교해 봐.`]); } });
      if (worst >= 4 && worstU) { out.risk += 1; out.notes.push(['warn', `${TL.data.name(champ(worstU))} 주변 ${worst}명 밀집 — 가장 큰 뭉침.`]); }
      if (!cn.some(([, n]) => n >= 3)) out.notes.push(['ok', '핵심 딜러 주변 밀집도 낮음.']);
    }
    if (scen === 'protect' || scen === 'all') {
      carries.forEach(u => {
        const c = col(u.pos), r = row(u.pos);
        const shield = my.filter(x => isFront(x) && row(x.pos) < r && Math.abs(col(x.pos) - c) <= 1).length;
        if (r <= 1) { out.risk += 2; out.hl[u.pos] = 'threat'; out.notes.push(['bad', `핵심 딜러가 ${r + 1}행(전방)에 있음 — 원거리 캐리라면 바로 집중 공격 대상.`]); }
        if (!shield) { out.risk += 1; out.notes.push(['warn', `${TL.data.name(champ(u))} 앞 열(같은/인접 열)에 전방 유닛 없음 — 진입 경로가 열려 있어.`]); }
        else out.notes.push(['ok', `${TL.data.name(champ(u))} 앞에 전방 유닛 ${shield}명.`]);
        if (eCarries.length) { const same = eCarries.some(e => (col(e.pos) <= 2 && c >= 4) || (col(e.pos) >= 4 && c <= 2)); if (same) out.notes.push(['info', '상대 딜러와 같은 방향(마주 보는 쪽)에 내 딜러가 있음 — 사거리 내 교전이 빨라질 수 있어. 반대편 배치도 비교해 봐.']); }
      });
      const front = my.filter(x => row(x.pos) <= 1).length; if (front < 2 && my.length >= 5) { out.risk += 1; out.notes.push(['warn', `1~2행 유닛 ${front}명 — 전방이 얇아.`]); }
    }
    if (!carries.length) out.notes.push(['info', '핵심 딜러를 지정하면(유닛 선택 → ⚔) 더 정확한 체크가 가능해.']);
    return out;
  }

  function render() {
    ensureOpp(); const el = TL.$('#view-scout'); const s = SC(); const o = opp();
    const list = TL.roster.list(rf);
    const res = analyze(s.myBoard, o.board, s.scenario);
    const eTraits = TL.engine.traits(o.board);
    el.innerHTML = `<div class="view-head"><div><h2>Scouting <span class="muted small">정찰 · 배치 훈련</span></h2><p>상대 보드를 기록하고 내 배치를 바꿔 가며 암살자·광역·딜러 보호 상황을 비교해. 분석은 <b>휴리스틱 체크(전투 시뮬레이션 아님)</b>.</p></div></div>
    <div class="split3">
      <div class="col" style="gap:12px">
        <div class="panel"><h3>로비 상대 <button class="xs" id="oAdd" ${s.opponents.length >= 7 ? 'disabled' : ''}>+ 추가</button></h3>
          ${s.opponents.map(x => `<div class="row between" style="padding:4px 0;border-bottom:1px solid var(--line)"><button class="sm ${x.id === s.activeId ? 'on' : 'ghost'}" data-opp="${x.id}" style="flex:1;text-align:left">${TL.esc(x.name)} <span class="tiny">${x.board.length}명 ${TL.esc(x.comp || '')}</span></button><button class="xs danger" data-odel="${x.id}">✕</button></div>`).join('')}
        </div>
        <div class="panel"><h3>챔피언 추가 → <select id="eTarget"><option value="enemy" ${editTarget === 'enemy' ? 'selected' : ''}>상대 보드</option><option value="mine" ${editTarget === 'mine' ? 'selected' : ''}>내 보드</option></select></h3>
          ${TL.roster.filterHTML('s', rf)}<div class="roster" id="sRoster" style="max-height:300px">${TL.roster.cardsHTML(list, {})}</div>
          <div class="divider"></div><div class="tabs-mini">${[['component', '재료'], ['completed', '완성'], ['emblem', '상징']].map(([k, l]) => `<button data-sitab="${k}" class="${itemTab === k ? 'active' : ''}">${l}</button>`).join('')}</div><div class="itembench" id="sItemPal" style="max-height:120px;overflow:auto">${TL.itemsUI.paletteHTML(itemTab)}</div><div class="tiny" style="margin-top:4px">유닛 선택 후 아이템 클릭 또는 드래그.</div>
        </div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><div class="row between" style="margin-bottom:6px"><div class="row"><input id="oName" value="${TL.esc(o.name)}" style="width:130px" title="상대 이름"/><input id="oComp" value="${TL.esc(o.comp || '')}" placeholder="사용 조합 (예: K/DA 리롤)" style="width:190px"/></div><button class="xs danger" id="oClear">상대 보드 비우기</button></div>
          <div class="tiny" style="margin-bottom:4px">▼ 상대 보드 (화면 위쪽 = 상대 후열 4행 · 실제 대면 방향으로 뒤집어 표시)</div>
          <div class="board enemy" id="eBoard"></div>
          <div style="height:10px"></div>
          <div class="row between" style="margin-bottom:4px"><span class="tiny">▲ 내 보드 (위쪽 = 1행 최전방)</span><span class="row"><button class="xs" id="mImport">팀 빌더 보드 가져오기</button><button class="xs" id="mSaveL">배치안 저장</button><button class="xs danger" id="mClear">비우기</button></span></div>
          <div class="board" id="mBoard"></div>
          <div id="sSelUnit" style="margin-top:8px"></div>
        </div>
        <div class="panel"><h3>상대 특성 · 메모</h3>${TL.engine.traitsHTML(eTraits, true)}<textarea id="oNotes" rows="3" style="margin-top:6px" placeholder="핵심 아이템, 캐리 위치 습관, 레벨/골드, 다음 대응 계획">${TL.esc(o.notes || '')}</textarea></div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><h3>배치 체크 <select id="scen">${Object.entries(SCEN).map(([k, v]) => `<option value="${k}" ${s.scenario === k ? 'selected' : ''}>${v}</option>`).join('')}</select></h3>
          <div class="kpis"><div class="kpi"><span>위험 점수(낮을수록 좋음)</span><b class="${res.risk >= 4 ? 'red-t' : res.risk >= 2 ? 'gold-t' : 'green-t'}">${res.risk}</b></div></div>
          <div style="margin-top:6px">${res.notes.map(([k, t]) => `<div class="tiny" style="margin-bottom:4px">${{ bad: '🔴', warn: '🟠', ok: '🟢', info: 'ℹ️' }[k]} ${TL.esc(t)}</div>`).join('')}</div>
          <div class="legend" style="margin-top:6px"><span><i style="background:#7a2333"></i>위험 유닛</span><span><i style="background:#7a5a20"></i>주의 구역</span></div>
          <div class="tiny dim" style="margin-top:4px">근거: 역할(role) 데이터와 직접 표시한 ⚔/광역/암살 플래그 기반의 일반 원칙. 실제 진입 대상·스킬 범위는 챔피언별로 다르니 PBE에서 확인해.</div>
        </div>
        <div class="panel"><h3>배치안 비교 <span class="pill">${s.layouts.length}</span></h3>${layoutsHTML()}</div>
        <div class="panel"><h3>경쟁 현황</h3>${contestHTML()}</div>
      </div>
    </div>`;
    bind(res);
  }
  function layoutsHTML() {
    const s = SC(); if (!s.layouts.length) return '<div class="tiny">내 보드를 배치한 뒤 "배치안 저장"으로 A/B안을 만들어 비교해.</div>';
    const o = opp();
    return `<table class="table"><thead><tr><th>배치안</th>${Object.keys(SCEN).map(k => `<th>${SCEN[k].replace(' 대응', '')}</th>`).join('')}<th></th></tr></thead><tbody>${s.layouts.map(l => `<tr><td><b>${TL.esc(l.name)}</b>${l.note ? `<div class="tiny">${TL.esc(l.note)}</div>` : ''}</td>${Object.keys(SCEN).map(k => { const r = analyze(l.board, o.board, k).risk; return `<td class="${r >= 4 ? 'red-t' : r >= 2 ? 'gold-t' : 'green-t'}">${r}</td>`; }).join('')}<td><button class="xs" data-lload="${l.id}">적용</button><button class="xs danger" data-ldel="${l.id}">✕</button></td></tr>`).join('')}</tbody></table><div class="tiny">현재 선택한 상대(${TL.esc(o.name)}) 기준 위험 점수.</div>`;
  }
  function contestHTML() {
    const mine = new Set([...TL.state.builder.board, ...SC().myBoard].map(u => u.champ));
    const rows = [...mine].map(id => { const c = TL.data.champ(id); const who = SC().opponents.filter(o => o.board.some(u => u.champ === id)); const held = TL.sum(SC().opponents.flatMap(o => o.board.filter(u => u.champ === id).map(u => TL.engine.copies(u.star)))); return { c, who, held }; }).filter(r => r.c && r.who.length).sort((a, b) => b.held - a.held);
    if (!rows.length) return '<div class="tiny">내 조합(팀 빌더/정찰 보드)의 챔피언을 쓰는 상대가 기록되지 않았어.</div>';
    return rows.map(r => { const pool = TL.engine.poolSize(r.c.cost); return `<div class="tiny" style="margin-bottom:3px"><b>${TL.esc(TL.data.name(r.c))}</b> — 상대 ${r.who.length}명(${r.who.map(o => TL.esc(o.name)).join(', ')}) · 추정 ${r.held}장 보유${pool ? ` / 풀 ${pool}장 (남은 최대 ${Math.max(0, pool - r.held)})` : ''}</div>`; }).join('') + '<div class="tiny dim">보드 위 별 레벨 기준 장수(대기석 미포함). 풀 크기는 Set 18 기준(carryover).</div>';
  }
  function selHTML() {
    const t = editTarget; const b = boardOf(t); const id = t === 'enemy' ? selE : selM; const u = b.find(x => x.id === id); if (!u) return '<div class="tiny">유닛을 클릭하면 별/아이템/역할/플래그를 편집할 수 있어. 선택 후 빈 칸 클릭 = 이동, 우클릭 = 제거. (편집 대상: ' + (t === 'enemy' ? '상대' : '내') + ' 보드)</div>';
    const c = TL.data.champ(u.champ);
    return `<div class="notice blue"><b>${t === 'enemy' ? '상대' : '내'} · ${TL.esc(c.name)}</b> ${TL.esc(c.role)} · ${c.traits.join('/')}
      <div class="row" style="margin-top:4px">${[1, 2, 3].map(n => `<button class="xs ${u.star === n ? 'on' : ''}" data-star="${n}">${'★'.repeat(n)}</button>`).join('')}<button class="xs ${u.role === 'carry' ? 'on' : ''}" data-role="carry">⚔ 핵심 딜러</button><button class="xs ${u.role === 'tank' ? 'on' : ''}" data-role="tank">🛡 탱커</button>${t === 'enemy' ? `<button class="xs ${u.flag === 'aoe' ? 'on' : ''}" data-flag="aoe">광역</button><button class="xs ${u.flag === 'assassin' ? 'on' : ''}" data-flag="assassin">암살/후방 진입</button>` : ''}<button class="xs danger" data-urem>제거</button></div>
      <div class="row" style="margin-top:4px">${(u.items || []).map((i, k) => `<span class="itm ${TL.data.item(i)?.type}">${TL.esc(TL.data.item(i)?.nameKo || i)} <button class="xs ghost" data-uneq="${k}">✕</button></span>`).join('') || '<span class="tiny">아이템 없음</span>'}</div></div>`;
  }
  function bind() {
    const s = SC(), o = opp();
    TL.$('#oAdd').onclick = () => { const x = { id: TL.uid('o'), name: `상대 ${s.opponents.length + 1}`, comp: '', notes: '', board: [] }; s.opponents.push(x); s.activeId = x.id; TL.save(); render(); };
    TL.$$('[data-opp]').forEach(b => b.onclick = () => { s.activeId = b.dataset.opp; selE = null; TL.save(); render(); });
    TL.$$('[data-odel]').forEach(b => b.onclick = () => { const x = s.opponents.find(y => y.id === b.dataset.odel); TL.confirm('상대 삭제', `${TL.esc(x.name)} 정찰 기록을 삭제할까?`, () => { s.opponents = s.opponents.filter(y => y !== x); TL.save(); render(); }, '삭제', 'danger'); });
    TL.$('#eTarget').onchange = e => { editTarget = e.target.value; render(); };
    const re = () => { rf = { q: TL.$('#sQ').value, cost: TL.$('#sCost').value, trait: TL.$('#sTrait').value }; TL.$('#sRoster').innerHTML = TL.roster.cardsHTML(TL.roster.list(rf), {}); TL.roster.bind(TL.$('#sRoster'), id => add(id)); };
    TL.$('#sQ').oninput = TL.debounce(re, 120); TL.$('#sCost').onchange = re; TL.$('#sTrait').onchange = re;
    TL.roster.bind(TL.$('#sRoster'), id => add(id));
    TL.$$('[data-sitab]').forEach(b => b.onclick = () => { itemTab = b.dataset.sitab; render(); });
    TL.itemsUI.bind(TL.$('#sItemPal'), id => { const b = boardOf(editTarget); const u = b.find(x => x.id === (editTarget === 'enemy' ? selE : selM)); if (!u) return TL.toast('먼저 유닛을 선택해.'); const r = TL.itemsUI.equip(u, id, 3); if (!r.ok) return TL.toast(r.msg, 'err'); u.items = r.items; TL.save(); render(); });
    const mk = (target, board, elId) => {
      const marks = Object.fromEntries(board.filter(u => u.role).map(u => [u.id, u.role]));
      const res = analyze(s.myBoard, o.board, s.scenario);
      TL.board.render(TL.$(elId), board, {
        enemy: target === 'enemy', flip: target === 'enemy', zone: target, marks, highlight: target === 'mine' ? res.hl : {}, selected: target === 'enemy' ? selE : selM,
        onClick: (pos, uid) => { editTarget = target; const cur = target === 'enemy' ? selE : selM; if (uid) { if (target === 'enemy') selE = selE === uid ? null : uid; else selM = selM === uid ? null : uid; return render(); } if (cur) return move(board, cur, pos); },
        onRemove: uid => { const i = board.findIndex(x => x.id === uid); if (i >= 0) board.splice(i, 1); TL.save(); render(); },
        onDrop: (d, t) => { editTarget = target; if (d.kind === 'champ') return add(d.champ, t.pos); if (d.kind === 'unit') { if (board.some(x => x.id === d.uid)) return move(board, d.uid, t.pos); return; } if (d.kind === 'item' && t.uid) { const u = board.find(x => x.id === t.uid); const r = TL.itemsUI.equip(u, d.item, 3); if (!r.ok) return TL.toast(r.msg, 'err'); u.items = r.items; TL.save(); render(); } },
      });
    };
    mk('enemy', o.board, '#eBoard'); mk('mine', s.myBoard, '#mBoard');
    TL.$('#sSelUnit').innerHTML = selHTML();
    const b = boardOf(editTarget); const u = b.find(x => x.id === (editTarget === 'enemy' ? selE : selM));
    if (u) {
      TL.$$('[data-star]').forEach(x => x.onclick = () => { u.star = +x.dataset.star; TL.save(); render(); });
      TL.$$('[data-role]').forEach(x => x.onclick = () => { u.role = u.role === x.dataset.role ? null : x.dataset.role; TL.save(); render(); });
      TL.$$('[data-flag]').forEach(x => x.onclick = () => { u.flag = u.flag === x.dataset.flag ? null : x.dataset.flag; TL.save(); render(); });
      const rm = TL.$('[data-urem]'); if (rm) rm.onclick = () => { b.splice(b.indexOf(u), 1); TL.save(); render(); };
      TL.$$('[data-uneq]').forEach(x => x.onclick = () => { u.items.splice(+x.dataset.uneq, 1); TL.save(); render(); });
    }
    TL.$('#oName').onchange = e => { o.name = e.target.value || o.name; TL.save(); render(); };
    TL.$('#oComp').onchange = e => { o.comp = e.target.value; TL.save(); render(); };
    TL.$('#oNotes').onchange = e => { o.notes = e.target.value; TL.save(); };
    TL.$('#oClear').onclick = () => TL.confirm('상대 보드 비우기', '이 상대의 보드를 비울까?', () => { o.board = []; TL.save(); render(); }, '비우기', 'danger');
    TL.$('#mClear').onclick = () => { s.myBoard = []; TL.save(); render(); };
    TL.$('#mImport').onclick = () => { s.myBoard = TL.clone(TL.state.builder.board); TL.save(); TL.toast(`팀 빌더 보드 ${s.myBoard.length}명을 가져왔어.`, 'ok'); render(); };
    TL.$('#mSaveL').onclick = () => { if (!s.myBoard.length) return TL.toast('내 보드가 비어 있어.', 'err'); TL.modal('배치안 저장', `<div class="field"><label>이름</label><input id="lN" value="배치안 ${String.fromCharCode(65 + s.layouts.length % 26)}"/></div><div class="field" style="margin-top:6px"><label>메모</label><input id="lM" placeholder="예: 캐리 3행 안쪽, 구석에 미끼"/></div>`, { buttons: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: () => { s.layouts.push({ id: TL.uid('l'), name: TL.$('#lN').value || '배치안', note: TL.$('#lM').value, board: TL.clone(s.myBoard), created: new Date().toISOString() }); TL.save(); render(); } }] }); };
    TL.$$('[data-lload]').forEach(x => x.onclick = () => { const l = s.layouts.find(y => y.id === x.dataset.lload); s.myBoard = TL.clone(l.board); TL.save(); render(); });
    TL.$$('[data-ldel]').forEach(x => x.onclick = () => { s.layouts = s.layouts.filter(y => y.id !== x.dataset.ldel); TL.save(); render(); });
    TL.$('#scen').onchange = e => { s.scenario = e.target.value; TL.save(); render(); };
  }
  V.render = render; V.analyze = analyze;
  TL.views.scout = V;
})(window.TL);
