import re, json, html, io, os, time, urllib.request
from PIL import Image
from parse_app import parse_page, clean
from parse_mr import parse_mr

H = {"User-Agent": "Mozilla/5.0 (personal-companion-app; low-rate)"}
MR = parse_mr()
MRN = {}
for m in MR:
    MRN.setdefault(m['name'], []).append(m)


def strip(s):
    return clean(re.sub(r'<[^>]+>', '', s.replace('<!-- -->', '')))


def extra(path):
    raw = open(path, encoding='utf-8').read()
    ps = re.findall(r'<p class="text-sm text-gray-700[^>]*whitespace-pre-line"><span>(.*?)</span></p>', raw, re.S)
    desc = html.unescape(re.sub(r'<[^>]+>', '', ps[0])).strip() if ps else None
    pr = re.search(r'<p class="text-xs text-amber-600[^>]*><span>(.*?)</span></p>', raw, re.S)
    props = strip(pr.group(1)) if pr else None
    specs = []
    m = re.search(r'Specialty</h2>(.*?)</section>', raw, re.S)
    if m:
        for row in m.group(1).split('<div class="flex items-start gap-2')[1:]:
            r = row.replace('<!-- -->', '')
            lvm = re.search(r'Level\s*(\d+)</span>', r)
            if lvm:
                specs.append({'unlock_level': int(lvm.group(1)), 'text': strip(r[lvm.end():]).replace('[ ', '[').replace(' ]', ']').replace(' ]', ']')})
    chain = None
    m = re.search(r'>Chain</h2>(.*?)</section>', raw, re.S)
    if m:
        chain = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1).replace('<!-- -->', '')))).strip()
    det = {}
    m = re.search(r'Details</h2>(.*?)</section>', raw, re.S)
    if m:
        for k, v in re.findall(r'<span class="text-sm text-gray-500[^>]*>(.*?)</span><span class="text-sm font-medium[^>]*>(.*?)</span>', m.group(1), re.S):
            det[strip(k)] = strip(v)
    cd = re.search(r'>Cooldown</span><span[^>]*>([\d.]+)s', raw)
    return desc, props, specs, chain, det, float(cd.group(1)) if cd else None


TAGS = json.load(open('tags.json', encoding='utf-8'))


def slug(n):
    return re.sub(r'[^a-z0-9]+', '-', n.lower().replace("'", '').replace('\u2019', '')).strip('-')


