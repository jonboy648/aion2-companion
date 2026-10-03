import re,html,json,sys
sys.path.insert(0,'/d/Aion2/app')
def clean(s): return re.sub(r'\s+',' ',html.unescape(s)).strip()
def parse_page(path):
    raw=open(path,encoding='utf-8').read()
    t=raw.replace('\\"','"')
    d={}
    d['skill_id']=int(re.search(r'rel="canonical" href="https://aion2\.app/(?:ko/)?db/skills/(\d+)"',t).group(1))
    d['name']=clean(re.search(r'<h1[^>]*>([^<]+)',raw).group(1))
    d['icon']=re.search(r'"image":"https://aion2\.app/db-item-icons/([A-Za-z0-9_]+)\.webp"',t).group(1)
    # header chips
    m=re.search(r'font-semibold text-teal-700[^>]*>([^<]+)</span>(.*?)</div></div></div>',raw,re.S)
    chips=[clean(x) for x in re.findall(r'<span>(.*?)</span>',m.group(2))] if m else []
    d['chips']=[re.sub(r'<[^>]+>|<!-- -->','',c) for c in chips]
    # levels
    i=t.find('"levels":['); 
    j=t.find(',"description"',i) if i>0 else -1
    lv=[]
    for mm in re.finditer(r'\{"level":(\d+),"cooldown":([\d.]+),"cost_mp":([\d.]+),"cost_hp":([\d.]+),"cost_dp":([\d.]+),"casting_time":([\d.]+),"dmg_min":(null|"[\d.]+"),"dmg_max":(null|"[\d.]+"),"heal_min":(null|"[\d.]+"),"heal_max":(null|"[\d.]+"),"token_values":(\{[^}]*\})',t):
        f=lambda x:None if x=='null' else float(x.strip('"'))
        lv.append(dict(level=int(mm.group(1)),dmg_min=f(mm.group(7)),dmg_max=f(mm.group(8)),heal_min=f(mm.group(9)),heal_max=f(mm.group(10)),cooldown_s=float(mm.group(2)),cost_mp=float(mm.group(3)),cost_hp=float(mm.group(4)),cost_dp=float(mm.group(5)),cast_time_s=float(mm.group(6)),tokens=json.loads(mm.group(11))))
    seen={};[seen.setdefault(x['level'],x) for x in lv]; d['per_level']=[seen[k] for k in sorted(seen)]
    # visible text
    b=raw[raw.find('<main'):]
    b=re.sub(r'<script.*?</script>','',b,flags=re.S)
    v=re.sub(r'<!-- -->','',b)
    v=re.sub(r'<[^>]+>','|',v); v=re.sub(r'\|+','|',v); v=html.unescape(v)
    d['vis']=v[:v.find('Game client')] if 'Game client' in v else v[:3000]
    return d
if __name__=='__main__':
    import glob
    for f in sorted(glob.glob('raw/*_en.html')):
        d=parse_page(f); print(d['skill_id'],d['name'],d['chips'],len(d['per_level']),d['per_level'][0]['cost_mp'] if d['per_level'] else '')
