"""يبني train_mixed.jsonl / val_mixed.jsonl: بيانات الأدوات (train/val.jsonl) + كتابة عامة self-distilled (general_pairs.jsonl)."""
import json, os, random
from pathlib import Path
SFX = f"_{os.environ['DATA_SUFFIX']}" if os.environ.get("DATA_SUFFIX") else ""  # مثال: DATA_SUFFIX=v3
DATA = Path(__file__).resolve().parent.parent.parent / "gpu-stack" / "data"
r = random.Random(11)
gen = [json.loads(l) for l in (DATA / "general_pairs.jsonl").read_text(encoding="utf-8").splitlines()]
r.shuffle(gen)
def row(g):
    return {"id": "", "category": "general_writing", "dialect": "فصحى", "role": "teacher", "tools": [],
            "messages": [{"role": "system", "content": "أنت مساعد عربي مفيد ودقيق."},
                         {"role": "user", "content": g["p"]}, {"role": "assistant", "content": g["a"]}]}
gv, gt = gen[:25], gen[25:]
load = lambda n: [json.loads(l) for l in (DATA / n).read_text(encoding="utf-8").splitlines() if l.strip()]
tr = load(f"train{SFX}.jsonl") + [row(g) for g in gt]
va = load(f"val{SFX}.jsonl") + [row(g) for g in gv]
r.shuffle(tr); r.shuffle(va)
for n, d in ((f"train_mixed{SFX}.jsonl", tr), (f"val_mixed{SFX}.jsonl", va)):
    (DATA / n).write_text("\n".join(json.dumps(x, ensure_ascii=False) for x in d) + "\n", encoding="utf-8")
print(f"train={len(tr)} (general={len(gt)}) val={len(va)}")
