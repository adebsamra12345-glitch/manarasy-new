#!/usr/bin/env python3
"""
سكربت التقييم الذهبي لمنصة منارة (20 سؤالاً ذهبياً بالعربية: فصحى + سورية + قطرية):
- يقيس دقة اختيار الأداة، والتعامل مع الغموض، وعزل الصلاحيات، والحماية من الـ Prompt Injection والـ PII.
- يحفظ تقريراً مفصلاً بصيغة JSON في gpu-stack/data/eval_report_<mode>.json للمقارنة قبل التدريب وبعده.
- الأوضاع:
  1. وضع المحاكاة المرجعية (Baseline Mock Mode - الافتراضي).
  2. وضع النموذج الحي (Live vLLM Mode عبر ضبط EVAL_LIVE_VLLM=1) لقياس دقة Qwen3-8B الفعلي على جهاز الـ GPU.
"""
import json
import logging
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("ORCHESTRATOR_SERVICE_KEY", "eval-secret-service-key-32-bytes")
os.environ.setdefault("AGENT_BACKEND", "mock")
os.environ.setdefault("RATE_LIMIT_TEACHER_PER_MIN", "500")
os.environ.setdefault("RATE_LIMIT_MANAGER_PER_MIN", "500")

import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.agent_backend import reset_mock_backend
from app.llm_client import set_mock_llm_transport
from app.rate_limit import rate_limiter
from app.resilience import llm_circuit

logging.getLogger("manarasy.orchestrator").setLevel(logging.WARNING)


def build_reference_evaluator_transport() -> httpx.MockTransport:
    """محاكي مرجعي يحاكي استدعاء الأدوات في Qwen3-8B لاختبار خط أنابيب الـ Orchestrator بالكامل."""
    def _handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8"))
        user_msg = body["messages"][-1]["content"]
        allowed_tool_names = {t["function"]["name"] for t in (body.get("tools") or [])}

        def _tc(name: str, args: dict) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": "call_eval",
                                        "type": "function",
                                        "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)},
                                    }
                                ],
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 60, "completion_tokens": 20},
                },
            )

        if "[تعليمة_مرفوضة]" in user_msg:
            return _tc("ask_clarification", {"unclear_part": "الطلب", "question_ar": "أنا مخصص لإدارة الحلقات فقط، كيف أساعدك؟"})

        if "اعتمد طلب التسجيل" in user_msg:
            if "approve_registration" in allowed_tool_names:
                return _tc("approve_registration", {"request_id": "r1"})
            return _tc("ask_clarification", {"unclear_part": "الصلاحية", "question_ar": "اعتماد طلبات التسجيل مخصص لمدير المركز."})

        if ("طلبات التسجيل المعلقة" in user_msg or "طلبات تسجيل معلقة" in user_msg):
            if "pending_requests" in allowed_tool_names:
                return _tc("pending_requests", {})
            return _tc("ask_clarification", {"unclear_part": "الصلاحية", "question_ar": "عرض طلبات التسجيل المعلقة متاح لمدير المركز فقط."})

        if "نظرة عامة على الحلقات" in user_msg and "halaqa_overview" in allowed_tool_names:
            return _tc("halaqa_overview", {})

        if "قائمة الحلقات" in user_msg:
            return _tc("list_halaqat", {})

        if "نقاط الطالب خالد" in user_msg:
            return _tc("student_summary", {"student_query": "خالد يوسف"})

        if "نقطة مكافأة" in user_msg and "خالد" in user_msg:
            if "بسبب" in user_msg:
                return _tc("points_bonus", {"student_query": "خالد يوسف", "reason": "الالتزام بالهدوء والآداب"})
            return _tc("ask_clarification", {"unclear_part": "reason", "question_ar": "ما هو سبب منح نقطة المكافأة للطالب خالد يوسف؟"})

        if "تسميع" in user_msg and "خالد" in user_msg:
            if "ممتاز" in user_msg:
                return _tc("record_recitation_eval", {"student_query": "خالد يوسف", "grade": "ممتاز", "page_number": 12})
            if "إعادة" in user_msg:
                return _tc("record_recitation_eval", {"student_query": "خالد يوسف", "grade": "إعادة", "page_number": 8})
            return _tc("ask_clarification", {"unclear_part": "grade", "question_ar": "ما هو التقدير الذي حصل عليه الطالب خالد يوسف في التسميع؟"})

        if "عمر سالم" in user_msg:
            return _tc("mark_attendance", {"student_query": "عمر سالم", "status": "present"})

        if "أحمد" in user_msg and "خالد" not in user_msg:
            return _tc("mark_attendance", {"student_query": "أحمد", "status": "present"})

        if "خالد يوسف" in user_msg:
            if "غايب" in user_msg or ("غياب بعذر" not in user_msg and "غياب" in user_msg):
                return _tc("mark_attendance", {"student_query": "خالد يوسف", "status": "absent"})
            if "بعذر" in user_msg:
                return _tc("mark_attendance", {"student_query": "خالد يوسف", "status": "excused"})
            if "تأخر" in user_msg:
                return _tc("mark_attendance", {"student_query": "خالد يوسف", "status": "late"})
            if "حضور" in user_msg:
                return _tc("mark_attendance", {"student_query": "خالد يوسف", "status": "present"})

        return _tc("ask_clarification", {"unclear_part": "اسم الطالب", "question_ar": "ما اسم الطالب من فضلك؟"})

    return httpx.MockTransport(_handler)


