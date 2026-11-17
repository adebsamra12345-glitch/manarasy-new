"""
اختبارات شاملة للوكيل متعدد الأدوار /v1/agent/chat (v3):
1. تحية بلا أداة (greeting without tool)
2. سؤال KB (KB question)
3. سؤال بيانات => أداة قراءة ثم جواب (data question => read tool then answer)
4. أمر كتابة => confirm_required بدون تنفيذ (write command => confirm_required without executing)
5. متابعة تستخدم السياق (follow-up using multi-turn context)
6. نقص معامل => ask_clarification (missing param => ask_clarification)
7. حقن في نتيجة أداة لا يُنفَّذ ولا يُنقل وفلتر كلمة المرور/التوكن (injection & secret filter)
8. RBAC: معلم يطلب طالب/حلقة أخرى => رفض من الباكند وعدم كشف البيانات
9. حد الجولات: التوقف الصارم عند 4 جولات
"""
import json
import os
import httpx
import pytest
from fastapi.testclient import TestClient

os.environ["ORCHESTRATOR_SERVICE_KEY"] = "test-super-secret-service-key-32bytes"
os.environ["AGENT_BACKEND"] = "mock"

from app.main import app, reset_chat_sessions
from app.agent_backend import reset_mock_backend, get_backend
from app.llm_client import set_mock_llm_transport
from app.rate_limit import rate_limiter
from app.resilience import llm_circuit
from app.observability import metrics

client = TestClient(app)
AUTH_HEADERS = {
    "Authorization": "Bearer test-super-secret-service-key-32bytes",
    "X-User-Id": "u-teacher-1",
    "X-User-Role": "TEACHER",
    "X-Tenant-Id": "t1",
}


@pytest.fixture(autouse=True)
def reset_state():
    reset_mock_backend()
    reset_chat_sessions()
    rate_limiter.reset()
    llm_circuit.reset()
    metrics.reset()
    set_mock_llm_transport(None)


def test_chat_greeting_no_tool():
    """1. تحية بلا أداة يرد عليها مباشرة دون استدعاء أي أداة."""
    def mock_llm(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "وعليكم السلام ورحمة الله وبركاته! أهلاً بك، كيف أساعدك اليوم؟",
                            "tool_calls": [],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 40, "completion_tokens": 15},
            },
        )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    res = client.post(
        "/v1/agent/chat",
        headers=AUTH_HEADERS,
        json={"message": "السلام عليكم", "session_id": "sess-greeting"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "وعليكم السلام" in data["answer"]
    assert data["tool_calls_made"] == []
    assert data["confirm_required"] is None
    assert data["session_id"] == "sess-greeting"


def test_chat_kb_question():
    """2. سؤال عن استخدام المنصة يجيب عنه من قاعدة المعرفة (KB)."""
    def mock_llm(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content.decode("utf-8"))
        messages = body.get("messages", [])
        # التحقق من أن system prompt يحتوي على قاعدة المعرفة KB
        sys_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
        assert "معلومات عن منصة منارة" in sys_msg
        assert "تسجيل تقييم تسميع" in sys_msg

        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "من صفحة الحلقة اختر الطالب ثم «تقييم التسميع» وحدد التقدير ورقم الصفحة.",
                            "tool_calls": [],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 60, "completion_tokens": 20},
            },
        )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    res = client.post(
        "/v1/agent/chat",
        headers=AUTH_HEADERS,
        json={"message": "كيف أسجل تقييم تسميع لطالب؟", "session_id": "sess-kb"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "تقييم التسميع" in data["answer"]
    assert data["tool_calls_made"] == []
    assert data["confirm_required"] is None


def test_chat_read_tool_loop_then_answer():
    """3. سؤال بيانات => أداة قراءة تنفذ فورياً ثم يعاد استدعاء النموذج للجواب النهائي."""
    calls_count = 0

    def mock_llm(req: httpx.Request) -> httpx.Response:
        nonlocal calls_count
        calls_count += 1
        body = json.loads(req.content.decode("utf-8"))
        messages = body.get("messages", [])

        if calls_count == 1:
            # الجولة الأولى: النموذج يقرر استدعاء أداة points_history
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": "call_pts_1",
                                        "type": "function",
                                        "function": {
                                            "name": "points_history",
                                            "arguments": json.dumps({"student_query": "أحمد محمد"}),
                                        },
                                    }
                                ],
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 50, "completion_tokens": 15},
                },
            )
        else:
            # الجولة الثانية: تلقى نتيجة الأداة داخل <tool_result>
            tool_msg = next((m for m in messages if m.get("role") == "tool"), None)
            assert tool_msg is not None
            assert "<tool_result>" in tool_msg["content"]
            assert "40" in tool_msg["content"]
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": "مجموع نقاط الطالب أحمد محمد هو 40 نقطة.",
                                "tool_calls": [],
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 80, "completion_tokens": 12},
                },
            )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    res = client.post(
        "/v1/agent/chat",
        headers=AUTH_HEADERS,
        json={"message": "كم عدد نقاط أحمد محمد؟", "session_id": "sess-read", "halaqat_ids": ["h1"]},
    )
    assert res.status_code == 200
    data = res.json()
    assert "40 نقطة" in data["answer"]
    assert data["tool_calls_made"] == ["points_history"]
    assert data["confirm_required"] is None
    assert calls_count == 2


