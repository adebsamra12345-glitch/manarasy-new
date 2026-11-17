"""
عميل vLLM المتوافق مع OpenAI:
- يدعم الاستدلال العادي، واستدعاء الأدوات (Tool Calling)، والـ Streaming (SSE).
- يفرض enable_thinking=False افتراضياً للدردشة والأدوات، ولا يفعّله إلا للمهام التي تطلبه صراحةً.
- محمي بـ Timeouts وRetries وCircuit Breaker.
"""
import json
import re
from typing import Any, AsyncIterator

import httpx

from .config import get_settings
from .observability import logger as _obs_logger, metrics
from .resilience import llm_circuit, retry_with_backoff
from .security import sanitize_model_output

# نقل مخصص للاختبارات (Mock Transport) عند الحاجة دون لمس الشبكة
_custom_async_transport: httpx.AsyncBaseTransport | None = None


def set_mock_llm_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    global _custom_async_transport
    _custom_async_transport = transport


def _make_async_client(timeout: float) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, transport=_custom_async_transport)


# حارس الحروف الدخيلة: الصينية/اليابانية/الكورية (المحوّل يُنتجها أحياناً وسط النص العربي)
CJK_RE = re.compile("[\u3000-\u9fff\uac00-\ud7af\u3040-\u30ff]")


def has_cjk(text: str) -> bool:
    return bool(text) and CJK_RE.search(text) is not None


def strip_cjk(text: str) -> str:
    return CJK_RE.sub("", text)


def _tool_calls_have_cjk(tool_calls: list[dict[str, Any]]) -> bool:
    for tc in tool_calls or []:
        args = ((tc or {}).get("function") or {}).get("arguments")
        if isinstance(args, str):
            # قيم arguments (JSON مُسلسل)؛ يُفحص النص الخام فيشمل كل القيم
            if has_cjk(args):
                return True
        elif isinstance(args, dict) and has_cjk(json.dumps(args, ensure_ascii=False)):
            return True
    return False


