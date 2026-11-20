#!/usr/bin/env python3
"""Update data/*.json + data/bundle.js from CommunityDragon (PBE or live).

  python3 tools/update_from_cdragon.py --check                 # exit 0 if Set 19 is present, 3 if not
  python3 tools/update_from_cdragon.py                         # download PBE, merge, write data/
  python3 tools/update_from_cdragon.py --channel latest --status live --patch "19.1 live"
  python3 tools/update_from_cdragon.py --mutator TFTSet18 --out /tmp/x   # pipeline dry run on another set

Merge policy (고증 우선):
- Champions/traits/augments/items come from CDragon (game files) → status = pbe|live.
- Curated fields CDragon does not carry are kept from the current data when the name matches:
  Korean names, unlock flag/condition (Dev Drop), effects tags, trait type/countMode/notes/prismatic info.
- Entries that exist only in the old data are dropped and listed in the changelog; new entries are added.
- shop-odds.json / game-rules.json are NOT in CDragon → kept as is (still 'carryover' until patch notes confirm).
"""
import argparse, json, os, re, sys, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
TODAY = datetime.date.today().isoformat()
BASE = 'https://raw.communitydragon.org/{ch}/'


def fnv(s):
    h = 0x811c9dc5
    for c in s.lower().encode():
        h = ((h ^ c) * 0x01000193) & 0xffffffff
    return '{%08x}' % h


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '')).strip('-')


def fetch_json(url, cache):
    if cache and os.path.exists(cache):
        return json.load(open(cache, encoding='utf8'))
    req = urllib.request.Request(url, headers={'User-Agent': 'tft-tournament-lab-updater'})
    with urllib.request.urlopen(req, timeout=300) as r:
        raw = r.read()
    if cache:
        open(cache, 'wb').write(raw)
    return json.loads(raw)


def resolve(desc, variables):
    """Replace @Var@ / @Var*100@ using names or FNV-1a hashed names; strip markup."""
    if not desc:
        return ''
    v = {}
    for k, val in (variables or {}).items():
        if isinstance(val, list):
            val = val[1] if len(val) > 1 else (val[0] if val else None)
        if isinstance(val, (int, float)):
            v[k.lower()] = val
    def rep(m):
        name, mul = m.group(1), m.group(2)
        val = v.get(name.lower())
        if val is None:
            val = v.get(fnv(name))
        if val is None:
            return '?'
        x = val * (float(mul) if mul else 1)
        return str(int(round(x))) if abs(x - round(x)) < 0.05 else f'{x:.1f}'
    s = re.sub(r'@([A-Za-z0-9_.]+)(?:\*([0-9.]+))?@', rep, desc)
    s = re.sub(r'@[^@\s]*@?', '?', s)
    s = re.sub(r'%i:[^%]*%', '', s)
    s = re.sub(r'\{\{[^}]*\}\}', '', s)
    s = s.replace('<br>', ' ').replace('&nbsp;', ' ').replace('\\n', ' ').replace('\n', ' ')
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def trait_rows(desc):
    """Split CDragon trait desc into (intro, [row templates])."""
    rows = re.findall(r'<row>(.*?)</row>', desc or '', re.S)
    intro = re.split(r'<row>', desc or '')[0]
    return intro, rows


def tier_of(aug):
    key = (aug.get('icon') or '').lower().rsplit('/', 1)[-1] + ' ' + aug.get('apiName', '').lower()
    if re.search(r'(_|-)iii\b|(_|-)iii\.|t3\b|-t3|_t3|prismatic', key):
        return 'Prismatic'
    if re.search(r'(_|-)ii\b|(_|-)ii\.|t2\b|-t2|_t2', key):
        return 'Gold'
    if re.search(r'(_|-)i\b|(_|-)i\.|t1\b|-t1|_t1', key):
        return 'Silver'
    return None


ECON = re.compile(r'\b(gold|interest|reroll|XP|level|loot orb|loot orbs)\b', re.I)
ITEMS = re.compile(r'\b(item|items|component|components|Anvil|Emblem|Spatula|Frying Pan|Thief|Gloves|Sword|Bow|Rod|Tear|Vest|Cloak|Belt|Artifact)\b', re.I)
COMBAT = re.compile(r'\b(Health|Attack Damage|Ability Power|Attack Speed|Armor|Magic Resist|Damage Amp|Durability|Omnivamp|shield|heal|Critical|Mana|team gains|Your team)\b', re.I)
UNITS = re.compile(r'\b(champion|champions|copy|copies|Duplicator|\d-cost)\b', re.I)
HP = re.compile(r'player Health', re.I)


