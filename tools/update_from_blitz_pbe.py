#!/usr/bin/env python3
"""Convert the Set 19 PBE game-data snapshot (tools/sources/blitz_pbe_16.24_set19.json) into data/*.json + bundle.js.

Why this source: on 2026-11-20 CommunityDragon's pbe/latest exports still contained only Set 18, while Blitz.gg's
public Set 19 pages embed PBE 16.24 game data (apiNames DA_*19, numbers for traits/abilities/augments, item recipes,
unlock conditions). When CommunityDragon publishes TFTSet19, run tools/update_from_cdragon.py to re-verify/override.

  python3 tools/update_from_blitz_pbe.py [--src tools/sources/blitz_pbe_16.24_set19.json] [--out data]

Curated fields not present in the feed (Korean names, effect tags, trait countMode/notes) are kept by name from the
current data (Dev Drop build). shop-odds.json / game-rules.json are not in the feed and stay 'carryover'.
"""
import argparse, json, os, re, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = datetime.date.today().isoformat()
TIER = {'tier1': 'Silver', 'tier2': 'Gold', 'tier3': 'Prismatic'}
ROUND = {'Augment.RoundVariant.Early': '2-1', 'Augment.RoundVariant.Mid': '3-2', 'Augment.RoundVariant.Late': '4-2'}
CAT = {'Augment.Category.Economic': 'econ', 'Augment.Category.Reroll': 'econ', 'Augment.Property.GrantsXP': 'econ',
       'Augment.Category.GrantsItems': 'items', 'Augment.Property.GrantsArtifactAnvil': 'items', 'Augment.Category.GrantsEmblem': 'items',
       'Augment.Category.Trait': 'trait'}
ECON = re.compile(r'\b(gold|interest|reroll|XP|level|loot orb|loot orbs)\b', re.I)
ITEMS = re.compile(r'\b(item|items|component|components|Anvil|Emblem|Spatula|Frying Pan|Thief|Gloves|Sword|Bow|Rod|Tear|Vest|Cloak|Belt|Artifact)\b', re.I)
COMBAT = re.compile(r'\b(Health|Attack Damage|Ability Power|Attack Speed|Armor|Magic Resist|Damage Amp|Durability|Omnivamp|shield|heal|Critical|Mana|team gains|Your team)\b', re.I)
UNITS = re.compile(r'\b(champion|champions|copy|copies|Duplicator|\d-cost)\b', re.I)


ICON = {'scaleAP': 'AP', 'scaleAD': 'AD', 'scaleHealth': 'Health', 'scaleAS': 'Attack Speed', 'scaleArmor': 'Armor', 'scaleMR': 'MR',
        'scaleDA': 'Damage Amp', 'scaleDR': 'Durability', 'scaleCrit': 'Crit Chance', 'TFTManaRegen': 'Mana Regen', 'scaleSV': 'Omnivamp',
        'scaleCritMult': 'Crit Damage', 'scaleMana': 'Mana'}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower().replace("'", '').replace('’', '')).strip('-')


