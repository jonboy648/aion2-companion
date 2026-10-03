import re,json,collections
s=open('mr_rsc.txt',encoding='utf-8').read()
dec=json.JSONDecoder()
def flat(c):
    if isinstance(c,str): return c
    if isinstance(c,list):
        if len(c)>=4 and c[0]=='$': return flat(c[3].get('children')) if isinstance(c[3],dict) else ''
        return ''.join(flat(x) for x in c)
    return ''
def walk(c,acc):
    if isinstance(c,list):
        if len(c)>=4 and c[0]=='$' and isinstance(c[3],dict):
            if c[1]=='img': acc['imgs'].append(c[3].get('src'))
            if c[1]=='li': acc['li'].append(c[3].get('children'))
            walk(c[3].get('children'),acc)
        else:
            for x in c: walk(x,acc)
out=[]
for m in re.finditer(r'\["\$","article","([^"]*)",',s):
    node,_=dec.raw_decode(s[m.start():])
    ch=node[3]['children']
    try:
        hdr=ch[0][3]['children'];sp=hdr[1][3]['children']
        ent={'name':node[2],'tags':sp[0] if isinstance(sp[0],str) else '', 'variants':sp[1]}
    except Exception:
        ent={'name':node[2],'tags':'','variants':1}
    d=ch[1][3]['children'] if isinstance(ch[1],list) else []
    if isinstance(d,str): d=[d]
    ent['description']=flat(d)
    ent['values']=[flat(x) for x in d if isinstance(x,list) and x and x[0]=='$']
    ent['specs']=[]
    for blk in ch[2:]:
        if isinstance(blk,list):
            acc={'imgs':[],'li':[]};walk(blk,acc)
            for l in acc['li']: ent['specs'].append(flat(l))
    # stats lines (attack ratio, flat, etc.) from blocks that are not spec
    stats={}
    for blk in ch[2:]:
        if isinstance(blk,list):
            t=flat(blk)
            for k in ['Attack ratio','Flat','Hits','Stagger','Range','Weapon','Cooldown','MP','Cost']:
                mm=re.search(k+r'\s*([0-9.,\-–]+[a-z%]*|[A-Za-z ]+?)(?=Attack ratio|Flat|Hits|Stagger|Range|Weapon|Cooldown|MP|$|Specialisations)',t)
                if mm: stats.setdefault(k,mm.group(1).strip())
    ent['stats']=stats
    out.append(ent)
json.dump(out,open('metaroad_raw.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(out))
c=collections.Counter()
for e in out:
    for k in e['stats']: c[k]+=1
print(c)
