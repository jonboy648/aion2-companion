import sys,json,glob,os,re
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from build_common import *
SRC_DATE_APP='aion2.app game client dump (Game client 18.09.2026), pages fetched 2026-10-03'
SRC_DATE_MR='Metaroad datamine page (metaroad.gg/aion2/database/skills/spiritmaster) retrieved 2026-10-03'
mr=json.load(open(ROOT+'raw/metaroad_raw.json',encoding='utf-8'))
mr_by={}
for e in mr: mr_by.setdefault(e['name'],e)
used=set()
def mr_stats(e):
    st=e['stats']; out={}
    r=st.get('Attack ratio'); f=st.get('Flat')
    out['ratio']=num(r.rstrip('%')) if r else None
    out['flat']=num(f) if f else None
    return out
def hits_of(desc):
    m=re.search(r'\((\d+) hits\)',desc or ''); return int(m.group(1)) if m else None
def stagger_of(desc):
    m=re.search(r'(\d+(?:-\d+)?) Stagger Gauge Damage',desc or ''); return m.group(1) if m else None
def variants_count(base):
    n=0
    for e in mr:
        if e['name']!=base and e['name'].startswith(base+' [') : n+=1
    return n
def category(r):
    n=r['name']
    if 'Weapon Equip' in n: return 'system_passive'
    if n=='Dodge': return 'basic_dodge'
    if r['id']==16300001: return 'chain_or_hidden_active'
    if r['stigma']: return 'stigma'
    if r['unlock'] is not None and r['mastery']:
        return 'passive' if r['ctype']=='Passive' else 'active'
    if re.match(r'^(Fire|Water|Wind|Earth|Ancient) Spirit:',n): return 'spirit_skill'
    if n=='Use Spirit Summon Skill': return 'chain_or_system'
    p=r['props']['levels'][0]
    return 'chain_or_hidden_active' if (p.get('dmg_min') not in (None,'0') or r['ctype']=='Active' and 'damage' in (r['props']['description'] or '').lower()) else 'chain_or_hidden'
def build(r):
    p=r['props']; lv=p['levels']; tv0=lv[0].get('token_values') or {}
    per=[]
    for x in lv:
        tv=x.get('token_values') or None
        per.append({'level':x['level'],'dmg_min':num(x['dmg_min']),'dmg_max':num(x['dmg_max']),
          'heal_min':num(x.get('heal_min')),'heal_max':num(x.get('heal_max')),
          'cooldown_s':x['cooldown'],'cost_mp':x['cost_mp'],'cast_time_s':x['casting_time'],'tokens':tv})
    cat=category(r)
    # metaroad match
    m=mr_by.get(r['name'])
    if m and (m['name'] in used) : m=None
    if m and m['tags'] and not (m['tags'].startswith(r['ctype'] or 'zzz') or m['tags'].startswith('System')): m=None
    if m: used.add(m['name'])
    desc=resolve(p['description'],tv0)
    if m and m['description']: desc=m['description']
    st=mr_stats(m) if m else {'ratio':None,'flat':None}
    coef=None
    if m and (st['ratio'] is not None or st['flat'] is not None):
        coef={'atk_ratio_pct_rank1':st['ratio'],'flat_rank1':st['flat'],'hits':hits_of(desc),
          'stagger_gauge_damage':stagger_of(desc),'note':'Metaroad shows rank-1 ratio/flat; per-rank resolved damage in per_level'}
    specs=[]
    for s in p['specs']:
        specs.append({'unlock_level':s['unlock_level'],'text':resolve(s['description'],tv0)})
    cd1=lv[0]['cooldown']; cdN=lv[-1]['cooldown']
    rng=num((r['range'] or '').replace('m','').strip()) if r['range'] else (num(m['stats'].get('Range','').rstrip('m')) if m else None)
    effects=[]
    sg=stagger_of(desc)
    if sg: effects.append(f'Stagger gauge damage: {sg}')
    if m: effects.append(f"Metaroad variants (ranks): {m['variants']}")
    vc=variants_count(r['name'])
    if vc: effects.append(f'Metaroad specialization variants listed: {vc}')
    if cd1!=cdN: effects.append(f'Cooldown falls from {cd1}s (rank 1) to {cdN}s (rank {lv[-1]["level"]})')
    sid=r['id']
    e={'name':r['name'],'name_kr':r['name_kr'],'skill_id':sid,'category':cat,'client_type':r['ctype'],
      'unlock_level':r['unlock'],'max_skill_level':r['max'],'cooldown_s':cd1,'cooldown_s_at_max_level':cdN if cd1!=cdN else None,
      'cast_time_s':lv[0]['casting_time'],'cost':{'mp':lv[0]['cost_mp'],'hp':lv[0]['cost_hp'],'dp':lv[0]['cost_dp']},
      'range_m':rng,'description':desc,'coefficients':coef,'effects':effects,'specializations':specs,
      'properties':p['properties'],'damage_type_or_weapon':' / '.join(x for x in [r['dtype'],r['weapon']] if x) or None,
      'per_level':per,'icon':r['icon'],
      'icon_url':f"https://aion2.app/db-item-icons/{r['icon']}.webp" if r['icon'] else None,
      'source_url':f'https://aion2.app/db/skills/{sid}','source_url_secondary':'https://metaroad.gg/aion2/database/skills/spiritmaster' if m else None,
      'source_date':SRC_DATE_APP+('; '+SRC_DATE_MR if m else ''),
      'metaroad_tag':(m['tags'].strip().rstrip('·').strip()+' ·') if m and m['tags'] else None}
    return e