def clean(s):
    if not s:
        return ''
    s = re.sub(r'%i:([A-Za-z]+)%', lambda m: ICON.get(m.group(1), '') + ' ', s)  # stat icons → labels
    s = s.replace('<br>', ' ').replace('\r', ' ').replace('\n', ' ').replace('&nbsp;', ' ')
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+([,.;:%])', r'\1', s)
    return re.sub(r'\s+', ' ', s).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default=os.path.join(ROOT, 'tools/sources/blitz_pbe_16.24_set19.json'))
    ap.add_argument('--base', default=os.path.join(ROOT, 'legacy/data_devdrop_2026-11-15'), help='curated data to merge from')
    ap.add_argument('--out', default=os.path.join(ROOT, 'data'))
    ap.add_argument('--prev', default=os.path.join(ROOT, 'data'), help='previous data dir for patch-to-patch balance diff')
    a = ap.parse_args()
    src = json.load(open(a.src, encoding='utf8'))
    F = src['feeds']; U, T, I, A, UL, R = F['units'], F['traits'], F['items'], F['augments'], F['unlockables'], F['champion-roles']
    pinfo = src['patchInfo']['data'][0]; upd = pinfo['updated_at'][0]
    pbe_patch = pinfo['display_patch']; pbe_date = f'{upd[0]:04d}-{upd[1]:02d}-{upd[2]:02d}'
    hm = pinfo['updated_at'][1] if len(pinfo['updated_at']) > 1 else [0, 0]
    pbe_stamp = f"{pbe_date.replace('-', '')}-{hm[0]:02d}{hm[1]:02d}"
    prevdata = {}
    for f in ('champions', 'traits', 'augments'):
        fp = os.path.join(a.prev, f + '.json')
        if os.path.exists(fp):
            prevdata[f] = json.load(open(fp, encoding='utf8'))
    PATCH = f'PBE {pbe_patch} (Set 19, {pbe_date} {hm[0]:02d}:{hm[1]:02d} UTC)'
    old = {f: json.load(open(os.path.join(a.base, f + '.json'), encoding='utf8')) for f in ['patch-info', 'champions', 'traits', 'items', 'augments', 'shop-odds', 'game-rules']}
    o_ch = {c['name']: c for c in old['champions']['champions']}
    o_tr = {t['name']: t for t in old['traits']['traits']}
    o_it = {i['name'].lower(): i for i in old['items']['items']}
    o_au = {x['name'].lower(): x for x in old['augments']['augments']}
    status = 'pbe'
    srcref = [f'PBE {pbe_patch} game data via Blitz.gg Set 19 pages (feed updated {pbe_date})', 'https://blitz.gg/tft/set19']
    log = []

    # ---------- traits ----------
    tname = {k: v['name'] for k, v in T.items()}
    members = {}
    for u in U.values():
        if 'Override' in u['apiKey']:
            continue
        for t in u.get('origin', []) + u.get('class', []):
            members.setdefault(t, []).append(u['apiKey'])
    traits, skipped_traits = [], []
    for k, t in T.items():
        if not members.get(k):
            skipped_traits.append(t['name']); continue
        prev = o_tr.get(t['name'], {})
        tiers, prism, seen = [], None, {}
        for b in t.get('bonuses', []):
            eff = clean(b.get('effect'))
            n = b.get('needed') or 0
            if n < 1:
                continue
            if 'Prismatic' in eff:
                if prism:
                    prism['effect'] += ' / ' + eff
                else:
                    prism = {'min': n, 'effect': eff, 'requires': 'Prismatic Tour augment quest'}
                continue
            if n in seen:  # second side (True Damage B-Side)
                tiers[seen[n]]['effect'] += ' / ' + eff
                continue
            seen[n] = len(tiers); tiers.append({'min': n, 'effect': eff})
        unique = t['name'] in {x for x, p in o_tr.items() if p.get('type') == 'unique'} or (len(tiers) == 1 and tiers[0]['min'] == 1)
        entry = {'id': prev.get('id') or slug(t['name']), 'name': t['name'], 'nameKo': prev.get('nameKo'),
                 'type': prev.get('type') or ('unique' if unique else 'trait'), 'traitClass': t.get('type'),
                 'description': clean(t.get('description')) or prev.get('description', ''),
                 'countMode': prev.get('countMode', 'units'), 'tiers': tiers or [{'min': 1, 'effect': ''}],
                 'champions': [], 'status': status, 'apiName': k,
                 'notes': [n for n in prev.get('notes', []) if 'Dev Drop' not in n]}
        if prism:
            entry['prismatic'] = prism
        for kk in ('prismaticEligible', 'sides'):
            if kk in prev:
                entry[kk] = prev[kk]
        if t['name'] == 'True Damage':
            groups = [clean(b['effect']) for b in t['bonuses'] if 'Prismatic' not in clean(b['effect'])]
            entry['sides'] = {'A': groups[:2], 'B': groups[2:4]}
        old_bp = [x['min'] for x in prev.get('tiers', [])]
        if prev and old_bp != [x['min'] for x in entry['tiers']]:
            log.append(f"특성 단계 변경 {t['name']}: {'/'.join(map(str, old_bp))} → {'/'.join(str(x['min']) for x in entry['tiers'])}")
        traits.append(entry)
    if skipped_traits:
        log.append(f'구성원 없는 내부 특성 제외: {", ".join(skipped_traits)} (Baron Nashor 악기 수집 / Seraphine 성장 단계 추적용)')
    tn_ok = {t['apiName']: t['name'] for t in traits}

    # ---------- champions ----------
    role = {k: v['name'] for k, v in R.items()}
    ulk = {k: clean(v['description']) for k, v in UL.items()}
    variants = {}
    for u in U.values():
        if 'Override' in u['apiKey']:
            base = re.sub(r'_?HeroAugment_?Override$', '', u['apiKey'])
            variants[base] = u
    ak_name = {'DA_AkaliKDA19': 'Akali (K/DA)', 'DA_Akali_TrueDamage19': 'Akali (True Damage)'}
    champs = []
    for u in U.values():
        if 'Override' in u['apiKey']:
            continue
        name = ak_name.get(u['apiKey'], u['name'])
        prev = o_ch.get(name, {})
        tr = [tn_ok[t] for t in u.get('origin', []) + u.get('class', []) if t in tn_ok]
        st = u.get('stats', {}); off, de = st.get('offense', {}), st.get('defense', {})
        ab = u.get('ability') or {}
        r = role.get(u.get('role'), '') or prev.get('role', '')
        unlock = u['apiKey'] in ulk or prev.get('unlock', False)
        c = {'id': prev.get('id') or slug(name), 'name': name, 'nameKo': prev.get('nameKo'), 'cost': u['cost'], 'traits': tr,
             'role': r, 'effects': prev.get('effects', []), 'unlock': unlock,
             'unlockCondition': ulk.get(u['apiKey']) or prev.get('unlockCondition'),
             'unlockConditionStatus': 'pbe' if u['apiKey'] in ulk else ('preview' if prev.get('unlockCondition') else None),
             'status': status, 'apiName': u['apiKey'],
             'stats': {'hp': de.get('health'), 'armor': de.get('armor'), 'mr': de.get('magicResist'), 'ad': off.get('damage'), 'as': off.get('attackSpeed'), 'range': off.get('range')},
             'ability': {'name': ab.get('name'), 'desc': clean(ab.get('description')), 'manaStart': ab.get('manaStart'), 'manaCost': ab.get('manaCost')}}
        if u['apiKey'] in variants:
            v = variants[u['apiKey']]; c['heroVariant'] = {'role': role.get(v.get('role'), ''), 'ability': {'name': (v.get('ability') or {}).get('name'), 'desc': clean((v.get('ability') or {}).get('description'))}, 'note': 'Hero 증강 선택 시 바뀌는 형태'}
        if prev:
            if prev['cost'] != c['cost']: log.append(f"코스트 변경 {name}: {prev['cost']} → {c['cost']}")
            if prev['traits'] != c['traits']: log.append(f"특성 변경 {name}: {'/'.join(prev['traits'])} → {'/'.join(c['traits'])}")
            if prev.get('role') and prev['role'] != c['role']: log.append(f"역할 변경 {name}: {prev['role']} → {c['role']}")
        else:
            log.append(f'신규 챔피언 {name}')
        champs.append(c)
    for n in set(o_ch) - {c['name'] for c in champs}:
        log.append(f'Dev Drop에만 있던 챔피언 {n} (PBE에 없음)')
    champs.sort(key=lambda c: (c['cost'], c['name']))
    for t in traits:
        t['champions'] = [c['name'] for c in champs if t['name'] in c['traits']]

    # ---------- items ----------
    comp_key = {k: v for k, v in I.items() if v.get('kind') == 'basic'}
    items, ids = [], set()
    def add(v, typ):
        nm = v['name']; prev = o_it.get(nm.lower(), {})
        iid = prev.get('id') or slug(nm)
        if iid in ids:
            return
        ids.add(iid)
        rec = None
        if len(v.get('buildsFrom') or []) == 2 and all(x in comp_key for x in v['buildsFrom']):
            rec = [(o_it.get(comp_key[x]['name'].lower(), {}).get('id') or slug(comp_key[x]['name'])) for x in v['buildsFrom']]
        e = {'id': iid, 'apiName': v['apiKey'], 'name': nm, 'nameKo': prev.get('nameKo'), 'type': typ, 'recipe': rec,
             'stats': prev.get('stats', ''), 'description': clean(v.get('description')), 'status': status}
        if typ == 'emblem' and v.get('trait') in tn_ok:
            e['grantsTrait'] = tn_ok[v['trait']]
        elif typ == 'emblem':
            return
        items.append(e)
    for v in comp_key.values(): add(v, 'component')
    for v in I.values():
        k = v.get('kind')
        if k == 'normal': add(v, 'completed')
        elif k == 'emblem': add(v, 'emblem')
        elif k == 'spatula': add(v, 'special')
    for v in I.values():
        k = v.get('kind')
        if k in ('artifact', 'radiant', 'support'): add(v, k)
    # recipe uniqueness for craftables (game files keep one item per recipe)
    seen_r = {}
    for e in items:
        if e['recipe'] and e['type'] in ('completed', 'emblem', 'special'):
            key = '+'.join(sorted(e['recipe']))
            if key in seen_r:
                log.append(f"조합법 중복 {e['name']} / {seen_r[key]} → 뒤 항목 조합법 제거"); e['recipe'] = None
            else:
                seen_r[key] = e['name']
    old_c = {i['name'] for i in old['items']['items'] if i['type'] == 'completed'}; new_c = {i['name'] for i in items if i['type'] == 'completed'}
    if old_c != new_c:
        log.append(f'완성 아이템 변경: 추가 {sorted(new_c - old_c)} / 제거 {sorted(old_c - new_c)}')

    # ---------- augments ----------
    augs, excluded, aids = [], [], set()
    for tier_key, tier in A.items():
        for k, v in tier.items():
            tags = v.get('tags', [])
            if 'Augment.ExcludeFromCatalog' in tags or 'Augment.Mode.ExcludeStandard' in tags:
                excluded.append(v['name']); continue
            d = clean(v.get('description'))
            prev = o_au.get(v['name'].lower(), {})
            cats = sorted({CAT[t] for t in tags if t in CAT} | ({'econ'} if ECON.search(d) else set()) | ({'items'} if ITEMS.search(d) else set()) | ({'combat'} if COMBAT.search(d) else set()) | ({'units'} if UNITS.search(d) else set()) | ({'hp'} if re.search(r'player Health', d, re.I) else set()))
            rel = sorted(({tn_ok[v['trait']]} if v.get('trait') in tn_ok else set()) | {t['name'] for t in traits if re.search(r'(?<![A-Za-z])' + re.escape(t['name']) + r'(?![A-Za-z])', d)})
            kind = 'hero' if 'Augment.Category.Hero' in tags else 'emblem' if ('Augment.Category.GrantsEmblem' in tags or re.search(r'\bEmblem\b', d)) and rel else 'trait' if 'Augment.Category.Trait' in tags else (prev.get('kind') or 'general')
            if kind in ('trait', 'emblem') and 'trait' not in cats:
                cats.append('trait')
            aid = prev.get('id') or slug(v['name'])
            while aid in aids:
                aid += '-2'
            aids.add(aid)
            augs.append({'id': aid, 'name': v['name'], 'tier': TIER[tier_key], 'description': d, 'kind': kind, 'categories': cats,
                         'relatedTraits': rel, 'rounds': [ROUND[t] for t in tags if t in ROUND], 'riotTags': [t for t in tags if t.startswith('Augment.Category') or t.startswith('Augment.Property')],
                         'numbers': 'in-description', 'status': status, 'apiName': k})
            if prev and prev.get('tier') != TIER[tier_key]:
                log.append(f"증강 등급 변경 {v['name']}: {prev.get('tier')} → {TIER[tier_key]}")
    # ---------- patch-to-patch balance diff vs previous data (PBE → PBE) ----------
    bal = []
    if prevdata.get('champions', {}).get('meta', {}).get('status') == 'pbe':
        pt = {t['name']: t for t in prevdata['traits']['traits']}
        for t in traits:
            p0 = pt.get(t['name'])
            if not p0: continue
            for x, y in zip(p0['tiers'], t['tiers']):
                if re.findall(r'[0-9][0-9/.%]*x?', x['effect']) != re.findall(r'[0-9][0-9/.%]*x?', y['effect']):
                    bal.append(f"[특성] {t['name']} ({y['min']}): {x['effect']} → {y['effect']}")
        pc = {c['name']: c for c in prevdata['champions']['champions']}
        for c in champs:
            p0 = pc.get(c['name'])
            if not p0: continue
            for k2, v2 in (c.get('stats') or {}).items():
                v1 = (p0.get('stats') or {}).get(k2)
                if v1 is not None and v1 != v2: bal.append(f"[챔피언] {c['name']} {k2}: {v1} → {v2}")
            if (p0.get('ability') or {}).get('manaCost') not in (None, (c.get('ability') or {}).get('manaCost')):
                bal.append(f"[챔피언] {c['name']} 마나: {p0['ability']['manaCost']} → {c['ability']['manaCost']}")
            n1 = re.findall(r'[0-9][0-9/.%]*', (p0.get('ability') or {}).get('desc') or ''); n2 = re.findall(r'[0-9][0-9/.%]*', (c.get('ability') or {}).get('desc') or '')
            if n1 != n2:
                d2 = ', '.join(f'{x}→{y}' for x, y in zip(n1, n2) if x != y)
                bal.append(f"[챔피언] {c['name']} 스킬 수치: " + (d2[:160] if d2 else '설명 문구/항목 변경'))
            if p0.get('unlockCondition') and (p0.get('unlockCondition') or '').lower() != (c.get('unlockCondition') or '').lower():
                bal.append(f"[해금] {c['name']}: {p0['unlockCondition']} → {c['unlockCondition']}")
        pa = {x.get('apiName') or x['name']: x for x in prevdata['augments']['augments']}
        for x in augs:
            p0 = pa.get(x['apiName'])
            if p0 and re.findall(r'[0-9][0-9/.%]*', p0['description']) != re.findall(r'[0-9][0-9/.%]*', x['description']):
                bal.append(f"[증강] {x['name']}: {p0['description']} → {x['description']}")
            if p0 and p0['tier'] != x['tier']: bal.append(f"[증강] {x['name']} 등급 {p0['tier']} → {x['tier']}")
        na = {x['apiName']: x['name'] for x in augs}
        bal += [f'[증강] 신규 {na[k]}' for k in sorted(set(na) - set(pa))] + [f"[증강] 삭제 {pa[k]['name']}" for k in sorted(set(pa) - set(na))]
        prev_ver = json.load(open(os.path.join(a.prev, 'patch-info.json'), encoding='utf8')).get('dataVersion') if os.path.exists(os.path.join(a.prev, 'patch-info.json')) else '?'
        log.insert(0, f'PBE 밸런스 변경 (이전 {prev_ver} 대비): {len(bal)}건')
    an_new = {x['name'] for x in augs}; an_old = {x['name'] for x in old['augments']['augments']}
    log.append(f'증강: Dev Drop {len(an_old)} → PBE {len(augs)} (신규 {len(an_new - an_old)}, PBE에 없음 {len(an_old - an_new)}, 일반 모드 제외/카탈로그 제외 {len(excluded)})')

    # ---------- patch info ----------
    pi = old['patch-info']
    ver = f'19.0-pbe.{pbe_stamp}'
    pi.update({'dataVersion': ver, 'currentDataPatch': PATCH, 'built': TODAY})
    for s in pi['schedule']:
        if s['patch'] == 'PBE':
            s.update({'confirmed': True, 'what': f'Set 19 PBE 오픈 (11-17). 데이터 반영: PBE {pbe_patch} ({pbe_date})'})
    summary = [f'PBE {pbe_patch} 게임 데이터로 갱신 (Blitz.gg Set 19 페이지 내장 데이터, {pbe_date}) — CommunityDragon은 2026-11-20 기준 Set 19 미반영',
               f'챔피언 {len(champs)} · 특성 {len(traits)} · 증강 {len(augs)} · 아이템 {len(items)}',
               '추가된 수치: 특성 단계별 수치, 챔피언 스탯·마나·스킬 수치, 증강 수치(설명 내), 해금 조건 수치, 상징 조합법, 증강 등장 라운드',
               '상점 확률 / XP / 경제 규칙: 출처 없음 → carryover 유지'] + log[:60]
    pi['balanceChanges'] = {'version': ver, 'since': (json.load(open(os.path.join(a.prev, 'patch-info.json'), encoding='utf8')).get('dataVersion') if os.path.exists(os.path.join(a.prev, 'patch-info.json')) else None), 'changes': bal} if bal else pi.get('balanceChanges')
    pi['changelog'] = [{'version': ver, 'date': TODAY, 'changes': summary + bal[:80]}] + [c for c in pi['changelog'] if c['version'] != ver]
    s0 = {'name': f'PBE {pbe_patch} 게임 데이터 — Blitz.gg Set 19 (내장 데이터)', 'url': 'https://blitz.gg/tft/set19', 'used': 'champions, traits, items, augments, unlocks (status: pbe)'}
    pi['sources'] = [s0] + [s for s in pi['sources'] if s['url'] != s0['url']]
    def keep(f):  # rules files are not in this feed: keep the current data/ version (e.g. tftflow-verified), else the base
        fp = os.path.join(a.prev, f + '.json')
        return json.load(open(fp, encoding='utf8')) if os.path.exists(fp) else old[f]
    meta = lambda n, note: {'set': 19, 'patch': PATCH, 'source': srcref, 'updated': pbe_date, 'status': status, 'count': n, 'note': note}
    out = {'patch-info': pi,
           'champions': {'meta': meta(len(champs), '한국어 이름·효과 태그는 이전 데이터(CDragon ko_kr / Dev Drop)에서 유지. heroVariant = Hero 증강 형태'), 'champions': champs},
           'traits': {'meta': meta(len(traits), '단계 수치는 PBE 값. 라이브 전 변경 가능'), 'traits': traits},
           'augments': {'meta': meta(len(augs), 'categories = Riot 태그 + 설명 키워드. rounds = Riot RoundVariant(Early 2-1 / Mid 3-2 / Late 4-2)'), 'augments': augs},
           'items': {'meta': meta(len(items), 'Set 19 PBE 아이템 목록. 한국어 이름은 이름이 같은 Set 18 아이템에서 유지'), 'items': items},
           'shop-odds': keep('shop-odds'), 'game-rules': keep('game-rules')}
    os.makedirs(a.out, exist_ok=True)
    for f, obj in out.items():
        json.dump(obj, open(os.path.join(a.out, f + '.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    with open(os.path.join(a.out, 'bundle.js'), 'w', encoding='utf8') as fh:
        fh.write('/* AUTO-GENERATED by tools/update_from_blitz_pbe.py — edit data/*.json, or import JSON in the app. */\n')
        fh.write('window.TFT_DATA_BUNDLE=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('\n'.join(summary))


if __name__ == '__main__':
    main()
