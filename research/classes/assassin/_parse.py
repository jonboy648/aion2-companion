import re,json,html,glob
def flight(h):
    return h.replace('\\\\\\"','\x01').replace('\\"','"').replace('\x01','\\"')
def txt(s):
    return html.unescape(re.sub(r'<[^>]+>','',s)).strip()
def parse(h):
    f=flight(h)
    o={}
    o['name']=txt(re.search(r'<h1[^>]*>(.*?)</h1>',h,re.S).group(1))
    hd=h[h.find('<h1'):h.find('<h1')+3000]
    cls=re.search(r'font-semibold text-teal[^"]*">([^<]+)</span>',hd)
    o['class']=cls.group(1) if cls else None
    # header spans after class
    m=re.search(r'font-semibold text-teal[^"]*">[^<]+</span><span[^>]*>([^<]+)</span>',h)
    o['kind']=m.group(1) if m else None
    m=re.search(r'Required level</span>.{0,40}?(\d+)',h[h.find('<h1'):h.find('<h1')+3000],re.S) or re.search(r'Required level.{0,60}?>(\d+)<',hd,re.S)
    o['required_level']=int(m.group(1)) if m else None
    i=f.find('"levels":['); 
    if i>=0:
        arr,_=json.JSONDecoder().raw_decode(f[i+9:]); o['levels']=arr
    else: o['levels']=[]
    m=re.search(r'<p class="text-sm[^"]*whitespace-pre-line">(.*?)</p>',h,re.S)
    o['description']=txt(m.group(1)) if m else None
    o['properties']=[txt(x) for x in re.findall(r'<p class="text-xs text-amber[^"]*">(.*?)</p>',h,re.S)]
    o['specs']=[]
    parts=re.split(r'<div class="flex items-start gap-2[^"]*"[^>]*>',h)[1:]
    for blk in parts:
        blk=blk.split('</section>')[0]
        lv=re.search(r'Level<!-- --> <!-- -->(\d+)',blk)
        if not lv: continue
        ic=re.search(r'/db-item-icons/([^"]+?)\.webp',blk)
        t=blk[blk.find('text-sm text-gray-700'):]
        t=t[t.find('>')+1:]
        tx=txt(t.split('</div>')[0])
        o['specs'].append({'rank':int(lv.group(1)),'text':tx,'icon':ic.group(1) if ic else None})
    j=h.find('>Details<')
    det={}
    if j>=0:
        seg=h[j:j+2500]
        for k,v in re.findall(r'>([A-Za-z ]+)</span><span[^>]*>([^<]+)</span>',seg): det[k]=v
        if not det:
            t=re.sub(r'<[^>]+>','|',seg); t=[x for x in re.sub(r'\|+','|',t).split('|') if x]
            det={t[i]:t[i+1] for i in range(1,min(len(t)-1,9),2)}
    o['details']=det
    ic=re.search(r'src="/db-item-icons/([^"]+?)\.webp"',h[h.find('<h1')-1200:h.find('<h1')])
    o['icon']=ic.group(1) if ic else None
    return o
if __name__=='__main__':
    import sys
    for p in sorted(glob.glob('_raw/13*.en.html')):
        o=parse(open(p,encoding='utf-8').read())
        print(p[5:13],o['name'],'|',o['class'],o['kind'],o['required_level'],len(o['levels']),o['icon'],o['details'],len(o['specs']))
