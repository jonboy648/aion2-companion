"""Download every Templar skill icon (webp -> 256x256 PNG) and write assets/icons/templar/index.json.
Slug rule (data_contract.md section 3): lowercase, delete apostrophes, non-alnum runs -> '-'."""
import io, json, re, time, urllib.request
from PIL import Image
H = {"User-Agent": "Mozilla/5.0 (personal-companion-app; low-rate)"}
OUT = "D:/Aion2/assets/icons/templar"
skills = json.load(open("D:/Aion2/research/classes/templar/skills.json", encoding="utf-8"))
idx = {}
for e in skills:
    if e["skill_id"] is None:
        continue
    icon = re.search(r"/(ICON_[A-Za-z0-9_]+)\.webp", e["icon_url"]).group(1)
    url = f"https://aion2.app/db-item-icons/{icon}.webp"
    data = urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=30).read()
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    slug = re.sub(r"[^a-z0-9]+", "-", e["name"].lower().replace("'", "").replace("\u2019", "")).strip("-")
    if slug in idx:
        slug += "-" + str(e["skill_id"])
    im.save(f"{OUT}/{slug}.png")
    idx[slug] = {"name": e["name"], "source_url": url, "size": f"{im.width}x{im.height}",
                 "skill_id": str(e["skill_id"]), "icon": icon}
    time.sleep(0.45)
json.dump(idx, open(f"{OUT}/index.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(len(idx), "icons")
