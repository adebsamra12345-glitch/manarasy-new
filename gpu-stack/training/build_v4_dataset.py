#!/usr/bin/env python3
"""يبني train_v4_mixed.jsonl / val_v4_mixed.jsonl = بيانات v4 أحادية الدور (generate_dataset.py --suffix v4)
+ بيانات v3 متعددة الأدوار (unified_*.jsonl: محادثة، KB، بيانات ثم جواب، حقن في نتائج الأدوات...).

لماذا الدمج: v3 أضاف قدرات المحادثة لكنه تراجع في missing_param/rbac؛ بيانات v4 تعالج ذلك ويبقى ما تعلمه v3.
الاتساق: تُستبدل مواصفات الأدوات في كل صف بـ specs_for(role) الحالية (نفس ما يراه النموذج وقت التقديم)،
وتُسقَط الصفوف التي يخالف فيها أي استدعاء أداة مخطط الأداة، أو يتسرب فيها نص من التقييم الذهبي.
الاستخدام: python training/build_v4_dataset.py [مجلد البيانات]   (الافتراضي gpu-stack/data)
"""
import json
import os
import random
import sys
from collections import Counter
from pathlib import Path

import jsonschema

os.environ.setdefault("AGENT_UI_TOOL", "1")
ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "orchestrator"))

from app.agent_tools import specs_for  # noqa: E402

DATA = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "gpu-stack" / "data"
GOLDEN = {c["utterance"].strip() for c in json.loads((ROOT / "orchestrator" / "eval" / "golden_ar.json").read_text(encoding="utf-8"))}
ROLE_MAP = {"teacher": "TEACHER", "manager": "CENTER_MANAGER", "TEACHER": "TEACHER",
            "CENTER_MANAGER": "CENTER_MANAGER", "TENANT_ADMIN": "TENANT_ADMIN"}


def load(name):
    p = DATA / name
    return [json.loads(x) for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]


def retool(row, drops):
    """يعيد ضبط tools ويتحقق من كل استدعاء. يرجع None إن وجب إسقاط الصف."""
    if not row.get("tools"):
        return row
    role = ROLE_MAP.get(row.get("role", ""), "TEACHER")
    specs = specs_for(role)
    schemas = {s["function"]["name"]: s["function"]["parameters"] for s in specs}
    for m in row["messages"]:
        if m["role"] == "user" and any(g in m["content"] for g in GOLDEN):
            drops["golden_leak"] += 1
            return None
        for tc in m.get("tool_calls") or []:
            fn = tc["function"]
            try:
                if fn["name"] not in schemas:
                    raise ValueError("tool not allowed for role")
                jsonschema.validate(json.loads(fn["arguments"]), schemas[fn["name"]])
            except Exception:
                drops["bad_tool_call"] += 1
                return None
    row = dict(row)
    row["tools"] = specs
    return row


def main():
    drops = Counter()
    out = {}
    for split, single, unified in (("train", "train_v4.jsonl", "unified_train.jsonl"), ("val", "val_v4.jsonl", "unified_val.jsonl")):
        rows = load(single)
        uni_raw = load(unified)
        uni = [r for r in (retool(x, drops) for x in uni_raw) if r]
        out[split] = rows + uni
        print(f"{split}: v4_single={len(rows)} unified={len(uni)}/{len(uni_raw)}")
    rng = random.Random(11)
    for split, rows in out.items():
        rng.shuffle(rows)
        for i, r in enumerate(rows, 1):
            r["id"] = f" mixed-{split}-{i:05d}"
        (DATA / f"{split}_v4_mixed.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    cats = Counter(r["category"] for r in out["train"])
    print("dropped:", dict(drops))
    print("train categories:", dict(cats))


if __name__ == "__main__":
    main()
