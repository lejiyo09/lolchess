/* Dashboard — D-day, data verification status, training KPIs, checklist, routine, schedule */
'use strict';
(function (TL) {
  const V = {};
  function render() {
    const el = TL.$('#view-dashboard'); const s = TL.state; const p = TL.data.patch(); const b = TL.data.bundle();
    const days = Math.ceil((new Date(s.settings.eventDate + 'T00:00:00') - new Date(TL.today() + 'T00:00:00')) / 864e5);
    const rec = TL.views.records.agg(s.records.games.filter(g => +g.myPlace >= 1));
    const sims = s.simHistory; const simAvg = sims.length ? (TL.sum(sims.map(h => h.placement)) / sims.length).toFixed(2) : '-';
    const dr = TL.views.drill.stats();
    const nextPatch = p.schedule.find(x => x.date >= TL.today());
    const statusRows = ['champions', 'traits', 'augments', 'items', 'shop-odds', 'game-rules'].map(f => [f, b[f].meta?.status, b[f].meta?.patch]);
    const done = s.checklist.filter(c => c.d).length;
    el.innerHTML = `<div class="view-head"><div><h2>Dashboard <span class="muted small">대시보드</span></h2><p>${TL.esc(s.settings.eventName)} · ${TL.esc(s.settings.eventDate)} · 대회 기준 패치 ${TL.esc(p.targetPatch)}</p></div></div>
    <div class="kpis" style="margin-bottom:12px">
      <div class="kpi"><span>대회까지</span><b class="gold-t">${days >= 0 ? 'D-' + days : '종료'}</b><small>${TL.esc(s.settings.eventDate)}</small></div>
      <div class="kpi"><span>다음 패치</span><b>${nextPatch ? TL.esc(nextPatch.patch) : '-'}</b><small>${nextPatch ? TL.esc(nextPatch.date) + (nextPatch.confirmed ? '' : ' (예상)') : ''}</small></div>
      <div class="kpi"><span>스크림/대회 경기</span><b>${rec.n || 0}</b><small>평균 ${rec.n ? rec.avg.toFixed(2) : '-'} · TOP4 ${rec.n ? Math.round(rec.top4 * 100) + '%' : '-'}</small></div>
      <div class="kpi"><span>시뮬레이터</span><b>${sims.length}게임</b><small>평균 ${simAvg}위${s.sim && s.sim.phase !== 'over' ? ' · 진행 중 ' + s.sim.stage + '-' + s.sim.round : ''}</small></div>
      <div class="kpi"><span>판단력 훈련</span><b>${dr.n}/${TL.views.drill.questions.length}</b><small>평균 ${dr.n ? dr.avg.toFixed(2) : '-'}/3</small></div>
      <div class="kpi"><span>저장 조합</span><b>${s.comps.length}</b><small>증강 기록 ${s.augLab.history.length}</small></div>
    </div>
    <div class="grid g2">
      <div class="col" style="gap:12px">
        <div class="panel"><h3>데이터 검증 상태 <button class="xs" data-go="settings">관리 →</button></h3>
          <div class="notice ${b.champions.meta.status === 'live' ? 'green' : ''} tiny" style="margin-bottom:8px">현재 기준: <b>${TL.esc(p.currentDataPatch)}</b> (데이터 ${TL.esc(p.dataVersion)}). ${b.champions.meta.status === 'preview' ? '수치·최종 밸런스는 미확정이야. PBE → 19.1(12-02) → 19.2(12-15) 순서로 재검증 필요.' : b.champions.meta.status === 'pbe' ? 'PBE 수치는 라이브 전까지 계속 바뀔 수 있어. 19.1(12-02) → 19.2(12-15) 패치 노트로 재검증 필요. 상점 확률·경제 규칙은 아직 Set 18 값.' : ''}</div>
          <table class="table"><tbody>${statusRows.map(([f, st, pt]) => `<tr><td>${f}</td><td>${TL.statusPill(st || 'unverified')}</td><td class="tiny">${TL.esc(pt || '')}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="panel"><h3>패치 일정</h3><div class="timeline">${p.schedule.map(x => `<div class="${x.date < TL.today() ? 'past' : ''}"><span>${TL.esc(x.date)}</span><span class="pill ${x.confirmed ? 'green' : ''}">${TL.esc(x.patch)}</span><span class="tiny">${TL.esc(x.what)}${x.confirmed ? '' : ' · 미확정'}</span></div>`).join('')}<div><span>${TL.esc(s.settings.eventDate)}</span><span class="pill gold">대회</span><span class="tiny">${TL.esc(s.settings.eventName)}</span></div></div></div>
        <div class="panel"><h3>최근 경기</h3>${s.records.games.slice(0, 5).map(g => `<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--line)"><span>${TL.esc(g.date)} · ${TL.esc(g.event)} · ${TL.esc(g.comp || '')}</span><b class="${+g.myPlace <= 4 ? 'green-t' : 'red-t'}">${g.myPlace}위</b></div>`).join('') || '<div class="empty">아직 기록 없음 <button class="xs" data-go="records">기록하기</button></div>'}</div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><h3>대회 준비 체크리스트 <span class="pill">${done}/${s.checklist.length}</span></h3>
          ${s.checklist.map((c, i) => `<div class="row nw" style="padding:5px 0;border-bottom:1px solid var(--line)"><input type="checkbox" data-ck="${i}" ${c.d ? 'checked' : ''}/><span class="small" style="flex:1">${TL.esc(c.t)}</span><button class="xs ghost" data-ckdel="${i}" title="삭제">✕</button></div>`).join('')}
          <div class="row" style="margin-top:6px"><input id="ckNew" placeholder="항목 추가" style="flex:1"/><button class="sm" id="ckAdd">추가</button></div></div>
        <div class="panel"><h3>권장 훈련 루틴 (1세션 60~90분)</h3><ol class="small" style="margin:0;padding-left:18px;line-height:1.8">
          <li><a href="#builder" data-go="builder">Team Builder</a>: 주력 조합 1개 + 대체 조합 1개를 저장하고 핵심 아이템·딜러/탱커 지정</li>
          <li><a href="#sim" data-go="sim">Game Simulator</a>: 1게임 완주 또는 "4-1 체력 35" 같은 시나리오 3회 반복 → 복기 화면 확인</li>
          <li><a href="#augments" data-go="augments">Augment Lab</a>: 선택 연습 5회, 이유 작성 후 상황 값을 바꿔 비교</li>
          <li><a href="#scout" data-go="scout">Scouting</a>: 결승권 상대 2~3명 보드 기록 → 배치안 A/B 위험 점수 비교</li>
          <li><a href="#drill" data-go="drill">Decision Training</a>: 문제 5개 + 상황 생성기 5회, 이유를 먼저 쓰고 답하기</li>
          <li><a href="#records" data-go="records">Tournament Records</a>: 스크림 결과·증강·복기 기록 → 조합별/패치별 성적 확인</li></ol></div>
        ${sims.length ? `<div class="panel"><h3>최근 시뮬레이션</h3>${sims.slice(0, 5).map(h => `<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--line)"><span>${TL.fmtDate(h.date)} · ${TL.esc(h.traits.slice(0, 2).join(', '))}</span><span>리롤 ${h.stats.rollGold}G · <b class="${h.placement <= 4 ? 'green-t' : 'red-t'}">${h.placement}위</b></span></div>`).join('')}</div>` : ''}
      </div>
    </div>`;
    TL.$$('[data-go]', el).forEach(a => a.onclick = e => { e.preventDefault(); TL.go(a.dataset.go); });
    TL.$$('[data-ck]', el).forEach(c => c.onchange = () => { s.checklist[+c.dataset.ck].d = c.checked; TL.save(); render(); });
    TL.$$('[data-ckdel]', el).forEach(c => c.onclick = () => { s.checklist.splice(+c.dataset.ckdel, 1); TL.save(); render(); });
    TL.$('#ckAdd').onclick = () => { const v = TL.$('#ckNew').value.trim(); if (!v) return; s.checklist.push({ t: v, d: false }); TL.save(); render(); };
  }
  V.render = render;
  TL.views.dashboard = V;
})(window.TL);