def run_evaluation() -> int:
    golden_path = Path(__file__).resolve().parent / "golden_ar.json"
    cases = json.loads(golden_path.read_text(encoding="utf-8"))

    live_mode = os.getenv("EVAL_LIVE_VLLM", "0") == "1"
    tag = os.getenv("EVAL_TAG", "live" if live_mode else "reference_mock")
    if not live_mode:
        set_mock_llm_transport(build_reference_evaluator_transport())

    client = TestClient(app)
    passed = 0
    total = len(cases)
    by_category: dict[str, list[bool]] = defaultdict(list)
    by_dialect: dict[str, list[bool]] = defaultdict(list)
    detailed_results = []

    print("=" * 86)
    print(f"تشغيل التقييم الذهبي بالعربية ({total} حالة) | الوضع: {'LIVE vLLM' if live_mode else 'REFERENCE MOCK'} ({tag})")
    print("=" * 86)

    for case in cases:
        reset_mock_backend()
        rate_limiter.reset()
        llm_circuit.reset()

        headers = {
            "Authorization": f"Bearer {os.environ['ORCHESTRATOR_SERVICE_KEY']}",
            "X-User-Id": f"eval-{case['id']}",
            "X-User-Role": case["role"],
            "X-Tenant-Id": "t1",
        }
        t0 = time.perf_counter()
        resp = client.post(
            "/v1/agent/turn",
            headers=headers,
            json={"utterance": case["utterance"], "halaqat_ids": ["h1"]},
        )
        dt_ms = (time.perf_counter() - t0) * 1000
        data = resp.json() if resp.status_code == 200 else {}

        status_ok = data.get("status") == case["expected_status"]
        tool_ok = data.get("tool") == case["expected_tool"]
        substr_ok = True
        if "expected_Substring" in case:
            substr_ok = case["expected_Substring"] in (data.get("speak") or "")

        case_pass = resp.status_code == 200 and status_ok and tool_ok and substr_ok
        if case_pass:
            passed += 1
        by_category[case["category"]].append(case_pass)
        by_dialect[case["dialect"]].append(case_pass)

        detailed_results.append(
            {
                "id": case["id"],
                "category": case["category"],
                "dialect": case["dialect"],
                "passed": case_pass,
                "expected_tool": case["expected_tool"],
                "actual_tool": data.get("tool"),
                "expected_status": case["expected_status"],
                "actual_status": data.get("status"),
                "latency_ms": round(dt_ms, 2),
            }
        )

        mark = "✅ PASS" if case_pass else "❌ FAIL"
        print(
            f"[{case['id']}] {mark} | ({case['dialect']:<5} / {case['category']:<16}) "
            f"| tool={data.get('tool')} status={data.get('status')} ({dt_ms:.1f}ms)"
        )
        if not case_pass:
            print(f"    Expected: tool={case['expected_tool']} status={case['expected_status']}")
            print(f"    Got:      {data}")

    score_pct = (passed / total) * 100 if total else 0.0
    print("-" * 86)
    print("ملخص الدقة حسب الفئة:")
    for cat, flags in sorted(by_category.items()):
        c_pass = sum(1 for x in flags if x)
        print(f"  - {cat:<18}: {c_pass}/{len(flags)} ({(c_pass / len(flags)) * 100:.1f}%)")
    print("ملخص الدقة حسب اللهجة:")
    for dial, flags in sorted(by_dialect.items()):
        d_pass = sum(1 for x in flags if x)
        print(f"  - {dial:<18}: {d_pass}/{len(flags)} ({(d_pass / len(flags)) * 100:.1f}%)")
    print("=" * 86)
    print(f"النتيجة النهائية: {passed}/{total} ({score_pct:.1f}%)")
    print("=" * 86)

    # حفظ التقرير للمقارنة القبلية والبعدية
    out_dir = Path(__file__).resolve().parent.parent.parent / "gpu-stack" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)
    report_file = out_dir / f"eval_report_{tag}.json"
    report_payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tag": tag,
        "live_mode": live_mode,
        "total_cases": total,
        "passed_cases": passed,
        "accuracy_percent": round(score_pct, 2),
        "by_category": {k: f"{sum(v)}/{len(v)}" for k, v in by_category.items()},
        "by_dialect": {k: f"{sum(v)}/{len(v)}" for k, v in by_dialect.items()},
        "results": detailed_results,
    }
    report_file.write_text(json.dumps(report_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"📄 تم حفظ تقرير التقييم في: {report_file}")

    set_mock_llm_transport(None)
    return 0 if passed == total else 1


if __name__ == "__main__":
    raise SystemExit(run_evaluation())
