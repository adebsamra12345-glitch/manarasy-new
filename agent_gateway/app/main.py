import secrets
import time

import jsonschema
from fastapi import Body, Depends, FastAPI, Header, HTTPException

from .arabic import parse_confirmation
from .backend import BackendError
from .auth import Principal, current_principal
from .tools import TOOLS, NeedClarification, specs_for

app = FastAPI(title="Manarasy Agent Gateway")

CONFIRM_TTL = 60
_pending: dict[str, dict] = {}   # token -> {principal, tool, args, exp}
_done: dict[str, dict] = {}      # Idempotency-Key -> result


def _clarify(e: NeedClarification):
    return {"status": "needs_clarification", "unclear_part": e.unclear_part,
            "speak": e.question_ar, "options": e.options}


def _run(p: Principal, tool, args):
    try:
        return {"status": "ok", "result": tool.handler(p, args)}
    except NeedClarification as e:
        return _clarify(e)
    except BackendError as e:
        return _backend_error(e)


def _backend_error(e: BackendError):
    if e.status in (401, 403):
        raise HTTPException(e.status, e.message)
    spoken = ("المنصة غير متاحة حالياً، حاول بعد قليل." if e.status >= 500
              else f"رفضت المنصة الطلب: {e.message}")
    return {"status": "error", "speak": spoken}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/v1/tools")
def tools(p: Principal = Depends(current_principal)):
    return specs_for(p.role)


@app.post("/v1/tools/{name}")
def call_tool(name: str, args: dict = Body(default={}), p: Principal = Depends(current_principal)):
    if name == "ask_clarification":
        return {"status": "needs_clarification", "unclear_part": args.get("unclear_part", ""),
                "speak": args.get("question_ar", "هل تعيد من فضلك؟"), "options": []}
    tool = TOOLS.get(name)
    if not tool or p.role not in tool.roles:       # لا نكشف وجود أدوات غير مصرّح بها
        raise HTTPException(404, "unknown tool")
    try:
        jsonschema.validate(args, tool.parameters)
    except jsonschema.ValidationError as e:
        return {"status": "needs_clarification", "unclear_part": ".".join(map(str, e.path)),
                "speak": "ينقصني بعض المعلومات لتنفيذ الطلب، هل تعيد الجزء الناقص؟", "options": []}
    if not tool.write:
        return _run(p, tool, args)
    # كتابة: لا تنفيذ قبل تأكيد صوتي
    try:
        question = tool.confirm_text(p, args)
    except NeedClarification as e:
        return _clarify(e)
    except BackendError as e:
        return _backend_error(e)
    token = secrets.token_urlsafe(16)
    _pending[token] = {"uid": p.user_id, "tenant": p.tenant_id, "principal": p,
                       "tool": name, "args": args, "exp": time.time() + CONFIRM_TTL}
    return {"status": "confirm_required", "confirm_token": token,
            "speak": f"{question}، هل أؤكد؟"}


@app.post("/v1/confirm")
def confirm(token: str = Body(...), utterance: str = Body(...),
            idempotency_key: str | None = Header(default=None),
            p: Principal = Depends(current_principal)):
    if idempotency_key and idempotency_key in _done:
        return _done[idempotency_key]
    pend = _pending.get(token)
    if not pend or pend["uid"] != p.user_id or pend["tenant"] != p.tenant_id:
        raise HTTPException(404, "no pending action")
    if time.time() > pend["exp"]:
        _pending.pop(token, None)
        return {"status": "expired", "speak": "انتهت مهلة التأكيد، أعد الطلب من فضلك."}
    verdict = parse_confirmation(utterance)
    if verdict == "no":
        _pending.pop(token, None)
        return {"status": "cancelled", "speak": "تم إلغاء العملية."}
    if verdict == "unclear":
        return {"status": "confirm_required", "confirm_token": token,
                "speak": "لم أفهم ردك، هل أؤكد التنفيذ؟ قل نعم أو لا."}
    _pending.pop(token, None)
    out = _run(pend["principal"], TOOLS[pend["tool"]], pend["args"])
    if out["status"] == "ok":
        out["speak"] = "تم التنفيذ."
    if idempotency_key:
        _done[idempotency_key] = out
    return out
