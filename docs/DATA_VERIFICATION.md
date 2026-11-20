# Set 19 데이터 검증 보고서

> **최신 상태 (2026-11-20)**: PBE 16.24 데이터 반영 — 아래 5절 참고.

- 검증일: **2026-11-17** · 데이터 버전 `19.0-preview.1`
- 원칙: 고증 우선. 확인되지 않은 값은 채우지 않고 `unverified`/`carryover`로 표시. 존재하지 않는 챔피언·특성·아이템·효과를 만들지 않음.

## 1. 현재 시점의 사실관계

| 항목 | 날짜 | 상태 | 출처 |
|---|---|---|---|
| Set 18 마지막 정규 패치 18.6 | 2026-11-04 | 라이브 | tft.ninja release-date |
| Set 19 Dev Drop (챔피언 94 · 특성 47 · 증강 330) | 2026-11-15 | 공개됨 | Riot Dev Drop → tft.ninja |
| Set 19 PBE | 2026-11-17 | **추정**(Riot 미발표) | tft.ninja |
| 19.1 (Set 19 출시) | 2026-12-02 | Riot 확정 | tft.ninja (일부 매체는 12-01 표기) |
| 19.2 (대회 기준 패치) | 2026-12-15 | 일정상 예정 | Riot 패치 일정 (tft.ninja 인용) |

**결론: 대회 기준인 19.2 라이브 데이터는 아직 존재하지 않는다.** 따라서 이 프로그램은 "사전 공개 + 이전 세트 규칙" 데이터로 동작하며, 화면 곳곳(헤더·대시보드·데이터 설정·각 패널)에 그 상태를 표시한다.

CommunityDragon 확인 결과(2026-11-17): `pbe` = 16.23(Set 18까지), `latest` = 16.22(Set 18). **Set 19 데이터 미포함.** PBE 반영 후 앱의 CommunityDragon 가져오기로 교체 가능.

## 2. 항목별 검증 결과

### 챔피언 (champions.json) — `preview`
- Dev Drop 전사본(tft.ninja, 2026-11-15)과 v0.1.0 데이터 94명을 **필드 단위로 대조 → 코스트·특성·역할·해금 여부 100% 일치**.
- 코스트 분포: 1코 15 · 2코 18 · 3코 16 · 4코 22 · 5코 19 · 7코 4 = 94, 해금형 36.
- 추가: 해금 조건 원문 36개, 효과 태그(CC/치유 등), 한국어 이름 93개(CommunityDragon `ko_kr`에서 apiName으로 매칭 90 + LoL 공식명 카서스/아칼리 3). **Locke는 한국어 공식명을 확인하지 못해 영문 유지.**
- 미포함(비공개): 체력·공격력 등 스탯, 스킬 수치.

### 특성 (traits.json) — `preview`
- 47개(일반 27 + 고유 20) 설명과 단계별 효과 문장(Riot 원문) 수록. **수치(%·스탯)는 Dev Drop에서 비공개.**
- v0.1.0 대비 수정:
  - **True Damage**: v0.1.0의 `10` 단계는 원문에 없음 → 제거. A-Side(승리)/B-Side(패배) 각각 3/5 단계. 프리즘 단계는 Prismatic Tour 증강 퀘스트로 해금(설명 원문).
  - **Collab**: v0.1.0은 고유 특성(1)로 처리 → 원문상 3/5 단계이며 "게임마다 다른 챔피언이 Collab을 얻음" → `rotating` 타입으로 수정, 팀 빌더에서 수동 지정.
  - **Pentakill**: 원문에 7이 두 번(두 번째 = MOSH PIT 프리즘) → 일반 3/5/7 + 프리즘 7로 분리.
  - **K/DA**: "총 별 레벨에 따라 곡 발매" → 유닛 수가 아니라 **별 레벨 합**으로 집계(`countMode: stars`).
- 확인 필요(노트로 표시): Rock 단계 활성 기준(유닛 수로 계산 중), Gu Feng 레벨 11 경로.
- 한국어 특성명은 이전 세트와 같은 apiName이 확인된 5개만 표시(비전 마법사·전쟁기계·펜타킬·신동·학살자). 나머지 Set 19 특성의 공식 한국어 명칭은 미확인 → 영문 유지.