def _strip_tool_calls(tool_calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for tc in tool_calls or []:
        tc = json.loads(json.dumps(tc))
        fn = tc.get("function") or {}
        if isinstance(fn.get("arguments"), str):
            fn["arguments"] = strip_cjk(fn["arguments"])
        elif isinstance(fn.get("arguments"), dict):
            fn["arguments"] = json.loads(strip_cjk(json.dumps(fn["arguments"], ensure_ascii=False)))
        out.append(tc)
    return out


def _log_cjk(action: str, endpoint: str, model: str, length: int) -> None:
    # خصوصية: العداد والطول فقط، لا نص الرد
    metrics.inc_cjk_guard(action, endpoint)
    _obs_logger.info(json.dumps(
        {"event": "cjk_guard", "action": action, "endpoint": endpoint, "model": model, "content_len": length},
        ensure_ascii=False,
    ))


async def check_vllm_ready() -> bool:
    s = get_settings()
    health_url = s.vllm_base_url[:-3] + "/health" if s.vllm_base_url.endswith("/v1") else f"{s.vllm_base_url}/health"
    try:
        async with _make_async_client(timeout=3.0) as client:
            resp = await client.get(health_url)
            if resp.status_code == 200:
                return True
            resp_models = await client.get(f"{s.vllm_base_url}/models")
            return resp_models.status_code == 200
    except Exception:
        return False


async def chat_completion(
    messages: list[dict[str, str]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    enable_thinking: bool = False,
    tools: list[dict[str, Any]] | None = None,
    model: str | None = None,
    endpoint: str = "",
) -> dict[str, Any]:
    s = get_settings()
    model = model or s.vllm_model_text
    capped_tokens = min(max_tokens or s.max_output_tokens, s.max_output_tokens)
    temp = s.default_temperature if temperature is None else temperature

    async def _call_model(model_name: str) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "max_tokens": capped_tokens,
            "temperature": temp,
            "chat_template_kwargs": {"enable_thinking": bool(enable_thinking)},
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async def _do_call() -> dict[str, Any]:
            async with _make_async_client(timeout=s.llm_timeout_seconds) as client:
                r = await client.post(f"{s.vllm_base_url}/chat/completions", json=payload)
                r.raise_for_status()
                return r.json()

        data = await retry_with_backoff(_do_call, llm_circuit)
        choice = (data.get("choices") or [{}])[0]
        msg = choice.get("message") or {}
        usage = data.get("usage") or {}
        return {
            "content": sanitize_model_output(msg.get("content") or ""),
            "tool_calls": msg.get("tool_calls") or [],
            "prompt_tokens": int(usage.get("prompt_tokens") or 0),
            "completion_tokens": int(usage.get("completion_tokens") or 0),
        }

    result = await _call_model(model)
    if has_cjk(result["content"]) or _tool_calls_have_cjk(result["tool_calls"]):
        fallback = s.vllm_model_fallback
        if fallback and fallback != model:
            _log_cjk("retry", endpoint, model, len(result["content"]))
            retry = await _call_model(fallback)
            retry["prompt_tokens"] += result["prompt_tokens"]
            retry["completion_tokens"] += result["completion_tokens"]
            result = retry
        if has_cjk(result["content"]) or _tool_calls_have_cjk(result["tool_calls"]):
            _log_cjk("strip", endpoint, fallback if fallback and fallback != model else model, len(result["content"]))
            result["content"] = strip_cjk(result["content"])
            result["tool_calls"] = _strip_tool_calls(result["tool_calls"])
    return result


async def stream_chat_completion(
    messages: list[dict[str, str]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    enable_thinking: bool = False,
    model: str | None = None,
    endpoint: str = "/v1/chat/stream",
) -> AsyncIterator[str]:
    """يولّد أحداث SSE (data: {...}\\n\\n) متوافقة مع الواجهة وتطبيق منارة."""
    s = get_settings()
    llm_circuit.allow_request()
    capped_tokens = min(max_tokens or s.max_output_tokens, s.max_output_tokens)
    temp = s.default_temperature if temperature is None else temperature

    payload: dict[str, Any] = {
        "model": model or s.vllm_model_text,
        "messages": messages,
        "max_tokens": capped_tokens,
        "temperature": temp,
        "stream": True,
        "chat_template_kwargs": {"enable_thinking": bool(enable_thinking)},
    }

    in_think_block = False
    stripped_chars = 0
    try:
        async with _make_async_client(timeout=s.llm_timeout_seconds) as client:
            async with client.stream("POST", f"{s.vllm_base_url}/chat/completions", json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except ValueError:
                        continue
                    delta = ((chunk.get("choices") or [{}])[0].get("delta") or {}).get("content") or ""
                    if not delta:
                        continue
                    if "<think>" in delta and "</think>" in delta:
                        before = delta.split("<think>", 1)[0]
                        after = delta.split("</think>", 1)[-1]
                        delta = before + after
                    elif "<think>" in delta:
                        in_think_block = True
                        delta = delta.split("<think>", 1)[0]
                    elif "</think>" in delta:
                        in_think_block = False
                        delta = delta.split("</think>", 1)[-1]
                    if in_think_block or not delta:
                        continue
                    safe_delta = sanitize_model_output(delta)
                    if has_cjk(safe_delta):
                        # لا يمكن إعادة التوليد بعد الإرسال: نحذف الحروف الدخيلة من كل delta
                        stripped_chars += len(CJK_RE.findall(safe_delta))
                        safe_delta = strip_cjk(safe_delta)
                    if not safe_delta:
                        continue
                    yield f"data: {json.dumps({'delta': safe_delta}, ensure_ascii=False)}\n\n"
        llm_circuit.record_success()
        if stripped_chars:
            _log_cjk("strip", endpoint, model or s.vllm_model_text, stripped_chars)
        yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
    except Exception as exc:
        llm_circuit.record_failure()
        err_payload = {
            "error": True,
            "fallback": "المساعد الذكي غير متاح حالياً، يرجى المحاولة لاحقاً.",
            "detail": type(exc).__name__,
        }
        yield f"data: {json.dumps(err_payload, ensure_ascii=False)}\n\n"
