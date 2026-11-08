"""
خدمة الـ Orchestrator المركزية لمنصة منارة (FastAPI):
- النقطة الوحيدة التي يتصل بها تطبيق منارة؛ لا يتصل التطبيق بـ vLLM أو STT مباشرة.
- مصادقة بمفتاح خدمة Bearer بمقارنة آمنة زمنياً.
- Rate Limiting لكل مستخدم/دور، وحد أقصى لحجم الطلب والـ tokens.
- Timeouts، Retries مع Backoff، وCircuit Breaker مع سقوط آمن (Graceful Fallback).
- قوالب Prompts منفصلة بنسخ وأرقام إصدار.
- تسجيل JSON منظم بدون PII، ومقاييس Prometheus على /metrics.
"""
import base64
import json
import time
from typing import Any

from fastapi import Body, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from .agent_backend import Principal
from .agent_tools import confirm_tool_call, execute_tool_call, specs_for
from .config import get_settings
from .llm_client import chat_completion, check_vllm_ready, stream_chat_completion
from .observability import log_structured_event, metrics
from .prompts_loader import registry
from .rate_limit import rate_limiter
from .resilience import CircuitBreakerOpenError, llm_circuit, stt_circuit
from .security import (
    ServiceCaller,
    sanitize_model_output,
    sanitize_user_input,
    scrub_sensitive_dict,
    verify_service_key,
)
from .stt_client import check_stt_ready, transcribe_audio

app = FastAPI(title="Manarasy AI Orchestrator", version="1.0.0")


@app.middleware("http")
async def enforce_body_size_limit(request: Request, call_next):
    settings = get_settings()
    limit = (
        settings.max_audio_upload_bytes + 4096
        if request.url.path.endswith("/audio/transcribe")
        else settings.max_request_body_bytes
    )
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > limit:
        return PlainTextResponse("Request body too large", status_code=413)
    return await call_next(request)


# ─── Models ──────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=6000)
    prompt_id: str = Field(default="assistant_chat")
    context: dict[str, Any] = Field(default_factory=dict)
    enable_thinking: bool | None = None
    max_tokens: int | None = Field(default=None, ge=16, le=1024)
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)


class EvaluationNoteRequest(BaseModel):
    recitation_type: str = "حفظ جديد"
    target_unit: str = "صفحة 1"
    grade: str = "ممتاز"
    memorization_mistakes: int = Field(default=0, ge=0, le=50)
    tajweed_mistakes: int = Field(default=0, ge=0, le=50)
    behavior_score: int = Field(default=10, ge=0, le=10)
    requires_repeat: bool = False
    teacher_notes: str = Field(default="", max_length=1000)


class ReportInsightRequest(BaseModel):
    period: str = "الشهر الحالي"
    average_cpi: str = "0%"
    attendance_rate: str = "0%"
    total_pages: int = 0
    total_halaqat: int = 0
    extra_context: str = Field(default="", max_length=1500)


class QuizGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=500)
    count: int = Field(default=3, ge=1, le=10)
    difficulty: str = Field(default="متوسط", max_length=50)


class AgentTurnRequest(BaseModel):
    utterance: str = Field(..., min_length=1, max_length=2000)
    halaqat_ids: list[str] = Field(default_factory=list)


class ConfirmRequest(BaseModel):
    token: str = Field(..., min_length=1)
    utterance: str = Field(..., min_length=1, max_length=500)


# ─── Health, Readiness & Metrics ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "manarasy-orchestrator",
        "circuit_breakers": {
            "vllm": llm_circuit.state,
            "stt": stt_circuit.state,
        },
        "prompts": registry.list_versions(),
    }


@app.get("/ready")
async def ready():
    vllm_ok = await check_vllm_ready()
    stt_ok = await check_stt_ready()
    is_ready = vllm_ok and llm_circuit.state != "OPEN"
    status_code = 200 if is_ready else 503
    return PlainTextResponse(
        content=json.dumps(
            {
                "ready": is_ready,
                "vllm_reachable": vllm_ok,
                "stt_reachable": stt_ok,
                "vllm_circuit": llm_circuit.state,
                "stt_circuit": stt_circuit.state,
            }
        ),
        status_code=status_code,
        media_type="application/json",
    )


@app.get("/metrics", response_class=PlainTextResponse)
def prometheus_metrics():
    return metrics.render_prometheus()