### 증강 (augments.json) — `preview`
- v0.1.0의 실버 예시 20개 → **330개 전체**(실버 84 · 골드 137 · 프리즘 109, 상징 49 · 특성 19 · 영웅 1).
- 설명은 Riot 원문(영문). **수치 비공개** → `numbers: null`.
- `categories`(경제/아이템/전투력/챔피언/체력/특성)와 `relatedTraits`는 설명 키워드 기반 **자동 분류(training-model)** 이며 공식 분류가 아님.
- 증강 등급 출현 확률은 비공개 → 시뮬레이터/연구실에서 사용자가 등급을 선택.

### 아이템 (items.json) — `carryover`
- 표준 조합표 36개 + 특수 3개(전략가의 왕관/망토/방패) + 재료 10개: **CommunityDragon live 16.22(Set 18)** 원본 `composition` 필드 그대로. 한국어 이름·설명은 `ko_kr` 원본.
- v0.1.0 아이템 목록과 비교: Runaan's Hurricane → 현재 같은 조합(곡궁+음전자 망토)은 **Kraken's Fury**, Statikk Shiv 자리 → **Void Staff**, Redemption 자리 → **Spirit Visage** (CDragon의 apiName은 옛 이름이지만 표시 이름이 바뀐 것을 확인).
- 상징 17개: Set 19 증강 원문에 "X Emblem"으로 등장하는 것만 수록(`preview`, 조합법 미공개). 그 외 특성의 상징은 만들지 않음.
- Set 19에서 아이템이 바뀌면 교체 필요.

### 상점 확률 · 풀 (shop-odds.json) — `carryover`
- **Set 18 patch 18.3 공개 값**(tft.ninja roll-odds, 2026-11-08 업데이트): Lv7 16/30/43/10/1, Lv8 15/20/32/30/3, Lv9 10/17/25/33/15, Lv10 5/10/20/40/25, Lv11 1/2/12/50/35 등. 모든 행 합계 100 검증.
- v0.1.0의 값(예: Lv7 19/30/35/15/1, Lv8 15/20/30/30/5, Lv11 1/5/14/40/40)은 출처를 확인할 수 없어 교체.
- 풀 크기(Set 18): 1코 30 · 2코 25 · 3코 18 · 4코 10 · 5코 9. **7코스트 풀/확률은 비공개 → null**, 시뮬레이터 상점에서 제외.
- 레벨 1 행은 원 표에 없어 레벨 2와 동일하다고 가정(표시).

### 게임 규칙 (game-rules.json) — `carryover`
| 규칙 | 값 | 교차 검증 |
|---|---|---|
| XP 필요량 | 2→3: 2, 3→4: 6, 4→5: 10, 5→6: 20, 6→7: 36, **7→8: 56**, 8→9: 68, 9→10: 68 | tft.ninja(18.2 기준 56) vs LoL 위키(60) **불일치** → 최신 출처 56 채택, 노트 표시 |
| XP 구매 / 패시브 | 4G = 4XP / 라운드당 2XP | 위키·tft.ninja 일치 |
| 기본 수입 | 1-2: 2, 1-3: 2, 1-4: 3, 2-1: 4, 이후 5 | 위키·tft.ninja 일치 |
| 이자 | 10G당 1, 최대 5 (패시브 수입 전 계산) | 일치 |
| 연승/연패 | 3-4: +1, 5: +2, 6+: +3 · PvP 승리 +1 | 일치 (v0.1.0의 2-3/4-5/6+ 구간은 수정) |
| 스테이지 피해 | 1:0, 2:2, 3:5, 4:8, 5:10, 6:12, 7+:17 + 생존 유닛 1당 1 | tft.ninja (patch 18.1) |
| 판매가 | 1성·1코스트 전액, 그 외 투자액 − 1 | 위키 패치 기록·tft.ninja 일치 |
| 증강 라운드 | 2-1, 3-2, 4-2 | tft.ninja augments overview |
| 보드/대기석 | 4×7 = 28칸, 대기석 9 | tft.ninja the-board |
| 회전초밥 라운드 수입·XP | **출처 불명확 → `unverified`, 둘 다 미지급으로 설정** | "계획 단계 시작 시 수입"(위키) · "무료 XP로 3-2에 5레벨"(tft.ninja) 문구와 일치하도록 설정 |

## 3. 사용한 출처

1. Riot Set 19 Dev Drop (2026-11-15) 전사본 — https://tft.ninja/sets/19/units , /traits , /augments
2. Set 19 일정 — https://tft.ninja/guides/news/set-19-release-date
3. CommunityDragon — https://raw.communitydragon.org/latest/cdragon/tft/en_us.json , ko_kr.json , pbe 버전
4. League of Legends Wiki — https://wiki.leagueoflegends.com/en-us/TFT:Gold , TFT:Experience
5. TFT Ninja 메커닉 가이드 — roll-odds, champion-pool, leveling, economy, player-damage-calculation, stages, star-levels, augments/overview, the-board, carousel, loot-orbs
6. 교차 확인용 — Blitz.gg Set 19 champions/traits/unlocks, Inven Global, esports.gg (검색 결과 요약)

