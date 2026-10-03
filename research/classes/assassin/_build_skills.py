import re,json,glob
from collections import Counter
from _parse import parse
from _metaroad import load as load_meta
SRC_DATE="aion2.app game client dump 2026-09-18 (en + ko pages fetched 2026-10-03); Metaroad datamine page retrieved 2026-10-03"
def slugify(n): return re.sub(r'[^a-z0-9]+','-',n.lower().replace("'",'').replace('’','')).strip('-')
raw={p[5:13]:p for p in glob.glob('_raw/13*.en.html')}
pages={sid:parse(open(raw[sid],encoding='utf-8').read()) for sid in sorted(raw)}
ko={sid:parse(open(f'_raw/{sid}.ko.html',encoding='utf-8').read())['name'] for sid in pages}
meta=load_meta(); mby={}
for d in meta: mby.setdefault(d['name'],[]).append(d)
CAT={}
for sid,o in pages.items():
    k=o['kind']
    if sid=='13000100': c='basic_dodge'
    elif sid in('13220037','13350007'): c='passive_proc'
    elif k=='Stigma': c='stigma'
    elif k=='Passive': c='passive'
    elif k=='Active': c='active'
    elif o['details'].get('Damage type') and o['levels'][0].get('dmg_min'): c='chain_or_hidden_active'
    else: c='chain_or_hidden'
    CAT[sid]=c
# tags: manual = pressed by hand outside the one-key macro (Inven guides, see NOTES); rest are utility/role tags
T={
'13000100':'manual defense mobility evade','13010000':'damage builder chain sustain macro','13020000':'damage cc slow mobile_cast manual',
'13030000':'damage builder chain sustain macro','13040000':'damage builder chain sustain macro','13050000':'damage cc blind mobility macro',
'13060000':'damage insignia_source back_attack macro','13070000':'damage cc stun mobility macro','13080000':'defense evade sustain manual',
'13090000':'damage mobility chain manual','13100000':'damage insignia_source chain manual','13110000':'damage insignia_source chain manual',
'13120000':'damage insignia_source chain manual','13130000':'damage cc stun insignia_consumer manual macro_conditional','13140000':'damage mobility stealth defense manual',
'13150000':'buff party manual','13160000':'buff manual','13170000':'buff sustain manual','13180000':'stealth mobility utility manual',
'13210000':'damage cc stun macro','13220000':'damage cc knockdown mobility insignia_source macro','13220037':'damage cc proc',
'13230000':'damage cc airborne insignia_consumer manual','13240000':'damage cc knockdown chain manual','13250000':'damage cc blind manual',
'13260000':'defense cc_break buff sustain manual','13270000':'damage insignia_source buff manual','13280000':'damage mobility dispel manual',
'13290000':'stealth utility manual','13300000':'damage debuff back_attack manual','13310000':'buff damage_amp heart_gore_reset manual',
'13330000':'damage cc stun chain manual','13340000':'damage mobility sustain stagger_only manual','13350000':'damage proc crit_trigger sustain',
'13350007':'damage proc crit_trigger','13360000':'damage cc blind mobility macro','13370000':'defense cc_break buff manual',
'13380000':'damage cc push chain manual','13390000':'buff combat_speed manual','13700000':'damage cc blind defense manual',
'13710000':'passive defense heal evade','13720000':'passive crit buff insignia_source','13730000':'passive dot debuff','13740000':'passive back_attack buff',
'13750000':'passive crit_damage buff','13760000':'passive impact buff','13770000':'passive proc mobility','13780000':'passive debuff',
'13790000':'passive defense heal cc_resist','13800000':'passive proc execute'}
slugs={}; used={}
for sid,o in pages.items():
    s=slugify(o['name'])
    if s in used: s+='-'+sid
    used[s]=sid; slugs[sid]=s
def sg(desc):
    m=re.search(r'(\d+(?:-\d+)?) Stagger Gauge Damage',desc or ''); return m.group(1) if m else None
def getmeta(sid,o):
    if sid=='13730000': return None
    c=[d for d in mby.get(o['name'],[]) if d['tag'].startswith(('Active','Passive'))]
    if sid=='13160000': c=[d for d in c if d['tag'].startswith('Active')]
    return c[0] if c else None
