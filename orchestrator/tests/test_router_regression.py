"""مجموعة انحدار الموجّه الحتمي (eval/router_regression_ar.json): تضم أخطاء المستخدم الإحدى عشرة بكل صيغها.
تشغَّل بلا GPU ولا نموذج؛ يجب أن تبقى 100% قبل أي نشر."""
import json
import os
from pathlib import Path

import pytest

os.environ["AGENT_BACKEND"] = "mock"

from app.agent_backend import Principal, reset_mock_backend
from app.screens import reset_slots, route_message

CASES = json.loads((Path(__file__).resolve().parent.parent / "eval" / "router_regression_ar.json").read_text(encoding="utf-8"))["cases"]


@pytest.fixture(autouse=True)
def _reset():
    reset_mock_backend()
    reset_slots()


def _types(out):
    return [a["type"] for a in out["ui_actions"]]


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_case(case):
    p = Principal("u1", "teacher", "t1", [])
    out = None
    for step in case["steps"]:
        out = route_message(p, case["role"], step, f"k-{case['id']}")
    ex = case["expect"]
    if ex.get("passthrough"):
        assert out is None, out
        return
    assert out is not None, f"لم يُعالَج: {case['steps']}"
    if "navigate" in ex:
        assert out["ui_actions"] == [{"type": "navigate", "route": ex["navigate"]}], out
    if ex.get("no_ui"):
        assert out["ui_actions"] == [], out
    if "action_types" in ex:
        assert _types(out) == ex["action_types"], out
    if "answer_contains" in ex:
        assert ex["answer_contains"] in out["answer"], out
    if "choice_kinds" in ex:
        assert [o["action"]["type"] for o in out["ui_actions"][0]["options"]] == ex["choice_kinds"]
    if "confirm_on_yes" in ex:
        assert [a["type"] for a in out["ui_actions"][0]["on_confirm"]] == ex["confirm_on_yes"]


def test_ui_golden_not_ui_cases_are_never_hijacked_by_router():
    """عبارات «ليست تنقلاً» في ui_golden_ar.json يجب ألا يلتقطها الموجّه (تذهب للنموذج)."""
    golden = json.loads((Path(__file__).resolve().parent.parent / "eval" / "ui_golden_ar.json").read_text(encoding="utf-8"))["cases"]
    p = Principal("u1", "teacher", "t1", [])
    for c in golden:
        if c["expect"].get("not_ui"):
            reset_slots()
            assert route_message(p, c["role"], c["utterance"], "g") is None, c["utterance"]


def test_no_golden_case_is_hijacked_by_router():
    """كل عبارات التقييم الذهبي (أدوات/غموض/أمان) يجب أن تصل للنموذج لا للموجّه الحتمي."""
    golden = json.loads((Path(__file__).resolve().parent.parent / "eval" / "golden_ar.json").read_text(encoding="utf-8"))
    for c in golden:
        reset_slots()
        p = Principal("u1", "teacher", "t1", [])
        assert route_message(p, c["role"], c["utterance"], "g") is None, f"{c['id']}: {c['utterance']}"
