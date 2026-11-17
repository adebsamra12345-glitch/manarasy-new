#!/usr/bin/env python3
"""v5 = train_v4_mixed (v4 أحادي الدور + v3 متعدد الأدوار) + v5_extra (توضيح/صلاحيات/حقن/تنقل).
يتحقق من مخططات الأدوات ويُسقط أي تسرب لعبارات التقييم (golden/ui_golden/router_regression).
الاستخدام: python training/build_v5_dataset.py [مجلد البيانات]  (يتطلب train_v4_mixed.jsonl و v5_extra_*.jsonl فيه)
"""
import json
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_v4_dataset as B4  # noqa: E402  (يستورد specs_for ويضبط المسارات)
from v5_extra import _held_out  # noqa: E402

DATA = B4.DATA
HELD = _held_out()


def main():
    drops = Counter()
    out = {}
    for split in ("train", "val"):
        base = B4.load(f"{split}_v4_mixed.jsonl")
        extra = B4.load(f"v5_extra_{split}.jsonl")
        rows = []
        for r in base + extra:
            r = B4.retool(r, drops)
            if r is None:
                continue
            if any(m["role"] == "user" and m["content"].strip() in HELD for m in r["messages"]):
                drops["heldout_leak"] += 1
                continue
            rows.append(r)
        out[split] = rows
        print(f"{split}: base={len(base)} extra={len(extra)} -> {len(rows)}")
    rng = random.Random(5)
    for split, rows in out.items():
        rng.shuffle(rows)
        for i, r in enumerate(rows, 1):
            r["id"] = f" v5-{split}-{i:05d}"
        (DATA / f"{split}_v5_mixed.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    print("dropped:", dict(drops))
    print("train categories:", dict(Counter(r["category"] for r in out["train"])))


if __name__ == "__main__":
    main()
