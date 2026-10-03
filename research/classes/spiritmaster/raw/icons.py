import json,io,os,time,urllib.request,re,sys
from PIL import Image
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from build_common import slugify
H={"User-Agent":"Mozilla/5.0 (personal-companion-app; low-rate)"}
OUT='D:/Aion2/assets/icons/spiritmaster'
os.makedirs(OUT,exist_ok=True)
sk=json.load(open('D:/Aion2/research/classes/spiritmaster/raw/skills_stage1.json',encoding='utf-8'))
cache={}; missing=[]
idx={}
for e in sorted([x for x in sk if x['skill_id'] and x['icon']],key=lambda x:x['skill_id']):
    ic=e['icon']
    if ic not in cache:
        u=f'https://aion2.app/db-item-icons/{ic}.webp'
        b=urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=30).read()
        time.sleep(.4)
        try: cache[ic]=Image.open(io.BytesIO(b)).convert('RGBA')
        except Exception: cache[ic]=None; missing.append((e['skill_id'],e['name'],ic))
    if cache[ic] is None: continue
    im=cache[ic]
    slug=slugify(e['name'])
    if slug in idx: slug+='-'+str(e['skill_id'])
    im.save(f'{OUT}/{slug}.png')
    idx[slug]={'name':e['name'],'source_url':f'https://aion2.app/db-item-icons/{ic}.webp','size':f'{im.width}x{im.height}',
               'skill_id':str(e['skill_id']),'icon':ic}
json.dump(idx,open(f'{OUT}/index.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
print('missing',missing); print(len(idx),'saved;',len(cache),'unique icon art;',sorted({v['size'] for v in idx.values()}))
