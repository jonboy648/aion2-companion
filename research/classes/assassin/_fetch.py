import re,time,urllib.request,os
H={"User-Agent":"Mozilla/5.0 (personal-companion-app; low-rate)"}
ids=sorted(set(re.findall(r'/db/skills/(13\d+)',open('_list.html',encoding='utf-8').read())))
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=30).read().decode('utf-8')
for sid in ids:
    for loc,pre in(('en','https://aion2.app/db/skills/'),('ko','https://aion2.app/ko/db/skills/')):
        p=f'_raw/{sid}.{loc}.html'
        if os.path.exists(p): continue
        try: open(p,'w',encoding='utf-8').write(get(pre+sid))
        except Exception as e: print(sid,loc,e)
        time.sleep(0.45)
print(len(ids))