def num(v): return float(v) if v not in(None,'') else None
skills=[]; conflicts=[]
for sid,o in pages.items():
    L=o['levels']; l1=L[0]; ll=L[-1]; m=getmeta(sid,o); det=o['details']
    rng=re.search(r'([\d.]+)',det.get('Range',''))
    per=[{'level':r['level'],'dmg_min':num(r.get('dmg_min')),'dmg_max':num(r.get('dmg_max')),
          'heal_min':num(r.get('heal_min')),'heal_max':num(r.get('heal_max')),
          'cooldown_s':r['cooldown'],'cost_mp':r['cost_mp'],'cast_time_s':r['casting_time'],
          'tokens':r.get('token_values') or {}} for r in L]
    eff=[]
    if m: eff.append(f"Metaroad variants (ranks): {m['variants']}")
    s_=sg(o['description'])
    if s_: eff.append(f"Stagger gauge damage: {s_}")
    if ll['cooldown']!=l1['cooldown']: eff.append(f"Cooldown falls from {l1['cooldown']}s (rank 1) to {ll['cooldown']}s (rank {ll['level']}) per client")
    coef=None
    if m and m['ratio'] is not None:
        note='Metaroad shows rank-1 ratio/flat; per-rank resolved damage in per_level'
        f1=per[0]['dmg_min']
        if m['flat'] is not None and f1 is not None and abs(m['flat']-f1)>0.5 and not (m['hits'] and m['hits']>1):
            note+=f"; CONFLICT flat: Metaroad {m['flat']:g} vs aion2.app rank-1 {f1:g}"; conflicts.append((o['name'],'flat',m['flat'],f1))
        coef={'atk_ratio_pct_rank1':m['ratio'],'flat_rank1':m['flat'],'hits':m['hits'],'stagger_gauge_damage':s_,'note':note}
    elif s_: coef={'atk_ratio_pct_rank1':None,'flat_rank1':None,'hits':None,'stagger_gauge_damage':s_,'note':'ratio/flat not on Metaroad'}
    if m and m['cd'] is not None and l1['cooldown'] and m['cd']!=l1['cooldown']: conflicts.append((o['name'],'cooldown',m['cd'],l1['cooldown']))
    skills.append({'name':o['name'],'name_kr':ko[sid],'skill_id':int(sid),'slug':slugs[sid],'category':CAT[sid],
     'client_type':det.get('Type'),'unlock_level':o['required_level'],'max_skill_level':len(L),
     'cooldown_s':l1['cooldown'],'cooldown_s_at_max_level':ll['cooldown'] if ll['cooldown']!=l1['cooldown'] else None,
     'cast_time_s':l1['casting_time'],'cost':{'mp':l1['cost_mp'],'hp':l1['cost_hp'],'dp':l1['cost_dp']},
     'range_m':float(rng.group(1)) if rng else None,'description':o['description'],'coefficients':coef,'effects':eff,
     'specializations':[{'unlock_level':s['rank'],'text':s['text']} for s in o['specs']],
     'properties':', '.join(o['properties']) or None,
     'damage_type_or_weapon':' / '.join(x for x in (det.get('Damage type'),det.get('Weapon')) if x) or None,
     'tags':T[sid].split(),'per_level':per,'icon':o['icon'],'icon_url':f"https://aion2.app/db-item-icons/{o['icon']}.webp",
     'source_url':f'https://aion2.app/db/skills/{sid}','source_url_secondary':'https://metaroad.gg/aion2/database/skills/assassin',
     'source_date':SRC_DATE,'metaroad_tag':m['tag'] if m else None})
for nm in('Clone Attack','Poison'):
    d=mby[nm][0]
    skills.append({'name':nm,'name_kr':None,'skill_id':None,'slug':slugify(nm)+'-system','category':'chain_or_system','client_type':d['tag'],
     'unlock_level':None,'max_skill_level':None,'cooldown_s':None,'cast_time_s':None,'cost':{'mp':None,'hp':None,'dp':None},'range_m':50.0,
     'description':None,'coefficients':None,
     'effects':['Metaroad system entry, no id, no text; backs Exploit Weakness clones' if nm=='Clone Attack' else 'Metaroad system entry, no id, no text; backs the Poison DoT'],
     'specializations':[],'tags':['system','proc'],'icon':None,'icon_url':None,'source_url':'https://metaroad.gg/aion2/database/skills/assassin',
     'source_url_secondary':None,'source_date':SRC_DATE,'metaroad_tag':d['tag']})
json.dump(skills,open('skills.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
json.dump(conflicts,open('_raw/conflicts.json','w',encoding='utf-8'),ensure_ascii=False)
print(len(skills),Counter(s['category'] for s in skills)); print(conflicts)
