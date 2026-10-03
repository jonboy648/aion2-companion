import re,html,json
def txt(s): return html.unescape(re.sub(r'<[^>]+>','',s)).strip()
def parse_mr(path='raw/metaroad_chanter.html'):
    h=open(path,encoding='utf-8').read().replace('<!-- -->','')
    out=[]
    for a in re.findall(r'<article id="skill-[^"]*".*?</article>',h,flags=re.S):
        d={}
        d['id_attr']=re.search(r'id="(skill-[^"]*)"',a).group(1)
        d['name']=txt(re.search(r'<h3[^>]*>(.*?)</h3>',a,re.S).group(1))
        sp=txt(re.search(r'<span class="text-\[10px\][^>]*>(.*?)</span>',a,re.S).group(1))
        d['meta_head']=sp
        m=re.search(r'<p class="whitespace-pre-line[^>]*>(.*?)</p>',a,re.S)
        d['description']=txt(m.group(1)) if m else None
        stats={}
        for k,v in re.findall(r'<span class="text-gray-500">([A-Za-z ]+?) <span class="text-purple-300">(.*?)</span></span>',a): stats[k.strip()]=txt(v)
        d['stats']=stats
        d['specs']=[]
        sec=re.search(r'Specialisations</div><ul.*?</ul>',a,re.S)
        if sec:
            for li in re.findall(r'<li.*?</li>',sec.group(0),re.S):
                lv=re.search(r'tabular-nums text-white">(\d+)</span>',li)
                icon=re.search(r'spec-icons/([^"]+)"',li)
                d['specs'].append({'unlock_level':int(lv.group(1)) if lv else None,'text':txt(re.sub(r'<span class="relative.*?</span></span>','',li,flags=re.S)),'icon':icon.group(1) if icon else None})
        dl={}
        for dl_ in re.findall(r'<dt class="text-gray-600">(.*?)</dt><dd[^>]*>(.*?)</dd>',a,re.S): dl[txt(dl_[0])]=txt(dl_[1])
        d['dl']=dl
        out.append(d)
    return out
if __name__=='__main__':
    o=parse_mr(); json.dump(o,open('raw/metaroad_parsed.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
    for d in o: print(d['id_attr'],'|',d['meta_head'],'|',d['stats'].get('Attack ratio'),d['dl'])