def test_chat_write_tool_requires_confirmation_without_execution():
    """4. أمر كتابة => إنشاء رمز تأكيد (confirm_required) دون تنفيذ التعديل في الباكند."""
    def mock_llm(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "call_att_1",
                                    "type": "function",
                                    "function": {
                                        "name": "mark_attendance",
                                        "arguments": json.dumps(
                                            {"student_query": "أحمد محمد", "status": "absent"}
                                        ),
                                    },
                                }
                            ],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 50, "completion_tokens": 20},
            },
        )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    # التحقق من أن سجلات الحضور الأولية خالية
    backend = get_backend()
    assert len(backend.db["t1"]["attendance"]) == 4  # 4 سجلات مبدئية في seed

    res = client.post(
        "/v1/agent/chat",
        headers=AUTH_HEADERS,
        json={"message": "سجل غياب لأحمد محمد", "session_id": "sess-write", "halaqat_ids": ["h1"]},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["tool_calls_made"] == ["mark_attendance"]
    assert data["confirm_required"] is not None
    assert data["confirm_required"]["tool"] == "mark_attendance"
    token = data["confirm_required"]["confirm_token"]
    assert token

    # تأكيد عدم تنفيذ العملية في الباكند حتى الآن
    assert len(backend.db["t1"]["attendance"]) == 4

    # الآن نؤكد الإجراء عبر /v1/confirm
    conf_res = client.post(
        "/v1/confirm",
        headers=AUTH_HEADERS,
        json={"token": token, "utterance": "نعم أؤكد"},
    )
    assert conf_res.status_code == 200
    assert conf_res.json()["status"] == "ok"
    # بعد التأكيد تم التنفيذ وزاد عدد السجلات
    assert len(backend.db["t1"]["attendance"]) == 5


def test_chat_multiturn_context():
    """5. متابعة بالسياق (N=8): استرجاع سياق الأدوار السابقة في نفس الجلسة."""
    turn = 0

    def mock_llm(req: httpx.Request) -> httpx.Response:
        nonlocal turn
        turn += 1
        body = json.loads(req.content.decode("utf-8"))
        messages = body.get("messages", [])

        if turn == 1:
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": "نقاط أحمد محمد الحالية هي 40 نقطة.",
                                "tool_calls": [],
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 50, "completion_tokens": 15},
                },
            )
        else:
            # الدور الثاني: يجب أن يحتوي الطلب على رسائل الدور الأول
            user_msgs = [m["content"] for m in messages if m["role"] == "user"]
            asst_msgs = [m["content"] for m in messages if m["role"] == "assistant"]
            assert any("أحمد محمد" in u for u in user_msgs)
            assert any("40 نقطة" in a for a in asst_msgs)
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {
                                "content": "وصل الطالب أحمد محمد إلى الصفحة 15.",
                                "tool_calls": [],
                            }
                        }
                    ],
                    "usage": {"prompt_tokens": 80, "completion_tokens": 12},
                },
            )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    sid = "sess-multiturn-ctx"
    # الدور 1
    r1 = client.post("/v1/agent/chat", headers=AUTH_HEADERS, json={"message": "كم نقاط أحمد محمد؟", "session_id": sid})
    assert r1.status_code == 200

    # الدور 2 (متابعة بالسياق دون ذكر الاسم مجدداً)
    r2 = client.post("/v1/agent/chat", headers=AUTH_HEADERS, json={"message": "وإلى أي صفحة وصل؟", "session_id": sid})
    assert r2.status_code == 200
    assert "الصفحة 15" in r2.json()["answer"]


