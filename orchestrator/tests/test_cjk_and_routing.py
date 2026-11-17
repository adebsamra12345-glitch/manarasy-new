"""اختبارات حارس CJK وتوجيه النماذج لكل نقطة نهاية (Mock transport، بيانات وهمية)."""
import asyncio
import json
import os

import httpx
import pytest
from fastapi.testclient import TestClient

os.environ["ORCHESTRATOR_SERVICE_KEY"] = "test-super-secret-service-key-32bytes"
os.environ["AGENT_BACKEND"] = "mock"
os.environ["LLM_RETRY_BACKOFF_SECONDS"] = "0.01"
os.environ["LLM_MAX_RETRIES"] = "1"
for _k in ("VLLM_MODEL_AGENT", "VLLM_MODEL_TEXT", "VLLM_MODEL_FALLBACK",
           "VLLM_MODEL_EVALUATION_NOTE", "VLLM_MODEL_REPORT_INSIGHT"):
    os.environ.pop(_k, None)
os.environ["VLLM_MODEL_NAME"] = "manarasy"  # AGENT يرث منه عند عدم ضبط VLLM_MODEL_AGENT

from app.llm_client import chat_completion, set_mock_llm_transport, stream_chat_completion
from app.main import app
from app.observability import metrics
from app.rate_limit import rate_limiter
from app.resilience import llm_circuit

client = TestClient(app)
H = {
    "Authorization": "Bearer test-super-secret-service-key-32bytes",
    "X-User-Id": "u1", "X-User-Role": "MANAGER", "X-Tenant-Id": "t1",
}
DIRTY = "لا تتردد، ف你的努力 يُغير العالم"
CLEAN = "لا تتردد، فجهدك يُغير العالم"


@pytest.fixture(autouse=True)
def _reset():
    rate_limiter.reset(); llm_circuit.reset(); metrics.reset()
    yield
    set_mock_llm_transport(None)


def _reply(content="", tool_calls=None):
    msg = {"content": content}
    if tool_calls:
        msg["tool_calls"] = tool_calls
    return httpx.Response(200, json={"choices": [{"message": msg}], "usage": {"prompt_tokens": 5, "completion_tokens": 5}})


def _run(coro):
    return asyncio.run(coro)


def test_manarasy_cjk_retried_with_base():
    seen = []

    def h(req):
        m = json.loads(req.content)["model"]; seen.append(m)
        return _reply(DIRTY if m == "manarasy" else CLEAN)

    set_mock_llm_transport(httpx.MockTransport(h))
    res = _run(chat_completion([{"role": "user", "content": "x"}], model="manarasy", endpoint="/v1/chat"))
    assert seen == ["manarasy", "base"]
    assert res["content"] == CLEAN
    assert 'cjk_guard_total{action="retry",endpoint="/v1/chat"} 1' in metrics.render_prometheus()


def test_base_with_cjk_is_stripped():
    seen = []

    def h(req):
        seen.append(json.loads(req.content)["model"])
        return _reply(DIRTY)

    set_mock_llm_transport(httpx.MockTransport(h))
    res = _run(chat_completion([{"role": "user", "content": "x"}], endpoint="/v1/chat"))
    assert seen == ["base"]  # لا إعادة: النموذج هو الـ FALLBACK نفسه
    assert res["content"] == "لا تتردد، ف يُغير العالم"
    assert 'cjk_guard_total{action="strip",endpoint="/v1/chat"} 1' in metrics.render_prometheus()


def test_cjk_in_tool_arguments_retried_with_base():
    bad = [{"id": "c", "type": "function", "function": {"name": "mark_attendance",
            "arguments": json.dumps({"student_query": "خالد 你好", "status": "absent"}, ensure_ascii=False)}}]
    good = [{"id": "c", "type": "function", "function": {"name": "mark_attendance",
             "arguments": json.dumps({"student_query": "خالد", "status": "absent"}, ensure_ascii=False)}}]
    seen = []

    def h(req):
        m = json.loads(req.content)["model"]; seen.append(m)
        return _reply("", bad if m == "manarasy" else good)

    set_mock_llm_transport(httpx.MockTransport(h))
    res = _run(chat_completion([{"role": "user", "content": "x"}], model="manarasy",
                               tools=[{"type": "function", "function": {"name": "mark_attendance"}}],
                               endpoint="/v1/agent/turn"))
    assert seen == ["manarasy", "base"]
    assert json.loads(res["tool_calls"][0]["function"]["arguments"])["student_query"] == "خالد"


def test_streaming_strips_cjk_per_delta():
    def h(req):
        body = json.loads(req.content)
        assert body["stream"] and body["model"] == "base"
        sse = ('data: ' + json.dumps({"choices": [{"delta": {"content": "لا تتردد، ف你的"}}]}, ensure_ascii=False) + "\n\n"
               'data: ' + json.dumps({"choices": [{"delta": {"content": "جهدك 努力 يغير"}}]}, ensure_ascii=False) + "\n\n"
               "data: [DONE]\n\n")
        return httpx.Response(200, text=sse, headers={"content-type": "text/event-stream"})

    set_mock_llm_transport(httpx.MockTransport(h))

    async def collect():
        return [c async for c in stream_chat_completion([{"role": "user", "content": "x"}])]

    out = "".join(_run(collect()))
    assert not any("一" <= ch <= "鿿" for ch in out)
    assert "جهدك" in out
    assert 'cjk_guard_total{action="strip",endpoint="/v1/chat/stream"} 1' in metrics.render_prometheus()


@pytest.mark.parametrize("path,body,expected", [
    ("/v1/chat", {"message": "مرحبا"}, "base"),
    ("/v1/evaluation-note", {}, "base"),
    ("/v1/report-insight", {}, "base"),
    ("/v1/quiz-generate", {"topic": "الصلاة"}, "base"),
    ("/v1/agent/turn", {"utterance": "اعرض الحلقات"}, "manarasy"),
])
def test_endpoint_routing(path, body, expected):
    seen = []

    def h(req):
        seen.append(json.loads(req.content)["model"])
        return _reply("رد نظيف")

    set_mock_llm_transport(httpx.MockTransport(h))
    r = client.post(path, headers=H, json=body)
    assert r.status_code == 200, r.text
    assert seen[0] == expected


def test_chat_stream_routes_to_text_model():
    seen = []

    def h(req):
        seen.append(json.loads(req.content)["model"])
        return httpx.Response(200, text='data: {"choices":[{"delta":{"content":"مرحبا"}}]}\n\ndata: [DONE]\n\n',
                              headers={"content-type": "text/event-stream"})

    set_mock_llm_transport(httpx.MockTransport(h))
    r = client.post("/v1/chat/stream", headers=H, json={"message": "مرحبا"})
    assert r.status_code == 200 and seen == ["base"]


def test_endpoint_model_override_via_env(monkeypatch):
    monkeypatch.setenv("VLLM_MODEL_EVALUATION_NOTE", "manarasy")
    seen = []

    def h(req):
        seen.append(json.loads(req.content)["model"])
        return _reply("ملاحظة")

    set_mock_llm_transport(httpx.MockTransport(h))
    assert client.post("/v1/evaluation-note", headers=H, json={}).status_code == 200
    assert seen[0] == "manarasy"
