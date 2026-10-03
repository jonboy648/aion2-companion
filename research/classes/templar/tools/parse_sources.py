"""Parse the saved aion2.app skill pages and the Metaroad Templar page into intermediate JSON.

Inputs (saved by the fetch scripts): raw/<id>.html, raw/ko/<id>.html, raw/metaroad_templar.html
Outputs: raw/parsed_app.json, raw/parsed_metaroad.json
"""
import glob
import html as H
import json
import os
import re

R = "D:/Aion2/research/classes/templar/raw"


def text_of(fragment: str) -> str:
    fragment = re.sub(r"<!--.*?-->", "", fragment, flags=re.S)
    fragment = re.sub(r"<br\s*/?>", "\n", fragment)
    return H.unescape(re.sub(r"<[^>]+>", "", fragment))


def rsc(h: str) -> str:
    parts = re.findall(r'self\.__next_f\.push\(\[1,"(.*?)"\]\)</script>', h, flags=re.S)
    return "".join(json.loads('"' + p + '"') for p in parts)


def parse_app(sid: str) -> dict:
    h = open(f"{R}/{sid}.html", encoding="utf-8").read()
    s = rsc(h)
    m = re.search(r"<h1[^>]*>([^<]+)", h)
    name = H.unescape(m.group(1)).strip() if m else None
    ic = re.search(r"/db-item-icons/([A-Za-z0-9_]+)\.webp", h)
    out = {"skill_id": int(sid), "name": name, "icon": ic.group(1) if ic else None}
    cls = re.search(r'<span class="font-semibold[^"]*">([^<]+)</span><span>([^<]+)</span>', h)
    out["class"], out["client_type"] = (cls.group(1), cls.group(2)) if cls else (None, None)
    rl = re.search(r"Required level<!-- --> <!-- -->(\d+)", h)
    out["unlock_level"] = int(rl.group(1)) if rl else None
    desc = re.search(r'whitespace-pre-line"><span>(.*?)</span></p>', h, flags=re.S)
    out["description_rank1"] = text_of(desc.group(1)).strip() if desc else None
    prop = re.search(r'text-amber-600 dark:text-amber-400 whitespace-pre-line mt-2"><span>(.*?)</span>', h, flags=re.S)
    out["properties"] = text_of(prop.group(1)).strip() if prop else None
    out["specializations"] = []
    si = h.find(">Specialty<")
    if si >= 0:
        ends = [x for x in (h.find(">Chain<", si), h.find(">Details<", si)) if x > 0]
        seg = h[si:min(ends)] if ends else h[si:]
        for row in re.split(r'<div class="flex items-start gap-2', seg)[1:]:
            lm = re.search(r"Level<!-- --> <!-- -->(\d+)</span>", row)
            if not lm:
                continue
            body = row[lm.end():]
            body = re.sub(r"<img[^>]*>", "", body.split("<h2")[0].split("</section>")[0])
            out["specializations"].append({"unlock_level": int(lm.group(1)),
                                           "text": re.sub(r"\s+", " ", text_of(body)).strip()})
    out["chain"] = []
    ci = h.find(">Chain<")
    if ci >= 0:
        cend = h.find(">Details<", ci)
        cseg = re.sub(r"<!--.*?-->", "", h[ci:cend])
        out["chain"] = [{"name": H.unescape(n).strip(), "step": st}
                        for n, st in re.findall(r"([A-Za-z' :\-]+?)</[^>]+>(?:<[^>]+>)*?(\d/\d)<", cseg)]
    det = h[h.find(">Details<"):] if ">Details<" in h else ""
    out["details"] = {}
    for k, v in re.findall(r'<dt[^>]*>([^<]+)</dt><dd[^>]*>(.*?)</dd>', det, flags=re.S):
        out["details"][k.strip()] = text_of(v).strip()
    if not out["details"]:
        det_txt = re.sub(r"\s+", " ", text_of(re.sub(r"<script.*?</script>", "", det, flags=re.S)))
        out["details_raw"] = det_txt[:300]
    i = s.find('"levels":[')
    out["per_level"] = []
    if i >= 0:
        levels, _ = json.JSONDecoder().raw_decode(s[i + 9:])
        for lv in levels:
            def f(x):
                return float(x) if x not in (None, "") else None
            out["per_level"].append({
                "level": lv["level"], "dmg_min": f(lv.get("dmg_min")), "dmg_max": f(lv.get("dmg_max")),
                "heal_min": f(lv.get("heal_min")), "heal_max": f(lv.get("heal_max")),
                "cooldown_s": lv.get("cooldown"), "cost_mp": lv.get("cost_mp"),
                "cost_hp": lv.get("cost_hp"), "cost_dp": lv.get("cost_dp"),
                "cast_time_s": lv.get("casting_time"), "tokens": lv.get("token_values") or {}})
    mx = re.search(r"Max<!-- --> <!-- -->(\d+)", h)
    out["max_skill_level"] = int(mx.group(1)) if mx else None
    ko = f"{R}/ko/{sid}.html"
    out["name_kr"] = None
    if os.path.exists(ko):
        kh = open(ko, encoding="utf-8").read()
        km = re.search(r"<h1[^>]*>([^<]+)", kh)
        out["name_kr"] = H.unescape(km.group(1)).strip() if km else None
    jd = re.search(r'"dateModified":"([^"]+)"', s)
    out["date_modified"] = jd.group(1) if jd else None
    return out


