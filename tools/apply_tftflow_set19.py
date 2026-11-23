#!/usr/bin/env python3
"""Apply verified Set 19 PBE rule tables (tftflow.com, "Patch 19.1") to data/:
  - data/encounters.json  (opening encounters: odds, host champion, description, simulator effect)
  - data/game-rules.json  (Stage 1 = encounter + PvE, no 1-1 carousel; stage damage; XP; augment tier sequences;
                           carousel sizes/arrangements; Gold Subscription / Beat Drop tables)
  - data/shop-odds.json   (shop odds incl. level 1, pool sizes incl. 7-cost)
Source snapshot: tools/sources/tftflow_set19_20261123.json
Run, then: python3 tools/build_bundle.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
SNAP = os.path.join(ROOT, 'tools/sources/tftflow_set19_20261123.json')
snap = json.load(open(SNAP, encoding='utf8'))
champs = json.load(open(os.path.join(DATA, 'champions.json'), encoding='utf8'))['champions']
names = sorted(((c['name'], c['id']) for c in champs), key=lambda x: -len(x[0]))
SRC = [snap['source'], 'https://tftflow.com/tables/set19']

# simulator effects (what the app applies automatically); text stays the source of truth
EFFECTS = {
    'Augment Crescendo': {'type': 'augment-tiers', 'tiers': ['Silver', 'Gold', 'Prismatic']},
    'Cheaper Levels': {'type': 'cheaper-levels', 'xp': 2},
    'Golden Gala': {'type': 'augment-tiers', 'tiers': ['Gold', 'Gold', 'Gold']},
    'Scouting Party': {'type': 'augment-rerolls', 'extra': 1},
    'Completed Item Anvil': {'type': 'grant', 'at': 'start', 'items': [['completed', 1]]},
    'Component Anvils': {'type': 'grant', 'at': 'start', 'items': [['component', 2]]},
    'Gold Subscription': {'type': 'gold-subscription'},
    'Golden Finale': {'type': 'augment-tiers', 'tiers': [None, None, 'Gold']},
    'Golden Prelude': {'type': 'augment-tiers', 'tiers': ['Gold', None, None]},
    "Gwen's Gifts": {'type': 'after-carousels', 'count': 2, 'items': [['component', 1]], 'note': '특수 가위(아이템 제거) 포함 — 시뮬레이터는 재료만 지급'},
    'Item Forge': {'type': 'grant', 'at': '3-3', 'items': [['completed', 2]], 'note': '재조합기 2개 포함 — 시뮬레이터는 완성 아이템만 지급'},
    'Reroll Subscription': {'type': 'reroll-subscription', 'count': None, 'note': '스테이지당 무료 새로고침 횟수 미공개 → 시뮬레이터 훈련값 2회'},
    'Scuttle Party': {'type': 'pve-bonus', 'note': '추가 전리품 게 — 정확한 보상 미공개 → 시뮬레이터 PvE마다 재료 +1(훈련값)'},
    '2 Cost Start': {'type': 'starting-champion', 'cost': 2},
    '3 Cost Start': {'type': 'starting-champion', 'cost': 3},
    'Upgraded Start': {'type': 'starting-champion', 'star': 2},
    'Beat Drop': {'type': 'beat-drop', 'hp': 40},
    'Emblem Ensemble': {'type': 'grant', 'at': 'start', 'items': [['emblem', 3]]},
    'Prismatic Finale': {'type': 'augment-tiers', 'tiers': [None, None, 'Prismatic']},
    'Prismatic Opener': {'type': 'augment-tiers', 'tiers': ['Prismatic', None, None]},
    'Prismatic Party': {'type': 'augment-tiers', 'tiers': ['Prismatic', 'Prismatic', 'Prismatic']},
    'Star Attraction': {'type': 'star-attraction', 'cost': 5, 'fieldableFrom': '4-6'},
    'Superstar': {'type': 'superstar', 'every': 2},
    'Lucky Treasure': {'type': 'grant', 'at': '3-5', 'items': [['radiant', 1]], 'note': 'Radiant Lucky Item Chest 내용 미공개 → 시뮬레이터 무작위 찬란한 아이템 1개'},
    'Prismatic Tour': {'type': 'prismatic-tour', 'tiers': ['Prismatic', 'Prismatic', 'Prismatic'], 'units': 3,
                       'bands': ['Pentakill', 'Ionic Spark', 'True Damage', 'Heartsteel', 'K/DA']},
}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '')).strip('-')


encs = []
for e in snap['encounters']:
    host = next(((n, i) for n, i in names if e['description'].startswith(n + ' ') or e['description'].startswith(n + "'")), None)
    if not host and re.match(r'Akali\b', e['description']):
        host = ('Akali', None)  # text does not say which Akali (K/DA or True Damage)
    encs.append({'id': slug(e['name']), 'name': e['name'], 'odds': e['odds'], 'description': e['description'],
                 'host': host[0] if host else None, 'hostChamp': host[1] if host else None,
                 'effect': EFFECTS.get(e['name'], {'type': 'none', 'note': '시뮬레이터 자동 적용 없음'}), 'status': 'pbe'})
encs.sort(key=lambda x: -x['odds'])
json.dump({'meta': {'set': 19, 'patch': '19.1 (PBE)', 'source': SRC, 'updated': snap['fetched'], 'status': 'pbe', 'count': len(encs),
                    'note': '게임 시작(1-1)에 조우자 1명이 무작위로 등장해 그 판 전체 규칙을 바꿈. Set 19 표에는 "조우자 없음" 항목이 없음(합계 99.94%). Set 19에는 1-1 회전초밥이 없음(회전초밥 표가 Stage 2부터).',
                    'oddsSum': round(sum(e['odds'] for e in encs), 2)},
           'encounters': encs}, open(os.path.join(DATA, 'encounters.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# ---- shop odds / pool
so = json.load(open(os.path.join(DATA, 'shop-odds.json'), encoding='utf8'))
so['odds'] = {k: v for k, v in snap['shopOdds'].items()}
so['poolSize'] = {k: v['bag'] for k, v in snap['pool'].items()}
so['poolDetail'] = snap['pool']
so['oddsNotes'] = {}
so['poolNotes'] = {'7': '7코스트 4명은 모두 해금형. 장당 9장(풀 36장). 상점 확률표(1~5코스트)에는 7코스트 행이 없어 시뮬레이터 일반 상점에서는 제외.'}
so['meta'] = {'set': 19, 'patch': '19.1 (PBE)', 'source': SRC, 'updated': snap['fetched'], 'status': 'pbe',
              'note': 'Set 19 PBE 표 기준. 상점 확률은 Set 18과 동일, 레벨 1 = 1코스트 100% 확인, 7코스트 풀 9장 확인.'}
json.dump(so, open(os.path.join(DATA, 'shop-odds.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# ---- game rules
gr = json.load(open(os.path.join(DATA, 'game-rules.json'), encoding='utf8'))
gr['xpToNext'] = {**{k: v for k, v in snap['xpToNext'].items()}, '10': None}
gr['xpNotes'] = {'1': '레벨 1→2: 2 XP (Set 19 표).', '7': '7→8 = 60 XP (Set 19 표). 이전 데이터의 56(Set 18 18.2 기준 tft.ninja)은 Set 19에서 60으로 확인.',
                 '10': '레벨 11은 XP가 아닌 효과로만 도달(Gu Feng 4단계 두루마리 경로).'}
gr['stageDamage'] = {'1': 0, **{k: v for k, v in snap['stageDamage'].items()}}
gr['rounds'] = {'stage1': ['encounter', 'pve', 'pve', 'pve'], 'stageN': ['pvp', 'pvp', 'pvp', 'carousel', 'pvp', 'pvp', 'pve']}
gr['roundNotes'] = {'1-1': '조우자(Opening Encounter) 등장 + 시작 챔피언 지급. 1-1 회전초밥 없음(Set 19 회전초밥 표는 Stage 2~7).',
                    'startingChampion': '기본 시작 챔피언 = 무작위 1코스트 1명 — "2 Cost Start / 3 Cost Start / Upgraded Start / Superstar" 조우자 문구("your starting champion")에서 추론. 정확한 선정 규칙은 미공개.'}
gr['carouselGivesIncome'] = False
gr['carouselGivesXp'] = False
gr['carousel'] = {k: v for k, v in snap['carousel'].items()}
gr['carouselNote'] = '회전초밥: Stage 2~7의 x-4. 챔피언 수(9/11/13)와 구성·아이템 배열 확률은 표 기준. "Stage N Normal" 배열의 코스트 구성은 미공개 → 시뮬레이터는 스테이지별 근사 코스트 사용.'
gr['augmentTierSequences'] = snap['augmentTierSequences']
gr['augmentNote'] = '증강 등급은 게임 시작 시 3라운드(2-1/3-2/4-2) 등급 조합 하나가 가중치로 정해짐(18개 조합, 총 가중치 109). 첫 증강: 골드 65.1% · 실버 25.7% · 프리즘 9.2%.'
gr['goldSubscription'] = snap['goldSubscription']
gr['beatDrop'] = snap['beatDrop']
gr['meta'] = {'set': 19, 'patch': '19.1 (PBE)', 'source': SRC + ['기본 수입·이자·연속 보너스·판매가: Set 18 출처 유지(carryover)'], 'updated': snap['fetched'], 'status': 'pbe',
              'note': 'Stage 1 구조·피해·XP·증강 등급·회전초밥·조우자 표는 Set 19 PBE 표로 갱신. 기본 수입·이자·연속 보너스·판매가는 Set 19 표가 없어 Set 18 값 유지.'}
json.dump(gr, open(os.path.join(DATA, 'game-rules.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('encounters', len(encs), '· hosts', sum(1 for e in encs if e['hostChamp']), '· unmapped hosts', [e['name'] for e in encs if not e['hostChamp'] and e['description'][0].isupper() and not e['description'].startswith(('Gain', 'Start', 'All', 'After', 'On ', 'The '))])
