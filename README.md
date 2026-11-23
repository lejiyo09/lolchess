# TFT Tournament Lab · Set 19 (Prismatic Tour)

2026년 12월 후반 TFT 대회를 준비하기 위한 **개인 훈련 프로그램**입니다. 덱 추천 사이트가 아니라, 운영 판단·조합 연구·정찰·대회 기록을 반복 연습하는 로컬 훈련 환경입니다.

- 설치 · 서버 · 로그인 · API 키 **없음**, 외부 라이브러리 **없음**
- `index.html`을 크롬에서 바로 열면 동작 (오프라인 동작)
- GitHub Pages에 그대로 올려도 동작 (서비스 워커로 첫 방문 후 오프라인 캐시)
- 기록은 브라우저 localStorage, 데이터셋 교체본과 백업은 IndexedDB에 저장

> ⚠️ **데이터 상태 (2026-11-23 기준)** — 챔피언·특성·증강·아이템: **PBE 16.24 게임 데이터 (2026-11-20 16:44 UTC 빌드)**, 이전 PBE 빌드 대비 밸런스 변경 45건 반영. 메타 덱: **tft.ninja PBE 통계 (최근 1일 579.6k 판, 2026-11-23 01:45 UTC 집계)**. 상점 확률·XP·경제 규칙은 아직 Set 18 값(`carryover`). 대회 기준 19.2는 2026-12-15 예정. CommunityDragon에는 아직 Set 19가 없음. 롤체지지(lolchess.gg)는 자동 접속을 차단(CloudFront 403)해 사용하지 못함. 자세한 내용: [`docs/DATA_VERIFICATION.md`](docs/DATA_VERIFICATION.md)

## 실행

**웹 / 앱(PWA)** — https://lejiyo09.github.io/lolchess/
- 처음 한 번 접속하면 이후 **오프라인에서도** 열립니다(서비스 워커 캐시).
- **앱으로 설치**: 오른쪽 위 `⬇ 앱 설치` 버튼, 또는
  - Chrome/Edge(PC·크롬북·안드로이드): 주소창의 설치 아이콘 ⊕ 또는 메뉴 ⋮ → *앱 설치 / 홈 화면에 추가*
  - iPhone/iPad(Safari): 공유 □↑ → *홈 화면에 추가*
- 새 버전을 올리면 앱 안에 "새 버전이 준비됐어 → 지금 적용" 안내가 뜹니다. 기록은 유지됩니다.
- 기록은 기기·브라우저마다 따로 저장됩니다. 다른 기기로 옮길 때는 *Data & Settings → 전체 기록 내보내기/복원*을 쓰세요.

**로컬 파일** — ZIP을 풀고 `index.html`을 크롬으로 열어도 동작합니다(설치 기능만 없음).

### GitHub Pages 설정 (저장소 주인 1회)
저장소 *Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save*. 1~2분 뒤 위 주소로 열립니다. `.nojekyll`이 포함돼 있어 빌드 과정은 없습니다.

### 새 버전 배포 시
`sw.js`의 `VERSION`과 `js/core.js`의 `APP_VERSION`을 올린 뒤 커밋하면 설치된 앱이 새 버전을 감지합니다.

## 메뉴