def categories(d, kind):
    c = []
    if ECON.search(d): c.append('econ')
    if ITEMS.search(d): c.append('items')
    if COMBAT.search(d): c.append('combat')
    if UNITS.search(d): c.append('units')
    if HP.search(d): c.append('hp')
    if kind in ('emblem', 'trait'): c.append('trait')
    return c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--channel', default='pbe', choices=['pbe', 'latest'])
    ap.add_argument('--mutator', default='TFTSet19')
    ap.add_argument('--status', default=None, help='pbe|live (default: pbe for pbe channel, live for latest)')
    ap.add_argument('--patch', default=None)
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--cache', default=None, help='directory to cache downloaded json')
    ap.add_argument('--out', default=DATA)
    a = ap.parse_args()
    status = a.status or ('pbe' if a.channel == 'pbe' else 'live')
    cache = a.cache
    if cache:
        os.makedirs(cache, exist_ok=True)
    base = BASE.format(ch=a.channel)
    meta = fetch_json(base + 'content-metadata.json', None)
    version = meta.get('version', '?')
    en = fetch_json(base + 'cdragon/tft/en_us.json', cache and os.path.join(cache, f'{a.channel}_en_{version.split("+")[0]}.json'))
    sd = next((s for s in en['setData'] if s.get('mutator') == a.mutator), None)
    if not sd:
        print(f'NOT_FOUND {a.mutator} in {a.channel} {version}; available: {sorted({s["mutator"] for s in en["setData"]})[-6:]}')
        sys.exit(3)
    print(f'FOUND {a.mutator} in {a.channel} {version}: {len(sd["champions"])} units, {len(sd["traits"])} traits, {len(sd.get("augments", []))} augments')
    if a.check:
        sys.exit(0)
    ko = fetch_json(base + 'cdragon/tft/ko_kr.json', cache and os.path.join(cache, f'{a.channel}_ko_{version.split("+")[0]}.json'))
    ko_items = {i['apiName']: i for i in ko['items']}
    ko_sd = next((s for s in ko['setData'] if s.get('mutator') == a.mutator), {'champions': [], 'traits': []})
    ko_ch = {c['apiName']: c for c in ko_sd['champions']}
    ko_tr = {t['apiName']: t for t in ko_sd['traits']}
    items_by = {i['apiName']: i for i in en['items']}

    old = {f: json.load(open(os.path.join(DATA, f + '.json'), encoding='utf8')) for f in ['patch-info', 'champions', 'traits', 'items', 'augments', 'shop-odds', 'game-rules']}
    o_ch = {c['name'].lower(): c for c in old['champions']['champions']}
    o_tr = {t['name'].lower(): t for t in old['traits']['traits']}
    o_au = {a2['name'].lower(): a2 for a2 in old['augments']['augments']}
    patch = a.patch or f'{a.mutator} {status.upper()} (CDragon {version.split("+")[0]})'

    # ---------- traits ----------
    traits = []
    for t in sd['traits']:
        intro, rows = trait_rows(t.get('desc'))
        effs = sorted(t.get('effects') or [], key=lambda e: e.get('minUnits', 0))
        tiers, prism = [], []
        seen = set()
        for i, e in enumerate(effs):
            mn = e.get('minUnits') or 0
            if mn < 1:
                continue
            row = rows[i] if i < len(rows) else (rows[-1] if rows else '')
            text = resolve(row.replace('@MinUnits@', str(mn)), e.get('variables'))
            text = re.sub(r'^\(\s*\d+\s*\)\s*', '', text)
            (prism if mn in seen else tiers).append({'min': mn, 'effect': text})
            seen.add(mn)
        prev = o_tr.get(t['name'].lower(), {})
        unique = len(tiers) == 1 and tiers[0]['min'] == 1
        entry = {
            'id': prev.get('id') or slug(t['name']), 'name': t['name'],
            'nameKo': (ko_tr.get(t['apiName']) or {}).get('name') or prev.get('nameKo'),
            'type': prev.get('type') or ('unique' if unique else 'trait'),
            'description': resolve(intro, (effs[0] if effs else {}).get('variables')) or prev.get('description', ''),
            'countMode': prev.get('countMode', 'units'),
            'tiers': tiers or [{'min': 1, 'effect': ''}],
            'champions': [], 'status': status, 'apiName': t['apiName'],
            'notes': [n for n in prev.get('notes', []) if 'Dev Drop' not in n],
        }
        if prism:
            entry['prismatic'] = {'min': prism[0]['min'], 'effect': prism[0]['effect'], 'requires': 'Prismatic Tour augment quest'}
        elif prev.get('prismatic'):
            entry['prismatic'] = prev['prismatic']
        for k in ('prismaticEligible', 'sides'):
            if k in prev:
                entry[k] = prev[k]
        if '?' in ' '.join(r['effect'] for r in entry['tiers']):
            entry['notes'].append('일부 수치는 게임 파일에서 계산식으로만 제공돼 "?"로 표시.')
        traits.append(entry)
    tnames = {t['name'] for t in traits}

    # ---------- champions ----------
    champs, seen_ids = [], set()
    for c in sd['champions']:
        if not c.get('traits') or not (1 <= (c.get('cost') or 0) <= 10) or not all(t in tnames for t in c['traits']):
            continue
        prev = o_ch.get(c['name'].lower(), {})
        cid = prev.get('id') or slug(c['name'])
        while cid in seen_ids:
            cid += '-2'
        seen_ids.add(cid)
        ab = c.get('ability') or {}
        st = c.get('stats') or {}
        champs.append({
            'id': cid, 'name': c['name'],
            'nameKo': (ko_ch.get(c['apiName']) or {}).get('name') or prev.get('nameKo'),
            'cost': c['cost'], 'traits': c['traits'], 'role': prev.get('role') or (c.get('role') or ''),
            'effects': prev.get('effects', []),
            'unlock': prev.get('unlock', False), 'unlockCondition': prev.get('unlockCondition'),
            'status': status, 'apiName': c['apiName'],
            'stats': {k: st.get(k2) for k, k2 in [('hp', 'hp'), ('ad', 'damage'), ('as', 'attackSpeed'), ('armor', 'armor'), ('mr', 'magicResist'), ('mana', 'mana'), ('initialMana', 'initialMana'), ('range', 'range')]},
            'ability': {'name': ab.get('name'), 'desc': resolve(ab.get('desc'), {v['name']: v.get('value') for v in ab.get('variables', [])})} if ab else None,
        })
    for t in traits:
        t['champions'] = [c['name'] for c in champs if t['name'] in c['traits']]

    # ---------- augments ----------
    augs, seen_ids = [], set()
    tn_by_api = {t['apiName']: t['name'] for t in traits}
    for aid in sd.get('augments', []):
        it = items_by.get(aid)
        if not it or not it.get('name'):
            continue
        prev = o_au.get(it['name'].lower(), {})
        desc = resolve(it.get('desc'), it.get('effects'))
        tier = prev.get('tier') or tier_of(it)
        rel = sorted({tn_by_api[x] for x in it.get('associatedTraits') or [] if x in tn_by_api} | {t for t in tnames if re.search(r'(?<![A-Za-z])' + re.escape(t) + r'(?![A-Za-z])', desc)})
        kind = prev.get('kind') or ('emblem' if 'Emblem' in desc and rel else 'trait' if it.get('associatedTraits') else 'general')
        aid2 = prev.get('id') or slug(it['name'])
        while aid2 in seen_ids:
            aid2 += '-2'
        seen_ids.add(aid2)
        augs.append({'id': aid2, 'name': it['name'], 'nameKo': (ko_items.get(aid) or {}).get('name'), 'tier': tier or 'Silver',
                     'tierStatus': 'dev-drop' if prev.get('tier') else ('icon-pattern' if tier else 'unknown'),
                     'description': desc or prev.get('description', ''), 'descriptionKo': resolve((ko_items.get(aid) or {}).get('desc'), it.get('effects')) or None,
                     'kind': kind, 'categories': categories(desc, kind), 'relatedTraits': rel,
                     'numbers': {k: v for k, v in (it.get('effects') or {}).items() if isinstance(v, (int, float))} or None,
                     'status': status, 'apiName': aid})

    # ---------- items (standard + emblems in this set) ----------
    comp_ids = ['TFT_Item_BFSword', 'TFT_Item_RecurveBow', 'TFT_Item_NeedlesslyLargeRod', 'TFT_Item_TearOfTheGoddess', 'TFT_Item_ChainVest', 'TFT_Item_NegatronCloak', 'TFT_Item_GiantsBelt', 'TFT_Item_SparringGloves', 'TFT_Item_Spatula', 'TFT_Item_FryingPan']
    comp_name = {items_by[c]['name']: c for c in comp_ids if c in items_by}
    set_items = [items_by[x] for x in sd.get('items', []) if x in items_by]
    def iid(name):
        return slug(name)
    out_items, names, recipes = [], set(), set()
    def stat_line(eff):
        lab = {'AD': ('공격력', 100, '%'), 'AP': ('주문력', 1, ''), 'AS': ('공격 속도', 1, '%'), 'Armor': ('방어력', 1, ''), 'MagicResist': ('마법 저항력', 1, ''), 'Health': ('체력', 1, ''), 'Mana': ('마나', 1, ''), 'CritChance': ('치명타 확률', 1, '%'), 'BonusDamage': ('피해 증폭', 100, '%')}
        o = []
        for k, (l, m, u) in lab.items():
            v = (eff or {}).get(k)
            if isinstance(v, (int, float)) and v:
                x = v * m
                o.append(f'{l} +{int(round(x)) if abs(x - round(x)) < 0.05 else round(x, 1)}{u}')
        return ', '.join(o)
    for c in comp_ids:
        it = items_by.get(c)
        if not it:
            continue
        k = ko_items.get(c, {})
        out_items.append({'id': iid(it['name']), 'apiName': c, 'name': it['name'], 'nameKo': k.get('name'), 'type': 'component', 'recipe': None, 'stats': stat_line(it.get('effects')), 'description': resolve(k.get('desc') or it.get('desc'), it.get('effects')), 'status': status})
        names.add(it['name'])
    pool = set_items if set_items else [i for i in en['items'] if i['apiName'].startswith('TFT_Item_')]
    # prefer generic TFT_Item_* names for the same recipe
    pool = sorted(pool, key=lambda i: (not i['apiName'].startswith('TFT_Item_'), len(i['apiName'])))
    for it in pool:
        compo = it.get('composition') or []
        comp_names = [items_by[x]['name'] if x in items_by else None for x in compo]
        if len(compo) != 2 or not all(n in comp_name for n in comp_names) or it['name'] in names or not it.get('name'):
            continue
        rkey = '+'.join(sorted(comp_names))
        if rkey in recipes:  # one item per recipe (CDragon keeps legacy/set-specific duplicates)
            continue
        recipes.add(rkey)
        names.add(it['name'])
        k = ko_items.get(it['apiName'], {})
        assoc = [tn_by_api.get(x) for x in it.get('associatedTraits') or [] if tn_by_api.get(x)]
        if not assoc and it['name'].endswith(' Emblem') and it['name'][:-7] in tnames:
            assoc = [it['name'][:-7]]
        is_emblem = bool(assoc) and ('Emblem' in it['name'] or 'Spatula' in comp_names or 'Frying Pan' in comp_names)
        special = not is_emblem and ('Spatula' in comp_names or 'Frying Pan' in comp_names)
        e = {'id': iid(it['name']), 'apiName': it['apiName'], 'name': it['name'], 'nameKo': k.get('name'),
             'type': 'emblem' if is_emblem else 'special' if special else 'completed',
             'recipe': [iid(n) for n in comp_names], 'stats': stat_line(it.get('effects')),
             'description': resolve(k.get('desc') or it.get('desc'), it.get('effects')), 'status': status}
        if is_emblem:
            e['grantsTrait'] = assoc[0]
        out_items.append(e)
    # keep Dev Drop emblems that CDragon did not provide (still preview)
    for oi in old['items']['items']:
        if oi['type'] == 'emblem' and oi['name'] not in names and oi.get('grantsTrait') in tnames:
            out_items.append(oi)

    # ---------- diff / changelog ----------
    def diff_names(a_list, b_list):
        A, Bn = {x['name'] for x in a_list}, {x['name'] for x in b_list}
        return sorted(Bn - A), sorted(A - Bn)
    ch_add, ch_rem = diff_names(old['champions']['champions'], champs)
    tr_add, tr_rem = diff_names(old['traits']['traits'], traits)
    au_add, au_rem = diff_names(old['augments']['augments'], augs)
    tier_changes = []
    for t in traits:
        p = o_tr.get(t['name'].lower())
        if p:
            x, y = '/'.join(str(r['min']) for r in p['tiers']), '/'.join(str(r['min']) for r in t['tiers'])
            if x != y:
                tier_changes.append(f"{t['name']}: {x} → {y}")
    cost_changes = [f"{c['name']}: {o_ch[c['name'].lower()]['cost']}→{c['cost']}" for c in champs if c['name'].lower() in o_ch and o_ch[c['name'].lower()]['cost'] != c['cost']]
    trait_changes = [f"{c['name']}: {'/'.join(o_ch[c['name'].lower()]['traits'])}→{'/'.join(c['traits'])}" for c in champs if c['name'].lower() in o_ch and o_ch[c['name'].lower()]['traits'] != c['traits']]
    tag = 'pbe' if status == 'pbe' else 'live'
    ver = f"19.0-{tag}.{TODAY.replace('-', '')}" if a.mutator == 'TFTSet19' else f"dryrun-{a.mutator}"
    changes = [f'CommunityDragon {a.channel} {version} → {a.mutator} 변환 (상태 {status})',
               f'챔피언 {len(champs)} (추가 {len(ch_add)}: {", ".join(ch_add[:15])}{" …" if len(ch_add) > 15 else ""} / 제거 {len(ch_rem)}: {", ".join(ch_rem[:15])})',
               f'특성 {len(traits)} (추가 {len(tr_add)} / 제거 {len(tr_rem)}) · 단계 변경 {len(tier_changes)}: {"; ".join(tier_changes[:10])}',
               f'코스트 변경 {len(cost_changes)}: {"; ".join(cost_changes[:15])}', f'특성 구성 변경 {len(trait_changes)}: {"; ".join(trait_changes[:15])}',
               f'증강 {len(augs)} (추가 {len(au_add)} / 제거 {len(au_rem)}) · 수치(effects) 포함', f'아이템 {len(out_items)} (Set 19 게임 파일 기준)',
               '상점 확률 / XP / 경제 규칙은 CDragon에 없음 → carryover 유지 (19.1 패치 노트로 확인 필요)']
    pi = old['patch-info']
    pi['dataVersion'] = ver
    pi['currentDataPatch'] = patch
    pi['built'] = TODAY
    pi['changelog'] = [{'version': ver, 'date': TODAY, 'changes': changes}] + [c for c in pi.get('changelog', []) if c.get('version') != ver]
    src = {'name': f'CommunityDragon {a.channel} ({version.split("+")[0]}) — {a.mutator}', 'url': base + 'cdragon/tft/en_us.json', 'used': 'champions, traits, augments, items'}
    pi['sources'] = [src] + [s for s in pi.get('sources', []) if s.get('url') != src['url']]
    for s in pi.get('schedule', []):
        if s.get('patch') == 'PBE' and a.channel == 'pbe' and a.mutator == 'TFTSet19':
            s['confirmed'] = True
            s['what'] = f'Set 19 PBE (CDragon {version.split("+")[0]} 반영 확인 {TODAY})'
    m = lambda n, note=None: {k: v for k, v in {'set': sd.get('number'), 'patch': patch, 'source': [src['name'], src['url']], 'updated': TODAY, 'status': status, 'count': n, 'note': note}.items() if v is not None}
    out = {
        'patch-info': pi,
        'champions': {'meta': m(len(champs), '해금 여부·조건, 한국어 이름 일부는 이전 데이터(Dev Drop/CDragon ko_kr)에서 이름 일치로 유지'), 'champions': champs},
        'traits': {'meta': m(len(traits), '단계 효과 수치는 게임 파일 변수로 계산. "?"는 계산식 변수'), 'traits': traits},
        'augments': {'meta': m(len(augs), 'tierStatus: dev-drop(이전 데이터) / icon-pattern(아이콘 이름 추정) / unknown'), 'augments': augs},
        'items': {'meta': m(len(out_items), 'Set 19 게임 파일의 아이템 목록 기준'), 'items': out_items},
        'shop-odds': old['shop-odds'], 'game-rules': old['game-rules'],
    }
    os.makedirs(a.out, exist_ok=True)
    for f, obj in out.items():
        json.dump(obj, open(os.path.join(a.out, f + '.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, 'bundle.js'), 'w', encoding='utf8') as fh:
        fh.write('/* AUTO-GENERATED by tools/update_from_cdragon.py — edit data/*.json, or import JSON in the app. */\n')
        fh.write('window.TFT_DATA_BUNDLE=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('\n'.join(changes))
    print('WROTE', a.out)


if __name__ == '__main__':
    main()