def parse_metaroad() -> list[dict]:
    h = open(f"{R}/metaroad_templar.html", encoding="utf-8").read()
    out = []
    for art in re.findall(r"<article id=\"skill-.*?</article>", h, flags=re.S):
        name = text_of(re.search(r"<h3[^>]*>(.*?)</h3>", art, flags=re.S).group(1)).strip()
        span = re.search(r"</h3><span[^>]*>(.*?)</span>", art, flags=re.S).group(1)
        span_t = text_of(span)
        vm = re.search(r"(\d+)\s*variants?", span_t)
        tag = re.sub(r"\s*\d+\s*variants?.*$", "", span_t).strip()
        d = {"name": name, "tag": tag, "variants": int(vm.group(1)) if vm else None}
        p = re.search(r'<p class="whitespace-pre-line[^>]*>(.*?)</p>', art, flags=re.S)
        d["description"] = re.sub(r"\s+", " ", text_of(p.group(1))).strip() if p else None
        d["description_raw"] = text_of(p.group(1)).strip() if p else None
        kv = {}
        for k, v in re.findall(r'<span class="text-gray-500">([A-Za-z ]+?) <span class="text-purple-300">(.*?)</span></span>', art):
            kv[k.strip()] = v.strip()
        for k, v in re.findall(r"<dt[^>]*>([^<]+)</dt><dd[^>]*>(.*?)</dd>", art, flags=re.S):
            kv[k.strip()] = text_of(v).strip()
        d["fields"] = kv
        specs = re.findall(r'tabular-nums text-white">(\d+)</span></span>(.*?)</li>', art, flags=re.S)
        d["specs"] = [{"unlock_level": int(a), "text": text_of(b).strip()} for a, b in specs]
        if not specs:  # specs without a level badge (Vicious Strike family chain skills)
            ul = re.search(r"Specialisations</div><ul[^>]*>(.*?)</ul>", art, flags=re.S)
            if ul:
                d["specs"] = [{"unlock_level": None, "text": text_of(li).strip()}
                              for li in re.findall(r"<li[^>]*>(.*?)</li>", ul.group(1), flags=re.S)]
        out.append(d)
    return out


if __name__ == "__main__":
    ids = sorted(re.sub(r"\D", "", os.path.basename(f)) for f in glob.glob(R + "/12*.html"))
    app = [parse_app(i) for i in ids]
    json.dump(app, open(R + "/parsed_app.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    mr = parse_metaroad()
    json.dump(mr, open(R + "/parsed_metaroad.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(app), "app pages;", len(mr), "metaroad articles")
