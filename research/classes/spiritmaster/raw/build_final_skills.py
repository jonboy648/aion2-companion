import sys,os,json,re
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from build_skills2 import main, ROOT
from build_common import slugify
from meta import *
sk=main()
idx=json.load(open('D:/Aion2/assets/icons/spiritmaster/index.json',encoding='utf-8'))
by_id={int(v['skill_id']):k for k,v in idx.items()}
used_keys=set(idx)
out=[]
for e in sorted(sk,key=lambda x:(x['skill_id'] is None,x['skill_id'] or 0)):
    if e['skill_id'] in by_id: key=by_id[e['skill_id']]
    else:
        key=slugify(e['name'])
        if key in used_keys: key+='-'+str(e['skill_id'])
    used_keys.add(key); e['key']=key
FALL={'Fire Spirit':'summon-fire-spirit','Water Spirit':'summon-water-spirit','Wind Spirit':'summon-wind-spirit',
      'Earth Spirit':'summon-earth-spirit','Ancient Spirit':'summon-ancient-spirit'}
for e in sk:
    n=e['name']
    e['icon_slug']=by_id.get(e['skill_id'])
    if e['icon_slug'] is None and e['skill_id'] is None:
        m=re.match(r'^(\w+ Spirit):',n)
        if m: e['icon_slug']=FALL[m.group(1)]
        elif n.startswith('Jointstrike: Destructive Attack'): e['icon_slug']='jointstrike-destructive-attack'
        elif n.startswith('Elemental Fusion'): e['icon_slug']='elemental-fusion'
        elif n.startswith('Dimensional Control'): e['icon_slug']='dimensional-control'
        elif n=='Earth Chain': e['icon_slug']='summon-earth-spirit'
        elif n=='Lethargy': e['icon_slug']='summon-wind-spirit'
    # element
    tag=(e['metaroad_tag'] or '')
    el=next((w.lower() for w in ('Fire','Water','Wind','Earth') if f'· {w} ·' in tag or tag.startswith(w)),None)
    if el is None:
        m=re.match(r'^(Fire|Water|Wind|Earth|Ancient) Spirit',n) or re.match(r'^(?:Summon|Dismiss): (Fire|Water|Wind|Earth|Ancient) Spirit',n)
        el=m.group(1).lower() if m else None
    if n in('Lethargy',): el='wind'
    if n=='Earth Chain': el='earth'
    e['element']=el or 'none'
    # kind
    cat=e['category']
    kind={'active':'active','passive':'passive','stigma':'stigma','system_passive':'system','basic_dodge':'dodge',
          'chain_or_hidden_active':'chain','chain_or_hidden':'proc','chain_or_system':'system','spirit_skill':'proc'}[cat]
    if n.startswith(('Jointstrike: Destructive Attack -','Elemental Fusion -')): kind='charge_tier'
    if (n+'|'+str(e['skill_id'])) in KIND: kind=KIND[n+'|'+str(e['skill_id'])]
    e['kind']=kind
    tags=[]
    if n in MANUAL: tags.append('manual')
    if cat=='spirit_skill': tags.append('spirit')
    if n.startswith('PvP') : tags.append('pvp')
    roles=list(ROLES.get(n,[]))
    if e['properties']=='Mobile' and 'mobility' not in roles: roles.append('mobility')
    tags+=['role:'+r for r in roles]
    e['tags']=tags
# unlinked: nothing yet
order=['key','name','name_kr','skill_id','category','kind','element','tags']
final=[]
for e in sk:
    d={k:e[k] for k in order}
    d.update({k:v for k,v in e.items() if k not in order and k!='icon_slug' and k!='icon'})
    d['icon']=e['icon']; d['icon_slug']=e['icon_slug']
    final.append(d)
json.dump(final,open(ROOT+'skills.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
json.dump(sk,open(ROOT+'raw/skills_stage1.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
import collections
print(len(final),collections.Counter(e['element'] for e in final),collections.Counter(e['kind'] for e in final))
print(len({e['key'] for e in final}),'unique keys')
print([ (e['key']) for e in final if e['skill_id'] is None][:60])
print('no icon_slug:',[e['name'] for e in final if not e['icon_slug']])