나무위키는 이번 검증에서 Set 19 문서를 확인하지 못했습니다(접근 허용은 했으나 사용 가능한 Set 19 수치 문서 없음). Riot 공식 패치 노트(19.1/19.2)는 아직 발표 전입니다.

## 4. 대회 전 재검증 체크리스트

- [ ] PBE 반영 후: CommunityDragon PBE `en_us.json` 가져오기 → `TFTSet19` → 상태 `pbe`
- [ ] 19.1 패치 노트(12-01 전후 공개 예상): 상점 확률·XP·풀 크기 변경 여부 확인 → shop-odds/game-rules 수정, 상태 `live`
- [ ] 19.2 패치 노트(12-14 전후): 밸런스 변경 반영, 증강 수치 메모 갱신
- [ ] 회전초밥 라운드 수입/XP, Rock 단계 기준, 7코스트 등장 방식 실제 확인
- [ ] 한국어 클라이언트 명칭(특성·증강) 확인 후 `nameKo` 추가

## 5. PBE 반영 (2026-11-20) — 현재 데이터 `19.0-pbe.20261120`

- **사실 확인**: Set 19는 2026-11-17부터 PBE에 올라와 있다 (tft.ninja 2026-11-18 업데이트: "Set 19 has been on the PBE since Tuesday, November 17").
- **CommunityDragon 확인 결과**: `pbe` = 16.24.8403318, `latest` = 16.23.8406595. 두 채널 모두 `cdragon/tft/*.json`, `tftchampions.json`, `tfttraits.json`, `tftitems.json`에 **Set 19가 없다** (TFT 내보내기 파일 크기도 16.23과 동일). → 사용자 선호 출처인 CommunityDragon으로는 아직 갱신 불가.
- **사용한 출처**: Blitz.gg 공개 Set 19 페이지(`/tft/set19`, `/champions`, `/traits`, `/augments`)에 내장된 게임 데이터. 자체 메타데이터: `patch_type=pbe, patch=16.24, updated_at=2026-11-20 04:01 UTC`. 키가 게임 파일 apiName(`DA_Ahri19`, `DA_19_*`) 그대로라 PBE 클라이언트에서 추출한 값으로 판단. 스냅샷: `tools/sources/blitz_pbe_16.24_set19.json`, 변환기: `tools/update_from_blitz_pbe.py`.
- **새로 들어온 값**: 특성 단계별 수치, 챔피언 스탯(체력·공격력·공속·방어·마저·사거리)과 마나·스킬 수치, 증강 설명 내 수치와 등장 라운드(Riot RoundVariant), 해금 조건 수치(32명), 상징 조합법, Set 19 아이템 목록(완성 36 · 상징 22 · 유물 33 · 찬란한 37 · 지원 4).
- **Dev Drop 대비 변경**: 챔피언 94명 구성·코스트 동일. Rakan 특성 Boy Band → Boy Band/Choreographer, Gnar 역할 Attack Specialist → Hybrid Specialist. 증강 329 → 366(신규 38, 사라짐 4, 일반 모드 제외 16), 등급 변경 2개(Bundle o' Shrooms Gold→Silver, Tons of Stats! Prismatic→Gold).
- **제외/처리**: Hero 증강 전용 형태 7개(`*_HeroAugment_Override`)는 별도 챔피언이 아니라 기본 챔피언의 `heroVariant`로 저장. 구성원 없는 내부 특성 3개(Mystical Instrument, Rising Star, Superstar)는 제외.
- **그대로인 것**: 상점 확률·풀 크기·XP·경제 규칙(Set 18 carryover — 출처 없음). 한국어 이름은 기존 CDragon ko_kr 매칭 유지(챔피언 93, 아이템 47). Set 19 특성·증강의 공식 한국어 명칭은 여전히 미확인.
- **이전 데이터 백업**: `legacy/data_devdrop_2026-11-15/`.
- **다음 단계**: CommunityDragon이 TFTSet19를 내보내면 `python3 tools/update_from_cdragon.py`로 교차 검증. 19.1(12-02) 패치 노트로 상점 확률·경제 규칙 확인.
