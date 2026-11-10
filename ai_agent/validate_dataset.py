# -*- coding: utf-8 -*-
"""يتحقق من سلامة البيانات: الحقول، صلاحية المسارات مقابل App.jsx، عدم تسرّب النصوص بين التقسيمات."""
import json, re, os, sys
H = os.path.dirname(os.path.abspath(__file__)); D = H + "/data"
app = open(H + "/../frontend/src/App.jsx", encoding="utf-8").read()
# مسارات حقيقية: بادئة الدور + مسار فرعي
real = set()
for blk in re.finditer(r'path="(/[a-z-]+)"[\s\S]*?(?=<Route\s+path="/[a-z-]+"|path="\*")', app):
    pre = blk.group(1)
    for m in re.finditer(r'<Route\s+path="([^"/][^"]*)"', blk.group(0)): real.add(pre + "/" + m.group(1))
def valid(route):
    r = re.sub(r"\{\w+\}", ":x", route)
    return any(re.fullmatch(re.sub(r":\w+", "[^/]+", x), r) for x in real)
errs, texts, n = [], {}, 0
for sp in ("train", "val", "test"):
    for line in open(f"{D}/{sp}.jsonl", encoding="utf-8"):
        s = json.loads(line); n += 1
        for k in ("text","role","channel","intent","slots","action","requires_confirmation"):
            if k not in s: errs.append(f"{sp}: missing {k} {s.get('id')}")
        if not s["text"].strip(): errs.append(f"empty text {s['id']}")
        r = s["action"].get("route")
        if r and not valid(r): errs.append(f"bad route {r}")
        texts.setdefault(s["text"], set()).add(sp)
leak = [t for t, v in texts.items() if len(v) > 1]
print(f"samples={n} routes_known={len(real)} errors={len(errs)} leaked_texts={len(leak)}")
for e in errs[:15]: print(" -", e)
sys.exit(1 if errs or leak else 0)
