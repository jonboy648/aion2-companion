import json,io,time,urllib.request
from PIL import Image
H={"User-Agent":"Mozilla/5.0 (personal-companion-app; low-rate)"}
OUT='D:/Aion2/assets/icons/assassin'
sk=json.load(open('skills.json',encoding='utf-8'))
cache={}; idx={}
for s in sk:
    if not s['icon']: continue
    ic=s['icon']
    if ic not in cache:
        u=f'https://aion2.app/db-item-icons/{ic}.webp'
        data=urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=30).read()
        cache[ic]=Image.open(io.BytesIO(data)).convert('RGBA'); time.sleep(0.45)
    im=cache[ic]; im.save(f"{OUT}/{s['slug']}.png")
    idx[s['slug']]={'name':s['name'],'source_url':f'https://aion2.app/db-item-icons/{ic}.webp','size':f'{im.width}x{im.height}','skill_id':str(s['skill_id']),'icon':ic}
json.dump(idx,open(f'{OUT}/index.json','w',encoding='utf-8'),indent=1,ensure_ascii=False)
print(len(idx),'icons',len(cache),'unique art',{k:v.size for k,v in list(cache.items())[:2]})