out = []
idx = {}
ICON_DIR = 'D:/Aion2/assets/icons/chanter'
os.makedirs(ICON_DIR, exist_ok=True)
SRC = 'aion2.app game client dump 2026-09-18 ("Game client 18.09.2026"); Metaroad Chanter datamine page fetched 2026-10-03'
ids = open('ids.txt').read().split()
_b = json.load(open('raw/daev_boards.json', encoding='utf-8'))
DV = {n['skill_id']: n['skill_icon'] for x in _b for n in x['nodes'] if n['skill_id']}
ICON_OVERRIDES = {}
CHAIN_CHILD = {18020000, 18030000, 18050000, 18070000, 18370000, 18390000, 18400000, 18410000}
for sid in ids:
    p = parse_page(f'raw/{sid}_en.html')
    k = parse_page(f'raw/{sid}_ko.html')
    desc, props, specs, chain, det, cd0 = extra(f'raw/{sid}_en.html')
    sid = int(sid)
    typ = det.get('Type')
    st = 'Stigma' in p['chips']
    if sid in CHAIN_CHILD:
        cat = 'chain_or_hidden'
    elif sid == 18000100:
        cat = 'basic_dodge'
    elif sid == 18080037:
        cat = 'passive_proc'
    elif st:
        cat = 'stigma'
    else:
        cat = (typ or 'Active').lower()
    lv = p['per_level']
    if not lv:
        lv = [dict(level=1, dmg_min=None, dmg_max=None, heal_min=None, heal_max=None, cooldown_s=cd0 or 0,
                   cost_mp=0.0, cost_hp=0.0, cost_dp=0.0, cast_time_s=0.0, tokens=None)]
    unlock = None
    for c in p['chips']:
        m = re.search(r'Required level (\d+)', c)
        if m:
            unlock = int(m.group(1))
    mx = int(det['Max']) if det.get('Max', '').isdigit() else len(lv)
    mr = (MRN.get(p['name']) or [None])[0]
    mr_proc = None
    if sid == 18080037:
        mr, mr_proc = None, MRN['Wave Blow'][0]
    rng = re.match(r'([\d.]+)', det.get('Range', ''))
    rng = float(rng.group(1)) if rng else None
    sg = re.search(r'(\d+(?:-\d+)?) Stagger Gauge Damage', desc or '')
    coef = None
    src_mr = mr or mr_proc
    if src_mr and src_mr['stats'].get('Attack ratio'):
        s = src_mr['stats']
        coef = {'atk_ratio_pct_rank1': float(s['Attack ratio'].rstrip('%')),
                'flat_rank1': float(s['Flat']) if s.get('Flat') else None,
                'hits': int(s['Hits']) if s.get('Hits') else None,
                'stagger_gauge_damage': sg.group(1) if sg else None,
                'note': ('ASSUMED equal to Wave Blow (same text and rank-1 damage 538); ' if mr_proc else '') + 'Metaroad shows rank-1 ratio/flat; per-rank resolved damage in per_level'}
        if coef['hits'] and desc and '(%d hit' % coef['hits'] not in desc:
            desc = desc + '\nHits (Metaroad): (%d hits)' % coef['hits']
    eff = []
    if sg:
        eff.append(f'Stagger gauge damage: {sg.group(1)}')
    if mr:
        eff.append(f"Metaroad variants (ranks): {re.search(r'(\d+) variant', mr['meta_head']).group(1)}")
    cds = [x['cooldown_s'] for x in lv]
    if len(set(cds)) > 1:
        eff.append(f'Cooldown falls from {cds[0]:g}s (rank 1) to {cds[-1]:g}s (rank {len(lv)}) per client')
    if chain:
        eff.append('Chain: ' + chain)
    hl = [x for x in lv if x.get('heal_min') is not None]
    if hl:
        eff.append(f"Heal per rank: {hl[0]['heal_min']:g}-{hl[0]['heal_max']:g} (rank 1) to "
                   f"{hl[-1]['heal_min']:g}-{hl[-1]['heal_max']:g} (rank {hl[-1]['level']})")
    if str(sid) in DV and DV[str(sid)] != p['icon']:
        ICON_OVERRIDES[sid] = (p['icon'], DV[str(sid)])
        p['icon'] = DV[str(sid)]
    sl = slug(p['name'])
    sl2 = sl if sl not in idx else f'{sl}-{sid}'
    iu = f"https://aion2.app/db-item-icons/{p['icon']}.webp"
    fn = f'{ICON_DIR}/{sl2}.png'
    if not os.path.exists(fn):
        data = urllib.request.urlopen(urllib.request.Request(iu, headers=H), timeout=30).read()
        Image.open(io.BytesIO(data)).convert('RGBA').save(fn)
        time.sleep(.45)
    im = Image.open(fn)
    idx[sl2] = {'name': p['name'], 'source_url': iu, 'size': f'{im.width}x{im.height}',
                'skill_id': str(sid), 'icon': p['icon']}
    mtag = None
    if mr or mr_proc:
        mr_t = mr or mr_proc
        mtag = re.sub(r'\s*\d+ variants?.*$', '', mr_t['meta_head']).strip() + ' ·'
    out.append({'name': p['name'], 'name_kr': k['name'], 'skill_id': sid, 'category': cat, 'client_type': typ,
                'unlock_level': unlock, 'max_skill_level': mx, 'cooldown_s': lv[0]['cooldown_s'],
                'cooldown_s_at_max_level': lv[-1]['cooldown_s'] if len(set(cds)) > 1 else None, 'cast_time_s': 0,
                'cost': {'mp': lv[0]['cost_mp'], 'hp': lv[0]['cost_hp'], 'dp': lv[0]['cost_dp']},
                'range_m': rng, 'description': desc, 'coefficients': coef, 'effects': eff,
                'specializations': specs, 'properties': props, 'damage_type': det.get('Damage type'),
                'weapon': det.get('Weapon'), 'damage_type_or_weapon': None,
                'stigma_points': int(det['Stigma points']) if det.get('Stigma points', '').isdigit() else None,
                'tags': TAGS.get(str(sid), []), 'per_level': lv, 'icon_url': iu, 'icon_slug': sl2,
                'source_url': f'https://aion2.app/db/skills/{sid}',
                'source_url_secondary': 'https://metaroad.gg/aion2/database/skills/chanter' if mr else None,
                'source_date': SRC, 'metaroad_tag': mtag})
for m in MR:
    if m['id_attr'].startswith('skill-rushing-smash-'):
        nm = {'lv-1': 'Rushing Smash - Level 1', 'lv-2': 'Rushing Smash - Level 2',
              'max': 'Rushing Smash - Max'}[m['id_attr'].split('smash-')[1]]
        out.append({'name': nm, 'name_kr': None, 'skill_id': None, 'category': 'chain_or_system',
                    'client_type': None, 'unlock_level': None, 'max_skill_level': None,
                    'cooldown_s': float(m['dl']['Cooldown'].rstrip('s')), 'cast_time_s': None,
                    'cost': {'mp': None, 'hp': None, 'dp': None}, 'range_m': 20.0, 'description': m['description'],
                    'coefficients': None, 'effects': ['Charge tier of Rushing Smash (Metaroad row, no client id)'],
                    'specializations': [], 'damage_type': 'Physical', 'weapon': 'Staff', 'damage_type_or_weapon': None,
                    'tags': TAGS.get(nm, []), 'per_level': [], 'icon_url': None, 'icon_slug': 'rushing-smash',
                    'source_url': 'https://metaroad.gg/aion2/database/skills/chanter#' + m['id_attr'],
                    'source_url_secondary': None, 'source_date': SRC,
                    'metaroad_tag': re.sub(r'\s*\d+ variants?.*$', '', m['meta_head']).strip() + ' ·'})
json.dump(out, open('skills.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
json.dump(idx, open(f'{ICON_DIR}/index.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(out), len(idx))
json.dump({str(k): v for k, v in ICON_OVERRIDES.items()}, open('raw/icon_overrides.json', 'w'), indent=1)