# ─── Helper for Principal from ServiceCaller ─────────────────────────────────
def _build_principal(
    caller: ServiceCaller,
    x_user_jwt: str = "",
    halaqat_ids: list[str] | None = None,
) -> Principal:
    forward_headers: dict[str, str] = {}
    if x_user_jwt:
        forward_headers["Authorization"] = (
            x_user_jwt if x_user_jwt.startswith("Bearer ") else f"Bearer {x_user_jwt}"
        )
    if caller.tenant_id:
        forward_headers["Tenant-ID"] = caller.tenant_id
    return Principal(
        user_id=caller.user_id,
        role=caller.role,
        tenant_id=caller.tenant_id or "t1",
        halaqat_ids=halaqat_ids or [],
        forward_headers=forward_headers,
    )


# ─── 1. General Chat & Streaming ─────────────────────────────────────────────
@app.post("/v1/chat")
async def v1_chat(req: ChatRequest, caller: ServiceCaller = Depends(verify_service_key)):
    t0 = time.monotonic()
    settings = get_settings()
    try:
        rate_limiter.check(caller)
    except HTTPException as exc:
        log_structured_event(
            endpoint="/v1/chat",
            status_code=exc.status_code,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=req.prompt_id,
            outcome="rate_limited",
        )
        raise

    try:
        tpl = registry.get(req.prompt_id)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown prompt_id: {req.prompt_id}")

    clean_msg, flagged = sanitize_user_input(req.message, max_chars=settings.max_input_chars)
    safe_ctx = scrub_sensitive_dict(req.context)
    ctx_str = json.dumps(safe_ctx, ensure_ascii=False) if safe_ctx else "بدون سياق إضافي"

    messages = tpl.render_messages(
        role=caller.role,
        context_summary=ctx_str,
        user_message=clean_msg,
    )
    use_thinking = tpl.enable_thinking if req.enable_thinking is None else bool(req.enable_thinking)
    max_tok = min(req.max_tokens or tpl.max_tokens, settings.max_output_tokens)
    temp = tpl.temperature if req.temperature is None else req.temperature

    try:
        res = await chat_completion(
            messages,
            max_tokens=max_tok,
            temperature=temp,
            enable_thinking=use_thinking,
        )
        latency_ms = (time.monotonic() - t0) * 1000
        log_structured_event(
            endpoint="/v1/chat",
            status_code=200,
            latency_ms=latency_ms,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            prompt_tokens=res["prompt_tokens"],
            completion_tokens=res["completion_tokens"],
            injection_flagged=flagged,
            outcome="ok",
        )
        return {
            "status": "ok",
            "ai_available": True,
            "answer": res["content"],
            "prompt_version": tpl.version,
            "usage": {
                "prompt_tokens": res["prompt_tokens"],
                "completion_tokens": res["completion_tokens"],
            },
        }
    except (CircuitBreakerOpenError, Exception):
        latency_ms = (time.monotonic() - t0) * 1000
        log_structured_event(
            endpoint="/v1/chat",
            status_code=503,
            latency_ms=latency_ms,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            injection_flagged=flagged,
            outcome="fallback_unavailable",
        )
        return {
            "status": "degraded",
            "ai_available": False,
            "answer": "المساعد الذكي غير متاح حالياً، يمكنك متابعة عملك في المنصة بشكل طبيعي.",
            "prompt_version": tpl.version,
        }


@app.post("/v1/chat/stream")
async def v1_chat_stream(req: ChatRequest, caller: ServiceCaller = Depends(verify_service_key)):
    t0 = time.monotonic()
    settings = get_settings()
    rate_limiter.check(caller)

    try:
        tpl = registry.get(req.prompt_id)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown prompt_id: {req.prompt_id}")

    clean_msg, flagged = sanitize_user_input(req.message, max_chars=settings.max_input_chars)
    safe_ctx = scrub_sensitive_dict(req.context)
    ctx_str = json.dumps(safe_ctx, ensure_ascii=False) if safe_ctx else "بدون سياق إضافي"

    messages = tpl.render_messages(
        role=caller.role,
        context_summary=ctx_str,
        user_message=clean_msg,
    )
    use_thinking = tpl.enable_thinking if req.enable_thinking is None else bool(req.enable_thinking)
    max_tok = min(req.max_tokens or tpl.max_tokens, settings.max_output_tokens)
    temp = tpl.temperature if req.temperature is None else req.temperature

    log_structured_event(
        endpoint="/v1/chat/stream",
        status_code=200,
        latency_ms=(time.monotonic() - t0) * 1000,
        role=caller.role,
        user_id=caller.user_id,
        tenant_id=caller.tenant_id,
        prompt_id=tpl.id,
        prompt_version=tpl.version,
        injection_flagged=flagged,
        outcome="stream_started",
    )

    return StreamingResponse(
        stream_chat_completion(
            messages,
            max_tokens=max_tok,
            temperature=temp,
            enable_thinking=use_thinking,
        ),
        media_type="text/event-stream",
    )