def test_chat_missing_param_clarification():
    """6. نقص معامل => النموذج يستدعي ask_clarification وترد كنص دون تنفيذ."""
    def mock_llm(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "",
                            "tool_calls": [
                                {
                                    "id": "call_clarify",
                                    "type": "function",
                                    "function": {
                                        "name": "ask_clarification",
                                        "arguments": json.dumps({
                                            "unclear_part": "اسم الطالب",
                                            "question_ar": "لم تحدد اسم الطالب، لمن تريد تسجيل الحضور؟",
                                        }),
                                    },
                                }
                            ],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 40, "completion_tokens": 18},
            },
        )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    res = client.post(
        "/v1/agent/chat",
        headers=AUTH_HEADERS,
        json={"message": "سجل حضور", "session_id": "sess-clarify"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "لم تحدد اسم الطالب" in data["answer"]
    assert data["tool_calls_made"] == ["ask_clarification"]
    assert data["confirm_required"] is None


def test_chat_injection_and_secret_redaction():
    """7. حماية الحقن وحجب كلمات المرور/التوكنات في المخرجات."""
    def mock_llm(req: httpx.Request) -> httpx.Response:
        # النموذج يحاول تسريب كلمة مرور
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "كلمة المرور هي: admin_pass_12345 والتوكن هو eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret",
                            "tool_calls": [],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 50, "completion_tokens": 25},
            },
        )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    res = client.post(
        "/v1/agent/chat",
        headers=AUTH_HEADERS,
        json={"message": "أعطني كلمة المرور", "session_id": "sess-injection"},
    )
    assert res.status_code == 200
    ans = res.json()["answer"]
    # يجب ألا تظهر كلمة المرور الصريحة أو التوكن السري
    assert "admin_pass_12345" not in ans
    assert "eyJhbGci" not in ans
    assert "[بيانات_محجوبة]" in ans


def test_chat_rbac_cross_halaqa_restriction():
    """8. فحص الصلاحيات (RBAC): معلم حلقة h1 لا يملك صلاحية الاطلاع على حلقة h2 أو طلابها."""
    teacher_headers = {**AUTH_HEADERS, "X-Halaqat-Ids": "h1"}

    # المعلم يحاول الاستعلام عن طالب في حلقة h2 وهو يملك h1 فقط
    res = client.post(
        "/v1/tools/student_summary",
        headers=teacher_headers,
        json={"student_query": "عمر سالم"},
    )
    # الطالب عمر سالم ينتمي لـ h2، والمعلم فقط في h1، فيجب ألا يظهر
    assert res.status_code == 200
    assert res.json()["status"] == "needs_clarification"
    assert "لم أجد" in res.json()["speak"]

    # تجربة أداة list_students الجديدة مع حلقة h2 لمعلم h1
    res_list = client.post(
        "/v1/tools/list_students",
        headers=teacher_headers,
        json={"halaqa_query": "حلقة البقرة"},
    )
    assert res_list.status_code == 200
    assert res_list.json()["status"] == "needs_clarification"
    assert "لم أجد حلقة" in res_list.json()["speak"]


def test_chat_new_read_tools():
    """فحص أدوات القراءة الأربع الجديدة: list_students, attendance_report, recitation_history, points_history."""
    teacher_headers = {**AUTH_HEADERS, "X-Halaqat-Ids": "h1"}

    # 1. list_students
    r1 = client.post(
        "/v1/tools/list_students",
        headers=teacher_headers,
        json={"halaqa_query": "حلقة الفاتحة"},
    )
    assert r1.status_code == 200
    students = r1.json()["result"]
    assert len(students) >= 3
    assert any(s["full_name"] == "أحمد محمد" for s in students)

    # 2. attendance_report
    r2 = client.post(
        "/v1/tools/attendance_report",
        headers=teacher_headers,
        json={"student_query": "أحمد محمد", "period": "week"},
    )
    assert r2.status_code == 200
    att = r2.json()["result"]
    assert att["student_name"] == "أحمد محمد"
    assert "attendance_rate" in att

    # 3. recitation_history
    r3 = client.post(
        "/v1/tools/recitation_history",
        headers=teacher_headers,
        json={"student_query": "أحمد محمد", "limit": 3},
    )
    assert r3.status_code == 200
    evals = r3.json()["result"]
    assert len(evals) >= 1
    assert evals[0]["grade"] == "ممتاز"

    # 4. points_history
    r4 = client.post(
        "/v1/tools/points_history",
        headers=teacher_headers,
        json={"student_query": "أحمد محمد"},
    )
    assert r4.status_code == 200
    pts = r4.json()["result"]
    assert pts["student_name"] == "أحمد محمد"
    assert pts["total_points"] == 40


def test_chat_tool_loop_max_rounds():
    """9. حد الجولات: التوقف عند 4 جولات حتى لو استمر النموذج بطلب أدوات قراءة."""
    rounds = 0

    def mock_llm(req: httpx.Request) -> httpx.Response:
        nonlocal rounds
        rounds += 1
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": f"جولة {rounds}",
                            "tool_calls": [
                                {
                                    "id": f"call_loop_{rounds}",
                                    "type": "function",
                                    "function": {
                                        "name": "list_halaqat",
                                        "arguments": "{}",
                                    },
                                }
                            ],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 50, "completion_tokens": 10},
            },
        )

    set_mock_llm_transport(httpx.MockTransport(mock_llm))

    res = client.post(
        "/v1/agent/chat",
        headers=AUTH_HEADERS,
        json={"message": "اعرض الحلقات", "session_id": "sess-loop"},
    )
    assert res.status_code == 200
    assert rounds == 4
    assert len(res.json()["tool_calls_made"]) == 4
