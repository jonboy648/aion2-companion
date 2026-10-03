from build_skills import *

def build_idless(m):
    st=m['stats']; desc=m['description']; s2=mr_stats(m)
    cdv=st.get('Cooldown'); cd=num(cdv.rstrip('s')) if cdv else None
    mp=num(st.get('MP')) if st.get('MP') else None
    rng=num(st['Range'].rstrip('m')) if st.get('Range') else None
    n=m['name']
    if re.match(r'^(Fire|Water|Wind|Earth|Ancient) Spirit:',n): cat='spirit_skill'
    elif n.startswith('PvP') or n.startswith('Elemental Immunity'): cat='system_passive'
    else: cat='chain_or_system'
    coef=None
    if s2['ratio'] is not None or s2['flat'] is not None:
        coef={'atk_ratio_pct_rank1':s2['ratio'],'flat_rank1':s2['flat'],'hits':hits_of(desc),
              'stagger_gauge_damage':stagger_of(desc),
              'note':'Metaroad rank-1 values; no client rank table (id-less entry)'}
    specs=[{'unlock_level':None,'text':t} for t in m['specs']]
    if not desc and specs and specs[0]['text'].startswith('Summons'):
        desc=re.sub(r'</?chat_combat>?','',specs[0]['text']); specs=specs[1:]
    eff=[]
    if m['variants']: eff.append(f"Metaroad variants (ranks): {m['variants']}")
    vc=variants_count(n)
    if vc: eff.append(f'Metaroad specialization variants listed: {vc}')
    tag=None
    if m['tags']: tag=m['tags'].strip().rstrip('·').strip()+' ·'
    return {'name':n,'name_kr':None,'skill_id':None,'category':cat,'client_type':None,
      'unlock_level':None,'max_skill_level':None,'cooldown_s':cd,'cooldown_s_at_max_level':None,
      'cast_time_s':None,'cost':{'mp':mp,'hp':None,'dp':None},'range_m':rng,'description':desc,
      'coefficients':coef,'effects':eff,
      'specializations':specs,
      'properties':None,'damage_type_or_weapon':st.get('Weapon'),'per_level':[],
      'icon':None,'icon_url':None,
      'source_url':'https://metaroad.gg/aion2/database/skills/spiritmaster','source_url_secondary':None,
      'source_date':SRC_DATE_MR,'metaroad_tag':tag}

def main():
    out=[]
    ids=sorted(os.path.basename(f)[:8] for f in glob.glob(ROOT+'raw/16*.html'))
    for i in ids: out.append(build(load_page(i)))
    names_with_id={e['name'] for e in out}
    for m in mr:
        n=m['name']
        if '[' in n or n=='Basic Attack': continue
        if n in used: continue
        if n in names_with_id and n!='Spirit Protection': continue
        out.append(build_idless(m))
    for m in mr:
        if m['name']=='Earth Chain [Frugal]': out.append(build_idless(dict(m,name='Earth Chain')))
    return out

if __name__=='__main__':
    import collections
    sk=main()
    json.dump(sk,open(ROOT+'raw/skills_stage1.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
    print(len(sk)); print(collections.Counter(e['category'] for e in sk))
    print([e['name'] for e in sk if e['skill_id'] is None])