# ─── 2. Specialized AI Endpoints (Notes, Reports, Quiz) ──────────────────────
@app.post("/v1/evaluation-note")
async def v1_evaluation_note(req: EvaluationNoteRequest, caller: ServiceCaller = Depends(verify_service_key)):
    t0 = time.monotonic()
    rate_limiter.check(caller)
    tpl = registry.get("evaluation_note")
    clean_notes, flagged = sanitize_user_input(req.teacher_notes, max_chars=500)

    fallback_note = (
        f"بارك الله فيك على تسميع ({req.target_unit}) بتقدير {req.grade}. "
        + ("ننصح بمراجعة الصفحة جيداً لتثبيت الحفظ قبل الجلسة القادمة." if req.requires_repeat else "استمر على هذا التميز والهمة العالية!")
    )

    messages = tpl.render_messages(
        recitation_type=sanitize_model_output(req.recitation_type),
        target_unit=sanitize_model_output(req.target_unit),
        grade=sanitize_model_output(req.grade),
        memorization_mistakes=req.memorization_mistakes,
        tajweed_mistakes=req.tajweed_mistakes,
        behavior_score=req.behavior_score,
        requires_repeat="نعم" if req.requires_repeat else "لا",
        teacher_notes=clean_notes or "لا توجد ملاحظات إضافية",
    )

    try:
        res = await chat_completion(
            messages,
            max_tokens=tpl.max_tokens,
            temperature=tpl.temperature,
            enable_thinking=False,
        )
        log_structured_event(
            endpoint="/v1/evaluation-note",
            status_code=200,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            prompt_tokens=res["prompt_tokens"],
            completion_tokens=res["completion_tokens"],
            injection_flagged=flagged,
        )
        return {
            "status": "ok",
            "ai_available": True,
            "note": res["content"] or fallback_note,
            "prompt_version": tpl.version,
        }
    except Exception:
        log_structured_event(
            endpoint="/v1/evaluation-note",
            status_code=503,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            injection_flagged=flagged,
            outcome="fallback_unavailable",
        )
        return {
            "status": "degraded",
            "ai_available": False,
            "note": fallback_note,
            "prompt_version": tpl.version,
        }


@app.post("/v1/report-insight")
async def v1_report_insight(req: ReportInsightRequest, caller: ServiceCaller = Depends(verify_service_key)):
    t0 = time.monotonic()
    rate_limiter.check(caller)
    tpl = registry.get("circle_report_insight")
    clean_extra, flagged = sanitize_user_input(req.extra_context, max_chars=1000)

    fallback_insight = (
        f"تحليل أداء الحلقات للفترة ({req.period}) يظهر متوسط كفاءة {req.average_cpi} "
        f"ونسبة حضور {req.attendance_rate} بإجمالي {req.total_pages} صفحة مسمّعة عبر {req.total_halaqat} حلقة."
    )

    messages = tpl.render_messages(
        period=sanitize_model_output(req.period),
        average_cpi=sanitize_model_output(req.average_cpi),
        attendance_rate=sanitize_model_output(req.attendance_rate),
        total_pages=req.total_pages,
        total_halaqat=req.total_halaqat,
        extra_context=clean_extra or "لا يوجد",
    )

    try:
        res = await chat_completion(
            messages,
            max_tokens=tpl.max_tokens,
            temperature=tpl.temperature,
            enable_thinking=False,
        )
        log_structured_event(
            endpoint="/v1/report-insight",
            status_code=200,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            prompt_tokens=res["prompt_tokens"],
            completion_tokens=res["completion_tokens"],
            injection_flagged=flagged,
        )
        return {
            "status": "ok",
            "ai_available": True,
            "insight": res["content"] or fallback_insight,
            "prompt_version": tpl.version,
        }
    except Exception:
        log_structured_event(
            endpoint="/v1/report-insight",
            status_code=503,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            injection_flagged=flagged,
            outcome="fallback_unavailable",
        )
        return {
            "status": "degraded",
            "ai_available": False,
            "insight": fallback_insight,
            "prompt_version": tpl.version,
        }


