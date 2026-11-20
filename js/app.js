/* TFT Tournament Lab — boot & router */
'use strict';
// v0.1.0 champion order (ids c0..c93) — used only to migrate old localStorage saves
window.TL_LEGACY_ORDER = ["Elise", "Gnar", "Katarina", "Kayn", "Kennen", "Kobuko", "Lillia", "Neeko", "Olaf", "Sett", "Taric", "Varus", "Yunara", "Ziggs", "Zoe", "Annie", "Ashe", "Camille", "Ezreal", "Gragas", "Illaoi", "Jax", "Karthus", "Lucian", "Lulu", "Lux", "Nasus", "Qiyana", "Renata Glasc", "Renekton", "Samira", "Seraphine", "Tristana", "Amumu", "Bard", "Braum", "Briar", "Draven", "Ekko", "Evelynn", "Galio", "K'Sante", "Kai'Sa", "Malzahar", "Senna", "Swain", "Syndra", "Tibbers", "Viego", "Ahri", "Alistar", "Alune", "Aurora", "Garen", "Graves", "Jhin", "Jinx", "Kayle", "Leona", "Locke", "Mel", "Shyvana", "Thresh", "Vayne", "Wukong", "Xayah", "Yasuo", "Yone", "Yorick", "Yuumi", "Zac", "Akali (K/DA)", "Akali (True Damage)", "Aphelios", "Dr. Mundo", "Gwen", "Janna", "Lee Sin", "Miss Fortune", "Mordekaiser", "Nidalee", "Nunu & Willump", "Pyke", "Rell", "Taliyah", "Teemo", "Twisted Fate", "Vi", "Vladimir", "Zeri", "Baron Nashor", "Rakan", "Smeech", "Sona"];
(function (TL) {
  TL.views = TL.views || {};
  TL.current = 'dashboard';
  TL.go = (name) => {
    if (!TL.views[name]) name = 'dashboard';
    TL.current = name;
    TL.$$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    TL.$$('.view').forEach(v => { const on = v.id === 'view-' + name; v.classList.toggle('active', on); if (!on) v.innerHTML = ''; }); // only the active view lives in the DOM (unique ids, low memory)
    try { TL.views[name].render(); } catch (e) { console.error(e); TL.$('#view-' + name).innerHTML = '<div class="notice red">화면을 그리는 중 오류: ' + TL.esc(e.message) + '<br>Data &amp; Settings에서 데이터 검증/복구를 실행해 줘.</div>'; }
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// sandbox */ }
    window.scrollTo(0, 0);
  };
  TL.refreshHeader = () => {
    const p = TL.data.patch(); const days = Math.ceil((new Date(TL.state.settings.eventDate + 'T00:00:00') - new Date(TL.today() + 'T00:00:00')) / 864e5);
    TL.$('#hdrStatus').innerHTML = `<span class="pill purple">데이터 ${TL.esc(p.dataVersion)}</span><span class="pill ${TL.data.isOverridden() ? 'cyan' : ''}">${TL.data.isOverridden() ? '사용자 데이터' : '내장 데이터'}</span><span class="pill gold keep" title="${TL.esc(p.currentDataPatch)}">기준: ${TL.esc(p.currentDataPatch)}</span><span class="pill keep ${days <= 14 ? 'red' : 'green'}">대회 ${days >= 0 ? 'D-' + days : 'D+' + (-days)}</span>`;
    TL.$('#navFoot').innerHTML = `v${TL.APP_VERSION} · ${TL.pwa && TL.pwa.standalone() ? '앱 모드' : '오프라인 동작'}<br>저장: localStorage + ${TL.idb.available ? 'IndexedDB' : '로컬 대체'}`;
  };
  async function autoBackup() {
    const s = TL.state.settings; const today = TL.today();
    if (s.lastAutoBackup === today) return;
    try { await TL.idb.addBackup({ id: TL.uid('bk'), kind: 'state', created: new Date().toISOString(), note: '일일 자동 백업', data: TL.clone(TL.state) }); await TL.idb.pruneBackups('state', 10); s.lastAutoBackup = today; TL.save(); } catch (e) { console.warn('auto backup failed', e); }
  }
  async function boot() {
    try { await TL.data.init(); } catch (e) { TL.$('#bootMsg').className = 'notice red'; TL.$('#bootMsg').textContent = '데이터 로드 실패: ' + e.message; return; }
    TL.state = TL.loadState();
    TL.$('#bootMsg').remove();
    TL.$$('#nav button').forEach(b => b.onclick = () => TL.go(b.dataset.view));
    TL.$('#modalClose').onclick = TL.closeModal;
    TL.$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') TL.closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') TL.closeModal();
      const tag = (e.target.tagName || '').toLowerCase(); if (['input', 'textarea', 'select'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (TL.current === 'sim' && TL.views.sim.hotkey) TL.views.sim.hotkey(e);
    });
    TL.refreshHeader();
    const start = (location.hash || '').slice(1);
    TL.go(TL.views[start] ? start : 'dashboard');
    if (TL._migrated) TL.toast('v0.1.0 저장 데이터를 v2 형식으로 옮겼어 (조합·스크림·증강 기록 유지).', 'ok');
    if (TL._stateCorrupt) TL.modal('저장 데이터 손상', '<p>브라우저에 저장된 기록을 읽지 못해 기본값으로 시작했어. 손상된 원본은 아래 버튼으로 내려받을 수 있어.</p>', { buttons: [{ label: '원본 내려받기', onClick: () => TL.download('tft-lab-corrupt-state.txt', TL._stateCorrupt, 'text/plain') }, { label: '닫기' }] });
    if (TL._overrideInvalid) TL.toast('저장된 사용자 데이터셋이 유효하지 않아 내장 데이터를 사용 중이야. Data & Settings 확인.', 'err');
    TL.saveNow();
    autoBackup();
  }
  /* ---------- PWA: install prompt, update flow, persistent storage ---------- */
  TL.pwa = {
    deferred: null,
    standalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  };
  const installBtn = () => document.getElementById('installBtn');
  const showInstall = on => { const b = installBtn(); if (b) b.classList.toggle('hide', !on); };
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); TL.pwa.deferred = e; showInstall(true); });
  window.addEventListener('appinstalled', () => { TL.pwa.deferred = null; showInstall(false); TL.toast && TL.toast('앱으로 설치됐어. 홈 화면/앱 목록에서 실행할 수 있어.', 'ok'); });
  const setupInstall = () => {
    const b = installBtn(); if (!b) return;
    if (TL.pwa.ios && !TL.pwa.standalone() && /^https?:$/.test(location.protocol)) showInstall(true); // iOS has no install prompt
    b.onclick = async () => {
      if (TL.pwa.deferred) { TL.pwa.deferred.prompt(); const r = await TL.pwa.deferred.userChoice; TL.pwa.deferred = null; if (r.outcome !== 'accepted') return; showInstall(false); return; }
      TL.modal('앱으로 설치하기', TL.pwa.ios
        ? '<ol class="small" style="line-height:1.9"><li>Safari 하단(아이패드는 상단)의 <b>공유</b> 버튼 □↑ 을 누르세요.</li><li><b>홈 화면에 추가</b>를 누르세요.</li><li>홈 화면의 <b>TFT Lab</b> 아이콘으로 실행하면 전체 화면 앱으로 열려요.</li></ol>'
        : '<p class="small">Chrome/Edge 주소창 오른쪽의 <b>설치</b> 아이콘(⊕) 또는 메뉴 ⋮ → <b>앱 설치</b> / <b>홈 화면에 추가</b>를 누르세요. 크롬북은 런처에 앱으로 추가돼요.</p>');
    };
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupInstall); else setupInstall();
  if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
    navigator.serviceWorker.register('sw.js').then(reg => {
      const offer = w => TL.modal && TL.modal('새 버전이 준비됐어', '<p class="small">앱(또는 데이터) 새 버전을 받았어. 지금 새로고침하면 적용돼. 기록은 그대로 유지돼.</p>', { buttons: [{ label: '나중에' }, { label: '지금 적용', cls: 'primary', onClick: () => w.postMessage('SKIP_WAITING') }] });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => { const w = reg.installing; if (!w) return; w.addEventListener('statechange', () => { if (w.state === 'installed') { if (navigator.serviceWorker.controller) offer(w); else w.postMessage('SKIP_WAITING'); } }); });
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000); // hourly check while open
    }).catch(e => console.warn('SW 등록 실패', e));
    // ask the browser not to evict local records (best effort; installed PWAs are usually granted)
    if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.TL);
