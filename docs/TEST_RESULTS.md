# 테스트 결과

- 실행 일시: 2026-11-17T03:25:03.702Z (UTC)
- 환경: Chromium (Playwright, headless) · `file://`로 index.html 직접 실행 (더블클릭 실행과 동일 조건)
- 결과: **95 / 95 통과**
- 성능: 화면 전환 평균 렌더 2.3 ms · JS 힙 사용량 10.7 MB

재실행 방법:

```bash
node tests/functional.js
```

```bash
node tests/http_offline.js
```

| # | 항목 | 결과 | 세부 |
|---|---|---|---|
| 1 | v0.1.0 저장 데이터 마이그레이션 | ✅ PASS | {"comps":1,"compChamp":"ahri","board":{"id":"u1","champ":"elise","star":2,"items":["infinity-edge"],"pos":3},"games":1,"place":3,"aug":1,"date":"2026- |
| 2 | 내장 데이터 검증 오류 0 | ✅ PASS |  |
| 3 | 데이터 규모 (챔피언 94/특성 47/증강 330) | ✅ PASS | {"e":[],"w":0,"ch":94,"tr":47,"au":330,"it":66,"metaOk":true} |
| 4 | 모든 데이터 파일 meta(set/patch/source/updated/status) | ✅ PASS |  |
| 5 | 데이터 고증 포인트 (K/DA 별합, True Damage 3/5, Collab 순환, Lv8 확률, XP, 조합법) | ✅ PASS | {"kda":"stars","td":[3,5],"collab":"rotating","odds8":"15/20/32/30/3","xp8":68,"ie":"Infinity Edge","kr":"Kraken's Fury"} |
| 6 | 클릭으로 챔피언 배치 | ✅ PASS | [["ziggs",0],["zoe",1]] |
| 7 | 로스터 → 보드 드래그 앤 드롭 | ✅ PASS | pos=24 |
| 8 | 보드 내 이동(스왑) | ✅ PASS | {"ziggs":1,"zoe":0,"annie":24} |
| 9 | 보드 → 대기석 이동 | ✅ PASS | {"bench":"annie","onBoard":false} |
| 10 | 대기석 → 보드 이동 | ✅ PASS |  |
| 11 | 클릭 선택 후 이동 (터치 대체 조작) | ✅ PASS |  |
| 12 | 특성 활성화 계산 (Arcanist 3 → 2단계 활성) | ✅ PASS | {"c":3,"a":0,"txt":true} |
| 13 | 같은 챔피언 중복은 특성 1회만 집계 | ✅ PASS | count=3 |
| 14 | K/DA 총 별 레벨 집계 (2★+1★=3 → 활성) | ✅ PASS | [3,0] |
| 15 | 레벨별 배치 인원 제한 (Lv3 초과 시 대기석으로) | ✅ PASS | {"n":6,"benchGnar":true} |
| 16 | 별 레벨 설정 | ✅ PASS |  |
| 17 | 아이템 장착 + 재료 2개 자동 조합 (B.F.+장갑 = 무한의 대검) | ✅ PASS | ["infinity-edge"] |
| 18 | 상징 장착 규칙 (이미 가진 특성의 상징은 거부) | ✅ PASS | ["infinity-edge"] |
| 19 | 상징으로 특성 추가 (Rock +1) | ✅ PASS |  |
| 20 | 아이템 해제 | ✅ PASS | ["infinity-edge"] |
| 21 | 해금 챔피언 상태 관리 | ✅ PASS |  |
| 22 | 코스트 필터 (5코스트 19명) | ✅ PASS | n=19 |
| 23 | 특성 필터 (Pentakill 7명) | ✅ PASS | n=7 |
| 24 | 해금 상태 필터 (해금 완료 1명) | ✅ PASS | n=1 |
| 25 | 한글 검색 (아리) | ✅ PASS | ["ahri"] |
| 26 | 조합 저장 → 비우기 → 불러오기 | ✅ PASS | before=6 after=6 |
| 27 | 여러 조합 비교 | ✅ PASS |  |
| 28 | 배치 변경 전후 비교 (이동 유닛 강조) | ✅ PASS | moved=1 |
| 29 | 보드 이미지(PNG) 내보내기 | ✅ PASS | 99368 bytes |
| 30 | 조합 JSON 내보내기/가져오기 | ✅ PASS |  |
| 31 | 새 게임 1-1 회전초밥 | ✅ PASS | {"ph":"carousel","r":"1-1","car":9} |
| 32 | 회전초밥 선택 → 1-2, 기본 수입 2G (규칙) | ✅ PASS | {"r":"1-2","g":2,"bench":1,"items":1,"lv":1} |
| 33 | 라운드 진행 1-2→2-1 + 패시브 XP (2-1에 Lv3 2/6) | ✅ PASS | {"r":"2-1","lv":3,"xp":2,"ph":"augment","items":4} |
| 34 | 2-1 증강 라운드 진입 | ✅ PASS |  |
| 35 | PvE 전리품 지급(훈련 모델) | ✅ PASS | items=4 |
| 36 | 증강체 선택 (시뮬레이터) + 증강 기록 연동 | ✅ PASS | {"id":"swordsmith-ii","name":"Swordsmith II","tier":"Gold","at":"2-1","reason":"테스트 이유"} |
| 37 | XP 구매: 4G → 4XP, Lv3 2/6 → Lv4 0/10 | ✅ PASS | {"g":26,"lv":4,"xp":0} |
| 38 | 단축키 F (XP 구매) | ✅ PASS | {"g":22,"xp":4} |
| 39 | 상점 리롤: −2G, 5칸 새로 생성 | ✅ PASS | {"g":20,"shop":"varus,katarina,lucian,briar,qiyana","n":5} |
| 40 | 단축키 D (리롤) | ✅ PASS |  |
| 41 | 상점 확률 준수 (Lv4: 55/30/15, 4·5코스트 0) | ✅ PASS | {"hi":0,"p1":0.5455,"p2":0.311,"p3":0.1435} |
| 42 | 챔피언 구매 (골드 차감·풀 감소) | ✅ PASS | {"g":18,"n":2} |
| 43 | 3장 자동 합성 → 2성 | ✅ PASS | ["ziggs2"] |
| 44 | 챔피언 판매 (1코스트 2성 = 3G 전액, 풀 3장 반환) | ✅ PASS | {"g":20,"pool":28,"n":0} |
| 45 | 판매가 규칙 (3코 2성 8 / 4코 2성 11 / 1성 전액 / 2코 3성 17) | ✅ PASS | 8,11,4,17 |
| 46 | 시뮬레이터 보드 배치 + 레벨 상한(Lv4 → 4명) | ✅ PASS | {"board":4,"bench":1} |
| 47 | 시뮬레이터 아이템 조합 (지팡이+지팡이 = 라바돈) | ✅ PASS | {"items":["rabadons-deathcap"],"left":0} |
| 48 | 라운드 수입 계산 (기본5 + 이자4 + 6연승3 + 승리1 = 13) | ✅ PASS | {"before":47,"after":60,"r":"3-2","streak":6,"last":"수입 +13G (기본 5 · 이자 4 · 연승 3 · 승리 1)"} |
| 49 | 패배 피해 (4스테이지 기본 8 + 생존 5 = 13), 연승 → 연패 전환 | ✅ PASS | {"hp":47,"streak":-1} |
| 50 | 4-4 회전초밥 라운드 진입 | ✅ PASS | {"ph":"carousel","r":"4-4"} |
| 51 | 수동 전투 결과 입력 (패배, 생존 3 → 8+3=11 피해) | ✅ PASS | {"r":"4-5","type":"pvp","result":"loss","dmg":11,"me":5.2,"opp":24.2,"p":0.01,"gold":16,"level":4,"hp":36} |
| 52 | 라운드 시작 상태로 되돌리기 | ✅ PASS |  |
| 53 | 게임 종료 → 순위·복기 저장 | ✅ PASS | {"ph":"over","pl":8,"hist":1} |
| 54 | 복기 화면 (레벨 타이밍·PvP 기록) | ✅ PASS |  |
| 55 | 상황 시나리오 시작 (3-2 표준) | ✅ PASS | {"r":"3-2","hp":70,"lv":5,"board":5} |
| 56 | 롤다운 확률 계산기 | ✅ PASS |  |
| 57 | 증강 선택 연습 (3개 → 선택 → 적합도 공개 → 기록) | ✅ PASS | offers=3 bars=3 |
| 58 | 상황별 효율 변화 (경제 증강: 2-1/체력100 > 4-2/체력25) | ✅ PASS | [78,19] |
| 59 | 증강 전체 데이터베이스 330개 표시 | ✅ PASS | n=330 |
| 60 | 등급별 분류 (Prismatic 109) | ✅ PASS | n=109 |
| 61 | 추천 조합/상황 메모 저장 | ✅ PASS |  |
| 62 | 증강 비교 탭 | ✅ PASS |  |
| 63 | 상대 보드 구성 (드래그/클릭) | ✅ PASS | ["briar","jinx"] |
| 64 | 암살자 대응 배치 비교 (구석 캐리 위험 > 3행 안쪽) | ✅ PASS | corner=3 inner=0 |
| 65 | 배치안 저장/비교 표 | ✅ PASS |  |
| 66 | 광역 대응 시나리오 전환 | ✅ PASS |  |
| 67 | 로비 상대 추가 | ✅ PASS |  |
| 68 | 판단 문제 답변 → 점수·이유·기회비용 해설 | ✅ PASS | {"choice":1,"score":3,"reason":"30G 이자와 연패 보너스","date":"2026-11-17T03:21:48.176Z","keys":[]} |
| 69 | 핵심 근거 자기 점검 | ✅ PASS |  |
| 70 | 데이터 기반 상황 생성기 | ✅ PASS |  |
| 71 | 대회 기록 저장 + 자동 통계 (3경기, 평균 3.67, 1등 1, TOP4 67%) | ✅ PASS | {"n":3,"avg":3.6666666666666665,"wins":1,"top4":0.6666666666666666,"pts":16,"lead":"P2","leadPts":23} |
| 72 | 로비 순위표 (P2 = 7+8+8=23점 1위) | ✅ PASS | {"n":3,"avg":3.6666666666666665,"wins":1,"top4":0.6666666666666666,"pts":16,"lead":"P2","leadPts":23} |
| 73 | 조합별/패치별/증강별 성적 + 추세 그래프 | ✅ PASS |  |
| 74 | 순위 중복 입력 검증 | ✅ PASS |  |
| 75 | 대회 점수 체계 수정 → 자동 재계산 (10+6+3=19) | ✅ PASS |  |
| 76 | 새로고침 후 데이터 유지 (조합/기록/시뮬/증강/정찰/훈련/해금) | ✅ PASS | {"comps":3,"games":3,"sim":3,"aug":2,"scout":2,"drill":1,"unl":true} |
| 77 | 전체 기록 JSON 내보내기 | ✅ PASS |  |
| 78 | 초기화 → JSON 복원 | ✅ PASS | {"games":3,"comps":3} |
| 79 | IndexedDB 자동 백업 (초기화 전/복원 전) | ✅ PASS | state:복원 전 자동 백업 \| state:초기화 전 자동 백업 \| state:일일 자동 백업 |
| 80 | 잘못된 백업 파일 거부 | ✅ PASS |  |
| 81 | 개별 데이터 파일 가져오기 → 변경 내역 미리 보기 | ✅ PASS |  |
| 82 | 데이터 교체 적용 + 가져오기 기록 | ✅ PASS | {"ov":true,"tiers":4,"log":1,"st":"live"} |
| 83 | 교체 데이터 새로고침 후 유지 (IndexedDB) | ✅ PASS |  |
| 84 | 교체 후에도 기존 화면 정상 동작 | ✅ PASS |  |
| 85 | 유효성 검사: 잘못된 데이터 감지 (없는 특성/코스트/확률 합) | ✅ PASS |  |
| 86 | 잘못된 데이터 자동 복구 | ✅ PASS | {"v":0,"n":93,"odds5":99.89999999999999} |
| 87 | v0.1.0 데이터셋 가져오기 인식 (True Damage 3/5/10 차이 표시) | ✅ PASS |  |
| 88 | 데이터셋 교체 전 자동 백업 | ✅ PASS | dataset backups=2 |
| 89 | 내장 데이터로 되돌리기 | ✅ PASS |  |
| 90 | 전체 데이터 번들 내보내기 | ✅ PASS |  |
| 91 | CommunityDragon 형식 변환기 | ✅ PASS | {"kind":"cdragon","ch":1,"tr":"3/5","aug":"Gain 5 gold","st":"pbe","valid":0} |
| 92 | Chromebook 1366×768 가로 스크롤 없음 | ✅ PASS |  |
| 93 | 모바일 390×844 가로 스크롤 없음 | ✅ PASS |  |
| 94 | 렌더 성능 (화면 전환 평균 < 60ms) | ✅ PASS | {"avgRenderMs":1.725,"heapMB":10.68115234375} |
| 95 | 페이지 JS 오류 없음 | ✅ PASS |  |

## 추가 테스트

| 항목 | 결과 |
|---|---|
| GitHub Pages 방식(HTTP 서버) 로드 | ✅ PASS |
| 서비스 워커 등록 | ✅ PASS |
| 오프라인 상태에서 새로고침 후 정상 동작 | ✅ PASS |
| 모든 JS 파일 구문 검사 (node vm) | ✅ PASS |

## 테스트하지 못한 것 (정직한 고지)

- 실제 Chromebook 하드웨어, 실제 모바일 기기의 터치 드래그(HTML5 드래그는 터치를 지원하지 않음 → 클릭 선택/이동 방식으로 대체되며 이 방식은 테스트됨).
- Firefox / Safari (Chromium만 자동 테스트).
- 실제 CommunityDragon Set 19 파일 변환 (2026-11-17 기준 CDragon PBE에 Set 19가 아직 없음 → 동일 구조의 축소 샘플로만 검증).
- 훈련용 전투력 모델의 "정확도"는 실제 게임 결과와 비교 검증할 수 없음(모델임을 UI에 표시).
