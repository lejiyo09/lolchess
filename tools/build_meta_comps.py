#!/usr/bin/env python3
"""Build data/meta-comps.json from a tft.ninja PBE comps snapshot (tools/sources/tftninja_pbe_comps_*.json).

The snapshot holds play statistics (not game data): comp families with play rate / average placement / top4 / win%,
units with ★★★ targets, item builds per carry, core vs flex units, components to collect, board shapes, variants,
pivots, plus the all-time PBE list for stability. IDs are mapped onto our champions/items/traits so the app can
load a comp straight into the Team Builder.

  python3 tools/build_meta_comps.py [--src tools/sources/tftninja_pbe_comps_20261123.json]
  python3 tools/build_bundle.py      # then regenerate data/bundle.js
"""
import argparse, glob, json, os, re, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')


def main():
    ap = argparse.ArgumentParser()
    srcs = sorted(glob.glob(os.path.join(ROOT, 'tools/sources/tftninja_pbe_comps_*.json')))
    ap.add_argument('--src', default=srcs[-1] if srcs else None)
    a = ap.parse_args()
    snap = json.load(open(a.src, encoding='utf8'))
    L, AT, FAM = snap['list'], snap['allTime'], snap['families']
    champs = json.load(open(os.path.join(DATA, 'champions.json'), encoding='utf8'))['champions']
    items = json.load(open(os.path.join(DATA, 'items.json'), encoding='utf8'))['items']
    traits = json.load(open(os.path.join(DATA, 'traits.json'), encoding='utf8'))['traits']
    by_api = {c.get('apiName'): c['id'] for c in champs}; by_name = {c['name'].lower(): c['id'] for c in champs}
    it_api = {i.get('apiName'): i['id'] for i in items}; it_name = {i['name'].lower(): i['id'] for i in items}
    tr_id = {t['id']: t['name'] for t in traits}
    cat = {k: v for d in (L.get('catalog', {}), AT.get('catalog', {})) for k, v in d.get('units', {}).items()}
    icat = {k: v for d in (L.get('catalog', {}), AT.get('catalog', {})) for k, v in d.get('items', {}).items()}
    for fam in FAM.values():
        cat.update(fam.get('catalog', {}).get('units', {})); icat.update(fam.get('catalog', {}).get('items', {}))
    unmapped = set()

    def cid(u):
        if u in by_api: return by_api[u]
        n = (cat.get(u) or {}).get('name', '').lower()
        if n in by_name: return by_name[n]
        unmapped.add(u); return None

    def iid(x):
        if x in it_api: return it_api[x]
        n = (icat.get(x) or {}).get('name', '').lower()
        if n in it_name: return it_name[n]
        alt = x.replace('_Radiant', 'Radiant')
        if alt in it_api: return it_api[alt]
        unmapped.add(x); return None

    def tlist(lst):
        return [{'id': i, 'share': r.get('share'), 'delta': r.get('delta'), 'necessity': r.get('necessity')} for r in lst or [] for i in [iid(r['id'])] if i]

    at = {f['slug']: f for f in AT.get('families', [])}
    comps = []
    for f in L['families']:
        d = (FAM.get(f['slug']) or {}).get('family') or {}
        picks = {p['unitId']: p for p in d.get('picks', [])}
        units = []
        for u in f['units']:
            c = cid(u['id'])
            if not c: continue
            p = picks.get(u['id'], {})
            it_tab = p.get('itemTable') or {}
            units.append({'champ': c, 'items': [x for x in (iid(i) for i in u.get('items', [])) if x], 'star3': bool(u.get('star3')),
                          'priority': u.get('priority'), 'role': u.get('role') or p.get('role'), 'damage': p.get('damage'),
                          'threeStarRate': p.get('threeStarRate'),
                          'itemTable': {k: tlist(it_tab.get(k)) for k in ('core', 'important', 'optional', 'artifacts', 'radiants') if it_tab.get(k)} or None})
        a2 = at.get(f['slug'])
        comps.append({
            'slug': f['slug'], 'name': f['name'], 'tier': f.get('tier'), 'style': f.get('style'), 'isReroll': f.get('isReroll'),
            'hiddenByDefault': f.get('defaultHidden'),
            'games': f.get('games'), 'playRate': f.get('playRate'), 'avp': f.get('avgPlacement'), 'adjAvp': f.get('adjAvgPlacement'),
            'top4': f.get('top4Rate'), 'win': f.get('winRate'), 'eighth': f.get('eighthRate'), 'winShare': f.get('winShare'),
            'traits': [{'name': tr_id.get(t['id'].split(':')[-1], t['id'].split(':')[-1]), 'count': t.get('breakpoint'), 'style': t.get('style')} for t in f.get('traits', [])],
            'requiredEmblems': [x for x in (iid(e) for e in f.get('requiredEmblems') or []) if x],
            'units': units,
            'core': [{'champ': cid(x['unitId']), 'share': x['inComp'].get('share'), 'delta': x['inComp'].get('delta')} for x in d.get('core', []) if cid(x['unitId'])],
            'flex': [{'champ': cid(x['unitId']), 'playRate': x.get('playRate'), 'delta': x['inComp'].get('delta'),
                      'replaces': [cid(r['unitId']) for r in x.get('replaces', []) if cid(r['unitId'])]} for x in d.get('flex', []) if cid(x['unitId'])],
            'components': [{'item': iid(x['componentId']), 'count': x['count'], 'forItems': [y for y in (iid(i) for i in x.get('forItems', [])) if y]} for x in d.get('componentsToCollect', []) if iid(x['componentId'])],
            'boardShapes': [{'count': x['unitCount'], 'share': x.get('share'), 'avp': x.get('avgPlacement'), 'games': x.get('games'), 'units': [y for y in (cid(u) for u in x['units']) if y]} for x in d.get('boardShapes', [])],
            'variants': [{'label': x.get('label'), 'lead': x.get('lead'), 'units': [y for y in (cid(u) for u in x.get('units', [])) if y], 'games': x.get('games'),
                          'avp': x.get('avgPlacement'), 'top4': x.get('top4Rate'), 'tier': x.get('tier')} for x in d.get('variants', [])][:6],
            'pivots': [{'slug': x['slug'], 'name': x['name'], 'sharedItems': [y for y in (iid(i) for i in x.get('shared', [])) if y]} for x in d.get('pivots', [])][:5],
            'allTime': {'games': a2.get('games'), 'avp': a2.get('avgPlacement'), 'top4': a2.get('top4Rate'), 'tier': a2.get('tier'), 'playRate': a2.get('playRate')} if a2 else None,
        })
    comps.sort(key=lambda c: (c['adjAvp'] or 9))
    computed = datetime.datetime.fromtimestamp(L['computedAt'] / 1000, datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ')
    out = {'meta': {'set': 19, 'patch': 'PBE', 'scope': L.get('scopeLine'), 'scopeAllTime': AT.get('scopeLine'), 'totalGames': L.get('totalGames'),
                    'source': ['tft.ninja PBE comps', 'https://tft.ninja/comps?e=pbe'], 'computedAt': computed, 'updated': snap.get('fetched'),
                    'status': 'pbe-stats', 'count': len(comps),
                    'note': 'PBE 플레이 통계(실험적 플레이·비랭크 환경 포함). 라이브 메타와 다를 수 있으며 PBE 패치마다 바뀜. 등급(S/A/B)은 tft.ninja 기준(조정 평균 등수).',
                    'gradeRules': L.get('gradeRules')},
           'comps': comps}
    json.dump(out, open(os.path.join(DATA, 'meta-comps.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(len(comps), 'comps ·', L.get('scopeLine'), '· computed', computed, '· unmapped ids:', sorted(unmapped)[:20])


if __name__ == '__main__':
    main()
