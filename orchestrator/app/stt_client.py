"""
عميل خدمة تحويل الصوت إلى نص (STT - faster-whisper) عبر الـ Orchestrator:
- يرسل الملف الصوتي إلى faster-whisper-server على جهاز الـ GPU عبر Tailscale.
- يتحقق من جودة النص المفرّغ ويطبّع النص العربي.
"""
from typing import Any

import httpx

from .config import get_settings
from .resilience import retry_with_backoff, stt_circuit
from .security import sanitize_user_input

_custom_stt_transport: httpx.AsyncBaseTransport | None = None


def set_mock_stt_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    global _custom_stt_transport
    _custom_stt_transport = transport


def _make_stt_client(timeout: float) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, transport=_custom_stt_transport)


async def check_stt_ready() -> bool:
    s = get_settings()
    health_url = s.stt_base_url[:-3] + "/health" if s.stt_base_url.endswith("/v1") else f"{s.stt_base_url}/health"
    try:
        async with _make_stt_client(timeout=3.0) as client:
            resp = await client.get(health_url)
            return resp.status_code == 200
    except Exception:
        return False


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.wav",
    content_type: str = "audio/wav",
    language: str = "ar",
) -> dict[str, Any]:
    s = get_settings()
    if len(audio_bytes) > s.max_audio_upload_bytes:
        raise ValueError("حجم الملف الصوتي يتجاوز الحد المسموح")

    async def _do_stt() -> dict[str, Any]:
        async with _make_stt_client(timeout=s.stt_timeout_seconds) as client:
            files = {"file": (filename, audio_bytes, content_type)}
            data = {
                "model": s.stt_model_name,
                "language": language,
                "response_format": "verbose_json",
            }
            r = await client.post(f"{s.stt_base_url}/audio/transcriptions", data=data, files=files)
            r.raise_for_status()
            return r.json()

    raw = await retry_with_backoff(_do_stt, stt_circuit, max_retries=1)
    raw_text = (raw.get("text") or "").strip()
    clean_text, flagged = sanitize_user_input(raw_text, max_chars=s.max_input_chars)

    # فحص جودة الصوت (إن توفرت segments من faster-whisper)
    segments = raw.get("segments") or []
    low_confidence = False
    if segments:
        avg_logprob = sum(float(seg.get("avg_logprob", -0.3)) for seg in segments) / len(segments)
        no_speech = sum(float(seg.get("no_speech_prob", 0.0)) for seg in segments) / len(segments)
        if avg_logprob < -1.0 or no_speech > 0.75:
            low_confidence = True

    if not clean_text or low_confidence:
        return {
            "status": "needs_clarification",
            "text": clean_text,
            "low_confidence": True,
            "speak": "لم أسمع التسجيل بوضوح، هل يمكنك الإعادة بصوت أوضح؟",
            "injection_flagged": flagged,
        }

    return {
        "status": "ok",
        "text": clean_text,
        "low_confidence": False,
        "injection_flagged": flagged,
    }

