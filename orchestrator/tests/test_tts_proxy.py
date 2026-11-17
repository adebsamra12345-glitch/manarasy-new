import json
import os

import httpx
import pytest
from fastapi.testclient import TestClient

os.environ["ORCHESTRATOR_SERVICE_KEY"] = "test-super-secret-service-key-32bytes"
os.environ["AGENT_BACKEND"] = "mock"

from app.main import app
from app.observability import metrics
from app.rate_limit import rate_limiter
from app.resilience import tts_circuit
from app.tts_client import set_mock_tts_transport

client = TestClient(app)
H = {"Authorization": "Bearer test-super-secret-service-key-32bytes", "X-User-Id": "u1", "X-User-Role": "TEACHER", "X-Tenant-Id": "t1"}


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    rate_limiter.reset(); tts_circuit.reset(); metrics.reset()
    monkeypatch.delenv("TTS_BASE_URL", raising=False)
    yield
    set_mock_tts_transport(None)


def test_disabled_returns_503_so_browser_reads():
    r = client.post("/v1/audio/speak", json={"text": "مرحبا"}, headers=H)
    assert r.status_code == 503 and r.json()["detail"] == "tts_disabled"
    assert client.get("/health").json()["tts_enabled"] is False


def test_enabled_proxies_audio_and_cleans_text(monkeypatch):
    monkeypatch.setenv("TTS_BASE_URL", "http://tts.local/v1")
    monkeypatch.setenv("TTS_VOICE", "ar-voice")
    seen = {}
    def h(req: httpx.Request):
        seen["url"] = str(req.url); seen["body"] = json.loads(req.content)
        return httpx.Response(200, content=b"ID3AUDIO", headers={"content-type": "audio/mpeg"})
    set_mock_tts_transport(httpx.MockTransport(h))
    r = client.post("/v1/audio/speak", json={"text": "**مرحباً** https://x.y بك"}, headers=H)
    assert r.status_code == 200 and r.content == b"ID3AUDIO" and r.headers["content-type"] == "audio/mpeg"
    assert seen["url"] == "http://tts.local/v1/audio/speech"
    assert seen["body"]["input"] == "مرحباً بك" and seen["body"]["voice"] == "ar-voice"


def test_backend_failure_degrades_to_503(monkeypatch):
    monkeypatch.setenv("TTS_BASE_URL", "http://tts.local/v1")
    set_mock_tts_transport(httpx.MockTransport(lambda req: httpx.Response(500)))
    r = client.post("/v1/audio/speak", json={"text": "مرحبا"}, headers=H)
    assert r.status_code == 503 and r.json()["detail"] == "tts_unavailable"


def test_requires_service_key():
    assert client.post("/v1/audio/speak", json={"text": "x"}).status_code in (401, 403)
