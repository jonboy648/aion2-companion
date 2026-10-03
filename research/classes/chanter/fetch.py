import re,time,urllib.request,os
H={"User-Agent":"Mozilla/5.0 (personal-companion-app; low-rate)"}
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=30).read()
ids=sorted(set(re.findall(r'/db/skills/(\d+)',open('../../tmp/chanter_list.html',encoding='utf-8').read())))
open('ids.txt','w').write('\n'.join(ids))
for i in ids:
    for lang,p in (('en',''),('ko','ko/')):
        f=f'raw/{i}_{lang}.html'
        if os.path.exists(f): continue
        try: open(f,'wb').write(get(f'https://aion2.app/{p}db/skills/{i}'))
        except Exception as e: print(i,lang,e)
        time.sleep(.45)
print(len(ids))
