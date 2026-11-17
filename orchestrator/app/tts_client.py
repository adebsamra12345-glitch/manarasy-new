"""عميل TTS خادمي اختياري (يتبع واجهة OpenAI /audio/speech) خلف الـ Orchestrator.

معطّل ما لم يُضبط TTS_BASE_URL. الغرض: صوت عربي أفضل من أصوات المتصفح إن ثبتت جودته على جهاز الـ GPU/CPU.
يعيد الصوت كما هو (mp3). لا يخزّن النص ولا الصوت.
"""
import re

import httpx

from .config import get_settings
from .resilience import retry_with_backoff, tts_circuit

_custom_transport: httpx.AsyncBaseTransport | None = None
_CLEAN = re.compile(r"[*_`#>~|]|https?://\S+")


class TtsDisabled(Exception):
    pass


def set_mock_tts_transport(transport) -> None:
    global _custom_transport
    _custom_transport = transport


def tts_enabled() -> bool:
    s = get_settings()
    return bool(s.tts_base_url)


async def synthesize(text: str) -> tuple[bytes, str]:
    s = get_settings()
    if not s.tts_base_url:
        raise TtsDisabled()
    clean = re.sub(r"\s+", " ", _CLEAN.sub(" ", text or "")).strip()[: s.tts_max_chars]
    if not clean:
        raise ValueError("النص فارغ")

    async def _do() -> tuple[bytes, str]:
        async with httpx.AsyncClient(timeout=s.tts_timeout_seconds, transport=_custom_transport) as client:
            payload = {"input": clean, "response_format": "mp3"}
            if s.tts_model:
                payload["model"] = s.tts_model
            if s.tts_voice:
                payload["voice"] = s.tts_voice
            r = await client.post(f"{s.tts_base_url}/audio/speech", json=payload)
            r.raise_for_status()
            return r.content, r.headers.get("content-type", "audio/mpeg")

    return await retry_with_backoff(_do, tts_circuit, max_retries=1)
