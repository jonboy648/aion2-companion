import re,json,html,glob,os
from parse_probe import rsc,props
ROOT='D:/Aion2/research/classes/spiritmaster/'
def read(p): return open(p,encoding='utf-8').read()
def ptext(h):
    t=re.sub(r'<script.*?</script>','',h,flags=re.S);t=re.sub(r'<[^>]+>','|',t);t=re.sub(r'\|+','|',t)
    return html.unescape(t)
def slugify(n):
    return re.sub(r'[^a-z0-9]+','-',n.lower().replace("'",'').replace('\u2019','')).strip('-')
def num(x):
    if x is None or x=='': return None
    try:
        f=float(str(x).replace(',',''));return int(f) if f==int(f) else f
    except: return None
def resolve(txt,tv):
    def r(m):
        k=m.group(1)
        if not (tv and k in tv): return '?'
        return str(tv[k])+('s' if k.endswith(':time') else '')
    return re.sub(r'\{([^{}]+)\}',r,txt or '')
def load_page(i):
    h=read(f'{ROOT}raw/{i}.html'); t=ptext(h); p=props(rsc(h))
    name=html.unescape(re.search(r'<h1[^>]*>([^<]+)',h).group(1)).strip()
    hk=read(f'{ROOT}raw/ko/{i}.html'); nk=html.unescape(re.search(r'<h1[^>]*>([^<]+)',hk).group(1)).strip()
    im=re.search(r'/db-item-icons/([A-Za-z0-9_]+)\.webp',h); icon=im.group(1) if im else None
    rl=re.search(r'Required level\| \|(\d+)',t)
    det=t[t.find('Details|'):t.find('Game client')]
    def d(k):
        m=re.search(k+r'\|([^|]+)\|',det); return m.group(1).strip() if m else None
    chain=[]
    ci=rsc(h).find('"children":"Chain"')
    if ci>0:
        seg=rsc(h)[ci:ci+6000]
        seg=seg[:seg.find('"Details"')] if '"Details"' in seg else seg
        idsx=re.findall(r'\["\$","span","(\d{8})"',seg); ords=re.findall(r'"children":"(\d)/(\d)"',seg)
        names=re.findall(r'"text-sm text-gray-800 dark:text-\[#e6edf3\]","children":"([^"]+)"',seg)
        chain=[{'id':int(a),'name':n,'pos':f'{b[0]}/{b[1]}'} for a,n,b in zip(idsx,names,ords)]
    return dict(id=int(i),name=name,name_kr=nk,icon=icon,props=p,unlock=int(rl.group(1)) if rl else None,
        stigma='|Stigma|· |Stigma|' in t, mastery='Mastery' in t[:t.find('Details|')],
        ctype=d('Type'),dtype=d('Damage type'),weapon=d('Weapon'),range=d('Range'),max=num(d('Max')),
        stigma_pts=num(d('Stigma points')),chain=chain,text=t)
