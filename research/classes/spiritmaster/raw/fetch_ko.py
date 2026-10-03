import re,time,urllib.request,os,glob
H={"User-Agent":"Mozilla/5.0 (personal-companion-app; low-rate)"}
for f in sorted(glob.glob('D:/Aion2/research/classes/spiritmaster/raw/16*.html')):
    i=os.path.basename(f)[:8]; p=f'D:/Aion2/research/classes/spiritmaster/raw/ko/{i}.html'
    if os.path.exists(p): continue
    try: b=urllib.request.urlopen(urllib.request.Request(f'https://aion2.app/ko/db/skills/{i}',headers=H),timeout=30).read()
    except Exception as e: print(i,e); time.sleep(.5); continue
    open(p,'wb').write(b); time.sleep(.45)
print(len(os.listdir('D:/Aion2/research/classes/spiritmaster/raw/ko')))