@app.post("/v1/quiz-generate")
async def v1_quiz_generate(req: QuizGenerateRequest, caller: ServiceCaller = Depends(verify_service_key)):
    t0 = time.monotonic()
    if caller.role not in ("TEACHER", "CENTER_MANAGER", "TENANT_ADMIN", "PLATFORM_ADMIN", "MANAGER", "ADMIN"):
        raise HTTPException(status_code=403, detail="غير مصرّح لهذا الدور بتوليد أسئلة المسابقات")
    rate_limiter.check(caller)
    tpl = registry.get("quiz_generator")
    clean_topic, flagged = sanitize_user_input(req.topic, max_chars=400)

    messages = tpl.render_messages(
        topic=clean_topic,
        count=req.count,
        difficulty=sanitize_model_output(req.difficulty),
    )

    try:
        res = await chat_completion(
            messages,
            max_tokens=tpl.max_tokens,
            temperature=tpl.temperature,
            enable_thinking=tpl.enable_thinking,
        )
        log_structured_event(
            endpoint="/v1/quiz-generate",
            status_code=200,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            prompt_tokens=res["prompt_tokens"],
            completion_tokens=res["completion_tokens"],
            injection_flagged=flagged,
        )
        return {
            "status": "ok",
            "ai_available": True,
            "content": res["content"],
            "prompt_version": tpl.version,
        }
    except Exception:
        log_structured_event(
            endpoint="/v1/quiz-generate",
            status_code=503,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            injection_flagged=flagged,
            outcome="fallback_unavailable",
        )
        return {
            "status": "degraded",
            "ai_available": False,
            "content": "",
            "fallback_message": "ميزة توليد الأسئلة الذكية غير متاحة حالياً، يمكنك إضافة الأسئلة يدوياً.",
            "prompt_version": tpl.version,
        }


# ─── 3. Agent Tools & Natural Language Turn ──────────────────────────────────
@app.get("/v1/tools")
def v1_list_tools(caller: ServiceCaller = Depends(verify_service_key)):
    rate_limiter.check(caller)
    return specs_for(caller.role)


@app.post("/v1/tools/{name}")
def v1_call_tool(
    name: str,
    args: dict = Body(default={}),
    x_user_jwt: str = Header(default=""),
    x_halaqat_ids: str = Header(default=""),
    caller: ServiceCaller = Depends(verify_service_key),
):
    t0 = time.monotonic()
    rate_limiter.check(caller)
    h_ids = [x.strip() for x in x_halaqat_ids.split(",") if x.strip()]
    p = _build_principal(caller, x_user_jwt=x_user_jwt, halaqat_ids=h_ids)
    out = execute_tool_call(p, name, args)
    log_structured_event(
        endpoint=f"/v1/tools/{name}",
        status_code=200,
        latency_ms=(time.monotonic() - t0) * 1000,
        role=caller.role,
        user_id=caller.user_id,
        tenant_id=caller.tenant_id,
        outcome=out.get("status", "ok"),
    )
    return out


@app.post("/v1/confirm")
def v1_confirm_tool(
    req: ConfirmRequest,
    idempotency_key: str | None = Header(default=None),
    x_user_jwt: str = Header(default=""),
    caller: ServiceCaller = Depends(verify_service_key),
):
    t0 = time.monotonic()
    rate_limiter.check(caller)
    p = _build_principal(caller, x_user_jwt=x_user_jwt)
    out = confirm_tool_call(p, req.token, req.utterance, idempotency_key=idempotency_key)
    log_structured_event(
        endpoint="/v1/confirm",
        status_code=200,
        latency_ms=(time.monotonic() - t0) * 1000,
        role=caller.role,
        user_id=caller.user_id,
        tenant_id=caller.tenant_id,
        outcome=out.get("status", "ok"),
    )
    return out


