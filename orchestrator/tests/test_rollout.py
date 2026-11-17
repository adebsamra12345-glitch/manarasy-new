"""النشر التدريجي (canary): ثبات التوزيع، العزل، السقوط التلقائي، والمقاييس."""
import json
import os

import httpx
import pytest
from fastapi.testclient import TestClient

os.environ["ORCHESTRATOR_SERVICE_KEY"] = "test-super-secret-service-key-32bytes"
os.environ["AGENT_BACKEND"] = "mock"

from app import rollout
from app.agent_backend import reset_mock_backend
from app.llm_client import set_mock_llm_transport
from app.main import app, reset_chat_sessions
from app.observability import metrics
from app.rate_limit import rate_limiter
from app.resilience import canary_circuit, llm_circuit

client = TestClient(app)


def H(user="u1", role="TEACHER", tenant="t1"):
    return {"Authorization": "Bearer test-super-secret-service-key-32bytes", "X-User-Id": user,
            "X-User-Role": role, "X-Tenant-Id": tenant}


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    reset_mock_backend(); reset_chat_sessions(); rate_limiter.reset(); llm_circuit.reset(); canary_circuit.reset(); metrics.reset()
    for k in ("AGENT_CANARY_PERCENT", "VLLM_MODEL_AGENT_CANARY", "AGENT_CANARY_TENANTS", "AGENT_UI_TOOL", "AGENT_CANARY_UI_TOOL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("VLLM_MODEL_AGENT", "manarasy")
    yield
    set_mock_llm_transport(None)


def enable(monkeypatch, pct=100, model="manarasy_v3"):
    monkeypatch.setenv("AGENT_CANARY_PERCENT", str(pct))
    monkeypatch.setenv("VLLM_MODEL_AGENT_CANARY", model)


def ok_llm(seen):
    def h(req: httpx.Request):
        body = json.loads(req.content)
        seen.append({"model": body["model"], "tools": [t["function"]["name"] for t in body.get("tools", [])]})
        return httpx.Response(200, json={"choices": [{"message": {"content": "مرحباً بك", "tool_calls": []}}],
                                         "usage": {"prompt_tokens": 1, "completion_tokens": 1}})
    return h


def chat(msg="مرحبا كيف حالك", **kw):
    return client.post("/v1/agent/chat", json={"message": msg, "session_id": "s"}, headers=H(**kw))


def test_disabled_by_default_and_without_model(monkeypatch):
    assert rollout.agent_variant("t1", "u1").name == "stable"
    monkeypatch.setenv("AGENT_CANARY_PERCENT", "100")  # بلا نموذج canary => مستقر
    assert rollout.agent_variant("t1", "u1").name == "stable"
    monkeypatch.setenv("VLLM_MODEL_AGENT_CANARY", "manarasy_v3")
    monkeypatch.setenv("AGENT_CANARY_PERCENT", "0")
    assert rollout.agent_variant("t1", "u1").name == "stable"


def test_sticky_and_roughly_proportional(monkeypatch):
    enable(monkeypatch, 20)
    first = [rollout.agent_variant("t1", f"u{i}").name for i in range(2000)]
    again = [rollout.agent_variant("t1", f"u{i}").name for i in range(2000)]
    assert first == again
    share = first.count("canary") / len(first)
    assert 0.16 < share < 0.24, share


def test_tenant_allowlist(monkeypatch):
    enable(monkeypatch, 100)
    monkeypatch.setenv("AGENT_CANARY_TENANTS", "t-pilot")
    assert rollout.agent_variant("t1", "u1").name == "stable"
    assert rollout.agent_variant("t-pilot", "u1").name == "canary"


def test_canary_uses_canary_model_and_ui_tool_but_stable_does_not(monkeypatch):
    seen = []
    set_mock_llm_transport(httpx.MockTransport(ok_llm(seen)))
    enable(monkeypatch, 100)
    assert chat().status_code == 200
    assert seen[-1]["model"] == "manarasy_v3" and "open_screen" in seen[-1]["tools"]
    monkeypatch.setenv("AGENT_CANARY_PERCENT", "0")
    chat()
    assert seen[-1]["model"] == "manarasy" and "open_screen" not in seen[-1]["tools"]


def test_canary_failure_falls_back_to_stable_in_same_request(monkeypatch):
    seen = []
    def h(req):
        body = json.loads(req.content)
        if body["model"] == "manarasy_v3":
            return httpx.Response(500, json={"error": "boom"})
        return ok_llm(seen)(req)
    set_mock_llm_transport(httpx.MockTransport(h))
    enable(monkeypatch, 100)
    r = chat()
    assert r.status_code == 200 and r.json()["answer"] == "مرحباً بك"
    assert seen[-1]["model"] == "manarasy" and "open_screen" not in seen[-1]["tools"]
    prom = client.get("/metrics").text
    assert 'agent_variant_total{variant="canary",event="canary_fallback"} 1' in prom


def test_canary_failures_do_not_open_stable_circuit(monkeypatch):
    set_mock_llm_transport(httpx.MockTransport(lambda req: httpx.Response(500) if json.loads(req.content)["model"] == "manarasy_v3" else ok_llm([])(req)))
    enable(monkeypatch, 100)
    for i in range(5):
        assert chat(user=f"x{i}").status_code == 200
    assert llm_circuit.state == "CLOSED"
    assert canary_circuit.state == "OPEN"


def test_health_and_metrics_expose_rollout(monkeypatch):
    enable(monkeypatch, 10)
    h = client.get("/health").json()
    assert h["agent_rollout"]["canary_percent"] == 10 and h["agent_rollout"]["canary_model"] == "manarasy_v3"
    set_mock_llm_transport(httpx.MockTransport(ok_llm([])))
    chat()
    prom = client.get("/metrics").text
    assert "agent_variant_total{" in prom and "agent_variant_latency_ms_count{" in prom
    assert 'orchestrator_circuit_breaker_state{service="vllm_canary"}' in prom


def test_ui_action_source_counted():
    client.post("/v1/agent/chat", json={"message": "افتح الملف الشخصي", "session_id": "s"}, headers=H())
    assert 'agent_ui_action_total{via="router"} 1' in client.get("/metrics").text
