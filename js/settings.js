/* Data & Settings — dataset status, validation, repair, import/export (bundle / single file / v0.1 / CommunityDragon), backups, changelog, app settings */
'use strict';
(function (TL) {
  const V = {};
  const slug = s => String(s).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  /* ---------- converters ---------- */
  TL.convert = {
    detect(o) {
      if (!o || typeof o !== 'object') return 'unknown';
      if (o.setData && o.sets && o.items) return 'cdragon';
      if (o['patch-info'] && o.champions && o.traits) return 'bundle';
      if (o.type === 'tft-lab-comp') return 'comp';
      if (o.version === 2 && o.settings) return 'state';
      if (Array.isArray(o.champions) && o.traits && !Array.isArray(o.traits)) return 'legacy';
      if (o.schemaVersion && o.dataVersion) return 'patch-info';
      if (o.meta && Array.isArray(o.champions)) return 'champions';
      if (o.meta && Array.isArray(o.traits)) return 'traits';
      if (o.meta && Array.isArray(o.items)) return 'items';
      if (o.meta && Array.isArray(o.augments)) return 'augments';
      if (o.odds && o.poolSize) return 'shop-odds';
      if (o.meta && Array.isArray(o.comps)) return 'meta-comps';
      if (o.xpToNext && o.stageDamage) return 'game-rules';
      return 'unknown';
    },
    legacy(o) { // v0.1.0 dataset → bundle (keeps current items/augments/rules)
      const b = TL.clone(TL.data.bundle());
      const traitNames = new Set(o.champions.flatMap(c => c.traits || []));
      const uniq = new Set(o.uniqueTraits || []);
      b.traits.traits = [...traitNames].map(n => { const old = b.traits.traits.find(t => t.name === n); const bp = o.traits[n] || (uniq.has(n) ? [1] : null); return { ...(old || { id: slug(n), name: n, nameKo: null, description: '', champions: [], notes: [] }), type: uniq.has(n) ? 'unique' : (old?.type || 'trait'), countMode: old?.countMode || 'units', tiers: (bp || [1]).map(m => ({ min: +m, effect: old?.tiers?.find(t => t.min === +m)?.effect || '' })), status: 'unverified' }; });
      b.champions.champions = o.champions.map(c => { const old = TL.data.champByName(c.name); return { id: old?.id || slug(c.name), name: c.name, nameKo: old?.nameKo || null, cost: +c.cost, traits: c.traits || [], role: c.role || '', effects: [], unlock: !!c.unlock, unlockCondition: old?.unlockCondition || null, status: 'unverified' }; });
      b.champions.meta = { ...b.champions.meta, source: o.source || 'v0.1.0 dataset', patch: o.snapshot || 'v0.1.0', status: 'unverified', updated: TL.today() };
      b.traits.meta = { ...b.traits.meta, source: o.source || 'v0.1.0 dataset', patch: o.snapshot || 'v0.1.0', status: 'unverified', updated: TL.today() };
      b['patch-info'] = { ...b['patch-info'], dataVersion: 'legacy-import-' + TL.today(), currentDataPatch: o.snapshot || 'v0.1.0 dataset' };
      return b;
    },
    cdragonSets(o) { return (o.setData || []).map(s => ({ mutator: s.mutator, number: s.number, champions: (s.champions || []).length })).sort((a, b) => b.number - a.number); },
    cdragon(o, mutator, status, patchLabel) {
      const sd = o.setData.find(s => s.mutator === mutator); if (!sd) throw new Error('세트 없음: ' + mutator);
      const items = Object.fromEntries(o.items.map(i => [i.apiName, i]));
      const clean = (desc, eff) => { if (!desc) return ''; const e = {}; Object.entries(eff || {}).forEach(([k, v]) => { if (typeof v === 'number') e[k.toLowerCase()] = v; }); return desc.replace(/@([A-Za-z0-9_]+)(?:\*([0-9.]+))?@/g, (m, k, mul) => { const v = e[k.toLowerCase()]; if (v == null) return '?'; const x = v * (mul ? +mul : 1); return Math.abs(x - Math.round(x)) < 0.05 ? String(Math.round(x)) : x.toFixed(1); }).replace(/@[^@\s]*@?/g, '').replace(/%i:[^%]*%/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); };
      const traits = (sd.traits || []).map(t => { const tiers = (t.effects || []).map(e => ({ min: e.minUnits, effect: '' })).filter(x => x.min >= 1); return { id: slug(t.name), name: t.name, nameKo: null, type: tiers.length === 1 && tiers[0].min === 1 ? 'unique' : 'trait', countMode: 'units', description: clean(t.desc, {}), tiers: tiers.length ? tiers : [{ min: 1, effect: '' }], champions: [], status, notes: ['CommunityDragon 변환 — 단계 효과 수치는 desc 참고'], apiName: t.apiName }; });
      const tn = new Set(traits.map(t => t.name));
      const champions = (sd.champions || []).filter(c => c.cost >= 1 && c.cost <= 10 && (c.traits || []).length && c.traits.every(t => tn.has(t))).map(c => ({ id: slug(c.name) + (c.apiName ? '' : ''), name: c.name, nameKo: null, cost: c.cost, traits: c.traits, role: c.role || '', effects: [], unlock: false, unlockCondition: null, status, apiName: c.apiName, stats: c.stats ? { hp: c.stats.hp, ad: c.stats.damage, as: c.stats.attackSpeed, range: c.stats.range, mana: c.stats.mana } : null, ability: c.ability ? { name: c.ability.name, desc: clean(c.ability.desc, Object.fromEntries((c.ability.variables || []).map(v => [v.name, (v.value || [])[1]]))) } : null }));
      const seen = {}; champions.forEach(c => { if (seen[c.id]) c.id += '-' + (++seen[c.id]); else seen[c.id] = 1; });
      traits.forEach(t => { t.champions = champions.filter(c => c.traits.includes(t.name)).map(c => c.name); });
      const augments = (sd.augments || []).map(a => items[a]).filter(Boolean).map(a => ({ id: slug(a.name || a.apiName), name: a.name, tier: /_III|Prismatic|T3/i.test(a.apiName + (a.icon || '')) ? 'Prismatic' : /_II|Gold|T2/i.test(a.apiName + (a.icon || '')) ? 'Gold' : 'Silver', description: clean(a.desc, a.effects), kind: (a.associatedTraits || []).length ? 'trait' : 'general', categories: [], relatedTraits: (a.associatedTraits || []).map(x => traits.find(t => t.apiName === x)?.name).filter(Boolean), numbers: a.effects || null, status: 'unverified', apiName: a.apiName }));
      const auSeen = {}; augments.forEach(a => { if (auSeen[a.id]) a.id += '-' + (++auSeen[a.id]); else auSeen[a.id] = 1; });
      const b = TL.clone(TL.data.bundle());
      const meta = (n) => ({ set: sd.number, patch: patchLabel, source: ['CommunityDragon ' + mutator], updated: TL.today(), status, count: n });
      b.champions = { meta: meta(champions.length), champions }; b.traits = { meta: meta(traits.length), traits };
      if (augments.length) b.augments = { meta: { ...meta(augments.length), note: '등급은 apiName/아이콘 패턴으로 추정(unverified). 확인 후 수정 필요.' }, augments };
      b['patch-info'] = { ...b['patch-info'], set: sd.number, dataVersion: `cdragon-${mutator}-${TL.today()}`, currentDataPatch: patchLabel };
      return b;
    },
  };

  /* ---------- import flow ---------- */
  async function handleFiles(files) {
    let cand = TL.clone(TL.data.bundle()); const labels = []; let touched = false;
    for (const f of files) {
      let o; try { o = JSON.parse(await TL.readFile(f)); } catch (e) { TL.toast(`${f.name}: JSON 파싱 실패`, 'err'); continue; }
      const kind = TL.convert.detect(o);
      if (kind === 'bundle') { cand = o; touched = true; labels.push(f.name + ' (전체 번들)'); }
      else if (kind === 'legacy') { cand = TL.convert.legacy(o); touched = true; labels.push(f.name + ' (v0.1.0 데이터셋)'); }
      else if (kind === 'cdragon') { await cdragonDialog(o, f.name); return; }
      else if (['patch-info', 'champions', 'traits', 'items', 'augments', 'shop-odds', 'game-rules', 'meta-comps'].includes(kind)) { cand[kind] = o; touched = true; labels.push(`${f.name} (${kind})`); }
      else if (kind === 'state') { TL.toast('앱 기록 백업 파일이야 — 아래 "앱 기록 복원"을 사용해.', 'err'); }
      else TL.toast(`${f.name}: 알 수 없는 형식`, 'err');
    }
    if (touched) previewApply(cand, labels.join(', '));
  }
  async function cdragonDialog(o, name) {
    const sets = TL.convert.cdragonSets(o);
    TL.modal('CommunityDragon 데이터 변환', `<p class="small">${TL.esc(name)} — 변환할 세트(mutator)를 골라. Set 19가 PBE/라이브에 반영되면 <code>TFTSet19</code>가 나타나.</p>
      <div class="field"><label>세트</label><select id="cdSet">${sets.map(s => `<option value="${TL.esc(s.mutator)}">${TL.esc(s.mutator)} (Set ${s.number}, ${s.champions}개 유닛)</option>`).join('')}</select></div>
      <div class="fgrid" style="margin-top:6px"><div class="field"><label>검증 상태</label><select id="cdSt"><option value="pbe">pbe</option><option value="live">live</option><option value="unverified">unverified</option></select></div><div class="field"><label>패치 표기</label><input id="cdP" placeholder="예: 19.2 live"/></div></div>
      <div class="notice tiny" style="margin-top:6px">챔피언·특성 단계·증강은 교체, 아이템/상점 확률/규칙은 현재 값 유지. 해금 정보·한글명·증강 등급은 CDragon에 없거나 추정이라 변환 후 확인이 필요해.</div>`,
    { buttons: [{ label: '취소' }, { label: '변환', cls: 'primary', onClick: () => { try { const b = TL.convert.cdragon(o, TL.$('#cdSet').value, TL.$('#cdSt').value, TL.$('#cdP').value || TL.$('#cdSet').value); setTimeout(() => previewApply(b, name + ' → ' + TL.$('#cdSet')?.value), 50); } catch (e) { TL.toast('변환 실패: ' + e.message, 'err'); } } }] });
  }
  function previewApply(cand, label) {
    const v = TL.data.validate(cand);
    const diff = TL.data.diff(TL.data.bundle(), cand);
    const list = (t, arr) => arr.length ? `<div class="tiny"><b>${t}</b> ${arr.slice(0, 40).map(TL.esc).join(', ')}${arr.length > 40 ? ` 외 ${arr.length - 40}` : ''}</div>` : '';
    const body = `<div class="tiny">${TL.esc(label)}</div>
      <h4>검증 결과</h4>${v.errors.length ? `<div class="notice red tiny">오류 ${v.errors.length}개 — 그대로는 적용할 수 없어. "자동 복구 후 적용"을 쓰거나 파일을 수정해.<br>${v.errors.slice(0, 15).map(TL.esc).join('<br>')}</div>` : '<div class="notice green tiny">오류 없음</div>'}${v.warnings.length ? `<details><summary>경고 ${v.warnings.length}개</summary><div class="tiny">${v.warnings.slice(0, 60).map(TL.esc).join('<br>')}</div></details>` : ''}
      <h4>변경 내역 (현재 → 가져올 데이터)</h4><div class="tiny gold-t">${TL.esc(TL.data.diffSummary(diff))}</div>
      ${list('챔피언 추가:', diff.champions.added)}${list('챔피언 제거:', diff.champions.removed)}${list('챔피언 변경:', diff.champions.changed)}${list('특성 추가:', diff.traits.added)}${list('특성 제거:', diff.traits.removed)}${list('특성 단계 변경:', diff.traits.changed)}${list('아이템 +:', diff.items.added)}${list('아이템 −:', diff.items.removed)}${list('증강 +:', diff.augments.added.slice(0, 20))}${list('증강 −:', diff.augments.removed.slice(0, 20))}${list('상점 확률:', diff.odds)}${list('규칙:', diff.rules)}
      <div class="notice blue tiny" style="margin-top:6px">적용 전 현재 데이터셋은 IndexedDB에 자동 백업돼(최근 8개 유지). 저장된 조합/기록에서 사라진 챔피언은 표시되지 않을 수 있어.</div>`;
    const btns = [{ label: '취소' }];
    if (v.errors.length) btns.push({ label: '자동 복구 후 적용', cls: 'gold', onClick: () => { const r = TL.data.repair(cand); doApply(r.fixed, label + ' (복구)', r.log); } });
    else btns.push({ label: '적용', cls: 'primary', onClick: () => doApply(cand, label) });
    TL.modal('데이터 가져오기 미리 보기', body, { buttons: btns });
  }
  async function doApply(b, label, repairLog) {
    try { const r = await TL.data.apply(b, label); TL.refreshHeader(); render(); TL.toast('데이터 적용 완료: ' + TL.data.diffSummary(r.diff), 'ok'); if (repairLog?.length) TL.modal('자동 복구 내역', '<div class="tiny">' + repairLog.map(TL.esc).join('<br>') + '</div>'); }
    catch (e) { TL.modal('적용 실패', `<pre>${TL.esc(e.message)}</pre>`); }
  }

  /* ---------- render ---------- */
  async function render() {
    const el = TL.$('#view-settings'); const b = TL.data.bundle(); const p = b['patch-info']; const s = TL.state.settings;
    const v = TL.data.validate(b);
    const rows = [['patch-info', p.dataVersion, p.currentDataPatch, '-', p.built, '-'], ...TL.DATA_FILES.slice(1).map(f => { const m = b[f].meta || {}; const n = (b[f][f] || b[f].champions || b[f].traits || b[f].items || b[f].augments || []).length || (f === 'shop-odds' ? Object.keys(b[f].odds || {}).length + ' 레벨' : f === 'game-rules' ? Object.keys(b[f]).length - 1 + ' 항목' : ''); return [f, n, m.patch, Array.isArray(m.source) ? m.source.join(' · ') : m.source, m.updated, m.status]; })];
    const MC = TL.data.meta(); if (MC) rows.push(['meta-comps', MC.comps.length + ' 조합', MC.meta.scope, (MC.meta.source || []).join(' · '), MC.meta.computedAt, MC.meta.status]);
    el.innerHTML = `<div class="view-head"><div><h2>Data &amp; Settings <span class="muted small">데이터 · 설정</span></h2><p>패치가 바뀌면 data/*.json만 교체하면 돼. 앱 안에서 가져오기/검증/복구/백업까지 처리할 수 있어.</p></div><div class="row">${TL.data.isOverridden() ? '<span class="pill cyan">사용자 데이터 사용 중</span>' : '<span class="pill">내장 데이터</span>'}<span class="pill ${v.errors.length ? 'red' : 'green'}">검증 ${v.errors.length ? '오류 ' + v.errors.length : '통과'} · 경고 ${v.warnings.length}</span></div></div>
    <div class="notice" style="margin-bottom:12px"><b>대회 기준 패치 19.2는 2026-12-15 예정이라 아직 존재하지 않아.</b> 현재 챔피언·특성·증강·아이템 기준: <b>${TL.esc(p.currentDataPatch)}</b> (${TL.statusPill(b.champions.meta.status)}). 상점 확률·XP·경제 규칙은 ${TL.esc(b['shop-odds'].meta.patch)} 값(${TL.statusPill(b['shop-odds'].meta.status)})이야. 19.1(12-02)과 19.2 패치 노트가 나오면 반드시 교체·재검증해.</div>
    <div class="split">
      <div class="col" style="gap:12px">
        <div class="panel"><h3>데이터 파일 상태</h3><div class="scroll"><table class="table"><thead><tr><th>파일</th><th>항목</th><th>패치</th><th>출처</th><th>업데이트</th><th>상태</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${r[0]}.json</b></td><td>${TL.esc(r[1])}</td><td class="tiny">${TL.esc(r[2] || '')}</td><td class="tiny" style="max-width:300px">${TL.esc(r[3] || '')}</td><td class="tiny">${TL.esc(r[4] || '')}</td><td>${r[5] && r[5] !== '-' ? TL.statusPill(r[5]) : ''}</td></tr>`).join('')}</tbody></table></div>
          <div class="legend" style="margin-top:6px">${Object.entries(TL.data.statusLegend()).map(([k, t]) => `<span>${TL.statusPill(k)} ${TL.esc(t)}</span>`).join('')}</div>
          <div class="row" style="margin-top:8px"><button class="sm" id="dValidate">데이터 검증</button><button class="sm" id="dRepair">자동 복구</button><button class="sm danger" id="dReset" ${TL.data.isOverridden() ? '' : 'disabled'}>내장 데이터로 되돌리기</button></div>
        </div>
        <div class="panel"><h3>데이터 가져오기 / 내보내기</h3>
          <div class="tiny" style="margin-bottom:6px">지원 형식: ① 전체 번들(내보내기 파일) ② 개별 파일(champions.json 등, 여러 개 동시 선택 가능) ③ v0.1.0 데이터셋(tft-set19-dataset.json) ④ CommunityDragon <code>cdragon/tft/en_us.json</code> (약 24MB, PBE/라이브 반영 후 사용)</div>
          <div class="row"><button class="primary sm" id="dImportBtn">JSON 가져오기…</button><input type="file" id="dImport" accept="application/json,.json" multiple hidden/><button class="sm" id="dExportAll">전체 번들 내보내기</button></div>
          <div class="row" style="margin-top:6px">${[...TL.DATA_FILES, ...(TL.data.meta() ? ['meta-comps'] : [])].map(f => `<button class="xs" data-exp="${f}">${f}.json</button>`).join('')}</div>
          <div class="tiny" style="margin-top:6px">데이터 원본 링크: <a href="https://raw.communitydragon.org/pbe/cdragon/tft/en_us.json" target="_blank" rel="noopener">CDragon PBE</a> · <a href="https://raw.communitydragon.org/latest/cdragon/tft/en_us.json" target="_blank" rel="noopener">CDragon Live</a> · <a href="https://teamfighttactics.leagueoflegends.com/ko-kr/news/game-updates/" target="_blank" rel="noopener">Riot 패치 노트</a> · <a href="https://wiki.leagueoflegends.com/en-us/TFT:Gold" target="_blank" rel="noopener">LoL Wiki</a> · <a href="https://namu.wiki/w/%EC%A0%84%EB%9E%B5%EC%A0%81%20%ED%8C%80%20%EC%A0%84%ED%88%AC" target="_blank" rel="noopener">나무위키</a></div>
        </div>
        <div class="panel"><h3>백업 (IndexedDB) <button class="xs" id="bkNow">지금 기록 백업</button></h3><div id="bkList" class="tiny">불러오는 중…</div></div>
        <div class="panel"><h3>패치 · 데이터 변경 내역</h3>
          <h4>일정</h4><div class="timeline">${p.schedule.map(x => `<div class="${x.date < TL.today() ? 'past' : ''}"><span>${TL.esc(x.date)}</span><span class="pill ${x.confirmed ? 'green' : ''}">${TL.esc(x.patch)}</span><span class="tiny">${TL.esc(x.what)}${x.confirmed ? '' : ' (미확정)'}</span></div>`).join('')}</div>
          <h4>데이터 버전 기록</h4>${p.changelog.map(c => `<details ${c.version === p.dataVersion ? 'open' : ''}><summary>${TL.esc(c.version)} · ${TL.esc(c.date)}</summary><ul class="tiny">${c.changes.map(x => `<li>${TL.esc(x)}</li>`).join('')}</ul></details>`).join('')}
          <h4>가져오기 기록</h4>${TL.state.importLog.length ? TL.state.importLog.map(l => `<div class="tiny">${TL.fmtDate(l.date)} · <b>${TL.esc(l.label)}</b> · ${TL.esc(l.version || '')} · ${TL.esc(TL.data.diffSummary(l.diff))}</div>`).join('') : '<div class="tiny">아직 없음</div>'}
          <h4>출처</h4>${p.sources.map(x => `<div class="tiny">· <a href="${TL.esc(x.url)}" target="_blank" rel="noopener">${TL.esc(x.name)}</a> — ${TL.esc(x.used)}</div>`).join('')}
        </div>
      </div>
      <div class="col" style="gap:12px">
        <div class="panel"><h3>앱 설정</h3>
          <div class="field"><label>내 이름 (기록에서 내 순위로 집계)</label><input id="stName" value="${TL.esc(s.playerName)}"/></div>
          <div class="field" style="margin-top:6px"><label>대회 이름</label><input id="stEvent" value="${TL.esc(s.eventName)}"/></div>
          <div class="field" style="margin-top:6px"><label>대회 날짜</label><input type="date" id="stDate" value="${TL.esc(s.eventDate)}"/></div>
          <div class="field" style="margin-top:6px"><label>기본 패치 표기</label><input id="stPatch" value="${TL.esc(s.defaultPatch)}"/></div>
          <label class="row" style="margin-top:8px;color:var(--text)"><input type="checkbox" id="st3d" ${s.board3d !== false ? 'checked' : ''}/> 인게임 스타일 3D 기울임 보드 (끄면 평면 — 저사양 기기용)</label>
          <label class="row" style="margin-top:8px;color:var(--text)"><input type="checkbox" id="stKo" ${s.showKo ? 'checked' : ''}/> 한국어 챔피언 이름 표시 (CommunityDragon ko_kr 확인분)</label>
          <div class="row" style="margin-top:8px"><button class="primary sm" id="stSave">설정 저장</button></div>
        </div>
        <div class="panel"><h3>대회 점수 체계</h3>
          ${s.scorePresets.map(pr => `<div style="border:1px solid var(--line);border-radius:8px;padding:6px;margin-bottom:6px"><div class="row between"><label class="row" style="color:var(--text)"><input type="radio" name="preset" value="${pr.id}" ${s.activePreset === pr.id ? 'checked' : ''}/> <input data-pn="${pr.id}" value="${TL.esc(pr.name)}" style="width:150px"/></label>${pr.id !== 'std' ? `<button class="xs danger" data-pdel="${pr.id}">✕</button>` : ''}</div><div class="row" style="margin-top:4px">${pr.map.map((v, i) => `<div class="field" style="width:44px"><label>${i + 1}위</label><input type="number" data-pv="${pr.id}" data-pi="${i}" value="${v}" step="0.5"/></div>`).join('')}</div></div>`).join('')}
          <div class="row"><button class="sm" id="pAdd">+ 점수표 추가</button><button class="sm primary" id="pSave">점수표 저장</button></div>
          <div class="tiny" style="margin-top:4px">기록 점수는 저장 시점이 아니라 현재 선택한 점수표로 다시 계산돼.</div>
        </div>
        <div class="panel"><h3>앱 기록 백업 / 복원</h3><div class="tiny">조합·시뮬레이터·증강·정찰·훈련·대회 기록·설정 전체(JSON). 다른 기기/브라우저로 옮길 때 사용.</div>
          <div class="row" style="margin-top:6px"><button class="sm gold" id="aExport">전체 기록 내보내기</button><button class="sm" id="aImportBtn">앱 기록 복원…</button><input type="file" id="aImport" accept="application/json,.json" hidden/></div>
          <div class="divider"></div><button class="sm danger" id="aReset">전체 기록 초기화</button>
          <div class="tiny" style="margin-top:6px">저장 위치: 이 브라우저의 localStorage(기록) + IndexedDB(데이터셋·백업). 공용 PC에서는 내보낸 뒤 초기화해.</div></div>
        <div class="panel"><h3>정보</h3><div class="tiny">TFT Tournament Lab v${TL.APP_VERSION} · 데이터 ${TL.esc(p.dataVersion)} · 정적 HTML/CSS/JS · 서버·로그인·API 키 없음 · 외부 라이브러리 없음<br>비공식 팬 제작 도구이며 Riot Games와 무관합니다.</div></div>
      </div>
    </div>`;
    bind(); renderBackups();
  }
  async function renderBackups() {
    const host = TL.$('#bkList'); if (!host) return;
    let list = []; try { list = await TL.idb.backups(); } catch (e) { host.textContent = '백업 목록을 불러오지 못했어: ' + e.message; return; }
    host.innerHTML = list.length ? `<table class="table"><thead><tr><th>시각</th><th>종류</th><th>메모</th><th></th></tr></thead><tbody>${list.map(b => `<tr><td>${TL.fmtDate(b.created)}</td><td>${b.kind === 'dataset' ? '데이터셋' : '앱 기록'}</td><td>${TL.esc(b.note || '')} ${b.version ? '· ' + TL.esc(b.version) : ''}</td><td><button class="xs" data-bkr="${b.id}">복원</button><button class="xs" data-bkd="${b.id}">내려받기</button><button class="xs danger" data-bkx="${b.id}">✕</button></td></tr>`).join('')}</tbody></table>` : '<div class="tiny">백업 없음 (데이터 가져오기 전/일일 자동 백업이 여기에 쌓여)</div>';
    const get = id => list.find(b => b.id === id);
    TL.$$('[data-bkr]', host).forEach(x => x.onclick = () => { const b = get(x.dataset.bkr); TL.confirm('백업 복원', `${TL.fmtDate(b.created)} ${b.kind === 'dataset' ? '데이터셋' : '앱 기록'} 백업으로 복원할까? (현재 상태는 먼저 백업돼)`, async () => { if (b.kind === 'dataset') { await doApply(b.data, '백업 복원 ' + TL.fmtDate(b.created)); } else { await TL.idb.addBackup({ id: TL.uid('bk'), kind: 'state', created: new Date().toISOString(), note: '복원 전 자동 백업', data: TL.clone(TL.state) }); TL.replaceState(b.data); TL.refreshHeader(); render(); TL.toast('앱 기록 복원 완료', 'ok'); } }); });
    TL.$$('[data-bkd]', host).forEach(x => x.onclick = () => { const b = get(x.dataset.bkd); TL.download(`tft-lab-backup-${b.kind}-${b.created.slice(0, 10)}.json`, b.data); });
    TL.$$('[data-bkx]', host).forEach(x => x.onclick = async () => { await TL.idb.delBackup(x.dataset.bkx); renderBackups(); });
  }
  function bind() {
    const s = TL.state.settings;
    TL.$('#dValidate').onclick = () => { const v = TL.data.validate(TL.data.bundle()); TL.modal('데이터 검증 결과', `<div class="notice ${v.errors.length ? 'red' : 'green'} tiny">오류 ${v.errors.length} · 경고 ${v.warnings.length}</div>${v.errors.length ? '<h4>오류</h4><div class="tiny">' + v.errors.map(TL.esc).join('<br>') + '</div>' : ''}${v.warnings.length ? '<h4>경고</h4><div class="tiny">' + v.warnings.map(TL.esc).join('<br>') + '</div>' : ''}<h4>상태 분포</h4><div class="tiny">${['champions', 'traits', 'items', 'augments'].map(f => { const c = {}; (TL.data.bundle()[f][f] || []).forEach(x => c[x.status || '?'] = (c[x.status || '?'] || 0) + 1); return `${f}: ${Object.entries(c).map(([k, n]) => k + ' ' + n).join(', ')}`; }).join('<br>')}</div>`); };
    TL.$('#dRepair').onclick = () => { const r = TL.data.repair(TL.data.bundle()); if (!r.log.length) return TL.toast('복구할 문제가 없어.', 'ok'); TL.confirm('자동 복구', '<div class="tiny">' + r.log.map(TL.esc).join('<br>') + '</div>', () => doApply(r.fixed, '자동 복구', r.log), '복구 적용'); };
    TL.$('#dReset').onclick = () => TL.confirm('내장 데이터로 되돌리기', '사용자 데이터셋을 지우고 내장 데이터(build 시점)로 되돌릴까? 현재 데이터셋은 백업돼.', async () => { await TL.data.resetToBuiltIn(); TL.refreshHeader(); render(); TL.toast('내장 데이터로 복원', 'ok'); });
    TL.$('#dImportBtn').onclick = () => TL.$('#dImport').click();
    TL.$('#dImport').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) handleFiles(fs); };
    TL.$('#dExportAll').onclick = () => TL.download(`tft19-data-bundle-${TL.data.patch().dataVersion}.json`, TL.data.bundle());
    TL.$$('[data-exp]').forEach(b => b.onclick = () => TL.download(b.dataset.exp + '.json', b.dataset.exp === 'meta-comps' ? TL.data.meta() : TL.data.bundle()[b.dataset.exp]));
    TL.$('#bkNow').onclick = async () => { await TL.idb.addBackup({ id: TL.uid('bk'), kind: 'state', created: new Date().toISOString(), note: '수동 백업', data: TL.clone(TL.state) }); await TL.idb.pruneBackups('state', 10); renderBackups(); TL.toast('백업 완료', 'ok'); };
    TL.$('#stSave').onclick = () => { s.playerName = TL.$('#stName').value.trim() || '나'; s.eventName = TL.$('#stEvent').value.trim(); s.eventDate = TL.$('#stDate').value || s.eventDate; s.defaultPatch = TL.$('#stPatch').value.trim() || '19.2'; s.showKo = TL.$('#stKo').checked; s.board3d = TL.$('#st3d').checked; TL.save(); TL.refreshHeader(); TL.toast('설정 저장', 'ok'); render(); };
    const savePresets = () => { s.scorePresets.forEach(pr => { pr.name = TL.$(`[data-pn="${pr.id}"]`)?.value || pr.name; pr.map = TL.$$(`[data-pv="${pr.id}"]`).sort((a, b) => a.dataset.pi - b.dataset.pi).map(i => Number(i.value)); }); const bad = s.scorePresets.find(pr => pr.map.length !== 8 || pr.map.some(x => !Number.isFinite(x))); if (bad) { TL.toast('점수는 1~8위 모두 숫자로 입력해.', 'err'); return false; } const r = TL.$('input[name="preset"]:checked'); if (r) s.activePreset = r.value; TL.save(); return true; };
    TL.$('#pSave').onclick = () => { if (savePresets()) { TL.toast('점수표 저장 (기록 점수 자동 재계산)', 'ok'); render(); } };
    TL.$('#pAdd').onclick = () => { savePresets(); s.scorePresets.push({ id: TL.uid('p'), name: '새 점수표', map: [8, 7, 6, 5, 4, 3, 2, 1] }); TL.save(); render(); };
    TL.$$('[data-pdel]').forEach(b => b.onclick = () => { s.scorePresets = s.scorePresets.filter(p => p.id !== b.dataset.pdel); if (!s.scorePresets.some(p => p.id === s.activePreset)) s.activePreset = 'std'; TL.save(); render(); });
    TL.$('#aExport').onclick = () => TL.download(`tft-tournament-lab-backup-${TL.today()}.json`, { ...TL.state, exportedAt: new Date().toISOString(), appVersion: TL.APP_VERSION, dataVersion: TL.data.patch().dataVersion });
    TL.$('#aImportBtn').onclick = () => TL.$('#aImport').click();
    TL.$('#aImport').onchange = async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      let o; try { o = JSON.parse(await TL.readFile(f)); } catch (err) { return TL.toast('JSON 파싱 실패', 'err'); }
      const errs = TL.validateState(o); if (errs.length) return TL.modal('복원 불가', '<div class="tiny">' + errs.map(TL.esc).join('<br>') + '</div>');
      const st = o.version === 2 ? o : TL.migrateLegacy(o);
      TL.confirm('앱 기록 복원', `${TL.esc(f.name)}로 현재 기록을 교체할까? (조합 ${st.comps?.length || 0} · 경기 ${st.records?.games?.length || 0}) 현재 기록은 먼저 IndexedDB에 백업돼.`, async () => { await TL.idb.addBackup({ id: TL.uid('bk'), kind: 'state', created: new Date().toISOString(), note: '복원 전 자동 백업', data: TL.clone(TL.state) }); delete st.exportedAt; delete st.appVersion; delete st.dataVersion; TL.replaceState(st); TL.refreshHeader(); render(); TL.toast('복원 완료', 'ok'); });
    };
    TL.$('#aReset').onclick = () => TL.confirm('전체 기록 초기화', '모든 조합·시뮬레이션·기록·설정을 지울까? (먼저 IndexedDB에 백업돼. 데이터셋은 유지)', async () => { await TL.idb.addBackup({ id: TL.uid('bk'), kind: 'state', created: new Date().toISOString(), note: '초기화 전 자동 백업', data: TL.clone(TL.state) }); TL.replaceState(TL.defaultState()); try { localStorage.removeItem('tftLab19'); } catch (e) { /* ignore */ } TL.refreshHeader(); render(); TL.toast('초기화 완료', 'ok'); }, '초기화', 'danger');
  }
  V.render = render; V.handleFiles = handleFiles; V.previewApply = previewApply;
  TL.views.settings = V;
})(window.TL);
