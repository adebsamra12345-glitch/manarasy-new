"""
مقارنة A/B بين النماذج (base مقابل manarasy) على نقطتي /v1/evaluation-note و/v1/report-insight
قبل تثبيت قرار التوجيه (VLLM_MODEL_EVALUATION_NOTE / VLLM_MODEL_REPORT_INSIGHT).
يستخدم قوالب الـ prompts نفسها ومدخلات وهمية. يطبع: نسبة CJK، نسبة العربية، الطول، ثم عيّنات للمراجعة البشرية.
المتغيرات: VLLM_CHAT_URL, EVAL_MODELS (الافتراضي base,manarasy).
"""
import json
import os
import re
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.prompts_loader import PromptRegistry  # noqa: E402

URL = os.getenv("VLLM_CHAT_URL", "http://100.119.62.40:8000/v1/chat/completions")
MODELS = os.getenv("EVAL_MODELS", "base,manarasy").split(",")
CJK = re.compile("[　-鿿가-힯぀-ヿ]")
AR = re.compile("[؀-ۿ]")
reg = PromptRegistry(ROOT / "prompts")

NOTE_CASES = [
    dict(recitation_type=t, target_unit=u, grade=g, memorization_mistakes=m, tajweed_mistakes=j,
         behavior_score=b, requires_repeat=r, teacher_notes=n)
    for t, u, g, m, j, b, r, n in [
        ("حفظ جديد", "صفحة 12", "ممتاز", 0, 0, 10, False, ""),
        ("مراجعة", "صفحة 40", "جيد جداً", 1, 2, 9, False, "طالب مجتهد"),
        ("حفظ جديد", "صفحة 3", "مقبول", 5, 4, 6, True, "يحتاج إعادة"),
        ("مراجعة", "صفحة 7", "جيد", 2, 1, 8, False, ""),
        ("حفظ جديد", "صفحة 21", "ضعيف", 8, 6, 5, True, "قلة تحضير"),
    ]
]
INSIGHT_CASES = [
    dict(period=p, average_cpi=c, attendance_rate=a, total_pages=pg, total_halaqat=h, extra_context=x)
    for p, c, a, pg, h, x in [
        ("الشهر الحالي", "82%", "91%", 340, 6, ""),
        ("الأسبوع الماضي", "64%", "70%", 120, 4, "انخفاض الحضور"),
        ("الفصل", "90%", "96%", 1200, 10, ""),
    ]
]
ENDPOINTS = {
    "evaluation-note": ("evaluation_note", NOTE_CASES),
    "report-insight": ("circle_report_insight", INSIGHT_CASES),
}


def messages_for(prompt_id, case):
    tpl = reg.get(prompt_id)
    kw = dict(case)
    if "requires_repeat" in kw:
        kw["requires_repeat"] = "نعم" if kw["requires_repeat"] else "لا"
    kw["teacher_notes"] = kw.get("teacher_notes") or "لا توجد ملاحظات إضافية"
    if "extra_context" in kw:
        kw["extra_context"] = kw["extra_context"] or "لا يوجد"
    return tpl, tpl.render_messages(**kw)


def main():
    cl = httpx.Client(timeout=180)
    for ep, (pid, cases) in ENDPOINTS.items():
        print(f"\n=== /v1/{ep} ===")
        outs = {}
        for m in MODELS:
            rows = []
            for case in cases:
                tpl, msgs = messages_for(pid, case)
                r = cl.post(URL, json={"model": m, "messages": msgs, "temperature": tpl.temperature,
                                       "max_tokens": tpl.max_tokens,
                                       "chat_template_kwargs": {"enable_thinking": False}}).json()["choices"][0]
                rows.append(r["message"]["content"] or "")
            outs[m] = rows
        print(f"{'model':12}{'CJK':>6}{'arabic':>8}{'avg len':>9}")
        for m, rows in outs.items():
            cj = sum(bool(CJK.search(t)) for t in rows)
            ar = sum(len(AR.findall(t)) for t in rows) / max(1, sum(len(re.findall(r"\S", t)) for t in rows))
            print(f"{m:12}{cj:>4}/{len(rows):<2}{ar:>8.2f}{sum(map(len, rows)) / len(rows):>9.0f}")
        for i in range(min(2, len(cases))):
            print(f"\n--- عيّنة {i + 1}: {json.dumps(cases[i], ensure_ascii=False)}")
            for m in outs:
                print(f"[{m}] {outs[m][i][:400]}")
    print("\nالقرار النهائي بمراجعة بشرية للعيّنات؛ ثبّته عبر VLLM_MODEL_EVALUATION_NOTE / VLLM_MODEL_REPORT_INSIGHT.")


if __name__ == "__main__":
    main()
