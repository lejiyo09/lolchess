/* Meta Comps — PBE meta decks snapshot (data/meta-comps.json): tiers, stats, units/items/traits, details, load into Team Builder */
'use strict';
(function (TL) {
  const V = {};
  let f = { q: '', tier: 'all', style: 'all', sort: 'adjAvp', showHidden: false }, open = {};
  const pct = x => (x == null ? '-' : (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%');
  const STYLE = { 'high-roll': '하이롤', consistent: '안정형', reroll: '리롤' };

  function list(M) {
    const q = f.q.trim().toLowerCase();
    return M.comps.filter(c => (f.showHidden || !c.hiddenByDefault) && (f.tier === 'all' || c.tier === f.tier)
      && (f.style === 'all' || (f.style === 'reroll' ? c.isReroll : c.style === f.style))
      && (!q || c.name.toLowerCase().includes(q) || c.units.some(u => { const ch = TL.data.champ(u.champ); return ch && (ch.name.toLowerCase().includes(q) || (ch.nameKo || '').includes(q)); })
        || c.traits.some(t => t.name.toLowerCase().includes(q)) || c.units.some(u => u.items.some(i => { const it = TL.data.item(i); return it && ((it.nameKo || '').includes(q) || it.name.toLowerCase().includes(q)); }))))
      .sort((a, b) => f.sort === 'playRate' ? b.playRate - a.playRate : f.sort === 'top4' ? b.top4 - a.top4 : f.sort === 'win' ? b.win - a.win : (a.adjAvp || 9) - (b.adjAvp || 9));
  }
  function unitHTML(u) {
    const c = TL.data.champ(u.champ); if (!c) return '';
    return `<div class="mc-u" title="${TL.esc(c.name + ' · ' + c.traits.join(', ') + (u.role ? '\n역할: ' + u.role : '') + (u.threeStarRate != null ? '\n3성 비율 ' + pct(u.threeStarRate) : ''))}">${u.star3 ? TL.ui.stars(3) : ''}${TL.ui.champ(c)}${u.priority ? `<span class="prio" title="아이템 우선순위">${u.priority}</span>` : ''}<span class="uitems">${u.items.map(i => TL.ui.item(i)).join('')}</span><span class="un">${TL.esc(TL.data.name(c))}</span></div>`;
  }
  function delta(d, invert) { if (d == null) return ''; const good = invert ? d < 0 : d > 0; return `<span class="${good ? 'delta-good' : 'delta-bad'}">${d > 0 ? '+' : ''}${d.toFixed(2)}</span>`; }
  function detailHTML(c) {
    const chip = id => { const ch = TL.data.champ(id); return ch ? `<span class="row nw" style="gap:4px">${TL.ui.champ(ch, 'xs')}${TL.esc(TL.data.name(ch))}</span>` : ''; };
    const carries = c.units.filter(u => u.itemTable);
    return `<div class="mc-detail grid g2">
      <div>
        <h4>핵심 유닛 <span class="tiny">(빠졌을 때 평균 등수 악화 폭)</span></h4><div class="col" style="gap:3px">${c.core.slice(0, 8).map(x => `<div class="row between small">${chip(x.champ)}<span class="tiny">채용 ${pct(x.share)} · 영향 ${delta(x.delta)}</span></div>`).join('') || '<div class="tiny">-</div>'}</div>
        <h4>유연 슬롯 (flex)</h4><div class="col" style="gap:3px">${c.flex.slice(0, 6).map(x => `<div class="row between small">${chip(x.champ)}<span class="tiny">${pct(x.playRate)} 채용${x.replaces.length ? ' · 대체: ' + x.replaces.map(r => TL.esc(TL.data.name(TL.data.champ(r)))).join(', ') : ''} · ${delta(x.delta)}</span></div>`).join('') || '<div class="tiny">-</div>'}</div>
        <h4>모을 재료</h4><div class="row">${c.components.map(x => `<span class="row nw" style="gap:3px;margin-right:8px" title="${TL.esc(x.forItems.map(i => TL.data.item(i)?.nameKo || i).join(', '))}">${TL.ui.item(x.item)}×${x.count}</span>`).join('') || '<span class="tiny">-</span>'}</div>
        <h4>레벨별 보드 (인원 수)</h4>${c.boardShapes.map(b => `<div class="row small" style="margin-bottom:3px"><b style="width:34px">${b.count}명</b>${b.units.map(id => TL.ui.champ(TL.data.champ(id), 'xs')).join('')}<span class="tiny">평균 ${b.avp ?? '-'} · ${pct(b.share)}</span></div>`).join('') || '<div class="tiny">-</div>'}
      </div>
      <div>
        <h4>캐리 아이템 표 <span class="tiny">(채용률 · 평균 등수 변화, 음수가 좋음)</span></h4>${carries.map(u => { const ch = TL.data.champ(u.champ); const T = u.itemTable; return `<div style="margin-bottom:6px"><div class="row small">${TL.ui.champ(ch, 'xs')}<b>${TL.esc(TL.data.name(ch))}</b><span class="tiny">${u.role || ''}${u.damage ? ' · ' + u.damage : ''}</span></div>${['core', 'important', 'optional', 'artifacts', 'radiants'].filter(k => T[k]).map(k => `<div class="row small" style="gap:6px"><span class="tiny" style="width:52px">${{ core: '핵심', important: '중요', optional: '선택', artifacts: '유물', radiants: '찬란한' }[k]}</span>${T[k].map(x => `<span class="row nw" style="gap:2px" title="${TL.esc(TL.data.item(x.id)?.nameKo || x.id)}">${TL.ui.item(x.id)}<span class="tiny">${pct(x.share)} ${delta(x.delta, true)}</span></span>`).join('')}</div>`).join('')}</div>`; }).join('') || '<div class="tiny">-</div>'}
        <h4>변형</h4>${c.variants.map(v => `<div class="tiny">${v.lead ? '★ ' : ''}${TL.esc(v.label || '')} — 평균 ${v.avp} · TOP4 ${pct(v.top4)} · ${v.games}판 ${v.tier ? '(' + v.tier + ')' : ''}</div>`).join('') || '<div class="tiny">-</div>'}
        <h4>전환(피벗) 후보 <span class="tiny">(아이템 공유)</span></h4>${c.pivots.map(p => `<div class="row small" style="gap:4px"><b>${TL.esc(p.name)}</b>${p.sharedItems.slice(0, 6).map(i => TL.ui.item(i)).join('')}</div>`).join('') || '<div class="tiny">-</div>'}
      </div>
    </div>`;
  }
  function compHTML(c) {
    const at = c.allTime;
    return `<div class="mc" id="mc-${TL.esc(c.slug)}">
      <div class="mc-head"><span class="mc-tier ${TL.esc(c.tier || 'C')}">${TL.esc(c.tier || '-')}</span><div><div class="mc-name">${TL.esc(c.name)}</div><div class="row" style="gap:4px;margin-top:2px">${c.isReroll ? '<span class="tag reroll">리롤</span>' : ''}${c.style ? `<span class="tag ${TL.esc(c.style)}">${STYLE[c.style] || TL.esc(c.style)}</span>` : ''}${c.hiddenByDefault ? '<span class="tag">저표본</span>' : ''}</div></div>
        <div class="mc-stats"><div><b class="gold-t">${c.adjAvp ?? '-'}</b><span>평균 등수(보정)</span></div><div><b>${pct(c.top4)}</b><span>TOP 4</span></div><div><b>${pct(c.win)}</b><span>1등</span></div><div><b>${pct(c.playRate)}</b><span>픽률 · ${(c.games || 0).toLocaleString()}판</span></div>${at ? `<div title="PBE 전체 기간"><b class="muted">${at.avp ?? '-'}</b><span>전체기간 평균 (${at.tier || '-'})</span></div>` : ''}</div></div>
      <div class="mc-traits">${c.traits.map(t => `<span class="mt">${TL.ui.trait(t.name, ['none', 'bronze', 'silver', 'gold', 'prism'][t.style] || 'bronze', 'xs')}${t.count} ${TL.esc(t.name)}</span>`).join('')}</div>
      <div class="mc-units">${c.units.map(unitHTML).join('')}</div>
      <div class="row" style="margin-top:8px"><button class="sm gold" data-load="${TL.esc(c.slug)}">팀 빌더로 불러오기</button><button class="sm" data-open="${TL.esc(c.slug)}">${open[c.slug] ? '상세 닫기' : '상세 보기'}</button></div>
      ${open[c.slug] ? detailHTML(c) : ''}
    </div>`;
  }
  function placeUnits(units) {
    // simple in-game style placement: tanks/fighters front, assassins back corners, ranged back row
    const used = new Set(); const take = rows => { for (const r of rows) for (const c of [3, 2, 4, 1, 5, 0, 6]) { const p = r * 7 + c; if (!used.has(p)) { used.add(p); return p; } } return null; };
    return units.map(u => { const ch = TL.data.champ(u.champ); const role = ch?.role || ''; const front = /Tank|Fighter/.test(role) || u.role === 'tank';
      const pos = /Assassin/.test(role) ? (() => { for (const p of [21, 27, 22, 26]) if (!used.has(p)) { used.add(p); return p; } return take([3, 2]); })() : take(front ? [0, 1] : [3, 2]);
      return { id: TL.uid('u'), champ: u.champ, star: u.star3 ? 3 : 2, items: u.items.filter(i => TL.data.item(i)).slice(0, 3), pos, role: u.priority === 1 ? 'carry' : (u.role === 'tank' ? 'tank' : null) }; });
  }
  function load(c) {
    const B = TL.state.builder;
    TL.confirm('팀 빌더로 불러오기', `<p class="small">"${TL.esc(c.name)}"를 팀 빌더 보드에 배치할까? (현재 보드는 교체되고, 저장된 조합은 그대로야)</p><p class="tiny">배치는 역할 기반 자동 배치(탱커·전사 앞줄, 원거리 뒷줄, 암살자 구석)라 정찰 메뉴에서 상대에 맞게 조정해.</p>`, () => {
      B.board = placeUnits(c.units).filter(u => u.pos != null); B.bench = Array(9).fill(null); B.level = Math.min(11, Math.max(B.board.length, 1)); B.selected = null; TL.save();
      TL.go('builder'); TL.toast(`${c.name} 불러옴 — 레벨 ${B.level}`, 'ok');
    }, '불러오기');
  }
  function render() {
    const el = TL.$('#view-meta'); const M = TL.data.meta();
    if (!M) { el.innerHTML = '<div class="view-head"><div><h2>Meta Comps</h2></div></div><div class="notice">메타 덱 데이터(meta-comps.json)가 없어. Data &amp; Settings에서 가져와 줘.</div>'; return; }
    const L = list(M); const m = M.meta;
    el.innerHTML = `<div class="view-head"><div><h2>Meta Comps <span class="muted small">PBE 메타 덱</span></h2><p>${TL.esc(m.scope || '')} · 집계 ${TL.esc(m.computedAt || '')} · 출처 <a href="${TL.esc(m.source?.[1] || '#')}" target="_blank" rel="noopener">${TL.esc(m.source?.[0] || '')}</a></p></div><div class="row">${TL.statusPill('pbe')}<span class="tiny">${M.comps.length}개 조합</span></div></div>
      <div class="notice tiny" style="margin-bottom:10px">${TL.esc(m.note || '')} 등급 기준: 조정 평균 등수 ${m.gradeRules?.tiers?.map(t => `${t.tier} &lt; ${t.below}`).join(' · ') || ''}. 롤체지지(lolchess.gg)는 자동 수집을 차단해 포함하지 못했어.</div>
      <div class="panel" style="margin-bottom:12px"><div class="row"><input id="mQ" placeholder="챔피언·특성·아이템 검색 (한/영)" value="${TL.esc(f.q)}" style="flex:1;min-width:180px"/>
        <select id="mTier"><option value="all">전체 등급</option>${['S', 'A', 'B'].map(t => `<option ${f.tier === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <select id="mStyle"><option value="all">전체 유형</option><option value="reroll" ${f.style === 'reroll' ? 'selected' : ''}>리롤</option><option value="high-roll" ${f.style === 'high-roll' ? 'selected' : ''}>하이롤</option><option value="consistent" ${f.style === 'consistent' ? 'selected' : ''}>안정형</option></select>
        <select id="mSort"><option value="adjAvp" ${f.sort === 'adjAvp' ? 'selected' : ''}>평균 등수순</option><option value="playRate" ${f.sort === 'playRate' ? 'selected' : ''}>픽률순</option><option value="top4" ${f.sort === 'top4' ? 'selected' : ''}>TOP4순</option><option value="win" ${f.sort === 'win' ? 'selected' : ''}>1등률순</option></select>
        <label class="row tiny"><input type="checkbox" id="mHidden" ${f.showHidden ? 'checked' : ''}/> 저표본 포함</label><span class="pill">${L.length}</span></div></div>
      <div id="mList">${L.map(compHTML).join('') || '<div class="empty">조건에 맞는 조합이 없어.</div>'}</div>`;
    const re = () => { f = { ...f, q: TL.$('#mQ').value, tier: TL.$('#mTier').value, style: TL.$('#mStyle').value, sort: TL.$('#mSort').value, showHidden: TL.$('#mHidden').checked }; render(); };
    TL.$('#mQ').oninput = TL.debounce(() => { re(); const i = TL.$('#mQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250);
    ['#mTier', '#mStyle', '#mSort', '#mHidden'].forEach(s => TL.$(s).onchange = re);
    TL.$$('[data-open]', el).forEach(b => b.onclick = () => { open[b.dataset.open] = !open[b.dataset.open]; render(); const t = document.getElementById('mc-' + b.dataset.open); if (t) t.scrollIntoView({ block: 'nearest' }); });
    TL.$$('[data-load]', el).forEach(b => b.onclick = () => load(M.comps.find(c => c.slug === b.dataset.load)));
  }
  V.render = render; V.placeUnits = placeUnits;
  TL.views.meta = V;
})(window.TL);
