#!/usr/bin/env python3
"""Build data/*.json and data/bundle.js from the verified source snapshots in tools/sources.

Run:  python3 tools/build_data.py
- data/*.json  : human-editable, per-domain data files (source of truth for patches)
- data/bundle.js : the same data wrapped as `window.TFT_DATA_BUNDLE = {...}` so index.html
                   works from file:// (Chrome blocks fetch() of local JSON files).

Every file carries a `meta` block: set, patch, source, updated, status.
Status values: "live" (verified on live servers), "pbe" (verified on PBE),
"preview" (official pre-release reveal / Dev Drop), "carryover" (verified for the
previous set; not yet confirmed for this set), "training-model" (simplified by this app),
"unverified" (no reliable source).
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'sources')
OUT = os.path.join(ROOT, 'data')
BUILD_DATE = '2026-11-17'
DATA_VERSION = '19.0-preview.1'


def load(name):
    with open(os.path.join(SRC, name), encoding='utf8') as f:
        return json.load(f)


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


NINJA_UNITS = 'https://tft.ninja/sets/19/units'
NINJA_TRAITS = 'https://tft.ninja/sets/19/traits'
NINJA_AUGS = 'https://tft.ninja/sets/19/augments'
DEV_DROP = 'Riot Games Set 19 Dev Drop (2026-11-15), transcribed by TFT Ninja'

ko = load('ko_map.json')
# Official LoL Korean champion names not present in the CDragon TFT tables (LoL client names)
KO_EXTRA = {'Karthus': '카서스', 'Akali (K/DA)': '아칼리 (K/DA)', 'Akali (True Damage)': '아칼리 (True Damage)'}

# ---------------------------------------------------------------- champions
champs_src = load('ninja_champs.json')
champions = []
for c in champs_src:
    k = (ko['champ'].get(c['name']) or [None])[0] or KO_EXTRA.get(c['name'])
    champions.append({
        'id': c['slug'],
        'name': c['name'],
        'nameKo': k,
        'cost': c['cost'],
        'traits': c['traits'],
        'role': c['role'],
        'effects': c['effects'],
        'unlock': c['unlock'],
        'unlockCondition': c['unlockCondition'],
        'status': 'preview',
    })

# ---------------------------------------------------------------- traits
traits_src = load('ninja_traits.json')
STAR_COUNT = {'K/DA'}  # Riot text: "release new songs based on their total star level"
ROTATING = {'Collab'}  # Riot text: "Each game a different set of champions gain the Collab trait!"
traits = []
for t in traits_src:
    tiers = [{'min': int(r['min']), 'effect': r['effect']} for r in t['tiers']]
    entry = {
        'id': t['slug'],
        'name': t['name'],
        'nameKo': (ko['trait'].get(t['name']) or [None])[0],
        'type': 'rotating' if t['name'] in ROTATING else ('unique' if t['unique'] else 'trait'),
        'description': t['description'],
        'countMode': 'stars' if t['name'] in STAR_COUNT else 'units',
        'tiers': tiers,
        'champions': t['champions'],
        'status': 'preview',
        'notes': [],
    }
    n = t['name']
    if n == 'Pentakill':
        # Dev Drop lists a second "7" row: "MOSH PIT!!!!!!!" = Prismatic version
        entry['tiers'] = tiers[:3]
        entry['prismatic'] = {'min': 7, 'effect': tiers[3]['effect'], 'requires': 'Prismatic Tour augment quest'}
        entry['notes'].append('Dev Drop에 7이 두 번 표기됨: 두 번째 행(MOSH PIT)은 프리즘 단계로 분리.')
    if n == 'True Damage':
        entry['tiers'] = [{'min': 3, 'effect': 'A-Side: ' + tiers[0]['effect'] + ' / B-Side: ' + tiers[2]['effect']},
                          {'min': 5, 'effect': 'A-Side: ' + tiers[1]['effect'] + ' / B-Side: ' + tiers[3]['effect']}]
        entry['sides'] = {'A': [r['effect'] for r in tiers[:2]], 'B': [r['effect'] for r in tiers[2:]]}
        entry['prismatic'] = {'min': None, 'effect': 'A: KNOW MY NAME / B: GIANTS (설명 참고)', 'requires': 'Prismatic Tour augment quest'}
        entry['notes'].append('기존 v0.1.0 데이터의 10 단계는 Dev Drop에 없음 → 제거. A/B 사이드 각각 3/5.')
    if n in ('Heartsteel', 'Ionic Spark', 'K/DA'):
        entry['prismaticEligible'] = True
    if n in ('Pentakill', 'True Damage'):
        entry['prismaticEligible'] = True
    if n == 'Rock':
        entry['notes'].append('Infernal Idol 강도는 Rock 챔피언 별 레벨에 비례(설명). 단계 활성은 유닛 수로 계산 — PBE에서 확인 필요.')
    if n == 'Collab':
        entry['notes'].append('게임마다 Collab 특성을 받는 챔피언이 바뀜. Dev Drop 기준 고정 보유자는 Sona뿐 → 팀 빌더에서 수동 지정 가능.')
    if n == 'Gu Feng':
        entry['notes'].append('4단계: 두 두루마리 중 하나를 선택, 하나는 레벨 11 경로를 연다(설명).')
    if not entry['description'] and tiers:
        entry['description'] = ' / '.join(r['effect'] for r in tiers)
    traits.append(entry)

# sanity: champion traits must exist
tnames = {t['name'] for t in traits}
for c in champions:
    for tr in c['traits']:
        assert tr in tnames, (c['name'], tr)

# ---------------------------------------------------------------- augments
augs_src = load('ninja_augs.json')
ECON = re.compile(r'\b(gold|interest|reroll|XP|level|loot orb|loot orbs)\b', re.I)
ITEMS = re.compile(r'\b(item|items|component|components|Anvil|Emblem|Spatula|Frying Pan|Thief|Gloves|Sword|Bow|Rod|Tear|Vest|Cloak|Belt|Artifact)\b', re.I)
COMBAT = re.compile(r'\b(Health|Attack Damage|Ability Power|Attack Speed|Armor|Magic Resist|Damage Amp|Durability|Omnivamp|shield|heal|Critical|Mana|team gains|Your team)\b', re.I)
UNITS = re.compile(r'\b(champion|champions|copy|copies|Duplicator|\d-cost)\b', re.I)
HP = re.compile(r'player Health', re.I)
augments = []
for a in augs_src:
    d = a['description']
    cats = []
    if ECON.search(d): cats.append('econ')
    if ITEMS.search(d): cats.append('items')
    if COMBAT.search(d): cats.append('combat')
    if UNITS.search(d): cats.append('units')
    if HP.search(d): cats.append('hp')
    if 'emblem' in a['tags'] or 'trait' in a['tags']: cats.append('trait')
    rel = sorted({t for t in tnames if re.search(r'(?<![A-Za-z])' + re.escape(t) + r'(?![A-Za-z])', d)})
    augments.append({
        'id': a['slug'], 'name': a['name'], 'tier': a['tier'], 'description': d,
        'kind': (a['tags'][0] if a['tags'] else 'general'),
        'categories': cats, 'relatedTraits': rel,
        'numbers': None, 'status': 'preview',
    })

# ---------------------------------------------------------------- items
cd = load('cdragon_items_live.json')
by_api = {i['apiName']: i for i in cd['items']}
COMPONENT_IDS = ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', 'TFT_Item_NeedlesslyLargeRod', 'TFT_Item_TearOfTheGoddess',
                 'TFT_Item_ChainVest', 'TFT_Item_NegatronCloak', 'TFT_Item_GiantsBelt', 'TFT_Item_SparringGloves',
                 'TFT_Item_Spatula', 'TFT_Item_FryingPan']
STAT_KO = {'AD': ('공격력', 100, '%'), 'AP': ('주문력', 1, ''), 'AS': ('공격 속도', 1, '%'), 'Armor': ('방어력', 1, ''),
           'MagicResist': ('마법 저항력', 1, ''), 'Health': ('체력', 1, ''), 'Mana': ('마나', 1, ''),
           'CritChance': ('치명타 확률', 1, '%'), 'BonusDamage': ('피해 증폭', 100, '%')}


def clean_desc(desc, effects):
    if not desc:
        return ''
    eff = {k.lower(): v for k, v in (effects or {}).items() if isinstance(v, (int, float))}

    def rep(m):
        expr = m.group(1)
        mult = 1
        if '*' in expr:
            expr, mm = expr.split('*', 1)
            try: mult = float(mm)
            except ValueError: mult = 1
        v = eff.get(expr.lower())
        if v is None:
            return '?'
        v = v * mult
        return str(int(round(v))) if abs(v - round(v)) < 0.05 else f'{v:.1f}'
    s = re.sub(r'@([A-Za-z0-9_*.]+)@', rep, desc)
    s = re.sub(r'@[^@\s]*@?', '', s)
    s = re.sub(r'%i:[^%]*%', '', s)
    s = re.sub(r'\{\{[^}]*\}\}', '', s)
    s = s.replace('<br>', ' ').replace('&nbsp;', ' ')
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def stat_line(effects):
    out = []
    for k, (label, mult, unit) in STAT_KO.items():
        v = (effects or {}).get(k)
        if isinstance(v, (int, float)) and v:
            vv = v * mult
            out.append(f'{label} +{int(round(vv)) if abs(vv-round(vv))<0.05 else round(vv,1)}{unit}')
    return ', '.join(out)


def iid(api):
    # id = slug of the English display name (apiNames are legacy, e.g. TFT_Item_RedBuff = Sunfire Cape)
    return slug(by_api[api]['name'].replace("'", ''))

items = []
for api in COMPONENT_IDS:
    i = by_api[api]
    items.append({'id': iid(api), 'apiName': api, 'name': i['name'], 'nameKo': i['nameKo'], 'type': 'component',
                  'recipe': None, 'stats': stat_line(i['effects']), 'description': clean_desc(i['descKo'], i['effects']),
                  'status': 'carryover'})
seen_names = set()
for api, i in sorted(by_api.items(), key=lambda kv: (kv[1]['name'] != kv[1]['name'], len(kv[0]))):
    if api in COMPONENT_IDS or i['name'] in seen_names:
        continue
    seen_names.add(i['name'])
    comp = i['composition']
    special = 'TFT_Item_Spatula' in comp or 'TFT_Item_FryingPan' in comp
    items.append({'id': iid(api), 'apiName': api, 'name': i['name'], 'nameKo': i['nameKo'],
                  'type': 'special' if special else 'completed',
                  'recipe': [iid(c) for c in comp], 'stats': stat_line(i['effects']),
                  'description': clean_desc(i['descKo'], i['effects']), 'status': 'carryover'})
# Emblems explicitly named in Set 19 Dev Drop augment text (recipe unpublished)
emb = sorted({m for a in augments for m in re.findall(r'(?:an?|1|2)\s+([A-Z][A-Za-z/&\- ]+?) Emblem', a['description'])})
emb = [e.strip() for e in emb if e.strip() in tnames]
for t in sorted(set(emb)):
    items.append({'id': slug(t) + '-emblem', 'apiName': None, 'name': t + ' Emblem', 'nameKo': None, 'type': 'emblem',
                  'grantsTrait': t, 'recipe': None, 'stats': '', 'description': f'장착한 챔피언이 {t} 특성을 얻습니다. (조합법 미공개)',
                  'status': 'preview'})
# Emblems for every non-unique trait (existence implied by "<Trait> Crown/Circlet" emblem augments) — mark unverified
named = {i['grantsTrait'] for i in items if i['type'] == 'emblem'}
emblem_aug_traits = {t for a in augments if a['kind'] == 'emblem' for t in a['relatedTraits']}
for t in sorted(emblem_aug_traits - named):
    tt = next(x for x in traits if x['name'] == t)
    if tt['type'] != 'trait':
        continue
    items.append({'id': slug(t) + '-emblem', 'apiName': None, 'name': t + ' Emblem', 'nameKo': None, 'type': 'emblem',
                  'grantsTrait': t, 'recipe': None, 'stats': '', 'description': f'장착한 챔피언이 {t} 특성을 얻습니다. (Emblem 증강 존재로 추정, 조합법 미공개)',
                  'status': 'unverified'})

# ---------------------------------------------------------------- shop odds & rules (Set 18 live carryover)
shop = {
    'meta': {'set': 18, 'appliesTo': 'Set 19 (가정: 세트 간 유지되는 핵심 규칙)', 'patch': '18.3 (Set 18)',
             'source': ['https://tft.ninja/guides/advanced/roll-odds (updated 2026-11-08, "Set 18 values as of patch 18.3")',
                        'https://tft.ninja/guides/game-mechanics/champions/champion-pool (updated 2026-10-06, Set 18)'],
             'updated': '2026-11-08', 'status': 'carryover',
             'note': 'Set 19 상점 확률/풀 크기는 아직 공개되지 않음. 19.1 패치 노트 또는 PBE 데이터로 교체 필요.'},
    'odds': {
        '1': [100, 0, 0, 0, 0], '2': [100, 0, 0, 0, 0], '3': [75, 25, 0, 0, 0], '4': [55, 30, 15, 0, 0],
        '5': [45, 33, 20, 2, 0], '6': [30, 40, 25, 5, 0], '7': [16, 30, 43, 10, 1], '8': [15, 20, 32, 30, 3],
        '9': [10, 17, 25, 33, 15], '10': [5, 10, 20, 40, 25], '11': [1, 2, 12, 50, 35]},
    'oddsNotes': {'1': '원 표에는 레벨 2부터 표기 — 레벨 1은 레벨 2와 동일하다고 가정(훈련용).'},
    'poolSize': {'1': 30, '2': 25, '3': 18, '4': 10, '5': 9, '7': None},
    'poolNotes': {'7': 'Set 19의 7코스트(Baron Nashor, Rakan, Smeech, Sona)는 모두 해금형이며 상점 등장 확률/풀 크기 미공개.'},
}
rules = {
    'meta': {'set': 18, 'appliesTo': 'Set 19 (가정)', 'patch': '18.1–18.6 (Set 18)',
             'source': ['https://tft.ninja/guides/game-mechanics/economy (updated 2026-11-07)',
                        'https://tft.ninja/guides/game-mechanics/leveling (updated 2026-11-08)',
                        'https://tft.ninja/guides/game-mechanics/player-damage-calculation (updated 2026-10-06, patch 18.1)',
                        'https://tft.ninja/guides/game-mechanics/stages (updated 2026-09-28)',
                        'https://tft.ninja/guides/game-mechanics/champions/star-levels',
                        'https://tft.ninja/guides/augments/overview',
                        'https://tft.ninja/guides/getting-started/the-board',
                        'https://wiki.leagueoflegends.com/en-us/TFT:Gold',
                        'https://wiki.leagueoflegends.com/en-us/TFT:Experience'],
             'updated': '2026-11-08', 'status': 'carryover',
             'note': 'Riot은 "경제·레벨·상점·회전초밥 규칙은 새 세트에서도 대부분 유지"된다고 안내(출처: tft.ninja Set 19 release-date). Set 19 수치는 19.1 패치 노트로 재검증 필요.'},
    'startingHp': 100,
    'boardRows': 4, 'boardCols': 7, 'benchSize': 9, 'maxItemsPerUnit': 3,
    'xpPerBuy': 4, 'xpBuyCost': 4, 'rerollCost': 2, 'passiveXpPerRound': 2,
    'passiveXpNote': 'Stage 1 PvE 라운드부터 매 라운드 종료 시 2 XP.',
    'xpToNext': {'1': 2, '2': 2, '3': 6, '4': 10, '5': 20, '6': 36, '7': 56, '8': 68, '9': 68, '10': None},
    'xpNotes': {'1': '레벨 1→2: 첫 PvE 라운드 후 자동(위키: "After the first wave") — 2 XP로 모델링.',
                '7': '7→8 = 56 XP (patch 18.2 기준, tft.ninja). LoL 위키 표는 60으로 표기 → 최신 출처(56) 채택.',
                '10': '레벨 11은 XP가 아닌 보너스 레벨 효과로만 도달(Set 19: Gu Feng 4단계 두루마리 경로 언급).'},
    'maxLevel': 11, 'maxLevelByXp': 10,
    'passiveIncome': {'default': 5, 'byRound': {'1-2': 2, '1-3': 2, '1-4': 3, '2-1': 4}},
    'interest': {'per': 10, 'max': 5, 'timing': '라운드 종료 시 보유 골드 기준(패시브 수입 전)'},
    'streakGold': [{'min': 3, 'max': 4, 'gold': 1}, {'min': 5, 'max': 5, 'gold': 2}, {'min': 6, 'max': 99, 'gold': 3}],
    'streakNote': '연승/연패 동일 표. PvE 라운드에서도 연속 보너스 지급(연속 기록은 유지).',
    'pvpWinGold': 1,
    'stageDamage': {'1': 0, '2': 2, '3': 5, '4': 8, '5': 10, '6': 12, '7': 17},
    'unitDamage': 'surviving enemy units × 1 (별/코스트 무관)',
    'sell': {'oneStar': 'full', 'oneCost': 'full', 'upgraded': 'invested-1'},
    'combine': 3,
    'rounds': {'stage1': ['carousel', 'pve', 'pve', 'pve'],
               'stageN': ['pvp', 'pvp', 'pvp', 'carousel', 'pvp', 'pvp', 'pve']},
    'augmentRounds': ['2-1', '3-2', '4-2'],
    'carouselGivesIncome': False, 'carouselGivesXp': False,
    'carouselNote': '회전초밥 라운드의 수입/XP 지급 여부는 출처에 명시되지 않음(unverified). "계획 단계 시작 시 수입"(위키)과 "무료 XP만으로 3-2에 5레벨"(tft.ninja) 문구와 일치하도록 둘 다 false로 설정 — PBE/라이브에서 확인 후 수정.',
    'unlockShopRule': '해금 조건 달성 시 다음 상점에 해당 챔피언 1장 보장(Riot Set 19 공지).',
}

# ---------------------------------------------------------------- patch info
patch = {
    'schemaVersion': 2,
    'dataVersion': DATA_VERSION,
    'set': 19, 'setName': 'Prismatic Tour',
    'targetPatch': '19.2',
    'currentDataPatch': 'Set 19 Dev Drop (pre-PBE)',
    'built': BUILD_DATE,
    'statusLegend': {
        'live': '라이브 서버 패치로 검증됨', 'pbe': 'PBE 데이터로 검증됨', 'preview': 'Riot 사전 공개(Dev Drop) — 수치 미공개/변경 가능',
        'carryover': '이전 세트(Set 18) 라이브 값 — Set 19 미확인', 'training-model': '이 앱의 단순화 모델', 'unverified': '신뢰 가능한 출처 없음'},
    'schedule': [
        {'patch': '18.6', 'date': '2026-11-04', 'what': 'Set 18 마지막 정규 패치(라이브)', 'confirmed': True},
        {'patch': 'Dev Drop', 'date': '2026-11-15', 'what': 'Set 19 챔피언 94 / 특성 47 / 증강 330 공개', 'confirmed': True},
        {'patch': 'PBE', 'date': '2026-11-17', 'what': 'Set 19 PBE (추정, Riot 미발표)', 'confirmed': False},
        {'patch': '19.1', 'date': '2026-12-02', 'what': 'Set 19 라이브 출시', 'confirmed': True},
        {'patch': '19.2', 'date': '2026-12-15', 'what': '첫 밸런스 패치 — 대회 기준 패치', 'confirmed': False},
    ],
    'sources': [
        {'name': 'TFT Ninja — Set 19 champions (Riot Dev Drop 2026-11-15)', 'url': NINJA_UNITS, 'used': 'champions'},
        {'name': 'TFT Ninja — Set 19 traits', 'url': NINJA_TRAITS, 'used': 'traits'},
        {'name': 'TFT Ninja — Set 19 augments (330)', 'url': NINJA_AUGS, 'used': 'augments'},
        {'name': 'TFT Ninja — Set 19 release date & patch schedule', 'url': 'https://tft.ninja/guides/news/set-19-release-date', 'used': 'schedule'},
        {'name': 'CommunityDragon — TFT en_us/ko_kr (live 16.22 / Set 18)', 'url': 'https://raw.communitydragon.org/latest/cdragon/tft/en_us.json', 'used': 'items, Korean names'},
        {'name': 'CommunityDragon PBE (16.23) — Set 19 미포함(2026-11-17 확인)', 'url': 'https://raw.communitydragon.org/pbe/cdragon/tft/en_us.json', 'used': 'verification'},
        {'name': 'League of Legends Wiki — TFT:Gold, TFT:Experience', 'url': 'https://wiki.leagueoflegends.com/en-us/TFT:Gold', 'used': 'rules cross-check'},
        {'name': 'TFT Ninja — mechanics guides (Set 18)', 'url': 'https://tft.ninja/guides/game-mechanics', 'used': 'rules'},
        {'name': 'Blitz.gg — Set 19 champions/traits/unlocks', 'url': 'https://blitz.gg/tft/articles/tft-set-19-champions-traits-unlocks', 'used': 'cross-check'},
    ],
    'changelog': [
        {'version': DATA_VERSION, 'date': BUILD_DATE, 'changes': [
            '챔피언 94명: Dev Drop 원문과 대조 — v0.1.0 데이터와 코스트/특성/역할/해금 여부 100% 일치 확인',
            '해금 조건 텍스트(36명) 추가, 한국어 챔피언명 93명 추가(CommunityDragon ko_kr 대조 90 + LoL 공식명 3, Locke는 미확인)',
            '특성 47개: 설명/단계별 효과 원문 추가. True Damage 10단계 제거(원문에 없음, A/B 사이드 3/5)',
            'Collab: 고유 특성(1) → 순환 특성(3/5)으로 수정, Pentakill 프리즘 7 단계 분리',
            'K/DA: 유닛 수가 아닌 "총 별 레벨" 기준 집계로 수정',
            '증강 20개 예시 → 330개 전체(실버 84/골드 137/프리즘 109) 원문 설명',
            '상점 확률 수정: v0.1.0 값(출처 불명) → Set 18 patch 18.3 공개 값. 예: Lv7 16/30/43/10/1, Lv8 15/20/32/30/3',
            'XP 표 수정: 8→9 80→68, 9→10 100→68 (Set 18 기준)',
            '경제 규칙 수정: 연승 보너스 3-4:1 / 5:2 / 6+:3, 승리 +1, 스테이지별 기본 수입·피해 추가',
            '아이템: 표준 조합표 55종(Set 18 라이브 CDragon) + Set 19 상징(조합법 미공개)',
        ]},
        {'version': '0.1.0', 'date': '2026-11-15', 'changes': ['최초 사전 공개 스냅샷(챔피언 94, 특성 브레이크포인트, 증강 예시 20)']},
    ],
}

meta_common = lambda **kw: dict(set=19, **kw)
files = {
    'patch-info.json': patch,
    'champions.json': {'meta': meta_common(patch='Dev Drop (pre-PBE)', source=[DEV_DROP, NINJA_UNITS, 'Korean names: CommunityDragon ko_kr'], updated='2026-11-15', status='preview', count=len(champions)), 'champions': champions},
    'traits.json': {'meta': meta_common(patch='Dev Drop (pre-PBE)', source=[DEV_DROP, NINJA_TRAITS], updated='2026-11-15', status='preview', count=len(traits), note='수치(%/스탯)는 Dev Drop에서 비공개. 단계(브레이크포인트)만 사용.'), 'traits': traits},
    'augments.json': {'meta': meta_common(patch='Dev Drop (pre-PBE)', source=[DEV_DROP, NINJA_AUGS], updated='2026-11-15', status='preview', count=len(augments), note='categories는 설명문 키워드 기반 자동 분류(training-model). 수치 미공개.'), 'augments': augments},
    'items.json': {'meta': meta_common(patch='16.22 live (Set 18) + Set 19 emblem names', source=[cd['source'], 'Set 19 emblems: augment text in ' + NINJA_AUGS], updated='2026-11-17', status='carryover', count=len(items), note='표준 아이템 조합표는 Set 18 라이브 기준. Set 19에서 교체/조정될 수 있음.'), 'items': items},
    'shop-odds.json': shop,
    'game-rules.json': rules,
}
os.makedirs(OUT, exist_ok=True)
for name, obj in files.items():
    with open(os.path.join(OUT, name), 'w', encoding='utf8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
bundle = {k.replace('.json', ''): v for k, v in files.items()}
with open(os.path.join(OUT, 'bundle.js'), 'w', encoding='utf8') as f:
    f.write('/* AUTO-GENERATED by tools/build_data.py — edit data/*.json then rebuild, or import JSON in the app. */\n')
    f.write('window.TFT_DATA_BUNDLE=' + json.dumps(bundle, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('champions', len(champions), 'traits', len(traits), 'augments', len(augments), 'items', len(items))
print('emblems', [i['name'] for i in items if i['type'] == 'emblem'])
print('special', [i['name'] for i in items if i['type'] == 'special'])
