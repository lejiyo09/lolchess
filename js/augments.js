/* Augment Lab — full Set 19 augment DB (330, Dev Drop text), situational comparison, pick practice, notes, history */
'use strict';
(function (TL) {
  const V = {};
  let tab = 'practice', revealed = false, dbF = { q: '', tier: 'all', kind: 'all', cat: 'all', trait: 'all' }, openId = null;
  const A = () => TL.state.augLab;
  const CAT_KO = { econ: '경제', items: '아이템', combat: '전투력', units: '챔피언', hp: '체력', trait: '특성/상징' };
  const PLAN = { flex: '유연(flex)', fast8: '빠른 8레벨', econ: '이자/경제', reroll1: '1코 리롤', reroll2: '2코 리롤', reroll3: '3코 리롤' };

  function myTraits(src) {
    let board = [];
    if (src === 'builder') board = TL.state.builder.board;
    else if (src === 'sim' && TL.state.sim) board = TL.state.sim.board;
    return TL.engine.traits(board, { collab: src === 'builder' ? TL.state.builder.collab : [] });
  }
  // Transparent heuristic. Returns {score, parts:[{label, v, why}]}
  function evaluate(a, ctx, traits) {
    const st = String(ctx.stage || '2-1'); const early = st.startsWith('2'), mid = st.startsWith('3');
    const hp = +ctx.hp || 100, plan = ctx.plan || 'flex', streak = +ctx.streak || 0;
    const parts = [];
    const add = (label, v, why) => parts.push({ label, v, why });
    const has = c => a.categories.includes(c);
    if (has('econ')) { let w = early ? 1.0 : mid ? 0.7 : 0.35; const why = [`${st} 시점 경제 가치 ${early ? '높음' : mid ? '보통' : '낮음'}`]; if (['econ', 'fast8'].includes(plan)) { w *= 1.2; why.push('경제/빠른 레벨 계획과 부합'); } if (hp < 40) { w *= 0.6; why.push('체력이 낮아 미래 가치 할인'); } add('경제', w, why.join(' · ')); }
    if (has('items')) { let w = early ? 1.0 : mid ? 0.85 : 0.6; const why = [`아이템은 ${early ? '조기 획득 시 누적 가치 큼' : mid ? '여전히 유효' : '후반엔 장착 대상이 확정돼야 가치'}`]; if (plan === 'flex') { w *= 1.15; why.push('유연 운영에 유리'); } add('아이템', w, why.join(' · ')); }
    if (has('combat')) { let w = early ? 0.6 : mid ? 0.85 : 1.1; const why = [`즉시 전투력: ${early ? '초반엔 상대적으로 낮음' : mid ? '중반 안정화' : '후반 핵심'}`]; if (hp < 50) { w *= 1.3; why.push(`체력 ${hp} → 지금 이기는 힘이 중요`); } if (streak >= 3) { w *= 1.15; why.push('연승 유지에 기여'); } add('전투력', w, why.join(' · ')); }
    if (has('units')) { let w = 0.8; const why = ['챔피언/복사 획득']; if (plan.startsWith('reroll')) { w *= 1.3; why.push('리롤 계획과 부합(3성 가속)'); } add('챔피언', w, why.join(' · ')); }
    if (has('hp')) { const w = hp < 40 ? 1.3 : hp > 80 ? 0.4 : 0.8; add('플레이어 체력', w, `현재 체력 ${hp}`); }
    if (a.kind === 'trait' || a.kind === 'emblem' || a.relatedTraits.length) {
      const rel = a.relatedTraits; let best = null;
      rel.forEach(t => { const x = traits.find(y => y.name === t); if (x && (!best || x.active > best.active || x.count > best.count)) best = x; });
      let w, why;
      if (!rel.length) { w = 0.5; why = '관련 특성 정보 없음'; }
      else if (best && best.active >= 0) { w = 1.4; why = `${best.name} 활성(${best.count}) — 보드와 직접 시너지`; }
      else if (best) { w = 1.0; why = `${best.name} ${best.count}명 보유(미활성) — 활성까지 ${best.next ? best.next - best.count : '?'}`; }
      else { w = (a.kind === 'trait' || a.kind === 'emblem') ? 0.3 : 0.6; why = `관련 특성(${rel.join(', ')}) 미보유 — 전환 필요`; }
      add('특성 적합도', w, why);
    }
    if (!parts.length) add('기타', 0.6, '키워드 분류 불가 — 설명을 직접 판단');
    const score = Math.round(Math.min(100, TL.sum(parts.map(p => p.v)) / Math.max(1, parts.length) * 60 + Math.min(parts.length, 3) * 6));
    return { score, parts };
  }
  function ctxHTML(ctx, src) {
    return `<div class="fgrid">
      <div class="field"><label>증강 라운드</label><select id="aStage">${['2-1', '3-2', '4-2'].map(s => `<option ${ctx.stage === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>체력</label><input type="number" id="aHp" value="${ctx.hp}" min="1" max="100"/></div>
      <div class="field"><label>골드</label><input type="number" id="aGold" value="${ctx.gold}" min="0"/></div>
      <div class="field"><label>레벨</label><input type="number" id="aLv" value="${ctx.level}" min="1" max="11"/></div>
      <div class="field"><label>연속(+승/−패)</label><input type="number" id="aStreak" value="${ctx.streak}" min="-12" max="12"/></div>
      <div class="field"><label>운영 방향</label><select id="aPlan">${Object.entries(PLAN).map(([k, v]) => `<option value="${k}" ${ctx.plan === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>내 특성 출처</label><select id="aSrc"><option value="builder" ${src === 'builder' ? 'selected' : ''}>팀 빌더 보드</option><option value="sim" ${src === 'sim' ? 'selected' : ''}>시뮬레이터 보드</option><option value="none" ${src === 'none' ? 'selected' : ''}>없음</option></select></div>
    </div>`;
  }
  function readCtx() {
    const c = A().ctx; c.stage = TL.$('#aStage').value; c.hp = +TL.$('#aHp').value || 100; c.gold = +TL.$('#aGold').value || 0; c.level = +TL.$('#aLv').value || 1; c.streak = +TL.$('#aStreak').value || 0; c.plan = TL.$('#aPlan').value; c.src = TL.$('#aSrc').value; TL.save();
  }
  function augCard(a, ev, opts = {}) {
    const note = A().notes[a.id];
    return `<div class="aug ${a.tier} ${opts.sel ? 'sel' : ''}" ${opts.click ? `data-pickaug="${a.id}" role="button" tabindex="0" style="cursor:pointer"` : ''}>
      <div class="row between"><span class="an">${TL.esc(a.name)}</span><span class="row"><span class="tier-${a.tier} tiny">${a.tier}</span>${a.kind !== 'general' ? `<span class="pill">${a.kind}</span>` : ''}</span></div>
      <span class="tiny" style="color:#c3cbec">${TL.esc(a.description)}</span>
      <span class="chips">${(a.rounds || []).map(r => `<span class="chip" style="border-color:var(--line2)" title="Riot RoundVariant">${r}</span>`).join('')}${a.categories.map(c => `<span class="chip">${CAT_KO[c] || c}</span>`).join('')}${a.relatedTraits.map(t => `<span class="chip on">${TL.esc(t)}</span>`).join('')}</span>
      ${ev ? `<div style="margin-top:4px"><div class="row between tiny"><span>상황 적합도(휴리스틱)</span><b class="gold-t">${ev.score}</b></div><div class="bar"><i style="width:${ev.score}%"></i></div>${ev.parts.map(p => `<div class="tiny">· <b>${p.label}</b> ${p.v.toFixed(2)} — ${TL.esc(p.why)}</div>`).join('')}</div>` : ''}
      ${note && (note.rec || note.memo) ? `<div class="tiny gold-t">📝 ${TL.esc([note.rec, note.memo].filter(Boolean).join(' / ').slice(0, 120))}</div>` : ''}
      ${opts.actions ? `<div class="row" style="margin-top:4px"><button class="xs" data-cmpadd="${a.id}">${A().compare.includes(a.id) ? '비교에서 빼기' : '비교에 추가'}</button><button class="xs" data-note="${a.id}">메모</button></div>` : ''}
    </div>`;
  }
  function render() {
    const el = TL.$('#view-augments'); const a = A(); const ctx = a.ctx; const src = ctx.src || 'builder';
    const meta = TL.data.bundle().augments.meta; const traits = myTraits(src);
    el.innerHTML = `<div class="view-head"><div><h2>Augment Lab <span class="muted small">증강체 연구실</span></h2><p>티어 순위 대신 "지금 내 상황"에서 무엇이 유리한지 근거를 비교하는 연습. ${TL.data.augs().length}개 전체 (Silver ${TL.data.augs().filter(x => x.tier === 'Silver').length} · Gold ${TL.data.augs().filter(x => x.tier === 'Gold').length} · Prismatic ${TL.data.augs().filter(x => x.tier === 'Prismatic').length})</p></div><div class="row">${TL.statusPill(meta.status)}<span class="tiny">${TL.esc(meta.patch)} · ${TL.esc(meta.updated)}</span></div></div>
    <div class="notice tiny" style="margin-bottom:10px">설명 출처: <b>${TL.esc(meta.patch)}</b> (${TL.esc(meta.status)}). ${meta.status === 'preview' ? 'Dev Drop 원문이라 <b>수치가 없어</b>. ' : '수치는 설명에 포함돼 있지만 라이브 전 바뀔 수 있어. '}분류 태그와 적합도는 Riot 태그·설명 키워드 기반 <b>휴리스틱(training-model)</b>이야 — 정답이 아니라 판단 근거를 정리하는 도구로 써. 증강 등급 출현 확률은 비공개라 등급은 직접 선택해. 칩의 2-1/3-2/4-2는 등장 가능 라운드.</div>
    <div class="panel" style="margin-bottom:12px"><h3>현재 상황 <span class="tiny">내 특성: ${traits.filter(t => t.active >= 0).map(t => TL.esc(t.name + ' ' + t.count)).join(', ') || '없음'}</span></h3>${ctxHTML(ctx, src)}</div>
    <div class="tabs-mini">${[['practice', '선택 연습'], ['compare', `비교 (${a.compare.length})`], ['db', '전체 데이터베이스'], ['history', `선택 기록 (${a.history.length})`]].map(([k, l]) => `<button data-atab="${k}" class="${tab === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div id="aBody"></div>`;
    ['#aStage', '#aHp', '#aGold', '#aLv', '#aStreak', '#aPlan', '#aSrc'].forEach(s => TL.$(s).onchange = () => { readCtx(); render(); });
    TL.$$('[data-atab]').forEach(b => b.onclick = () => { tab = b.dataset.atab; render(); });
    ({ practice, compare, db, history })[tab](TL.$('#aBody'), traits);
  }
  // marginal tier odds for an augment round from the Set 19 sequence table (game-rules.augmentTierSequences)
  function tierOdds(stage) {
    const seqs = TL.data.rules().augmentTierSequences; const idx = (TL.data.rules().augmentRounds || ['2-1', '3-2', '4-2']).indexOf(stage);
    if (!seqs || idx < 0) return null; const tot = TL.sum(seqs.map(x => x.w)); const o = { Silver: 0, Gold: 0, Prismatic: 0 };
    seqs.forEach(x => { o[x.t[idx]] = (o[x.t[idx]] || 0) + x.w / tot; }); return o;
  }
  function tierByOdds(stage) { const o = tierOdds(stage); if (!o) return TL.pick(['Silver', 'Gold', 'Prismatic']); let r = Math.random(); for (const [k, v] of Object.entries(o)) { r -= v; if (r < 0) return k; } return 'Gold'; }
  function practice(host, traits) {
    const a = A(); const ctx = a.ctx;
    const offer = a.offer.map(id => TL.data.aug(id)).filter(Boolean);
    host.innerHTML = `<div class="panel"><h3>3개 선택지 연습 <span class="row"><select id="aTier">${['Silver', 'Gold', 'Prismatic', 'random'].map(t => `<option value="${t}" ${ctx.tier === t ? 'selected' : ''}>${t === 'random' ? '실제 확률로 등급' : t}</option>`).join('')}</select>${(() => { const o = tierOdds(ctx.stage); return o ? `<span class="tiny">${ctx.stage} 등급 확률: ${Object.entries(o).map(([k, v]) => `<span class="tier-${k}">${k[0]} ${(v * 100).toFixed(1)}%</span>`).join(' · ')}</span>` : ''; })()}<button class="sm primary" id="aRoll">선택지 뽑기</button><label class="row tiny"><input type="checkbox" id="aReveal" ${revealed ? 'checked' : ''}/> 적합도 미리 보기</label></span></h3>
      ${offer.length ? `<div class="grid g3">${offer.map(x => augCard(x, revealed || a.picked ? evaluate(x, ctx, traits) : null, { click: true, sel: a.picked === x.id, actions: true })).join('')}</div>
      <textarea id="aReason" rows="2" style="margin-top:8px" placeholder="선택 이유: 체력/골드/레벨/보드/아이템 관점 + 포기한 선택지의 기회비용">${TL.esc(a._reason || '')}</textarea>
      <div class="row between" style="margin-top:6px"><span class="tiny">${a.picked ? `선택: <b class="gold-t">${TL.esc(TL.data.aug(a.picked)?.name)}</b> — 아래 버튼으로 기록` : '카드를 클릭해 선택 → 적합도 비교가 공개돼.'}</span><button class="sm gold" id="aSave" ${a.picked ? '' : 'disabled'}>선택 기록</button></div>` : '<div class="empty">"선택지 뽑기"를 눌러 시작해. (같은 등급 3개)</div>'}
    </div>`;
    TL.$('#aTier').onchange = e => { ctx.tier = e.target.value; TL.save(); };
    TL.$('#aReveal').onchange = e => { revealed = e.target.checked; render(); };
    TL.$('#aRoll').onclick = () => { const t = ctx.tier === 'random' ? tierByOdds(ctx.stage) : ctx.tier; a.offer = TL.shuffle(TL.data.augs().filter(x => x.tier === t)).slice(0, 3).map(x => x.id); a.picked = null; a._reason = ''; TL.save(); render(); };
    TL.$$('[data-pickaug]', host).forEach(c => c.onclick = e => { if (e.target.closest('button')) return; a.picked = c.dataset.pickaug; a._reason = TL.$('#aReason')?.value || a._reason; TL.save(); render(); });
    const r = TL.$('#aReason'); if (r) r.oninput = () => { a._reason = r.value; };
    const sv = TL.$('#aSave'); if (sv) sv.onclick = () => {
      const p = TL.data.aug(a.picked); const evs = offer.map(x => ({ name: x.name, score: evaluate(x, ctx, traits).score }));
      a.history.unshift({ id: TL.uid('a'), date: new Date().toISOString(), offers: offer.map(x => x.name), scores: evs, picked: p.name, pickedTier: p.tier, reason: TL.$('#aReason').value, ctx: { ...ctx, traits: traits.filter(t => t.active >= 0).map(t => t.name + ' ' + t.count) } });
      a.history = a.history.slice(0, 300); a.offer = []; a.picked = null; a._reason = ''; TL.save(); TL.toast('선택 기록 완료', 'ok'); render();
    };
    bindActions(host);
  }
  function compare(host, traits) {
    const a = A(); const list = a.compare.map(id => TL.data.aug(id)).filter(Boolean);
    if (!list.length) { host.innerHTML = '<div class="panel"><div class="empty">데이터베이스/선택 연습에서 "비교에 추가"를 눌러 최대 4개까지 비교해.</div></div>'; return; }
    const evs = list.map(x => ({ x, ev: evaluate(x, a.ctx, traits) })).sort((p, q) => q.ev.score - p.ev.score);
    host.innerHTML = `<div class="panel"><h3>상황별 비교 <button class="xs danger" id="aCmpClr">비우기</button></h3><div class="grid" style="grid-template-columns:repeat(${Math.min(4, list.length)},minmax(0,1fr))">${evs.map(({ x, ev }) => augCard(x, ev, { actions: true })).join('')}</div>
      <div class="notice blue tiny" style="margin-top:8px">상황 값을 바꿔 가며(예: 체력 90 → 30, 2-1 → 4-2) 순위가 어떻게 바뀌는지 확인해. 실제 선택은 수치 공개 후 직접 재평가 필요.</div></div>`;
    TL.$('#aCmpClr').onclick = () => { a.compare = []; TL.save(); render(); };
    bindActions(host);
  }
  function db(host, traits) {
    const q = dbF.q.trim().toLowerCase();
    const list = TL.data.augs().filter(x => (dbF.tier === 'all' || x.tier === dbF.tier) && (dbF.kind === 'all' || x.kind === dbF.kind) && (dbF.cat === 'all' || x.categories.includes(dbF.cat)) && (dbF.trait === 'all' || x.relatedTraits.includes(dbF.trait)) && (!q || x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q) || (A().notes[x.id]?.rec || '').toLowerCase().includes(q)));
    const traitsWith = [...new Set(TL.data.augs().flatMap(x => x.relatedTraits))].sort();
    host.innerHTML = `<div class="panel"><div class="row" style="margin-bottom:8px"><input id="dQ" placeholder="이름·설명·메모 검색" value="${TL.esc(dbF.q)}" style="flex:1;min-width:160px"/>
      <select id="dTier"><option value="all">전체 등급</option>${['Silver', 'Gold', 'Prismatic'].map(t => `<option ${dbF.tier === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select id="dKind"><option value="all">전체 종류</option>${['general', 'emblem', 'trait', 'hero'].map(t => `<option ${dbF.kind === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <select id="dCat"><option value="all">전체 분류</option>${Object.entries(CAT_KO).map(([k, v]) => `<option value="${k}" ${dbF.cat === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="dTrait"><option value="all">관련 특성</option>${traitsWith.map(t => `<option ${dbF.trait === t ? 'selected' : ''}>${TL.esc(t)}</option>`).join('')}</select><span class="pill">${list.length}</span></div>
      <div class="grid g3" style="max-height:640px;overflow:auto;align-content:start">${list.map(x => augCard(x, openId === x.id ? evaluate(x, A().ctx, traits) : null, { actions: true })).join('') || '<div class="empty">결과 없음</div>'}</div></div>`;
    const re = () => { dbF = { q: TL.$('#dQ').value, tier: TL.$('#dTier').value, kind: TL.$('#dKind').value, cat: TL.$('#dCat').value, trait: TL.$('#dTrait').value }; db(host, traits); };
    TL.$('#dQ').oninput = TL.debounce(() => { re(); const i = TL.$('#dQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200);
    ['#dTier', '#dKind', '#dCat', '#dTrait'].forEach(s => TL.$(s).onchange = re);
    bindActions(host);
  }
  function history(host) {
    const h = A().history;
    const tierCount = ['Silver', 'Gold', 'Prismatic'].map(t => [t, h.filter(x => x.pickedTier === t).length]);
    const catCount = {}; h.forEach(x => { const a = TL.data.augs().find(y => y.name === x.picked); (a?.categories || []).forEach(c => catCount[c] = (catCount[c] || 0) + 1); });
    const agree = h.filter(x => x.scores && x.scores.length).map(x => { const best = x.scores.reduce((p, q) => q.score > p.score ? q : p); return best.name === x.picked; });
    host.innerHTML = `<div class="panel"><h3>선택 기록 <span class="row"><button class="xs" id="hExp">CSV 내보내기</button><button class="xs danger" id="hClr">기록 비우기</button></span></h3>
      <div class="kpis" style="margin-bottom:8px"><div class="kpi"><span>기록 수</span><b>${h.length}</b></div>${tierCount.map(([t, n]) => `<div class="kpi"><span class="tier-${t}">${t}</span><b>${n}</b></div>`).join('')}<div class="kpi"><span>휴리스틱 1순위와 일치</span><b>${agree.length ? Math.round(agree.filter(Boolean).length / agree.length * 100) + '%' : '-'}</b><small>낮아도 괜찮음 — 이유가 핵심</small></div></div>
      <div class="tiny" style="margin-bottom:6px">자주 고른 분류: ${Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${CAT_KO[c] || c} ${n}`).join(' · ') || '-'}</div>
      <div class="scroll" style="max-height:520px">${h.length ? `<table class="table"><thead><tr><th>날짜</th><th>상황</th><th>선택지</th><th>선택</th><th>이유</th></tr></thead><tbody>${h.map(x => `<tr><td class="tiny">${TL.fmtDate(x.date)}</td><td class="tiny">${TL.esc(x.ctx?.stage || '')} ${x.ctx?.hp != null ? '· HP ' + x.ctx.hp : ''} ${x.ctx?.gold != null ? '· ' + x.ctx.gold + 'G' : ''} ${x.ctx?.level ? '· Lv' + x.ctx.level : ''} ${x.ctx?.plan ? '· ' + (PLAN[x.ctx.plan] || x.ctx.plan) : ''}${x.ctx?.source === 'sim' ? ' · 시뮬' : ''}</td><td class="tiny">${TL.esc((x.offers || []).join(' / '))}</td><td><b class="tier-${x.pickedTier}">${TL.esc(x.picked)}</b></td><td class="tiny">${TL.esc(x.reason || '')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">아직 기록 없음</div>'}</div></div>`;
    TL.$('#hClr').onclick = () => TL.confirm('선택 기록 비우기', '증강 선택 기록을 모두 지울까?', () => { A().history = []; TL.save(); render(); }, '비우기', 'danger');
    TL.$('#hExp').onclick = () => { const rows = [['date', 'stage', 'hp', 'gold', 'level', 'plan', 'offers', 'picked', 'tier', 'reason']].concat(h.map(x => [x.date, x.ctx?.stage, x.ctx?.hp, x.ctx?.gold, x.ctx?.level, x.ctx?.plan, (x.offers || []).join(' / '), x.picked, x.pickedTier, x.reason])); TL.download('tft19-augment-history.csv', '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); };
  }
  function bindActions(host) {
    const a = A();
    TL.$$('[data-cmpadd]', host).forEach(b => b.onclick = () => { const id = b.dataset.cmpadd; a.compare = a.compare.includes(id) ? a.compare.filter(x => x !== id) : [...a.compare, id].slice(-4); TL.save(); render(); });
    TL.$$('[data-note]', host).forEach(b => b.onclick = () => {
      const id = b.dataset.note; const x = TL.data.aug(id); const n = a.notes[id] || {};
      TL.modal('증강 메모 · ' + x.name, `<div class="tiny" style="margin-bottom:6px">${TL.esc(x.description)}</div><div class="field"><label>추천 조합 (직접 기록)</label><input id="nR" value="${TL.esc(n.rec || '')}" placeholder="예: Rock 7, Heartsteel 리롤"/></div><div class="field" style="margin-top:6px"><label>상황별 효율 메모</label><textarea id="nM" rows="4" placeholder="언제 좋은지/나쁜지, PBE에서 확인한 수치">${TL.esc(n.memo || '')}</textarea></div><div class="field" style="margin-top:6px"><label>개인 평가 (1~5, 선택)</label><input type="number" id="nS" min="1" max="5" value="${n.rating || ''}"/></div>`,
        { buttons: [{ label: '취소' }, { label: '저장', cls: 'primary', onClick: () => { a.notes[id] = { rec: TL.$('#nR').value, memo: TL.$('#nM').value, rating: +TL.$('#nS').value || null, updated: new Date().toISOString() }; TL.save(); render(); } }] });
    });
  }
  V.render = render; V.evaluate = evaluate;
  TL.views.augments = V;
})(window.TL);
