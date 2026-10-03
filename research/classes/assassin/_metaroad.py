import re,html,json
def load():
    h=open('_raw/metaroad.html',encoding='utf-8').read()
    t=re.sub(r'<script.*?</script>|<style.*?</style>','',h,flags=re.S); t=re.sub(r'<[^>]+>','|',t); t=html.unescape(re.sub(r'\|+','|',t))
    i=t.find('Skills| (50)|'); t=t[i:]
    parts=re.split(r'\|([^|]+)\|((?:Active|Passive|Basic|System|Stigma)[^|]*·\s*)\|(\d+)\| variants?\|(?:s\|)?',t)
    out=[]
    for k in range(1,len(parts),4):
        name,tag,var,body=parts[k],parts[k+1],parts[k+2],parts[k+3]
        d={'name':name,'tag':tag.strip(),'variants':int(var),'body':body}
        m=re.search(r'Attack ratio \|([\d.]+)%',body); d['ratio']=float(m.group(1)) if m else None
        m=re.search(r'Flat \|([\d.]+)',body); d['flat']=float(m.group(1)) if m else None
        m=re.search(r'Hits \|(\d+)',body); d['hits']=int(m.group(1)) if m else None
        m=re.search(r'Cooldown\|([\d.]+)s',body); d['cd']=float(m.group(1)) if m else None
        m=re.search(r'\|MP\|(\d+)',body); d['mp']=int(m.group(1)) if m else None
        out.append(d)
    return out
if __name__=='__main__':
    o=load(); print(len(o))
    for d in o: print(d['name'],'|',d['tag'],d['variants'],d['ratio'],d['flat'],d['hits'],d['cd'],d['mp'])
