"""
عميل vLLM المتوافق مع OpenAI:
- يدعم الاستدلال العادي، واستدعاء الأدوات (Tool Calling)، والـ Streaming (SSE).
- يفرض enable_thinking=False افتراضياً للدردشة والأدوات، ولا يفعّله إلا للمهام التي تطلبه صراحةً.
- محمي بـ Timeouts وRetries وCircuit Breaker.
"""
import json
from typing import Any, AsyncIterator

import httpx

from .config import get_settings
from .resilience import llm_circuit, retry_with_backoff
from .security import sanitize_model_output

# نقل مخصص للاختبارات (Mock Transport) عند الحاجة دون لمس الشبكة
_custom_async_transport: httpx.AsyncBaseTransport | None = None


def set_mock_llm_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    global _custom_async_transport
    _custom_async_transport = transport


def _make_async_client(timeout: float) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, transport=_custom_async_transport)


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
) -> dict[str, Any]:
    s = get_settings()
    capped_tokens = min(max_tokens or s.max_output_tokens, s.max_output_tokens)
    temp = s.default_temperature if temperature is None else temperature

    payload: dict[str, Any] = {
        "model": s.vllm_model_name,
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

    raw_content = msg.get("content") or ""
    clean_content = sanitize_model_output(raw_content)

    return {
        "content": clean_content,
        "tool_calls": msg.get("tool_calls") or [],
        "prompt_tokens": int(usage.get("prompt_tokens") or 0),
        "completion_tokens": int(usage.get("completion_tokens") or 0),
    }


async def stream_chat_completion(
    messages: list[dict[str, str]],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    enable_thinking: bool = False,
) -> AsyncIterator[str]:
    """يولّد أحداث SSE (data: {...}\\n\\n) متوافقة مع الواجهة وتطبيق منارة."""
    s = get_settings()
    llm_circuit.allow_request()
    capped_tokens = min(max_tokens or s.max_output_tokens, s.max_output_tokens)
    temp = s.default_temperature if temperature is None else temperature

    payload: dict[str, Any] = {
        "model": s.vllm_model_name,
        "messages": messages,
        "max_tokens": capped_tokens,
        "temperature": temp,
        "stream": True,
        "chat_template_kwargs": {"enable_thinking": bool(enable_thinking)},
    }

    in_think_block = False
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
                    if not safe_delta:
                        continue
                    yield f"data: {json.dumps({'delta': safe_delta}, ensure_ascii=False)}\n\n"
        llm_circuit.record_success()
        yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
    except Exception as exc:
        llm_circuit.record_failure()
        err_payload = {
            "error": True,
            "fallback": "المساعد الذكي غير متاح حالياً، يرجى المحاولة لاحقاً.",
            "detail": type(exc).__name__,
        }
        yield f"data: {json.dumps(err_payload, ensure_ascii=False)}\n\n"
