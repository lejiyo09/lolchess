/* Tournament Records — 8-player lobby results, editable scoring, standings, per-comp / per-patch stats, recent trend */
'use strict';
(function (TL) {
  const V = {};
  let filt = { event: 'all', patch: 'all' }, editId = null;
  const R = () => TL.state.records;
  const preset = () => { const s = TL.state.settings; return s.scorePresets.find(p => p.id === s.activePreset) || s.scorePresets[0]; };
  const pts = place => { const m = preset().map; return Number(m[place - 1] ?? 0); };
  const me = () => TL.state.settings.playerName || '나';

  function games() { return R().games.filter(g => (filt.event === 'all' || g.event === filt.event) && (filt.patch === 'all' || g.patch === filt.patch)); }
  function myGames(list) { return list.filter(g => Number.isFinite(+g.myPlace) && +g.myPlace >= 1); }
  function agg(list) {
    const n = list.length; if (!n) return { n: 0 };
    const pl = list.map(g => +g.myPlace);
    return { n, avg: TL.sum(pl) / n, wins: pl.filter(p => p === 1).length, top4: pl.filter(p => p <= 4).length / n, pts: TL.sum(pl.map(pts)) };
  }
  function groupBy(list, key) { const m = {}; list.forEach(g => { const k = (typeof key === 'function' ? key(g) : g[key]) || '(미기록)'; (m[k] = m[k] || []).push(g); }); return Object.entries(m).map(([k, v]) => ({ k, ...agg(v) })).sort((a, b) => a.avg - b.avg); }
  function standings(list) {
    const m = {};
    list.forEach(g => (g.lobby || []).forEach(p => { if (!p.name || !p.place) return; const x = m[p.name] = m[p.name] || { name: p.name, games: 0, pts: 0, wins: 0, top4: 0, places: [] }; x.games++; x.pts += pts(+p.place); if (+p.place === 1) x.wins++; if (+p.place <= 4) x.top4++; x.places.push(+p.place); }));
    // Tiebreak (common TFT event practice, editable notice): points → 1st places → top4 → best recent placement
    return Object.values(m).sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.top4 - a.top4 || a.places.at(-1) - b.places.at(-1));
  }
  function trendSVG(list) {
    const pts2 = list.slice(0, 20).reverse(); if (pts2.length < 2) return '<div class="tiny">경기가 2개 이상이면 추세가 표시돼.</div>';
    const W = 520, H = 120, pl = 26, pr = 8, pt = 8, pb = 18;
    const x = i => pl + i * (W - pl - pr) / (pts2.length - 1), y = p => pt + (p - 1) * (H - pt - pb) / 7;
    const grid = [1, 4, 8].map(p => `<line x1="${pl}" x2="${W - pr}" y1="${y(p)}" y2="${y(p)}" stroke="#26315a" stroke-width="1" ${p === 4 ? 'stroke-dasharray="3 3"' : ''}/><text x="${pl - 6}" y="${y(p) + 3}" fill="#8e98c2" font-size="10" text-anchor="end">${p}위</text>`).join('');
    const path = pts2.map((g, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(+g.myPlace).toFixed(1)}`).join(' ');
    const dots = pts2.map((g, i) => `<g><circle cx="${x(i)}" cy="${y(+g.myPlace)}" r="12" fill="transparent"><title>${TL.esc(g.date)} · ${TL.esc(g.event || '')} · ${g.myPlace}위 · ${TL.esc(g.comp || '')}</title></circle><circle cx="${x(i)}" cy="${y(+g.myPlace)}" r="4" fill="#e8b85a" stroke="#111833" stroke-width="2" pointer-events="none"/></g>`).join('');
    const avg5 = pts2.map((g, i) => { const w = pts2.slice(Math.max(0, i - 4), i + 1); return TL.sum(w.map(z => +z.myPlace)) / w.length; });
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 ${pts2.length}경기 순위 추세 (위가 1위)">${grid}<path d="${pts2.map((g, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(avg5[i]).toFixed(1)}`).join(' ')}" fill="none" stroke="#8e98c2" stroke-width="1.5" stroke-dasharray="4 3"/><path d="${path}" fill="none" stroke="#e8b85a" stroke-width="2" stroke-linejoin="round"/>${dots}<text x="${pl}" y="${H - 4}" fill="#8e98c2" font-size="10">오래된 경기</text><text x="${W - pr}" y="${H - 4}" fill="#8e98c2" font-size="10" text-anchor="end">최근</text></svg><div class="tiny">실선 = 경기별 순위 · 점선 = 최근 5경기 이동 평균 · 점선 가로줄 = 4위(TOP 4 경계)</div>`;
  }
  function formHTML(g) {
    g = g || { date: TL.today(), event: TL.state.settings.eventName || '스크림', gameNo: '', patch: TL.state.settings.defaultPatch || '19.2', lobby: Array.from({ length: 8 }, (_, i) => ({ name: i === 0 ? me() : '', place: '' })), comp: '', augments: ['', '', ''], items: '', note: '' };
    const lobby = (g.lobby || []).slice(); while (lobby.length < 8) lobby.push({ name: '', place: '' });
    return `<div class="fgrid"><div class="field"><label>날짜</label><input type="date" id="rDate" value="${TL.esc(g.date)}"/></div><div class="field"><label>대회/스크림 이름</label><input id="rEvent" list="rEvents" value="${TL.esc(g.event)}"/></div><div class="field"><label>경기 번호</label><input id="rNo" value="${TL.esc(g.gameNo || '')}" placeholder="예: Day1 G3"/></div><div class="field"><label>패치</label><input id="rPatch" value="${TL.esc(g.patch)}"/></div></div>
      <datalist id="rEvents">${[...new Set(R().games.map(x => x.event).filter(Boolean))].map(e => `<option value="${TL.esc(e)}">`).join('')}</datalist>
      <h4>8인 로비 (참가자 · 순위)</h4><div class="tiny" style="margin-bottom:4px">내 이름("${TL.esc(me())}", 설정에서 변경)과 일치하는 행이 내 순위로 집계돼. 순위는 1~8 중복 불가.</div>
      <div class="grid g4" style="gap:6px">${lobby.slice(0, 8).map((p, i) => `<div class="row nw"><input data-ln="${i}" value="${TL.esc(p.name || '')}" placeholder="참가자 ${i + 1}" style="flex:1;min-width:0"/><select data-lp="${i}" style="width:62px"><option value="">-</option>${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option ${+p.place === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="fgrid" style="margin-top:8px"><div class="field" style="grid-column:span 2"><label>사용 조합</label><input id="rComp" list="rComps" value="${TL.esc(g.comp || '')}" placeholder="저장 조합 또는 직접 입력"/></div>${[0, 1, 2].map(i => `<div class="field"><label>증강 ${i + 1}</label><input id="rAug${i}" list="rAugs" value="${TL.esc((g.augments || [])[i] || '')}"/></div>`).join('')}<div class="field" style="grid-column:span 2"><label>핵심 아이템</label><input id="rItems" value="${TL.esc(g.items || '')}" placeholder="예: 구인수, 내셔, 정의의 손길"/></div></div>
      <datalist id="rComps">${[...new Set([...TL.state.comps.map(c => c.name), ...R().games.map(x => x.comp)].filter(Boolean))].map(c => `<option value="${TL.esc(c)}">`).join('')}</datalist>
      <datalist id="rAugs">${TL.data.augs().map(a => `<option value="${TL.esc(a.name)}">`).join('')}</datalist>
      <div class="field" style="margin-top:6px"><label>경기 메모 · 복기</label><textarea id="rNote" rows="3" placeholder="오프닝, 레벨/롤다운 시점, 패배 원인, 다음 판 수정점">${TL.esc(g.note || '')}</textarea></div>`;
  }
  function readForm() {
    const lobby = Array.from({ length: 8 }, (_, i) => ({ name: TL.$(`[data-ln="${i}"]`).value.trim(), place: +TL.$(`[data-lp="${i}"]`).value || null })).filter(p => p.name || p.place);
    const places = lobby.map(p => p.place).filter(Boolean);
    if (new Set(places).size !== places.length) throw new Error('순위가 중복됐어.');
    const mine = lobby.find(p => p.name && p.name === me());
    if (!mine || !mine.place) throw new Error(`로비에 내 이름("${me()}")과 순위를 입력해 줘.`);
    lobby.forEach(p => { p.me = p.name === me(); });
    return { date: TL.$('#rDate').value || TL.today(), event: TL.$('#rEvent').value.trim() || '스크림', gameNo: TL.$('#rNo').value.trim(), patch: TL.$('#rPatch').value.trim() || '19.2', lobby, myPlace: mine.place, comp: TL.$('#rComp').value.trim(), augments: [0, 1, 2].map(i => TL.$('#rAug' + i).value.trim()).filter(Boolean), items: TL.$('#rItems').value.trim(), note: TL.$('#rNote').value };
  }
  function render() {
    const el = TL.$('#view-records'); const list = games(); const mine = myGames(list); const a = agg(mine);
    const events = [...new Set(R().games.map(g => g.event).filter(Boolean))], patches = [...new Set(R().games.map(g => g.patch).filter(Boolean))];
    const editing = editId ? R().games.find(g => g.id === editId) : null;
    const st = standings(list);
    el.innerHTML = `<div class="view-head"><div><h2>Tournament Records <span class="muted small">대회 · 스크림 기록</span></h2><p>8인 로비 기준. 점수표: <b class="gold-t">${TL.esc(preset().name)}</b> (${preset().map.join('-')}) — Data &amp; Settings에서 수정.</p></div>
      <div class="row"><select id="fEvent"><option value="all">전체 대회/스크림</option>${events.map(e => `<option ${filt.event === e ? 'selected' : ''}>${TL.esc(e)}</option>`).join('')}</select><select id="fPatch"><option value="all">전체 패치</option>${patches.map(p => `<option ${filt.patch === p ? 'selected' : ''}>${TL.esc(p)}</option>`).join('')}</select><button class="sm" id="rCsv">CSV</button></div></div>
    <div class="kpis" style="margin-bottom:12px"><div class="kpi"><span>총 경기</span><b>${a.n || 0}</b></div><div class="kpi"><span>평균 순위</span><b class="gold-t">${a.n ? a.avg.toFixed(2) : '-'}</b></div><div class="kpi"><span>1등</span><b>${a.n ? a.wins : 0}</b><small>${a.n ? Math.round(a.wins / a.n * 100) + '%' : ''}</small></div><div class="kpi"><span>TOP 4 비율</span><b>${a.n ? Math.round(a.top4 * 100) + '%' : '-'}</b></div><div class="kpi"><span>총 점수</span><b>${a.n ? a.pts : 0}</b><small>${a.n ? '경기당 ' + (a.pts / a.n).toFixed(2) : ''}</small></div><div class="kpi"><span>최근 5경기 평균</span><b>${mine.length ? (TL.sum(mine.slice(0, 5).map(g => +g.myPlace)) / Math.min(5, mine.length)).toFixed(2) : '-'}</b></div></div>
    <div class="split">
      <div class="col" style="gap:12px">
        <div class="panel"><h3>${editing ? '경기 수정' : '경기 결과 입력'} ${editing ? '<button class="xs" id="rCancel">수정 취소</button>' : ''}</h3>${formHTML(editing)}<div class="row" style="margin-top:8px"><button class="primary" id="rSave">${editing ? '수정 저장' : '결과 저장'}</button></div></div>
        <div class="panel"><h3>경기 히스토리 <span class="pill">${list.length}</span></h3><div class="scroll" style="max-height:460px">${list.length ? `<table class="table"><thead><tr><th>날짜</th><th>대회</th><th>패치</th><th>순위</th><th>점수</th><th>조합</th><th>증강</th><th>메모</th><th></th></tr></thead><tbody>${list.map(g => `<tr><td>${TL.esc(g.date)}</td><td>${TL.esc(g.event)} ${TL.esc(g.gameNo || '')}</td><td>${TL.esc(g.patch)}</td><td><b class="${+g.myPlace <= 4 ? 'green-t' : 'red-t'}">${g.myPlace}위</b></td><td>${pts(+g.myPlace)}</td><td>${TL.esc(g.comp || '')}</td><td class="tiny">${TL.esc((g.augments || []).join(', '))}</td><td class="tiny">${TL.esc((g.note || '').slice(0, 60))}</td><td><button class="xs" data-redit="${g.id}">수정</button><button class="xs danger" data-rdel="${g.id}">✕</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">아직 기록이 없어.</div>'}</div></div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><h3>최근 경기 추세 (내 순위)</h3>${trendSVG(mine)}</div>
        <div class="panel"><h3>조합별 성적</h3>${statTable(groupBy(mine, 'comp'))}</div>
        <div class="panel"><h3>패치별 성적</h3>${statTable(groupBy(mine, 'patch'))}</div>
        <div class="panel"><h3>증강별 성적</h3>${statTable(groupBy(mine.flatMap(g => (g.augments || []).map(x => ({ ...g, _aug: x }))), '_aug').slice(0, 10))}</div>
        <div class="panel"><h3>로비 순위표 (${filt.event === 'all' ? '전체' : TL.esc(filt.event)})</h3>${st.length ? `<table class="table"><thead><tr><th>#</th><th>참가자</th><th>점수</th><th>경기</th><th>1등</th><th>TOP4</th><th>평균</th></tr></thead><tbody>${st.map((x, i) => `<tr${x.name === me() ? ' style="background:#2a2112"' : ''}><td>${i + 1}</td><td>${TL.esc(x.name)}</td><td><b class="gold-t">${x.pts}</b></td><td>${x.games}</td><td>${x.wins}</td><td>${x.top4}</td><td>${(TL.sum(x.places) / x.places.length).toFixed(2)}</td></tr>`).join('')}</tbody></table><div class="tiny">동점 처리: 점수 → 1등 횟수 → TOP4 횟수 → 마지막 경기 순위. 실제 대회 규정이 다르면 그 규정을 따르세요.</div>` : '<div class="tiny">로비 참가자를 입력하면 대회 순위표가 계산돼.</div>'}</div>
      </div>
    </div>`;
    bind();
  }
  function statTable(rows) { if (!rows.length) return '<div class="tiny">데이터 없음</div>'; return `<table class="table"><thead><tr><th>항목</th><th>경기</th><th>평균</th><th>1등</th><th>TOP4</th><th>점수</th></tr></thead><tbody>${rows.map(r => `<tr><td>${TL.esc(r.k)}</td><td>${r.n}</td><td><b class="gold-t">${r.avg.toFixed(2)}</b></td><td>${r.wins}</td><td>${Math.round(r.top4 * 100)}%</td><td>${r.pts}</td></tr>`).join('')}</tbody></table>`; }
  function bind() {
    TL.$('#fEvent').onchange = e => { filt.event = e.target.value; render(); };
    TL.$('#fPatch').onchange = e => { filt.patch = e.target.value; render(); };
    TL.$('#rSave').onclick = () => {
      let g; try { g = readForm(); } catch (err) { return TL.toast(err.message, 'err'); }
      if (editId) { const x = R().games.find(y => y.id === editId); Object.assign(x, g); editId = null; TL.toast('수정 저장', 'ok'); }
      else { R().games.unshift({ id: TL.uid('g'), created: new Date().toISOString(), ...g }); TL.toast(`${g.myPlace}위 기록 저장 (+${pts(g.myPlace)}점)`, 'ok'); }
      R().games.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.created || '').localeCompare(String(a.created || '')));
      TL.save(); render();
    };
    const c = TL.$('#rCancel'); if (c) c.onclick = () => { editId = null; render(); };
    TL.$$('[data-redit]').forEach(b => b.onclick = () => { editId = b.dataset.redit; render(); window.scrollTo(0, 0); });
    TL.$$('[data-rdel]').forEach(b => b.onclick = () => TL.confirm('경기 삭제', '이 경기 기록을 삭제할까?', () => { R().games = R().games.filter(g => g.id !== b.dataset.rdel); TL.save(); render(); }, '삭제', 'danger'));
    TL.$('#rCsv').onclick = () => { const rows = [['date', 'event', 'game', 'patch', 'my_place', 'points', 'comp', 'augments', 'items', 'lobby', 'note']].concat(games().map(g => [g.date, g.event, g.gameNo, g.patch, g.myPlace, pts(+g.myPlace), g.comp, (g.augments || []).join(' / '), g.items, (g.lobby || []).map(p => `${p.name}:${p.place}`).join(' / '), g.note])); TL.download('tft19-records.csv', '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); };
  }
  V.render = render; V.agg = agg; V.standings = standings; V.pts = pts;
  TL.views.records = V;
})(window.TL);
