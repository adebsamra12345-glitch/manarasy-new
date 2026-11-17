"""أداة open_screen للنموذج (خلف AGENT_UI_TOOL): المواصفات حسب الدور، والتنفيذ، وحماية الدور."""
import json
import os

import httpx
import pytest
from fastapi.testclient import TestClient

os.environ["ORCHESTRATOR_SERVICE_KEY"] = "test-super-secret-service-key-32bytes"
os.environ["AGENT_BACKEND"] = "mock"

from app.agent_backend import reset_mock_backend
from app.agent_tools import specs_for
from app.llm_client import set_mock_llm_transport
from app.main import app, reset_chat_sessions
from app.observability import metrics
from app.rate_limit import rate_limiter
from app.resilience import llm_circuit

client = TestClient(app)


def H(role="TEACHER"):
    return {"Authorization": "Bearer test-super-secret-service-key-32bytes", "X-User-Id": "u1",
            "X-User-Role": role, "X-Tenant-Id": "t1"}


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    reset_mock_backend(); reset_chat_sessions(); rate_limiter.reset(); llm_circuit.reset(); metrics.reset()
    monkeypatch.delenv("AGENT_UI_TOOL", raising=False)
    yield
    set_mock_llm_transport(None)


def llm_calls(name, args):
    def h(req):
        return httpx.Response(200, json={"choices": [{"message": {"content": "", "tool_calls": [
            {"id": "c1", "type": "function", "function": {"name": name, "arguments": json.dumps(args, ensure_ascii=False)}}]}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1}})
    set_mock_llm_transport(httpx.MockTransport(h))


def names(role):
    return [s["function"]["name"] for s in specs_for(role)]


def test_tool_hidden_by_default_and_exposed_with_flag(monkeypatch):
    assert "open_screen" not in names("TEACHER")
    monkeypatch.setenv("AGENT_UI_TOOL", "1")
    assert "open_screen" in names("TEACHER")


def test_enum_is_role_specific(monkeypatch):
    monkeypatch.setenv("AGENT_UI_TOOL", "1")
    enum = lambda r: next(s for s in specs_for(r) if s["function"]["name"] == "open_screen")["function"]["parameters"]["properties"]["screen"]["enum"]
    assert "attendance" in enum("TEACHER") and "reports" not in enum("TEACHER")
    assert "reports" in enum("CENTER_MANAGER") and "attendance" not in enum("CENTER_MANAGER")
    assert "users" in enum("TENANT_ADMIN")


def test_model_call_is_rejected_when_flag_off():
    llm_calls("open_screen", {"screen": "students"})
    r = client.post("/v1/agent/chat", json={"message": "ورّيني الشي يلي فيه التلاميذ", "session_id": "s"}, headers=H())
    assert r.status_code == 200
    assert r.json()["ui_actions"] == []


def test_model_open_screen_returns_ui_actions(monkeypatch):
    monkeypatch.setenv("AGENT_UI_TOOL", "1")
    llm_calls("open_screen", {"screen": "students"})
    r = client.post("/v1/agent/chat", json={"message": "ورّيني الشي يلي فيه التلاميذ", "session_id": "s"}, headers=H()).json()
    assert r["ui_actions"] == [{"type": "navigate", "route": "/teacher/students"}]
    assert r["tool_calls_made"] == ["open_screen"]


def test_model_open_screen_uses_real_role_prefix(monkeypatch):
    monkeypatch.setenv("AGENT_UI_TOOL", "1")
    llm_calls("open_screen", {"screen": "reports"})
    r = client.post("/v1/agent/chat", json={"message": "ورّيني الأرقام الشهرية", "session_id": "s"}, headers=H("TENANT_ADMIN")).json()
    assert r["ui_actions"] == [{"type": "navigate", "route": "/admin/reports"}]


def test_model_cannot_open_screen_outside_role(monkeypatch):
    monkeypatch.setenv("AGENT_UI_TOOL", "1")
    llm_calls("open_screen", {"screen": "settings"})
    r = client.post("/v1/agent/chat", json={"message": "افتح لي الضبط", "session_id": "s"}, headers=H()).json()
    assert r["ui_actions"] == [] and "غير متاح" in r["answer"]


def test_model_open_screen_needing_halaqa_asks_with_choices(monkeypatch):
    monkeypatch.setenv("AGENT_UI_TOOL", "1")
    llm_calls("open_screen", {"screen": "halaqa_sessions"})
    r = client.post("/v1/agent/chat", json={"message": "ورّيني اللي صار في حلقتي قبل", "session_id": "s"}, headers=H()).json()
    assert r["ui_actions"][0]["type"] == "choices"


def test_agent_turn_surfaces_ui_actions(monkeypatch):
    monkeypatch.setenv("AGENT_UI_TOOL", "1")
    llm_calls("open_screen", {"screen": "profile"})
    j = client.post("/v1/agent/turn", json={"utterance": "ابغى اشوف بياناتي"}, headers=H()).json()
    assert j["status"] == "ok" and j["ui_actions"] == [{"type": "navigate", "route": "/teacher/profile"}]
