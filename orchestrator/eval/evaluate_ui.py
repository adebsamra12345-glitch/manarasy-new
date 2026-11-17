#!/usr/bin/env python3
"""تقييم أوامر الواجهة (تنقل/نوافذ/خروج) على عبارات خارج بيانات التدريب: eval/ui_golden_ar.json.

يقيس: دقة المسار النهائي (الموجّه الحتمي أو النموذج)، ونسبة التحويل الخاطئ لتنقل في طلبات البيانات،
واحترام الصلاحيات. يتطلب نموذجاً حياً لأن العبارات صُممت لتتجاوز الموجّه:
    EVAL_LIVE_VLLM=1 EVAL_TAG=v3 AGENT_UI_TOOL=1 VLLM_BASE_URL=http://<ts-ip>:8000/v1 \
    VLLM_MODEL_AGENT=manarasy python eval/evaluate_ui.py
يكتب gpu-stack/data/eval_ui_<tag>.json للمقارنة بين v2 وv3. يخرج بكود 1 إن لم تتحقق البوابة.
بوابة القبول: دقة التنقل ≥ 90% و«تحويل خاطئ» = 0 و«خرق صلاحيات» = 0.
"""
import json
import logging
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("ORCHESTRATOR_SERVICE_KEY", "eval-secret-service-key-32-bytes")
os.environ.setdefault("AGENT_BACKEND", "mock")
os.environ.setdefault("RATE_LIMIT_TEACHER_PER_MIN", "500")
os.environ.setdefault("RATE_LIMIT_MANAGER_PER_MIN", "500")
os.environ.setdefault("RATE_LIMIT_ADMIN_PER_MIN", "500")

from fastapi.testclient import TestClient

from app.agent_backend import reset_mock_backend
from app.main import app
from app.rate_limit import rate_limiter
from app.resilience import llm_circuit

logging.getLogger("manarasy.orchestrator").setLevel(logging.WARNING)

GATE_NAV_ACCURACY = 90.0


def _routes(actions):
    return [a.get("route") for a in actions if a.get("type") == "navigate"]


def main() -> int:
    if os.getenv("EVAL_LIVE_VLLM", "0") != "1":
        print("هذا التقييم يتطلب نموذجاً حياً (EVAL_LIVE_VLLM=1) على جهاز الـ GPU.")
        return 2
    cases = json.loads((Path(__file__).resolve().parent / "ui_golden_ar.json").read_text(encoding="utf-8"))["cases"]
    tag = os.getenv("EVAL_TAG", "live")
    client = TestClient(app)
    nav_total = nav_ok = false_ui = role_breach = 0
    rows = []
    for c in cases:
        reset_mock_backend(); rate_limiter.reset(); llm_circuit.reset()
        headers = {"Authorization": f"Bearer {os.environ['ORCHESTRATOR_SERVICE_KEY']}", "X-User-Id": f"ui-{c['id']}",
                   "X-User-Role": c["role"], "X-Tenant-Id": "t1"}
        t0 = time.perf_counter()
        r = client.post("/v1/agent/turn", headers=headers, json={"utterance": c["utterance"], "halaqat_ids": ["h1", "h2"]})
        ms = (time.perf_counter() - t0) * 1000
        d = r.json() if r.status_code == 200 else {}
        actions = d.get("ui_actions") or []
        ex = c["expect"]
        ok = True
        if "route" in ex:
            nav_total += 1
            ok = ex["route"] in _routes(actions)
            nav_ok += ok
        elif "action" in ex:
            nav_total += 1
            ok = any(a.get("type") == ex["action"] for a in actions)
            nav_ok += ok
        elif ex.get("not_ui"):
            ok = not actions
            false_ui += (not ok)
        elif "not_route" in ex:
            ok = ex["not_route"] not in _routes(actions)
            role_breach += (not ok)
        rows.append({"id": c["id"], "ok": bool(ok), "via": "llm" if d.get("tool") else "router", "tool": d.get("tool"),
                     "latency_ms": round(ms, 1)})
        print(f"[{c['id']}] {'PASS' if ok else 'FAIL'} via={rows[-1]['via']} tool={d.get('tool')} ({ms:.0f}ms)")
        if not ok:
            print(f"    utterance={c['utterance']!r}\n    got={d}")
    acc = 100.0 * nav_ok / nav_total if nav_total else 0.0
    gate = acc >= GATE_NAV_ACCURACY and false_ui == 0 and role_breach == 0
    print(f"\nدقة التنقل: {nav_ok}/{nav_total} ({acc:.1f}%) | تحويل خاطئ: {false_ui} | خرق صلاحيات: {role_breach} | البوابة: {'نجحت' if gate else 'فشلت'}")
    out = Path(__file__).resolve().parent.parent.parent / "gpu-stack" / "data" / f"eval_ui_{tag}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"tag": tag, "nav_accuracy": round(acc, 2), "false_ui": false_ui,
                               "role_breach": role_breach, "gate_passed": gate, "results": rows}, ensure_ascii=False, indent=2),
                   encoding="utf-8")
    return 0 if gate else 1


if __name__ == "__main__":
    raise SystemExit(main())
