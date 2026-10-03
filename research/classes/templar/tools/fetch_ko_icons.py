"""Fetch /ko pages (Korean names) and skill icons for Templar. Rate: >=0.4 s/request."""
import re,time,os,io,glob,html,urllib.request
from PIL import Image
H={"User-Agent":"Mozilla/5.0 (personal-companion-app; low-rate)"}
R='D:/Aion2/research/classes/templar/raw'
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=30).read()
ids=sorted(re.sub(r'\D','',os.path.basename(f)) for f in glob.glob(R+'/12*.html'))
for sid in ids:
    f=f'{R}/ko/{sid}.html'
    if not os.path.exists(f):
        open(f,'wb').write(get(f'https://aion2.app/ko/db/skills/{sid}')); time.sleep(0.45)
os.makedirs('D:/Aion2/assets/icons/templar',exist_ok=True)
for sid in ids:
    h=open(f'{R}/{sid}.html',encoding='utf-8').read()
    ic=re.search(r'/db-item-icons/([A-Za-z0-9_]+)\.webp',h)
    print(sid,ic and ic.group(1))
