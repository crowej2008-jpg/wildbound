# R6b: builds scripts/data/trinket-skills-source.json from the source dump.
# python3 -I scripts/data/make-trinket-worksheet.py <pokemon_data_cfg.json> scripts/data/trinket-skills-source.json packages/content/equipment/trinkets.json
import json, sys
src = sys.argv[1]; out = sys.argv[2]; trink = sys.argv[3]
d = json.load(open(src))
text = d.get('_text', {})
by_basic = {}
for t in ('skill_initiative_json', 'skill_passivity_json', 'skill_scene_json'):
    for k, v in d[t].items():
        if isinstance(v, dict) and 'basic_id' in v:
            by_basic.setdefault(v['basic_id'], []).append((t, v))
T = json.load(open(trink))['trinkets']
rows, missing = [], []
for tr in T:
    for s in tr['skills']:
        hits = by_basic.get(s['skillId'], [])
        if not hits:
            missing.append([tr['speciesId'], s['level'], s['skillId']])
        for t, v in sorted(hits, key=lambda h: h[1]['id']):
            rows.append({
                'species': tr['speciesId'], 'level': s['level'], 'skillId': s['skillId'], 'id': v['id'],
                'name': v.get('name'), 'nameEn': text.get(v.get('name')), 'desc': v.get('desc'),
                'descEn': text.get(v.get('desc')), 'table': t, 'cd': v.get('cd'), 'type': v.get('skill_type'),
            })
json.dump({'about': 'R6b part 2 worksheet: exclusive-trinket skills at Lv 10/20/30/40 (hero_weapon_json skill_list -> skill tables by basic_id). The client shows the last skill listed at a level. English from _text where present.',
           'skills': rows, 'missing': missing}, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(rows), 'rows;', len(missing), 'missing;', sum(1 for r in rows if r['descEn']), 'with English')
