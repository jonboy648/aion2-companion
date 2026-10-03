import re,time,urllib.request,os
H={"User-Agent":"Mozilla/5.0 (personal-companion-app; low-rate)"}
s=open('D:/Aion2/research/tmp/sm_db.xml',encoding='utf-8').read()
ids=sorted(set(re.findall(r'/db/skills/(16\d+)',s)))
for i in ids:
    p=f'D:/Aion2/research/classes/spiritmaster/raw/{i}.html'
    if os.path.exists(p): continue
    try: b=urllib.request.urlopen(urllib.request.Request(f'https://aion2.app/db/skills/{i}',headers=H),timeout=30).read()
    except Exception as e: print(i,e); time.sleep(.5); continue
    open(p,'wb').write(b); time.sleep(.45)
print('done',len(os.listdir('D:/Aion2/research/classes/spiritmaster/raw')))