@app.post("/v1/agent/turn")
async def v1_agent_turn(
    req: AgentTurnRequest,
    x_user_jwt: str = Header(default=""),
    caller: ServiceCaller = Depends(verify_service_key),
):
    """يستقبل أمراً نصياً من المعلم أو المدير، يختار الأداة عبر Qwen3-8B، وينفّذها مع التأكيد الصوتي."""
    t0 = time.monotonic()
    rate_limiter.check(caller)
    allowed_tools = specs_for(caller.role)
    tpl = registry.get("agent_tools")
    clean_utt, flagged = sanitize_user_input(req.utterance, max_chars=1500)
    messages = tpl.render_messages(utterance=clean_utt)

    try:
        res = await chat_completion(
            messages,
            max_tokens=tpl.max_tokens,
            temperature=tpl.temperature,
            enable_thinking=False,
            tools=allowed_tools,
        )
    except Exception:
        log_structured_event(
            endpoint="/v1/agent/turn",
            status_code=503,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            prompt_id=tpl.id,
            prompt_version=tpl.version,
            injection_flagged=flagged,
            outcome="fallback_unavailable",
        )
        return {
            "status": "degraded",
            "ai_available": False,
            "speak": "المساعد الذكي غير متاح حالياً، يمكنك تنفيذ الإجراء مباشرة من الشاشة.",
        }

    tool_calls = res.get("tool_calls") or []
    if not tool_calls:
        return {
            "status": "ok",
            "ai_available": True,
            "speak": res.get("content") or "كيف يمكنني مساعدتك في إدارة الحلقة؟",
        }

    first_call = tool_calls[0].get("function") or {}
    tool_name = first_call.get("name") or ""
    raw_args = first_call.get("arguments") or "{}"
    if isinstance(raw_args, str):
        try:
            parsed_args = json.loads(raw_args)
        except ValueError:
            parsed_args = {}
    else:
        parsed_args = raw_args

    p = _build_principal(caller, x_user_jwt=x_user_jwt, halaqat_ids=req.halaqat_ids)
    tool_result = execute_tool_call(p, tool_name, parsed_args)

    log_structured_event(
        endpoint="/v1/agent/turn",
        status_code=200,
        latency_ms=(time.monotonic() - t0) * 1000,
        role=caller.role,
        user_id=caller.user_id,
        tenant_id=caller.tenant_id,
        prompt_id=tpl.id,
        prompt_version=tpl.version,
        prompt_tokens=res["prompt_tokens"],
        completion_tokens=res["completion_tokens"],
        injection_flagged=flagged,
        outcome=tool_result.get("status", "ok"),
    )
    return {"ai_available": True, "tool": tool_name, **tool_result}


# ─── 4. Speech-To-Text (STT) via Orchestrator ────────────────────────────────
@app.post("/v1/audio/transcribe")
async def v1_audio_transcribe(
    request: Request,
    x_audio_filename: str = Header(default="audio.wav"),
    x_audio_language: str = Header(default="ar"),
    caller: ServiceCaller = Depends(verify_service_key),
):
    """
    يستقبل الصوت بإحدى الصيغتين (دون إلزام python-multipart):
    1. JSON يحتوي على {"audio_base64": "...", "filename": "audio.wav", "language": "ar"}
    2. محتوى ثنائي مباشر (application/octet-stream أو audio/*)
    """
    t0 = time.monotonic()
    rate_limiter.check(caller)
    ctype = (request.headers.get("content-type") or "").lower()
    raw_body = await request.body()
    if not raw_body:
        raise HTTPException(status_code=400, detail="الملف الصوتي فارغ")

    filename = x_audio_filename
    language = x_audio_language
    audio_content_type = "audio/wav"

    if "application/json" in ctype:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
            b64 = payload.get("audio_base64") or ""
            audio_bytes = base64.b64decode(b64)
            filename = payload.get("filename") or filename
            language = payload.get("language") or language
            audio_content_type = payload.get("content_type") or audio_content_type
        except Exception:
            raise HTTPException(status_code=400, detail="بيانات الصوت بصيغة JSON غير صالحة")
    else:
        audio_bytes = raw_body
        if ctype.startswith("audio/"):
            audio_content_type = ctype.split(";")[0].strip()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="الملف الصوتي فارغ")

    try:
        out = await transcribe_audio(
            audio_bytes=audio_bytes,
            filename=filename,
            content_type=audio_content_type,
            language=language,
        )
        log_structured_event(
            endpoint="/v1/audio/transcribe",
            status_code=200,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            injection_flagged=bool(out.get("injection_flagged")),
            outcome=out["status"],
        )
        return {"ai_available": True, **out}
    except ValueError as ve:
        raise HTTPException(status_code=413, detail=str(ve))
    except Exception:
        log_structured_event(
            endpoint="/v1/audio/transcribe",
            status_code=503,
            latency_ms=(time.monotonic() - t0) * 1000,
            role=caller.role,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
            outcome="fallback_unavailable",
        )
        return {
            "status": "degraded",
            "ai_available": False,
            "text": "",
            "speak": "خدمة التعرف على الصوت غير متاحة حالياً، يمكنك الكتابة نصياً.",
        }