| # | 메뉴 | 핵심 기능 |
|---|---|---|
| 1 | **Dashboard** | 대회 D-day, 데이터 검증 상태, 패치 일정, 훈련 지표, 체크리스트, 권장 루틴 |
| 2 | **Team Builder** | 7×4 헥스 보드, 드래그 앤 드롭(로스터→보드/대기석, 보드↔대기석, 스왑), 대기석 9칸, 별 1~3, 아이템 장착/해제·재료 자동 조합·상징 규칙, 레벨별 배치 인원 제한(전략가 아이템 +1), 특성 단계 시각화(브론즈/실버/골드/프리즘), 코스트·특성·해금 필터, 한/영 검색, 해금 상태 관리, Collab 지정, 조합 저장/불러오기/덮어쓰기/복제, 장단점·핵심 아이템 메모, 딜러/탱커 지정, 최대 3개 조합 비교, 배치 변경 전후 비교, PNG 이미지 내보내기, 조합 JSON |
| 3 | **Meta Comps** | PBE 메타 덱 65개(tft.ninja, 최근 1일 57.9만 판): 등급 S/A/B, 평균 등수·TOP4·1등률·픽률, ★★★ 목표·캐리 아이템·우선순위, 특성, 핵심/유연 유닛, 모을 재료, 레벨별 보드, 변형, 전환 후보, 팀 빌더로 불러오기 |
| 4 | **Game Simulator** | 1-1부터 라운드 진행(회전초밥·PvE·PvP·증강 2-1/3-2/4-2), 체력·레벨·XP·골드·연승/연패·상점·대기석·아이템·증강 관리, XP 구매/리롤/구매/판매/잠금/배치/아이템 조합, 3장 자동 합성, 공유 풀(7명 봇), 해금 처리(다음 상점 보장), 경쟁 시나리오, 롤다운 확률 계산기(몬테카를로), 판단 포인트 메모, 상황 시나리오 시작, 라운드 시작으로 되돌리기, 복기(레벨 타이밍 vs 가이드), 단축키 D/F/E/Space |
| 5 | **Augment Lab** | 증강 330개 전체 DB(등급·종류·분류·관련 특성 필터), 현재 상황(라운드·체력·골드·레벨·연속·운영 방향·내 보드 특성) 기반 적합도 비교, 3지선다 선택 연습(먼저 고르고 근거 공개), 증강별 추천 조합/상황 메모/개인 평가, 선택 기록·통계·CSV |
| 6 | **Scouting** | 로비 상대 최대 7명 보드·조합·아이템·메모, 실제 대면 방향(180° 회전) 표시, 내 보드(팀 빌더에서 가져오기), 암살자·광역·딜러 보호 체크(위험 점수·위험 칸 강조), 배치안 A/B 저장·비교, 경쟁 챔피언 장수 계산 |
| 7 | **Decision Training** | 17개 상황 문제(선택지별 0~3점 합리성·해설·기회비용, 복수 정답 허용, 이유 작성·핵심 근거 자기 점검), 실제 데이터로 확률을 계산하는 상황 생성기, 분야별 점수 |
| 8 | **Tournament Records** | 8인 로비 입력(참가자·순위 중복 검사), 조합·증강·핵심 아이템·메모·패치, 총 경기·평균·1등·TOP4·점수·최근 5경기, 조합별/패치별/증강별 성적, 최근 추세 그래프, 로비 순위표(동점 처리), 점수표 편집(자동 재계산), CSV |
| 9 | **Data & Settings** | 파일별 세트/패치/출처/업데이트/검증 상태, 데이터 검증·자동 복구, JSON 가져오기(전체 번들/개별 파일/v0.1.0 데이터셋/CommunityDragon) + 변경 내역 미리 보기, 내보내기, IndexedDB 백업(가져오기 전·일일·수동)·복원, 데이터 버전·가져오기 기록, 점수표 프리셋, 앱 기록 전체 백업/복원/초기화 |

## 폴더 구조

```
index.html            앱 진입점
css/app.css           다크 테마(남색·보라 + 골드)
js/core.js            유틸, localStorage/IndexedDB, 데이터 관리자(검증·복구·diff), 특성/경제 엔진, 헥스 보드·로스터·아이템 공용 컴포넌트
js/<menu>.js          메뉴별 모듈 (dashboard, builder, sim, augments, scout, drill, records, settings)
js/app.js             부팅·라우터·자동 백업·서비스 워커 등록
data/*.json           ★ 패치 데이터 원본 (champions, traits, items, augments, shop-odds, game-rules, patch-info)
data/bundle.js        위 JSON을 file://에서도 읽히도록 감싼 파일 (자동 생성)
tools/build_data.py   tools/sources → data/*.json + bundle.js 생성
tools/sources/        검증에 사용한 원천 스냅샷 (Dev Drop 파싱 결과, CDragon 아이템)
sw.js                 PWA 서비스 워커 (오프라인 캐시·업데이트 안내)
manifest.webmanifest  PWA 매니페스트 (이름·아이콘·바로가기)
icons/                앱 아이콘 (일반/maskable/Apple)
assets/               게임 아트: 챔피언 초상화 94, 특성 아이콘 47, 아이템 아이콘 127 (오프라인 캐시)
js/meta.js            Meta Comps 메뉴
tests/                Playwright 자동 테스트
docs/                 변경 보고서, 데이터 검증, 한계, 테스트 결과
legacy/               v0.1.0 원본 (보존)
```

## PBE 데이터 · 메타 덱 갱신 (개발자용)

```bash
python3 tools/update_from_blitz_pbe.py --src tools/sources/<새 스냅샷>.json
```

```bash
python3 tools/build_meta_comps.py --src tools/sources/<새 tft.ninja 스냅샷>.json
```

```bash
python3 tools/build_bundle.py
```

```bash
node tests/data_check.js
```

`update_from_blitz_pbe.py`는 직전 `data/`와 비교해 **PBE 밸런스 변경 내역**을 `patch-info.json`(`balanceChanges`)에 기록하고 대시보드에 표시합니다. `build_bundle.py`는 `data/bundle.js`와 아트 목록(`assets/index.js`, `assets/files.json`)을 만듭니다.

## 패치가 바뀌었을 때 (데이터만 교체)

