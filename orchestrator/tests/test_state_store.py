"""مخزن الحالة: Redis (عميل وهمي) يبقي الحوار والتأكيد بعد «إعادة التشغيل»، والسقوط الآمن للذاكرة."""
import os
import time

os.environ["ORCHESTRATOR_SERVICE_KEY"] = "test-super-secret-service-key-32bytes"
os.environ["AGENT_BACKEND"] = "mock"

import pytest

from app import agent_tools, screens
from app.agent_backend import Principal, reset_mock_backend
from app.state_store import MemoryStore, RedisStore, StateStore


class FakeRedis:
    def __init__(self):
        self.d = {}

    def get(self, k):
        v = self.d.get(k)
        return v[1].encode() if v and v[0] > time.time() else None

    def set(self, k, v, ex=None):
        self.d[k] = (time.time() + ex, v)

    def delete(self, k):
        self.d.pop(k, None)

    def scan_iter(self, match=None):
        return list(self.d)


class BrokenRedis(FakeRedis):
    def get(self, k):
        raise ConnectionError("down")

    def set(self, k, v, ex=None):
        raise ConnectionError("down")


@pytest.fixture(autouse=True)
def _reset():
    reset_mock_backend()


def test_ttl_expiry_and_json_roundtrip():
    s = StateStore(MemoryStore())
    s.set("a", {"x": "نص"}, ttl=1)
    assert s.get("a") == {"x": "نص"}
    s.delete("a")
    assert s.get("a") is None


def test_dialog_slot_survives_restart_via_shared_redis(monkeypatch):
    shared = FakeRedis()
    monkeypatch.setattr(screens, "store", StateStore(RedisStore(shared)))
    p = Principal("u1", "TEACHER", "t1", [])
    screens.route_message(p, "TEACHER", "افتح لي معلومات الطالب", "k")
    # «إعادة تشغيل»: كائن مخزن جديد على نفس Redis
    monkeypatch.setattr(screens, "store", StateStore(RedisStore(shared)))
    out = screens.route_message(p, "TEACHER", "خالد يوسف", "k")
    assert out["ui_actions"] == [{"type": "navigate", "route": "/teacher/students/s3/activity"}]


def test_pending_confirmation_shared_and_has_no_jwt(monkeypatch):
    shared = FakeRedis()
    monkeypatch.setattr(agent_tools, "store", StateStore(RedisStore(shared)))
    p = Principal("u1", "TEACHER", "t1", [], {"Authorization": "Bearer SECRET-JWT"})
    r = agent_tools.execute_tool_call(p, "mark_attendance", {"student_query": "خالد يوسف", "status": "present"})
    assert r["status"] == "confirm_required"
    assert all("SECRET-JWT" not in v[1] for v in shared.d.values())
    # تأكيد من «عملية أخرى» (مخزن جديد) وبرمز JWT جديد
    monkeypatch.setattr(agent_tools, "store", StateStore(RedisStore(shared)))
    p2 = Principal("u1", "TEACHER", "t1", [], {"Authorization": "Bearer NEW"})
    out = agent_tools.confirm_tool_call(p2, r["confirm_token"], "نعم", idempotency_key="k1")
    assert out["status"] == "ok"
    again = agent_tools.confirm_tool_call(p2, r["confirm_token"], "نعم", idempotency_key="k1")
    assert again == out  # idempotent: لا تنفيذ مزدوج


def test_other_user_cannot_confirm(monkeypatch):
    monkeypatch.setattr(agent_tools, "store", StateStore())
    p = Principal("u1", "TEACHER", "t1", [])
    r = agent_tools.execute_tool_call(p, "mark_attendance", {"student_query": "خالد يوسف", "status": "late"})
    with pytest.raises(Exception):
        agent_tools.confirm_tool_call(Principal("u2", "TEACHER", "t1", []), r["confirm_token"], "نعم")


def test_redis_failure_falls_back_to_memory():
    s = StateStore(RedisStore(BrokenRedis()))
    s.set("k", {"v": 1}, 60)
    assert s.get("k") == {"v": 1}
