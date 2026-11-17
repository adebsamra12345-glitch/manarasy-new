"""الموجّه الحتمي لأوامر الواجهة: تنقل، نوافذ، خروج، جلسات، طالب (أخطاء الأسئلة 1-9 من تقرير المستخدم)."""
import os

import pytest
from fastapi.testclient import TestClient

os.environ["ORCHESTRATOR_SERVICE_KEY"] = "test-super-secret-service-key-32bytes"
os.environ["AGENT_BACKEND"] = "mock"

from app.agent_backend import reset_mock_backend
from app.llm_client import set_mock_llm_transport
from app.main import app, reset_chat_sessions
from app.rate_limit import rate_limiter
from app.resilience import llm_circuit
from app.observability import metrics

client = TestClient(app)


def _headers(role="TEACHER"):
    return {
        "Authorization": "Bearer test-super-secret-service-key-32bytes",
        "X-User-Id": "u1",
        "X-User-Role": role,
        "X-Tenant-Id": "t1",
    }


@pytest.fixture(autouse=True)
def reset_state():
    reset_mock_backend()
    reset_chat_sessions()
    rate_limiter.reset()
    llm_circuit.reset()
    metrics.reset()

    def _no_llm(request):
        raise AssertionError("الموجّه الحتمي يجب ألا يصل للنموذج")

    set_mock_llm_transport(_no_llm)
    yield
    set_mock_llm_transport(None)


def chat(msg, role="TEACHER", sid="s1"):
    r = client.post("/v1/agent/chat", json={"message": msg, "session_id": sid}, headers=_headers(role))
    assert r.status_code == 200, r.text
    return r.json()


def actions(d, kind):
    return [a for a in d["ui_actions"] if a["type"] == kind]


@pytest.mark.parametrize("msg,route", [
    ("انقلني إلى تبويب الطلاب", "/teacher/students"),
    ("افتح لي جلسة الطلاب", "/teacher/students"),  # خطأ 3: لا يُعامل «طلاب» كاسم حلقة
    ("انقلني الى تبويب الملف الشخصي", "/teacher/profile"),
    ("افتح الملف الشخصي", "/teacher/profile"),
    ("الطلاب", "/teacher/students"),
    ("خذني إلى الحلقات", "/teacher/rings"),
    ("افتح التسميع", "/teacher/recitation"),
    ("اذهب إلى لوحة التحكم", "/teacher/dashboard"),
])
def test_teacher_navigation(msg, route):
    d = chat(msg)
    assert actions(d, "navigate") == [{"type": "navigate", "route": route}], d


def test_navigation_respects_role_prefix():
    d = chat("افتح التقارير", role="CENTER_MANAGER")
    assert actions(d, "navigate")[0]["route"] == "/center-manager/reports"
    d = chat("افتح الاعدادات", role="TENANT_ADMIN")
    assert actions(d, "navigate")[0]["route"] == "/admin/settings"


def test_screen_not_available_for_role_is_honest():
    d = chat("انقلني الى تبويب النقاط", role="TEACHER")  # خطأ 9: غير موجود للمعلم في App.jsx
    assert d["ui_actions"] == []
    assert "غير متاح" in d["answer"]


@pytest.mark.parametrize("msg", [
    "كم عدد الطلاب في حلقة الفاتحة؟",
    "اعرض طلاب حلقة الفاتحة الغائبين اليوم",
    "مرحبا كيف حالك",
    "ما هي أحكام المد",
])
def test_data_or_chat_messages_go_to_llm(msg):
    from app.agent_backend import Principal
    from app.screens import route_message
    p = Principal("u1", "TEACHER", "t1", [])
    assert route_message(p, "TEACHER", msg, "k") is None


def test_logout_requires_confirm_ui():  # خطأ 8
    d = chat("سجل خروجي")
    c = actions(d, "confirm_ui")
    assert len(c) == 1 and c[0]["on_confirm"] == [{"type": "logout"}]
    assert not actions(d, "navigate")


def test_password_offers_guide_or_modal():  # خطأ 5
    d = chat("ساعدني في تغيير كلمة المرور")
    opts = actions(d, "choices")[0]["options"]
    kinds = [o["action"]["type"] for o in opts]
    assert kinds == ["reply", "open_modal"]
    assert opts[1]["action"]["modal"] == "change_password"


def test_new_session_asks_for_halaqa_then_confirms():  # خطأ 1
    d = chat("افتح لي جلسة جديدة")
    opts = actions(d, "choices")[0]["options"]
    assert {o["action"]["text"] for o in opts} == {"حلقة الفاتحة", "حلقة البقرة"}
    d2 = chat("حلقة الفاتحة")  # إكمال المعامل الناقص نصاً
    c = actions(d2, "confirm_ui")[0]
    assert c["on_confirm"] == [{"type": "navigate", "route": "/teacher/rings/h1/sessions?new=1"}]


def test_previous_sessions_asks_halaqa_first_then_navigates():  # خطأ 2
    d = chat("انقلني الى الجلسات السابقة")
    assert actions(d, "choices")
    d2 = chat("البقرة")
    assert actions(d2, "navigate") == [{"type": "navigate", "route": "/teacher/rings/h2/sessions"}]


def test_previous_sessions_with_halaqa_name_in_message():
    d = chat("افتح جلسات حلقة الفاتحة")
    assert actions(d, "navigate")[0]["route"] == "/teacher/rings/h1/sessions"


def test_student_info_keeps_intent_across_turns():  # خطأ 7
    d = chat("افتح لي معلومات الطالب")
    assert "اسم الطالب" in d["answer"]
    d2 = chat("خالد يوسف")
    assert actions(d2, "navigate") == [{"type": "navigate", "route": "/teacher/students/s3/activity"}]


def test_student_info_ambiguous_name_gives_choices():
    d = chat("افتح معلومات الطالب أحمد")
    assert actions(d, "choices")
    assert not actions(d, "navigate")


def test_slot_is_cancelled_by_no():
    chat("افتح جلسة جديدة")
    d = chat("لا")
    assert "الإلغاء" in d["answer"]


def test_agent_turn_endpoint_returns_ui_actions():
    r = client.post("/v1/agent/turn", json={"utterance": "افتح الملف الشخصي"}, headers=_headers())
    assert r.status_code == 200
    j = r.json()
    assert j["ui_actions"] == [{"type": "navigate", "route": "/teacher/profile"}]
    assert j["speak"]