**방법 A — 앱 안에서 (권장)**: Data & Settings → `JSON 가져오기`
- 수정한 `champions.json` 등 개별 파일 또는 전체 번들 선택 → 검증 결과와 변경 내역 확인 → 적용
- 또는 CommunityDragon `https://raw.communitydragon.org/pbe/cdragon/tft/en_us.json`(PBE) / `.../latest/...`(라이브)를 내려받아 그대로 가져오기 → `TFTSet19` 선택 → 상태(pbe/live)·패치 표기 입력
- 적용 전 현재 데이터셋은 자동 백업되고, 언제든 "내장 데이터로 되돌리기" 가능

**방법 A-2 — 자동 업데이트 스크립트 (CommunityDragon)**:

```bash
python3 tools/update_from_cdragon.py --check
```

```bash
python3 tools/update_from_cdragon.py
```

```bash
node tests/data_check.js
```

`--check`는 PBE에 `TFTSet19`이 있으면 종료 코드 0, 없으면 3을 돌려줍니다. 업데이트는 챔피언·특성(단계별 수치 포함)·증강(수치 포함)·아이템을 게임 파일 값으로 바꾸고, CDragon에 없는 해금 조건·한국어 이름·특성 메모는 이름이 같으면 유지합니다. 상점 확률·경제 규칙은 CDragon에 없어 그대로 둡니다. 라이브 반영 후에는 `--channel latest --status live --patch "19.1 live"`로 실행하세요.

**방법 B — 파일 교체 (배포용)**: `data/*.json` 수정 → `python3 tools/build_data.py`(또는 JSON만 수정했다면 `bundle.js` 재생성 필요) → 배포

각 데이터 파일의 `meta`에는 `set`, `patch`, `source`, `updated`, `status`가 있습니다. 상태 값: `live` / `pbe` / `preview` / `carryover` / `training-model` / `unverified`.

## 실제 규칙 vs 훈련용 모델

| 실제 데이터 규칙 (data에서 읽음) | 훈련용 모델 (UI에 표시) |
|---|---|
| 기본 수입(1-2:2, 1-3:2, 1-4:3, 2-1:4, 이후 5), 이자(10G당 1, 최대 5), 연속 보너스(3-4:1, 5:2, 6+:3), PvP 승리 +1, XP 표·4G=4XP·라운드당 2XP, 레벨별 상점 확률, 챔피언 풀 크기, 판매가, 스테이지 피해 + 생존 유닛 수, 라운드 구조, 증강 라운드, 3장 합성, 아이템 조합표, 상징 장착 규칙 | 전투 승패(보드 가치·별·아이템·활성 특성 → 승률), 상대 7명(봇), PvE 전리품, 회전초밥 구성, 증강 등급, 다른 플레이어의 풀 사용량, 증강 적합도·정찰 위험 점수(휴리스틱), 회전초밥 라운드 수입/XP(출처 불명확 → 끔) |

## 테스트

```bash
node tests/functional.js
```

```bash
node tests/http_offline.js
```

```bash
node tests/pwa.js
```

```bash
node tests/data_check.js
```

최근 결과: **95/95 통과** + HTTP/오프라인 테스트 통과 → [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md)

## 문서

- [`docs/CHANGES.md`](docs/CHANGES.md) — 변경 사항 보고서 (v0.1.0 → v2.0.0)
- [`docs/DATA_VERIFICATION.md`](docs/DATA_VERIFICATION.md) — Set 19 데이터 검증 보고서
- [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md) — 미구현 기능 및 한계
- [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) — 테스트 결과

## 출처

- PBE 메타 덱 통계: tft.ninja PBE comps — https://tft.ninja/comps?e=pbe
- PBE 게임 데이터: Blitz.gg Set 19 공개 페이지 내장 데이터 — https://blitz.gg/tft/set19
- 게임 아트: 챔피언 초상화·특성 아이콘(tft.ninja 제공 Set 19 이미지), 아이템 아이콘(CommunityDragon 게임 파일). 모든 게임 아트의 권리는 Riot Games에 있습니다.

- Riot Games Set 19 Dev Drop(2026-11-15) — TFT Ninja 전사본: https://tft.ninja/sets/19/units · /traits · /augments
- 패치 일정: https://tft.ninja/guides/news/set-19-release-date
- CommunityDragon (아이템 조합표·한국어 이름, live 16.22 / Set 18): https://raw.communitydragon.org/latest/cdragon/tft/
- League of Legends Wiki (TFT:Gold, TFT:Experience): https://wiki.leagueoflegends.com/en-us/TFT:Gold
- TFT Ninja 메커닉 가이드 (Set 18 기준 상점 확률·XP·경제·피해): https://tft.ninja/guides/game-mechanics

TFT Tournament Lab은 비공식 팬 제작 훈련 도구이며 Riot Games의 승인·후원을 받지 않았습니다. Teamfight Tactics 및 관련 자산의 권리는 Riot Games에 있습니다.
