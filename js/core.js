/* TFT Tournament Lab — core: utilities, persistence (localStorage + IndexedDB), data manager, game engine helpers.
   Plain scripts (no modules) so index.html runs from file:// and GitHub Pages alike. */
'use strict';
window.TL = window.TL || {};
(function (TL) {
  const APP_VERSION = '2.3.0';
  TL.APP_VERSION = APP_VERSION;
  TL.THIEF = 'thiefs-gloves';
  TL.views = TL.views || {};

  /* ---------------- utils ---------------- */
  TL.$ = (s, r = document) => r.querySelector(s);
  TL.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  TL.esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TL.uid = (p = 'id') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  TL.clone = x => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  TL.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  TL.today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  TL.fmtDate = iso => { try { return new Date(iso).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } };
  TL.rand = (n) => Math.floor(Math.random() * n);
  TL.pick = arr => arr[TL.rand(arr.length)];
  TL.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = TL.rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  TL.sum = arr => arr.reduce((s, x) => s + (Number(x) || 0), 0);
  TL.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  TL.download = (name, obj, type = 'application/json') => {
    const blob = obj instanceof Blob ? obj : new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)], { type });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  TL.readFile = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
  TL.statusPill = st => `<span class="pill st st-${TL.esc(st)}" title="${TL.esc((TL.data && TL.data.statusLegend()[st]) || st)}">${TL.esc(st)}</span>`;

  /* ---------------- game art (bundled assets; graceful text fallback) ---------------- */
  const ASSET_SETS = {};
  const assetHas = (kind, id) => { const A = window.TFT_ASSETS || {}; if (!ASSET_SETS[kind]) ASSET_SETS[kind] = new Set(A[kind] || []); return ASSET_SETS[kind].has(id); };
  TL.img = {
    champ(id) { return assetHas('champions', id) ? `assets/champions/${id}.webp` : null; },
    traitByName(name) { const t = TL.data.trait(name); return t && assetHas('traits', t.id) ? `assets/traits/${t.id}.svg` : null; },
    item(id) {
      const it = TL.data.item(id); if (!it) return null;
      if (it.type === 'emblem' && it.grantsTrait) return TL.img.traitByName(it.grantsTrait);
      return assetHas('items', id) ? `assets/items/${id}.webp` : null;
    },
  };
  TL.ui = {
    // champion portrait: <img> with cost frame; falls back to initials when no art
    champ(c, cls = '') {
      if (!c) return `<span class="cp ${cls}">?</span>`;
      const src = TL.img.champ(c.id);
      return src ? `<img class="cp cost-${c.cost} ${cls}" src="${src}" alt="${TL.esc(c.name)}" loading="lazy" draggable="false">` : `<span class="cp cpf cost-${c.cost} ${cls}">${TL.esc((TL.data.name(c) || '?').slice(0, 2))}</span>`;
    },
    item(id, cls = '') {
      const it = TL.data.item(id); const src = TL.img.item(id); const tip = it ? (it.nameKo || it.name) : id;
      if (!src) return `<span class="ii iif ${cls} ${it?.type || ''}" title="${TL.esc(tip)}">${TL.esc((tip || '?').slice(0, 2))}</span>`;
      return `<img class="ii ${cls} ${it?.type || ''}" src="${src}" alt="${TL.esc(tip)}" title="${TL.esc(tip)}" loading="lazy" draggable="false">`;
    },
    trait(name, style = 'none', cls = '') {
      const src = TL.img.traitByName(name);
      return `<span class="ti t-${style} ${cls}" title="${TL.esc(name)}">${src ? `<img src="${src}" alt="" draggable="false">` : `<b>${TL.esc(name.slice(0, 2))}</b>`}</span>`;
    },
    stars(n) { return `<span class="stars s${n}">${'★'.repeat(n || 1)}</span>`; },
    coin(n) { return `<span class="coin"><i></i>${n}</span>`; },
  };

  /* ---------------- toast & modal ---------------- */
  TL.toast = (msg, kind = '') => {
    const host = TL.$('#toasts'); if (!host) return;
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg; host.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  };
  TL.modal = (title, html, opts = {}) => {
    TL.$('#modalTitle').textContent = title; TL.$('#modalBody').innerHTML = html;
    const back = TL.$('#modal'); back.classList.add('show');
    const foot = TL.$('#modalFoot'); foot.innerHTML = '';
    (opts.buttons || []).forEach(b => {
      const btn = document.createElement('button'); btn.textContent = b.label; if (b.cls) btn.className = b.cls;
      btn.onclick = () => { const keep = b.onClick && b.onClick() === false; if (!keep) TL.closeModal(); };
      foot.appendChild(btn);
    });
    if (opts.onOpen) opts.onOpen(TL.$('#modalBody'));
  };
  TL.closeModal = () => TL.$('#modal').classList.remove('show');
  TL.confirm = (title, html, onYes, yesLabel = '확인', cls = 'primary') =>
    TL.modal(title, html, { buttons: [{ label: '취소' }, { label: yesLabel, cls, onClick: onYes }] });

  /* ---------------- IndexedDB (with graceful fallback) ---------------- */
  const IDB_NAME = 'tftLab19', IDB_VER = 1;
  let dbp = null;
  TL.idb = {
    available: typeof indexedDB !== 'undefined',
    open() {
      if (dbp) return dbp;
      dbp = new Promise((res) => {
        if (!this.available) return res(null);
        try {
          const rq = indexedDB.open(IDB_NAME, IDB_VER);
          rq.onupgradeneeded = () => {
            const db = rq.result;
            if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
            if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'id' });
          };
          rq.onsuccess = () => res(rq.result);
          rq.onerror = () => { this.available = false; res(null); };
          rq.onblocked = () => res(null);
        } catch (e) { this.available = false; res(null); }
      });
      return dbp;
    },
    async tx(store, mode, fn) {
      const db = await this.open();
      if (!db) return this._fallback(store, mode, fn);
      return new Promise((res, rej) => {
        try {
          const t = db.transaction(store, mode); const s = t.objectStore(store); const r = fn(s);
          t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
          t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
        } catch (e) { rej(e); }
      });
    },
    // localStorage fallback (private mode / blocked IDB)
    _fallback(store, mode, fn) {
      const key = 'tftLab19.idbfb.' + store; let map = {};
      try { map = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { map = {}; }
      const s = {
        get: k => ({ result: map[k] }), put: (v, k) => { map[k ?? v.id] = v; return {}; }, delete: k => { delete map[k]; return {}; },
        getAll: () => ({ result: Object.values(map) }), clear: () => { map = {}; return {}; }
      };
      const r = fn(s);
      if (mode === 'readwrite') { try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) { TL.toast('저장 공간 부족: 백업을 저장하지 못했어.', 'err'); } }
      return Promise.resolve(r && 'result' in r ? r.result : undefined);
    },
    get(k) { return this.tx('kv', 'readonly', s => s.get(k)); },
    set(k, v) { return this.tx('kv', 'readwrite', s => s.put(v, k)); },
    del(k) { return this.tx('kv', 'readwrite', s => s.delete(k)); },
    backups() { return this.tx('backups', 'readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => (y.created || '').localeCompare(x.created || ''))); },
    addBackup(b) { return this.tx('backups', 'readwrite', s => s.put(b)); },
    delBackup(id) { return this.tx('backups', 'readwrite', s => s.delete(id)); },
    async pruneBackups(kind, keep) {
      const all = (await this.backups()).filter(b => b.kind === kind);
      for (const b of all.slice(keep)) await this.delBackup(b.id);
    },
  };

  /* ---------------- app state (localStorage) ---------------- */
  const KEY = 'tftLab19.v2', LEGACY_KEY = 'tftLab19';
  TL.defaultState = () => ({
    version: 2,
    settings: { board3d: true, eventDate: '2026-12-20', eventName: 'TFT 대회 (Set 19)', playerName: '나', showKo: true, scorePresets: [{ id: 'std', name: '기본 8-1', map: [8, 7, 6, 5, 4, 3, 2, 1] }], activePreset: 'std', defaultPatch: '19.2', lastAutoBackup: null },
    checklist: [
      { t: 'Set 19 핵심 조합 2개 이상 연구 (팀 빌더에 저장)', d: false },
      { t: '각 조합의 대체 캐리/전환 경로 정리', d: false },
      { t: '운영 시뮬레이터 10게임 이상 완주', d: false },
      { t: '정찰 후 배치 변경 훈련 (암살자/광역 대응)', d: false },
      { t: '판단력 훈련 전 문항 1회 이상 + 이유 기록', d: false },
      { t: '스크림 10게임 이상 기록 및 복기', d: false },
      { t: '19.1 / 19.2 패치 노트로 데이터 재검증', d: false },
    ],
    builder: { board: [], bench: Array(9).fill(null), level: 8, selected: null, unlocked: {}, collab: [], snapshot: null, compare: [], filters: { q: '', cost: 'all', trait: 'all', unlock: 'all' } },
    comps: [],
    sim: null,
    simHistory: [],
    augLab: { notes: {}, history: [], offer: [], picked: null, ctx: { stage: '2-1', hp: 100, gold: 10, level: 4, streak: 0, plan: 'flex', tier: 'Silver' }, compare: [] },
    scout: { opponents: [], activeId: null, myBoard: [], layouts: [], scenario: 'assassin', mode: 'enemy' },
    drill: { answers: {}, idx: 0, gen: null, genHistory: [] },
    records: { games: [] },
    importLog: [],
  });
  function deepMerge(base, over) {
    if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
    const out = { ...base };
    for (const k of Object.keys(over || {})) out[k] = (k in base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) ? deepMerge(base[k], over[k]) : over[k];
    return out;
  }
  TL.migrateLegacy = (old) => {
    // v0.1.0 state → v2 (keeps comps, scrims, augment history, scout, checklist, settings)
    const s = TL.defaultState();
    const nameToId = n => { const c = TL.data.champByName(n) || TL.data.champs().find(x => x.id === n); return c ? c.id : null; };
    const legacyChamp = id => { // old ids were c0..c93 in CHAMPS order — map through legacy dataset order
      const L = TL.data.legacyOrder(); const m = /^c(\d+)$/.exec(id || ''); return m && L[+m[1]] ? nameToId(L[+m[1]]) : nameToId(id);
    };
    const conv = u => { const cid = legacyChamp(u.champId); return cid ? { id: u.id || TL.uid('u'), champ: cid, star: u.star || 1, items: (u.items || []).filter(Boolean).map(n => TL.data.itemByName(n)?.id).filter(Boolean), pos: u.pos } : null; };
    (old.comps || []).forEach(c => s.comps.push({ id: String(c.id || TL.uid('c')), name: c.name || '이전 조합', board: (c.board || []).map(conv).filter(Boolean), bench: Array(9).fill(null), level: c.cap || 8, notes: { pros: '', cons: '', memo: '' }, carry: [], tank: [], keyItems: '', created: c.created || new Date().toISOString(), updated: new Date().toISOString(), migrated: true }));
    s.builder.board = (old.board || []).map(conv).filter(Boolean);
    s.builder.level = TL.clamp(Number(old.boardCap) || 8, 1, 11);
    (old.scrims || []).forEach(x => s.records.games.push({ id: TL.uid('g'), date: x.date, event: '스크림', gameNo: '', patch: x.patch || '19.2', lobby: [{ name: s.settings.playerName, place: x.place, me: true }], myPlace: x.place, comp: '', augments: [], items: '', note: [x.lobby, x.note].filter(Boolean).join(' · '), migrated: true }));
    (old.augmentHistory || []).forEach(h => s.augLab.history.push({ id: TL.uid('a'), date: h.date, offers: [], picked: h.name, pickedTier: h.tier, reason: h.reason || '', ctx: { stage: h.stage }, migrated: true }));
    if (old.enemy && (old.enemy.board || []).length) s.scout.opponents.push({ id: TL.uid('o'), name: old.enemy.name || '이전 정찰', comp: '', notes: old.counterNote || '', board: old.enemy.board.map(conv).filter(Boolean) });
    if (Array.isArray(old.checklist)) old.checklist.forEach((v, i) => { if (s.checklist[i]) s.checklist[i].d = !!v; });
    if (old.eventDate) s.settings.eventDate = old.eventDate;
    if (Array.isArray(old.scoreMap) && old.scoreMap.length === 8) s.settings.scorePresets[0].map = old.scoreMap.map(Number);
    s.migratedFrom = '0.1.0';
    return s;
  };
  TL.loadState = () => {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (raw) { try { return deepMerge(TL.defaultState(), JSON.parse(raw)); } catch (e) { console.warn('state parse failed', e); TL._stateCorrupt = raw; } }
    try { const old = localStorage.getItem(LEGACY_KEY); if (old) { const st = TL.migrateLegacy(JSON.parse(old)); TL._migrated = true; return st; } } catch (e) { console.warn('legacy migrate failed', e); }
    return TL.defaultState();
  };
  TL.saveNow = () => {
    try { localStorage.setItem(KEY, JSON.stringify(TL.state)); TL._saveFail = false; }
    catch (e) { if (!TL._saveFail) TL.toast('브라우저 저장 실패(용량/권한). Data & Settings에서 JSON 백업을 내보내 줘.', 'err'); TL._saveFail = true; }
  };
  TL.save = TL.debounce(TL.saveNow, 120);
  window.addEventListener('beforeunload', () => TL.saveNow());
  TL.replaceState = (st) => { TL.state = deepMerge(TL.defaultState(), st); TL.saveNow(); };
  TL.validateState = (obj) => {
    const errs = [];
    if (!obj || typeof obj !== 'object') return ['JSON 객체가 아님'];
    if (obj.version !== 2 && !obj.scrims && !obj.comps) errs.push('TFT Tournament Lab 백업 형식(version 2 또는 v0.1.0)이 아님');
    if (obj.comps && !Array.isArray(obj.comps)) errs.push('comps가 배열이 아님');
    if (obj.records && obj.records.games && !Array.isArray(obj.records.games)) errs.push('records.games가 배열이 아님');
    return errs;
  };

  /* ---------------- data manager ---------------- */
  const FILES = ['patch-info', 'champions', 'traits', 'items', 'augments', 'shop-odds', 'game-rules'];
  TL.DATA_FILES = FILES;
  const D = { bundle: null, base: null, idx: null, overridden: false };
  TL.data = {
    FILES,
    async init() {
      D.base = window.TFT_DATA_BUNDLE;
      if (!D.base) throw new Error('data/bundle.js를 불러오지 못했어.');
      let ov = null;
      try { ov = await TL.idb.get('dataset'); } catch (e) { console.warn(e); }
      if (ov) {
        const v = TL.data.validate(ov);
        if (v.errors.length) { console.warn('override invalid; using built-in', v.errors); TL._overrideInvalid = v.errors; D.bundle = TL.clone(D.base); }
        else { D.bundle = ov; D.overridden = true; }
      } else D.bundle = TL.clone(D.base);
      this.reindex();
    },
    reindex() {
      const b = D.bundle; const idx = { champ: {}, champName: {}, trait: {}, item: {}, itemName: {}, aug: {}, recipe: {} };
      b.champions.champions.forEach(c => { idx.champ[c.id] = c; idx.champName[c.name.toLowerCase()] = c; });
      b.traits.traits.forEach(t => { idx.trait[t.name] = t; });
      b.items.items.forEach(i => { idx.item[i.id] = i; idx.itemName[i.name.toLowerCase()] = i; if (i.nameKo) idx.itemName[i.nameKo] = i; if (i.recipe && i.recipe.length === 2) idx.recipe[[...i.recipe].sort().join('+')] = i; });
      b.augments.augments.forEach(a => { idx.aug[a.id] = a; });
      D.idx = idx;
    },
    bundle: () => D.bundle, base: () => D.base, isOverridden: () => D.overridden,
    meta: () => (D.bundle && D.bundle['meta-comps']) || (D.base && D.base['meta-comps']) || null,
    encounters: () => ((D.bundle && D.bundle.encounters) || (D.base && D.base.encounters) || { encounters: [] }).encounters,
    encountersMeta: () => ((D.bundle && D.bundle.encounters) || (D.base && D.base.encounters) || {}).meta || null,
    patch: () => D.bundle['patch-info'],
    statusLegend: () => (D.bundle ? D.bundle['patch-info'].statusLegend : {}) || {},
    champs: () => D.bundle.champions.champions,
    champ: id => D.idx.champ[id],
    champByName: n => D.idx.champName[String(n || '').toLowerCase()],
    traits: () => D.bundle.traits.traits,
    trait: n => D.idx.trait[n],
    items: () => D.bundle.items.items,
    item: id => D.idx.item[id],
    itemByName: n => D.idx.itemName[String(n || '').toLowerCase()] || D.idx.itemName[n],
    combine: (a, b) => D.idx.recipe[[a, b].sort().join('+')] || null,
    augs: () => D.bundle.augments.augments,
    aug: id => D.idx.aug[id],
    odds: () => D.bundle['shop-odds'],
    rules: () => D.bundle['game-rules'],
    legacyOrder: () => (window.TL_LEGACY_ORDER || []),
    name(c) { if (!c) return '?'; return (TL.state && TL.state.settings.showKo && c.nameKo) ? c.nameKo : c.name; },
    costs() { return [...new Set(this.champs().map(c => c.cost))].sort((a, b) => a - b); },
    async apply(bundle, label, kind = 'import') {
      const v = this.validate(bundle); if (v.errors.length) throw new Error(v.errors.join('\n'));
      await TL.data.backupCurrent('auto: before ' + label);
      const diff = this.diff(D.bundle, bundle);
      await TL.idb.set('dataset', bundle);
      D.bundle = bundle; D.overridden = true; this.reindex();
      TL.state.importLog.unshift({ id: TL.uid('i'), date: new Date().toISOString(), label, kind, version: bundle['patch-info']?.dataVersion, patch: bundle['patch-info']?.currentDataPatch, diff, warnings: v.warnings.slice(0, 30) });
      TL.state.importLog = TL.state.importLog.slice(0, 50); TL.save();
      return { diff, warnings: v.warnings };
    },
    async resetToBuiltIn() {
      await TL.data.backupCurrent('auto: before reset to built-in');
      await TL.idb.del('dataset'); D.bundle = TL.clone(D.base); D.overridden = false; this.reindex();
    },
    async backupCurrent(note) {
      try {
        await TL.idb.addBackup({ id: TL.uid('bk'), kind: 'dataset', created: new Date().toISOString(), note, version: D.bundle['patch-info']?.dataVersion, data: D.bundle });
        await TL.idb.pruneBackups('dataset', 8);
      } catch (e) { console.warn('backup failed', e); }
    },
    /* ---- validation (returns errors that block, warnings that inform) ---- */
    validate(b) {
      const errors = [], warnings = [];
      if (!b || typeof b !== 'object') return { errors: ['데이터가 객체가 아님'], warnings };
      for (const f of FILES) if (!b[f]) errors.push(`${f} 누락`);
      if (errors.length) return { errors, warnings };
      const ch = b.champions.champions, tr = b.traits.traits, it = b.items.items, au = b.augments.augments;
      if (!Array.isArray(ch) || !ch.length) errors.push('champions.champions 배열이 비어 있음');
      if (!Array.isArray(tr) || !tr.length) errors.push('traits.traits 배열이 비어 있음');
      if (!Array.isArray(it)) errors.push('items.items 배열 아님');
      if (!Array.isArray(au)) errors.push('augments.augments 배열 아님');
      if (errors.length) return { errors, warnings };
      const tn = new Set(), ids = new Set();
      tr.forEach((t, i) => {
        if (!t.name) errors.push(`traits[${i}] name 없음`); if (tn.has(t.name)) warnings.push(`중복 특성: ${t.name}`); tn.add(t.name);
        if (!Array.isArray(t.tiers) || !t.tiers.length) errors.push(`특성 ${t.name}: tiers 없음`);
        else { let prev = 0; t.tiers.forEach(x => { if (!Number.isFinite(x.min) || x.min < 1) errors.push(`특성 ${t.name}: 잘못된 단계 ${x.min}`); if (x.min < prev) warnings.push(`특성 ${t.name}: 단계 오름차순 아님`); prev = x.min; }); }
      });
      ch.forEach((c, i) => {
        if (!c.id || !c.name) errors.push(`champions[${i}] id/name 없음`);
        if (ids.has(c.id)) errors.push(`중복 챔피언 id: ${c.id}`); ids.add(c.id);
        if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(Number(c.cost))) errors.push(`${c.name}: 코스트 ${c.cost} 비정상`);
        if (!Array.isArray(c.traits)) errors.push(`${c.name}: traits 배열 아님`);
        else c.traits.forEach(t => { if (!tn.has(t)) errors.push(`${c.name}: 존재하지 않는 특성 "${t}"`); });
        if (!c.status) warnings.push(`${c.name}: 검증 상태(status) 없음`);
      });
      const itIds = new Set(it.map(i => i.id));
      it.forEach(i => { if (!i.id || !i.name) errors.push('아이템 id/name 없음'); (i.recipe || []).forEach(r => { if (!itIds.has(r)) errors.push(`${i.name}: 재료 ${r} 없음`); }); if (i.grantsTrait && !tn.has(i.grantsTrait)) warnings.push(`${i.name}: 특성 ${i.grantsTrait} 없음`); });
      au.forEach(a => { if (!a.id || !a.name) errors.push('증강 id/name 없음'); if (!['Silver', 'Gold', 'Prismatic'].includes(a.tier)) warnings.push(`증강 ${a.name}: 등급 ${a.tier}`); });
      const od = b['shop-odds'].odds || {};
      Object.entries(od).forEach(([lv, row]) => { const s = TL.sum(row); if (!Array.isArray(row) || Math.abs(s - 100) > 0.6) errors.push(`상점 확률 레벨 ${lv}: 합계 ${s} ≠ 100`); });
      if (!Object.keys(od).length) errors.push('상점 확률(odds) 없음');
      const ru = b['game-rules'];
      if (!ru.xpToNext) errors.push('game-rules.xpToNext 없음');
      if (!ru.stageDamage) warnings.push('game-rules.stageDamage 없음');
      for (const f of FILES.slice(1)) { const m = b[f].meta; if (!m) warnings.push(`${f}: meta 없음`); else ['patch', 'source', 'updated', 'status'].forEach(k => { if (m[k] === undefined) warnings.push(`${f}.meta.${k} 없음`); }); }
      return { errors, warnings };
    },
    /* ---- repair: drop/patch invalid records so the app can still run ---- */
    repair(b) {
      const fixed = TL.clone(b); const log = [];
      const base = D.base;
      for (const f of FILES) if (!fixed[f]) { fixed[f] = TL.clone(base[f]); log.push(`${f}: 누락 → 내장 데이터로 복구`); }
      ['champions', 'traits', 'items', 'augments'].forEach(f => { const k = f; if (!Array.isArray(fixed[f][k])) { fixed[f][k] = TL.clone(base[f][k]); log.push(`${f}.${k}: 배열 아님 → 내장 데이터로 복구`); } });
      const tnames = new Set(fixed.traits.traits.filter(t => t && t.name && Array.isArray(t.tiers) && t.tiers.length).map(t => t.name));
      const bt = fixed.traits.traits.length; fixed.traits.traits = fixed.traits.traits.filter(t => t && t.name && Array.isArray(t.tiers) && t.tiers.length);
      if (bt !== fixed.traits.traits.length) log.push(`잘못된 특성 ${bt - fixed.traits.traits.length}개 제거`);
      fixed.traits.traits.forEach(t => { t.tiers = t.tiers.filter(x => Number.isFinite(+x.min) && +x.min >= 1).map(x => ({ ...x, min: +x.min })).sort((a, b) => a.min - b.min); });
      const seen = new Set();
      fixed.champions.champions = fixed.champions.champions.filter(c => {
        if (!c || !c.name) { log.push('이름 없는 챔피언 제거'); return false; }
        c.id = c.id || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); if (seen.has(c.id)) { log.push(`중복 챔피언 제거: ${c.name}`); return false; } seen.add(c.id);
        c.cost = Number(c.cost); if (!(c.cost >= 1 && c.cost <= 10)) { log.push(`코스트 비정상 챔피언 제거: ${c.name}`); return false; }
        const before = (c.traits || []).length; c.traits = (c.traits || []).filter(t => { if (tnames.has(t)) return true; return false; });
        if (c.traits.length !== before) log.push(`${c.name}: 없는 특성 참조 제거`);
        c.status = c.status || 'unverified'; return true;
      });
      const ids = new Set(fixed.items.items.map(i => i.id));
      fixed.items.items = fixed.items.items.filter(i => i && i.id && i.name).map(i => { if (i.recipe && i.recipe.some(r => !ids.has(r))) { log.push(`${i.name}: 잘못된 조합법 제거`); i.recipe = null; } return i; });
      const od = fixed['shop-odds'].odds || {};
      Object.keys(od).forEach(lv => { const row = (od[lv] || []).map(Number); const s = TL.sum(row); if (s > 0 && Math.abs(s - 100) > 0.6) { od[lv] = row.map(x => Math.round(x / s * 1000) / 10); log.push(`상점 확률 레벨 ${lv}: 합계 ${s} → 100으로 정규화`); } });
      if (!Object.keys(od).length) { fixed['shop-odds'] = TL.clone(base['shop-odds']); log.push('상점 확률 없음 → 내장 데이터로 복구'); }
      if (!fixed['game-rules'].xpToNext) { fixed['game-rules'] = TL.clone(base['game-rules']); log.push('게임 규칙 → 내장 데이터로 복구'); }
      for (const f of FILES.slice(1)) { fixed[f].meta = Object.assign({ set: 19, patch: '?', source: '?', updated: '?', status: 'unverified' }, fixed[f].meta || {}); }
      return { fixed, log };
    },
    diff(a, b) {
      const out = { champions: { added: [], removed: [], changed: [] }, traits: { added: [], removed: [], changed: [] }, items: { added: [], removed: [] }, augments: { added: [], removed: [] }, odds: [], rules: [] };
      const m = (arr, k = 'id') => Object.fromEntries((arr || []).map(x => [x[k], x]));
      const ca = m(a.champions.champions), cb = m(b.champions.champions);
      Object.keys(cb).forEach(id => { if (!ca[id]) out.champions.added.push(cb[id].name); else { const x = ca[id], y = cb[id]; const ch = []; if (x.cost !== y.cost) ch.push(`코스트 ${x.cost}→${y.cost}`); if ((x.traits || []).join() !== (y.traits || []).join()) ch.push(`특성 ${x.traits.join('/')}→${y.traits.join('/')}`); if (!!x.unlock !== !!y.unlock) ch.push(`해금 ${x.unlock}→${y.unlock}`); if (x.status !== y.status) ch.push(`상태 ${x.status}→${y.status}`); if (ch.length) out.champions.changed.push(`${y.name}: ${ch.join(', ')}`); } });
      Object.keys(ca).forEach(id => { if (!cb[id]) out.champions.removed.push(ca[id].name); });
      const ta = m(a.traits.traits, 'name'), tb = m(b.traits.traits, 'name');
      Object.keys(tb).forEach(n => { if (!ta[n]) out.traits.added.push(n); else { const x = ta[n].tiers.map(t => t.min).join('/'), y = tb[n].tiers.map(t => t.min).join('/'); if (x !== y) out.traits.changed.push(`${n}: ${x} → ${y}`); } });
      Object.keys(ta).forEach(n => { if (!tb[n]) out.traits.removed.push(n); });
      const ia = m(a.items.items), ib = m(b.items.items);
      Object.keys(ib).forEach(id => { if (!ia[id]) out.items.added.push(ib[id].name); }); Object.keys(ia).forEach(id => { if (!ib[id]) out.items.removed.push(ia[id].name); });
      const aa = m(a.augments.augments), ab = m(b.augments.augments);
      Object.keys(ab).forEach(id => { if (!aa[id]) out.augments.added.push(ab[id].name); }); Object.keys(aa).forEach(id => { if (!ab[id]) out.augments.removed.push(aa[id].name); });
      const oa = a['shop-odds'].odds, ob = b['shop-odds'].odds;
      Object.keys({ ...oa, ...ob }).forEach(lv => { if ((oa[lv] || []).join() !== (ob[lv] || []).join()) out.odds.push(`Lv${lv}: ${(oa[lv] || []).join('/')} → ${(ob[lv] || []).join('/')}`); });
      const ra = a['game-rules'], rb = b['game-rules'];
      ['xpToNext', 'stageDamage', 'passiveIncome', 'streakGold', 'interest'].forEach(k => { if (JSON.stringify(ra[k]) !== JSON.stringify(rb[k])) out.rules.push(k); });
      return out;
    },
    diffSummary(d) {
      const parts = [];
      const p = (label, x) => { const n = (x.added || []).length + (x.removed || []).length + (x.changed || []).length; if (n) parts.push(`${label} +${(x.added || []).length}/-${(x.removed || []).length}${x.changed ? '/Δ' + x.changed.length : ''}`); };
      p('챔피언', d.champions); p('특성', d.traits); p('아이템', d.items); p('증강', d.augments);
      if (d.odds.length) parts.push(`상점확률 Δ${d.odds.length}`); if (d.rules.length) parts.push(`규칙 Δ${d.rules.join(',')}`);
      return parts.join(' · ') || '변경 없음';
    },
  };

  /* ---------------- engine helpers shared by builder / sim / scout ---------------- */
  TL.engine = {
    cap(level, units) {
      let extra = 0; (units || []).forEach(u => (u.items || []).forEach(i => { if (TL.data.item(i)?.type === 'special') extra++; }));
      return Number(level) + extra;
    },
    // Trait computation: distinct champions; emblem-granted traits; Collab assignment; K/DA counts total star level.
    traits(units, opts = {}) {
      const per = {}; // trait -> Map(key -> value)
      const collab = new Set(opts.collab || []);
      units.forEach(u => {
        const c = TL.data.champ(u.champ); if (!c) return;
        const own = new Set(c.traits);
        if (collab.has(c.id) && !own.has('Collab')) own.add('Collab');
        const granted = (u.items || []).map(i => TL.data.item(i)).filter(i => i && i.grantsTrait && !own.has(i.grantsTrait)).map(i => i.grantsTrait);
        own.forEach(t => { (per[t] = per[t] || new Map()); const k = 'c:' + c.id; per[t].set(k, Math.max(per[t].get(k) || 0, u.star || 1)); });
        granted.forEach(t => { (per[t] = per[t] || new Map()); const k = 'c:' + c.id; per[t].set(k, Math.max(per[t].get(k) || 0, u.star || 1)); });
      });
      const out = [];
      Object.entries(per).forEach(([name, mp]) => {
        const t = TL.data.trait(name);
        const count = t && t.countMode === 'stars' ? TL.sum([...mp.values()]) : mp.size;
        const tiers = t ? t.tiers.map(x => x.min) : [];
        let ai = -1; tiers.forEach((m, i) => { if (count >= m) ai = i; });
        const next = tiers.find(m => m > count) ?? null;
        let style = 'none';
        if (ai >= 0) {
          if (t.type === 'unique') style = 'unique';
          else if (tiers.length === 1) style = 'gold';
          else if (ai === tiers.length - 1) style = tiers.length >= 4 ? 'prism' : 'gold';
          else if (ai === 0) style = 'bronze';
          else style = (ai >= tiers.length - 2 && tiers.length >= 4) ? 'gold' : 'silver';
        }
        out.push({ name, trait: t, count, tiers, active: ai, next, style, mode: t?.countMode || 'units' });
      });
      out.sort((a, b) => (b.active >= 0) - (a.active >= 0) || (b.active - a.active) || b.count - a.count || a.name.localeCompare(b.name));
      return out;
    },
    traitsHTML(list, compact = false) {
      if (!list.length) return '<div class="empty">보드에 챔피언을 배치하면 특성이 집계돼.</div>';
      // in-game style trait tracker: hex badge (tier colour) with trait icon, count, breakpoint chain
      return '<div class="traits">' + list.map(x => {
        const t = x.trait, ko = t?.nameKo && TL.state.settings.showKo ? ` <span class="tiny">${TL.esc(t.nameKo)}</span>` : '';
        const tip = t ? `${t.description}\n` + t.tiers.map(r => `(${r.min}) ${r.effect}`).join('\n') + (t.notes?.length ? '\n※ ' + t.notes.join('\n※ ') : '') : '데이터에 없는 특성';
        const eff = (() => { const r = t && (x.active >= 0 ? t.tiers[x.active] : t.tiers[0]); return r && r.effect ? `<div class="teff">${x.active >= 0 ? '' : '(' + r.min + ') '}${TL.esc(r.effect.length > 90 ? r.effect.slice(0, 90) + '…' : r.effect)}</div>` : ''; })();
        return `<div class="trait t-${x.style} ${x.active < 0 ? 'inactive' : ''}" title="${TL.esc(tip)}">${TL.ui.trait(x.name, x.style, 'badge')}<div class="tbody"><div class="tn"><span class="tcount">${x.count}</span>${TL.esc(x.name)}${ko}${x.mode === 'stars' ? '<span class="pill xs" title="총 별 레벨로 집계">★합</span>' : ''}${t?.type === 'unique' ? '<span class="tiny">고유</span>' : ''}</div>${compact ? '' : `<div class="bps">${x.tiers.map((m, i) => `<span class="${i <= x.active ? 'hit' : ''} ${m === x.next ? 'next' : ''}">${m}</span>`).join('<i>›</i>')}${x.next ? `<span class="tiny" style="background:none">+${x.next - x.count}</span>` : ''}</div>${eff}`}</div></div>`;
      }).join('') + '</div>';
    },
    sellValue(cost, star) {
      const copies = star === 3 ? 9 : star === 2 ? 3 : 1; const inv = cost * copies;
      if (star === 1 || cost === 1) return inv; return inv - 1;
    },
    copies: star => (star === 3 ? 9 : star === 2 ? 3 : 1),
    xpToNext(level) { const r = TL.data.rules().xpToNext; const v = r[String(level)]; return v == null ? null : Number(v); },
    oddsRow(level) { const o = TL.data.odds().odds; return (o[String(level)] || o['8'] || [100, 0, 0, 0, 0]).map(Number); },
    poolSize(cost) { const p = TL.data.odds().poolSize || {}; const v = p[String(cost)]; return v == null ? null : Number(v); },
    passiveIncome(stage, round) { const pi = TL.data.rules().passiveIncome; return Number(pi.byRound?.[`${stage}-${round}`] ?? pi.default ?? 5); },
    interest(gold) { const i = TL.data.rules().interest || { per: 10, max: 5 }; return Math.min(i.max, Math.floor(Math.max(0, gold) / i.per)); },
    streakGold(streak) { const n = Math.abs(streak); const row = (TL.data.rules().streakGold || []).find(r => n >= r.min && n <= r.max); return row ? row.gold : 0; },
    stageDamage(stage) { const d = TL.data.rules().stageDamage || {}; const keys = Object.keys(d).map(Number).sort((a, b) => a - b); let v = 0; keys.forEach(k => { if (stage >= k) v = d[k]; }); return Number(v); },
    roundType(stage, round) {
      const r = TL.data.rules().rounds; if (stage === 1) return r.stage1[round - 1] || 'pve';
      return r.stageN[round - 1] || 'pvp';
    },
    roundsInStage(stage) { const r = TL.data.rules().rounds; return stage === 1 ? r.stage1.length : r.stageN.length; },
    isAugmentRound(stage, round) { return (TL.data.rules().augmentRounds || []).includes(`${stage}-${round}`); },
    /* per-shop chance to see ≥1 copy of target; pool-aware (approx, with replacement within one shop) */
    shopHitChance(level, champId, poolLeft) {
      const c = TL.data.champ(champId); if (!c) return 0;
      const odds = this.oddsRow(level); const tierP = (odds[c.cost - 1] || 0) / 100; if (!tierP) return 0;
      const tierTotal = poolLeft.tierTotal(c.cost); const mine = poolLeft.get(champId); if (!tierTotal || !mine) return 0;
      const p = tierP * mine / tierTotal; return 1 - Math.pow(1 - p, 5);
    },
    /* Monte Carlo: probability of buying `need` copies within `gold` (2g per roll; buying costs gold too) */
    rolldown({ level, champId, need, gold, otherHeld = 0, ownedHeld = 0, sims = 2000, includeUnlock = false }) {
      const c = TL.data.champ(champId); if (!c) return null;
      const pool = this.poolSize(c.cost); if (!pool) return { error: '풀 크기 미확정(데이터 없음)' };
      const odds = this.oddsRow(level); const tierP = (odds[c.cost - 1] || 0) / 100;
      const same = TL.data.champs().filter(x => x.cost === c.cost && (includeUnlock || !x.unlock || x.id === champId));
      const others = (same.length - 1) * pool; // other champions of tier assumed untouched by default
      let hits = 0, goldUsedTotal = 0, rollsTotal = 0;
      for (let s = 0; s < sims; s++) {
        let left = Math.max(0, pool - otherHeld - ownedHeld), g = gold, got = 0, rolls = 0, otherLeft = others;
        while (got < need && g >= 2) {
          g -= 2; rolls++;
          for (let k = 0; k < 5 && got < need; k++) {
            if (Math.random() >= tierP) continue;
            const tot = left + otherLeft; if (!tot) continue;
            if (Math.random() < left / tot) { if (g >= c.cost) { g -= c.cost; got++; left--; } }
          }
        }
        if (got >= need) { hits++; goldUsedTotal += gold - g; rollsTotal += rolls; }
      }
      return { p: hits / sims, avgGold: hits ? goldUsedTotal / hits : null, avgRolls: hits ? rollsTotal / hits : null, sims, poolLeft: Math.max(0, pool - otherHeld - ownedHeld), tierP };
    },
  };

  /* ---------------- hex board component (shared) ---------------- */
  // units: [{id,champ,star,items,pos}], opts: {el, enemy, selected, onSelect, onMove, onDropChamp, onDropItem, onRemove, marks:{id:'carry'|'tank'}, highlight:{pos:'threat'|'warn'}, flip, mini}
  TL.board = {
    render(el, units, opts = {}) {
      const rows = 4, cols = 7; let html = '';
      const order = []; for (let r = 0; r < rows; r++) order.push(opts.flip ? rows - 1 - r : r);
      order.forEach(r => {
        const odd = r % 2 === 1; const lead = opts.flip ? !odd : odd; // 180° rotation mirrors the row stagger
        if (lead) html += '<span class="hexrow-spacer"></span>';
        for (let cc = 0; cc < cols; cc++) { const c = opts.flip ? cols - 1 - cc : cc;
          const pos = r * cols + c; const u = units.find(x => x.pos === pos); const ch = u && TL.data.champ(u.champ);
          const hl = opts.highlight?.[pos] || ''; const sel = u && opts.selected === u.id ? 'sel' : '';
          const mark = u && opts.marks?.[u.id];
          const items = u ? (u.items || []).map(i => TL.ui.item(i)).join('') : '';
          const art = u && TL.img.champ(u.champ);
          html += `<button type="button" class="hex ${u ? 'occ cost-' + ch?.cost : 'empty'} ${hl} ${sel}" data-pos="${pos}" ${u ? `data-uid="${u.id}" draggable="${opts.mini ? 'false' : 'true'}"` : ''} title="${u ? TL.esc((ch ? ch.name + (ch.nameKo ? ' / ' + ch.nameKo : '') + ' · ' + ch.cost + '코스트 · ' + ch.traits.join(', ') : '?') + ((u.items || []).length ? '\n아이템: ' + u.items.map(i => TL.data.item(i)?.nameKo || TL.data.item(i)?.name || i).join(', ') : '')) : `${r + 1}행 ${c + 1}열`}">`
            + (u ? `<span class="hx-in">${art ? `<img class="hx-art" src="${art}" alt="" draggable="false" loading="lazy">` : ''}<span class="hx-shade"></span>${mark ? `<span class="role">${mark === 'carry' ? '⚔' : '🛡'}</span>` : ''}<span class="hs">${'★'.repeat(u.star || 1)}</span><span class="hn">${TL.esc(TL.data.name(ch))}</span>${items ? `<span class="hi">${items}</span>` : ''}</span>` : `<span class="pos">${r + 1}-${c + 1}</span>`)
            + '</button>';
        }
        if (!lead) html += '<span class="hexrow-spacer"></span>';
      });
      el.innerHTML = html;
      el.classList.toggle('enemy', !!opts.enemy);
      el.classList.toggle('tilt', !opts.mini && TL.state?.settings?.board3d !== false);
      if (opts.mini) return;
      TL.$$('.hex', el).forEach(h => {
        const pos = +h.dataset.pos;
        h.onclick = () => opts.onClick && opts.onClick(pos, h.dataset.uid || null);
        h.oncontextmenu = e => { e.preventDefault(); if (h.dataset.uid && opts.onRemove) opts.onRemove(h.dataset.uid); };
        h.ondragstart = e => { e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'unit', uid: h.dataset.uid, from: opts.zone || 'board' })); e.dataTransfer.effectAllowed = 'move'; };
        h.ondragover = e => { e.preventDefault(); h.classList.add('drop'); };
        h.ondragleave = () => h.classList.remove('drop');
        h.ondrop = e => { e.preventDefault(); h.classList.remove('drop'); let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } opts.onDrop && opts.onDrop(d, { zone: opts.zone || 'board', pos, uid: h.dataset.uid || null }); };
      });
    },
    renderBench(el, bench, opts = {}) {
      el.innerHTML = bench.map((u, i) => { const ch = u && TL.data.champ(u.champ); const art = u && TL.img.champ(u.champ); return `<div class="slot ${u ? 'occ cost-' + ch?.cost : ''} ${u && opts.selected === u.id ? 'sel' : ''}" data-slot="${i}" ${u ? `data-uid="${u.id}" draggable="true" title="${TL.esc(ch?.name + ' · ' + ch?.traits.join(', '))}"` : ''} tabindex="0">${u ? `${art ? `<img class="sl-art" src="${art}" alt="" draggable="false" loading="lazy">` : ''}<span class="hs">${'★'.repeat(u.star)}</span><span class="hn">${TL.esc(TL.data.name(ch))}</span>${u.items?.length ? `<span class="hi">${u.items.map(x => TL.ui.item(x)).join('')}</span>` : ''}` : `<span class="dim">${i + 1}</span>`}</div>`; }).join('');
      TL.$$('.slot', el).forEach(s => {
        const i = +s.dataset.slot;
        s.onclick = () => opts.onClick && opts.onClick(i, s.dataset.uid || null);
        s.oncontextmenu = e => { e.preventDefault(); if (s.dataset.uid && opts.onRemove) opts.onRemove(s.dataset.uid); };
        s.ondragstart = e => { e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'unit', uid: s.dataset.uid, from: 'bench' })); };
        s.ondragover = e => { e.preventDefault(); s.classList.add('drop'); };
        s.ondragleave = () => s.classList.remove('drop');
        s.ondrop = e => { e.preventDefault(); s.classList.remove('drop'); let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (x) { return; } opts.onDrop && opts.onDrop(d, { zone: 'bench', slot: i, uid: s.dataset.uid || null }); };
      });
    },
    neighbors(pos) { // pointy-top offset rows: odd rows shifted right
      const r = Math.floor(pos / 7), c = pos % 7, odd = r % 2 === 1;
      const d = odd ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
      return d.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => rr >= 0 && rr < 4 && cc >= 0 && cc < 7).map(([rr, cc]) => rr * 7 + cc);
    },
  };

  /* ---------------- roster (champion picker) ---------------- */
  TL.roster = {
    filterHTML(prefix, f) {
      const costs = TL.data.costs(); const traits = TL.data.traits().slice().sort((a, b) => (a.type === 'unique') - (b.type === 'unique') || a.name.localeCompare(b.name));
      return `<div class="roster-tools"><input id="${prefix}Q" placeholder="챔피언·특성 검색 (한/영)" value="${TL.esc(f.q || '')}"/>
        <select id="${prefix}Cost"><option value="all">전체 코스트</option>${costs.map(c => `<option value="${c}" ${String(f.cost) === String(c) ? 'selected' : ''}>${c}코스트</option>`).join('')}</select>
        <select id="${prefix}Trait"><option value="all">전체 특성</option>${traits.map(t => `<option value="${TL.esc(t.name)}" ${f.trait === t.name ? 'selected' : ''}>${TL.esc(t.name)}${t.type === 'unique' ? ' (고유)' : ''}</option>`).join('')}</select>
        ${f.unlock !== undefined ? `<select id="${prefix}Unlock"><option value="all">해금: 전체</option><option value="base" ${f.unlock === 'base' ? 'selected' : ''}>기본 상점</option><option value="unlock" ${f.unlock === 'unlock' ? 'selected' : ''}>해금형 전체</option><option value="unlocked" ${f.unlock === 'unlocked' ? 'selected' : ''}>해금 완료</option><option value="locked" ${f.unlock === 'locked' ? 'selected' : ''}>미해금</option></select>` : ''}</div>`;
    },
    list(f, unlocked = {}) {
      const q = (f.q || '').trim().toLowerCase();
      return TL.data.champs().filter(c => (f.cost === 'all' || !f.cost || String(c.cost) === String(f.cost)) && (f.trait === 'all' || !f.trait || c.traits.includes(f.trait))
        && (!f.unlock || f.unlock === 'all' || (f.unlock === 'base' && !c.unlock) || (f.unlock === 'unlock' && c.unlock) || (f.unlock === 'unlocked' && c.unlock && unlocked[c.id]) || (f.unlock === 'locked' && c.unlock && !unlocked[c.id]))
        && (!q || c.name.toLowerCase().includes(q) || (c.nameKo || '').includes(q) || c.traits.some(t => t.toLowerCase().includes(q)) || c.role.toLowerCase().includes(q)))
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
    },
    cardsHTML(list, opts = {}) {
      if (!list.length) return '<div class="empty" style="grid-column:1/-1">검색 결과 없음</div>';
      return list.map(c => { const locked = c.unlock && !(opts.unlocked || {})[c.id]; return `<div class="ch cost-${c.cost} ${locked && opts.dimLocked ? 'locked' : ''} ${opts.sel === c.id ? 'sel' : ''}" draggable="true" data-champ="${c.id}" tabindex="0" title="${TL.esc(c.name + ' · ' + c.role + (c.unlock ? '\n해금 조건: ' + (c.unlockCondition || '미공개') : ''))}">${TL.ui.champ(c, 'ch-art')}<span class="ch-body"><span class="nm">${TL.esc(TL.data.name(c))}</span><span class="tr">${c.traits.map(t => TL.ui.trait(t, 'none', 'xs') + `<em>${TL.esc(t)}</em>`).join('')}</span></span><span class="cs">${c.cost}</span>${c.unlock ? `<span class="lk" title="${(opts.unlocked || {})[c.id] ? '해금됨' : '해금형'}">${(opts.unlocked || {})[c.id] ? '🔓' : '🔒'}</span>` : ''}</div>`; }).join('');
    },
    bind(host, onPick) {
      TL.$$('[data-champ]', host).forEach(el => {
        el.onclick = () => onPick(el.dataset.champ);
        el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(el.dataset.champ); } };
        el.ondragstart = e => { e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'champ', champ: el.dataset.champ })); e.dataTransfer.effectAllowed = 'copy'; };
      });
    },
  };

  /* ---------------- item palette ---------------- */
  TL.itemsUI = {
    paletteHTML(filter = 'component') {
      const list = TL.data.items().filter(i => filter === 'all' || i.type === filter);
      return list.map(i => `<span class="itm icon ${i.type}" draggable="true" data-item="${i.id}" tabindex="0" title="${TL.esc((i.nameKo ? i.nameKo + ' / ' : '') + i.name + (i.recipe ? '\n조합: ' + i.recipe.map(r => TL.data.item(r)?.nameKo || r).join(' + ') : '') + (i.stats ? '\n' + i.stats : '') + (i.description ? '\n' + i.description : '') + '\n상태: ' + i.status)}">${TL.ui.item(i.id)}<span class="iname">${TL.esc(i.nameKo || i.name)}</span></span>`).join('');
    },
    bind(host, onPick) {
      TL.$$('[data-item]', host).forEach(el => {
        el.onclick = () => onPick(el.dataset.item, el);
        el.ondragstart = e => { e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'item', item: el.dataset.item, from: el.dataset.from || 'palette', idx: el.dataset.idx })); };
      });
    },
    // equip rules shared: returns {ok, items, msg, consumed}
    equip(unit, itemId, maxItems = 3) {
      const it = TL.data.item(itemId); const ch = TL.data.champ(unit.champ); if (!it || !ch) return { ok: false, msg: '알 수 없는 아이템' };
      const items = (unit.items || []).slice();
      if (it.type === 'emblem' && (ch.traits.includes(it.grantsTrait) || items.some(x => TL.data.item(x)?.grantsTrait === it.grantsTrait))) return { ok: false, msg: `${ch.name}은(는) 이미 ${it.grantsTrait} 특성을 가지고 있어 상징을 장착할 수 없어.` };
      if (items.includes(TL.THIEF)) return { ok: false, msg: '도적의 장갑은 아이템 슬롯 3개를 차지해.' };
      if (it.type === 'component') {
        const ci = items.findIndex(x => TL.data.item(x)?.type === 'component');
        if (ci >= 0) { const res = TL.data.combine(items[ci], itemId); if (res) { if (res.id === TL.THIEF && items.length > 1) return { ok: false, msg: '도적의 장갑은 슬롯 3개를 차지 — 다른 아이템이 있으면 완성 불가.' }; items[ci] = res.id; return { ok: true, items, msg: `${res.nameKo || res.name} 완성!`, combined: res }; } }
      }
      if (items.length >= maxItems) return { ok: false, msg: `아이템은 최대 ${maxItems}개까지야.` };
      if (itemId === TL.THIEF && items.length) return { ok: false, msg: '도적의 장갑은 슬롯 3개를 차지해.' };
      items.push(itemId); return { ok: true, items };
    },
  };
})(window.TL);
