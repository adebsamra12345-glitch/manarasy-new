"""أدوات الوكيل الصوتي/النصي لمنصة منارة مع تأكيد إلزامي قبل أي عملية كتابة."""
import copy
import os
import secrets
import time
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Callable

import jsonschema
from fastapi import HTTPException

from .agent_backend import BackendError, Principal, get_backend
from .arabic import normalize, parse_confirmation
from .screen_data import ALL_SCREEN_IDS, screen_ids_for_role
from .security import scrub_sensitive_dict
from .state_store import store

STATUS_AR = {"present": "حضور", "absent": "غياب", "late": "تأخر", "excused": "غياب بعذر"}
CONFIRM_TTL = 60

_PENDING_TTL = CONFIRM_TTL * 5  # أطول من المهلة ليظهر رد «انتهت المهلة» بدل «لا يوجد معلّق»
_DONE_TTL = 600

ROLE_MAPPING = {
    "TENANT_ADMIN": "manager",
    "CENTER_MANAGER": "manager",
    "MANAGER": "manager",
    "TEACHER": "teacher",
}


class NeedClarification(Exception):
    def __init__(self, unclear_part: str, question_ar: str, options=None):
        self.unclear_part, self.question_ar, self.options = unclear_part, question_ar, options or []


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    roles: set
    write: bool
    handler: Callable
    confirm_text: Callable | None = None


def resolve_student(p: Principal, query: str) -> dict:
    """يحل الاسم المنطوق إلى طالب ضمن نطاق المستخدم؛ لا يخمّن عند الغموض ويحجب أي PII."""
    q = normalize(query)
    if not q:
        raise NeedClarification("اسم الطالب", "لم أفهم اسم الطالب، هل تعيد الاسم من فضلك؟")
    scored = sorted(
        (
            (
                SequenceMatcher(None, q, normalize(s["full_name"])).ratio()
                + (0.25 if q in normalize(s["full_name"]).split() else 0),
                s["id"],
                s,
            )
            for s in get_backend().students(p)
        ),
        key=lambda x: -x[0],
    )
    good = [x for x in scored if x[0] >= 0.6]
    if not good:
        raise NeedClarification(query, f"لم أجد طالباً باسم «{query}» ضمن نطاقك، هل تعيد الاسم؟")
    if len(good) > 1 and good[0][0] - good[1][0] < 0.15:
        names = [x[2]["full_name"] for x in good[:2]]
        raise NeedClarification(query, f"تقصد {names[0]} أم {names[1]}؟", names)
    return scrub_sensitive_dict(good[0][2])


def resolve_halaqa(p: Principal, query: str) -> dict:
    """يحل اسم الحلقة المنطوق إلى حلقة ضمن نطاق المستخدم بدون تخمين."""
    q = normalize(query)
    if not q:
        raise NeedClarification("اسم الحلقة", "لم أفهم اسم الحلقة، هل تعيد الاسم من فضلك؟")
    token = normalize("حلقة")

    def _no_al(text: str) -> str:
        # «ال» التعريف تُضخّم التشابه بين كلمات لا علاقة لها (القديمة ~ البقرة)
        return " ".join(w[2:] if w.startswith("ال") and len(w) > 4 else w for w in text.split())

    q_core = _no_al(q.replace(token, "").strip() or q)
    halaqat = get_backend().halaqat(p)
    if not halaqat:
        raise NeedClarification(query, "لا توجد حلقات متاحة ضمن نطاقك.")
    scored = []
    for h in halaqat:
        h_norm = normalize(h["name"])
        h_core = _no_al(h_norm.replace(token, "").strip() or h_norm)
        score = SequenceMatcher(None, q_core, h_core).ratio()
        if q_core in h_core.split() or h_core in q_core.split():
            score = max(score, 0.8)
        scored.append((score, h["id"], h))

    scored.sort(key=lambda x: -x[0])
    good = [x for x in scored if x[0] >= 0.6]
    if not good:
        raise NeedClarification(query, f"لم أجد حلقة باسم «{query}» ضمن نطاقك، هل تعيد الاسم؟")
    if len(good) > 1 and good[0][0] - good[1][0] < 0.15:
        names = [x[2]["name"] for x in good[:2]]
        raise NeedClarification(query, f"تقصد {names[0]} أم {names[1]}؟", names)
    return good[0][2]


def list_students(p: Principal, a: dict):
    h = resolve_halaqa(p, a["halaqa_query"])
    students = get_backend().list_students(p, h["id"])
    return scrub_sensitive_dict(students)


def attendance_report(p: Principal, a: dict):
    period = a.get("period", "week")
    student_query = a.get("student_query")
    halaqa_query = a.get("halaqa_query")
    if student_query:
        s = resolve_student(p, student_query)
        rep = get_backend().attendance_report(p, student_id=s["id"], period=period)
        return scrub_sensitive_dict(rep)
    if halaqa_query:
        h = resolve_halaqa(p, halaqa_query)
        rep = get_backend().attendance_report(p, halaqa_id=h["id"], period=period)
        return scrub_sensitive_dict(rep)
    raise NeedClarification("اسم الطالب أو الحلقة", "هل ترغب في تقرير الحضور لطالب محدد أم لحلقة كاملة؟")


def recitation_history(p: Principal, a: dict):
    s = resolve_student(p, a["student_query"])
    limit = int(a.get("limit") or 5)
    hist = get_backend().recitation_history(p, s["id"], limit=limit)
    return scrub_sensitive_dict(hist)


def points_history(p: Principal, a: dict):
    s = resolve_student(p, a["student_query"])
    hist = get_backend().points_history(p, s["id"])
    return scrub_sensitive_dict(hist)


def list_halaqat(p: Principal, a: dict):
    return scrub_sensitive_dict(get_backend().halaqat(p))


def student_summary(p: Principal, a: dict):
    s = resolve_student(p, a["student_query"])
    return {k: s.get(k) for k in ("id", "full_name", "halaqa_name", "points", "reached_page", "rating")}


def mark_attendance(p: Principal, a: dict):
    s = resolve_student(p, a["student_query"])
    get_backend().mark_attendance(p, s, a["status"])
    return {"ok": True, "student_name": s["full_name"], "status": a["status"]}


def record_recitation_eval(p: Principal, a: dict):
    s = resolve_student(p, a["student_query"])
    fields = {k: a.get(k) for k in ("grade", "page_number", "behavior_score", "notes", "surah_number")}
    get_backend().record_eval(p, s, fields)
    return {"ok": True, "student_name": s["full_name"], **{k: v for k, v in fields.items() if v is not None}}


def points_bonus(p: Principal, a: dict):
    s = resolve_student(p, a["student_query"])
    get_backend().bonus(p, s, a["reason"])
    return {"ok": True, "student_name": s["full_name"], "added": 1}


def pending_requests(p: Principal, a: dict):
    return scrub_sensitive_dict(get_backend().pending(p))


def approve_registration(p: Principal, a: dict):
    return {"ok": True, **get_backend().approve(p, a["request_id"])}


def halaqa_overview(p: Principal, a: dict):
    return scrub_sensitive_dict(get_backend().overview(p))


def ui_tool_enabled() -> bool:
    """أداة open_screen للنموذج مفعّلة فقط مع محوّل v3 المدرَّب عليها (AGENT_UI_TOOL=1)؛
    الموجّه الحتمي في screens.py يعمل دائماً بدونها."""
    return os.getenv("AGENT_UI_TOOL", "0") == "1"


def open_screen(p: Principal, a: dict):
    from .screens import open_screen_tool  # استيراد متأخر: screens يستورد هذا الملف

    return open_screen_tool(p, a)


def _obj(props, req):
    return {"type": "object", "properties": props, "required": req}


_SQ = {"type": "string", "description": "اسم الطالب كما قاله المستخدم"}
_BOTH, _MGR = {"teacher", "manager"}, {"manager"}


def _name(p: Principal, a: dict):
    return resolve_student(p, a["student_query"])["full_name"]


TOOLS: dict[str, Tool] = {
    t.name: t
    for t in [
        Tool("list_halaqat", "عرض الحلقات", _obj({}, []), _BOTH, False, list_halaqat),
        Tool(
            "student_summary",
            "ملخص طالب ونقاطه",
            _obj({"student_query": _SQ}, ["student_query"]),
            _BOTH,
            False,
            student_summary,
        ),
        Tool(
            "mark_attendance",
            "تسجيل حضور/غياب/تأخر طالب",
            _obj(
                {
                    "student_query": _SQ,
                    "status": {"type": "string", "enum": ["present", "absent", "late", "excused"]},
                },
                ["student_query", "status"],
            ),
            _BOTH,
            True,
            mark_attendance,
            lambda p, a: f"سأسجّل {STATUS_AR[a['status']]} للطالب {_name(p, a)}",
        ),
        Tool(
            "record_recitation_eval",
            "تسجيل تقييم تسميع (تقدير وصفحة)",
            _obj(
                {
                    "student_query": _SQ,
                    "grade": {"type": "string", "description": "اسم التقدير مثل: ممتاز، جيد جداً، مقبول، إعادة"},
                    "page_number": {"type": "integer", "minimum": 1, "maximum": 604},
                    "behavior_score": {"type": "integer", "minimum": 0, "maximum": 10},
                    "notes": {"type": "string"},
                },
                ["student_query", "grade"],
            ),
            _BOTH,
            True,
            record_recitation_eval,
            lambda p, a: "سأسجّل تقييم تسميع بتقدير {}{} للطالب {}".format(
                a["grade"],
                f" للصفحة {a['page_number']}" if a.get("page_number") else "",
                _name(p, a),
            ),
        ),
        Tool(
            "points_bonus",
            "منح نقطة مكافأة سلوكية لطالب (+1)",
            _obj({"student_query": _SQ, "reason": {"type": "string", "description": "سبب المكافأة"}}, ["student_query", "reason"]),
            _BOTH,
            True,
            points_bonus,
            lambda p, a: f"سأمنح نقطة مكافأة للطالب {_name(p, a)} بسبب {a['reason']}",
        ),
        Tool("pending_requests", "طلبات التسجيل المعلقة", _obj({}, []), _MGR, False, pending_requests),
        Tool("halaqa_overview", "نظرة عامة على الحلقات", _obj({}, []), _MGR, False, halaqa_overview),
        Tool(
            "approve_registration",
            "اعتماد طلب تسجيل طالب",
            _obj({"request_id": {"type": "string"}}, ["request_id"]),
            _MGR,
            True,
            approve_registration,
            lambda p, a: f"سأعتمد طلب التسجيل رقم {a['request_id']}",
        ),
        Tool(
            "open_screen",
            "فتح تبويب أو شاشة في المنصة أو الانتقال إليها (تنقل داخل الواجهة): الطلاب، الحلقات، الجلسات، الملف الشخصي، "
            "الحضور، التسميع، جلسات حلقة محددة (halaqa_sessions)، بدء جلسة تسميع جديدة (start_session)، "
            "معلومات طالب (student_profile)، تغيير كلمة المرور (change_password)، تسجيل الخروج (logout). "
            "لا تسأل المستخدم عمّا يريده من التبويب؛ انتقل إليه مباشرة.",
            _obj(
                {
                    "screen": {"type": "string", "enum": ALL_SCREEN_IDS},
                    "halaqa_query": {"type": "string", "description": "اسم الحلقة إن ذكره المستخدم"},
                    "student_query": _SQ,
                },
                ["screen"],
            ),
            _BOTH,
            False,
            open_screen,
        ),
        Tool(
            "list_students",
            "عرض طلاب حلقة",
            _obj({"halaqa_query": {"type": "string", "description": "اسم الحلقة"}}, ["halaqa_query"]),
            _BOTH,
            False,
            list_students,
        ),
        Tool(
            "attendance_report",
            "تقرير حضور طالب أو حلقة لفترة",
            _obj(
                {
                    "student_query": _SQ,
                    "halaqa_query": {"type": "string"},
                    "period": {"type": "string", "enum": ["week", "month"]},
                },
                ["period"],
            ),
            _BOTH,
            False,
            attendance_report,
        ),
        Tool(
            "recitation_history",
            "آخر تقييمات التسميع لطالب",
            _obj({"student_query": _SQ, "limit": {"type": "integer"}}, ["student_query"]),
            _BOTH,
            False,
            recitation_history,
        ),
        Tool(
            "points_history",
            "سجل نقاط طالب",
            _obj({"student_query": _SQ}, ["student_query"]),
            _BOTH,
            False,
            points_history,
        ),
    ]
}

CLARIFY_SPEC = {
    "type": "function",
    "function": {
        "name": "ask_clarification",
        "description": "استخدمها عند عدم فهم جزء من الطلب بدل التخمين",
        "parameters": _obj(
            {"unclear_part": {"type": "string"}, "question_ar": {"type": "string"}},
            ["unclear_part", "question_ar"],
        ),
    },
}


def map_agent_role(raw_role: str) -> str:
    agent_role = ROLE_MAPPING.get((raw_role or "").upper(), (raw_role or "").lower())
    if agent_role not in {"teacher", "manager"}:
        raise HTTPException(status_code=403, detail="هذا الدور غير مصرّح له باستخدام أدوات الوكيل")
    return agent_role


def specs_for(role: str, ui_tool: bool | None = None) -> list:
    """ui_tool: None = العلم العام AGENT_UI_TOOL؛ True/False = قرار المجموعة (canary/مستقر)."""
    agent_role = map_agent_role(role)
    ui_on = ui_tool_enabled() if ui_tool is None else ui_tool
    out = []
    for t in TOOLS.values():
        if agent_role not in t.roles or (t.name == "open_screen" and not ui_on):
            continue
        params = t.parameters
        if t.name == "open_screen":  # تبويبات الدور الحقيقي فقط
            params = copy.deepcopy(params)
            params["properties"]["screen"]["enum"] = screen_ids_for_role((role or "").upper())
        out.append({"type": "function", "function": {"name": t.name, "description": t.description, "parameters": params}})
    return out + [CLARIFY_SPEC]


def _clarify(e: NeedClarification) -> dict:
    return {
        "status": "needs_clarification",
        "unclear_part": e.unclear_part,
        "speak": e.question_ar,
        "options": e.options,
    }


def _backend_error(e: BackendError) -> dict:
    if e.status in (401, 403):
        raise HTTPException(e.status, e.message)
    spoken = "المنصة غير متاحة حالياً، حاول بعد قليل." if e.status >= 500 else f"رفضت المنصة الطلب: {e.message}"
    return {"status": "error", "speak": spoken}


def _run_tool(p: Principal, tool: Tool, args: dict) -> dict:
    try:
        return {"status": "ok", "result": tool.handler(p, args)}
    except NeedClarification as e:
        return _clarify(e)
    except BackendError as e:
        return _backend_error(e)


def execute_tool_call(p: Principal, name: str, args: dict, ui_tool: bool | None = None) -> dict:
    agent_role = map_agent_role(p.role)
    p_scoped = Principal(p.user_id, agent_role, p.tenant_id, p.halaqat_ids, p.forward_headers)

    if name == "ask_clarification":
        return {
            "status": "needs_clarification",
            "unclear_part": args.get("unclear_part", ""),
            "speak": args.get("question_ar", "هل تعيد من فضلك؟"),
            "options": [],
        }

    tool = TOOLS.get(name)
    if not tool or agent_role not in tool.roles or (name == "open_screen" and not (ui_tool_enabled() if ui_tool is None else ui_tool)):
        raise HTTPException(status_code=404, detail="unknown tool")

    try:
        jsonschema.validate(args, tool.parameters)
    except jsonschema.ValidationError as e:
        return {
            "status": "needs_clarification",
            "unclear_part": ".".join(map(str, e.path)),
            "speak": "ينقصني بعض المعلومات لتنفيذ الطلب، هل تعيد الجزء الناقص؟",
            "options": [],
        }

    if not tool.write:
        return _run_tool(p_scoped, tool, args)

    try:
        question = tool.confirm_text(p_scoped, args)
    except NeedClarification as e:
        return _clarify(e)
    except BackendError as e:
        return _backend_error(e)

    token = secrets.token_urlsafe(16)
    # لا نخزّن JWT المستخدم: يُعاد بناء الهوية عند التأكيد من طلب التأكيد نفسه
    store.set(
        f"pending:{token}",
        {
            "uid": p_scoped.user_id,
            "tenant": p_scoped.tenant_id,
            "role": p_scoped.role,
            "halaqat_ids": list(p_scoped.halaqat_ids or []),
            "tool": name,
            "args": args,
            "exp": time.time() + CONFIRM_TTL,
        },
        _PENDING_TTL,
    )
    return {
        "status": "confirm_required",
        "confirm_token": token,
        "speak": f"{question}، هل أؤكد؟",
    }


def confirm_tool_call(p: Principal, token: str, utterance: str, idempotency_key: str | None = None) -> dict:
    idem_key = f"done:{p.tenant_id}:{p.user_id}:{idempotency_key}" if idempotency_key else None
    if idem_key:
        cached = store.get(idem_key)
        if cached is not None:
            return cached

    pend = store.get(f"pending:{token}")
    if not pend or pend["uid"] != p.user_id or pend["tenant"] != p.tenant_id:
        raise HTTPException(status_code=404, detail="no pending action")

    if time.time() > pend["exp"]:
        store.delete(f"pending:{token}")
        return {"status": "expired", "speak": "انتهت مهلة التأكيد، أعد الطلب من فضلك."}

    verdict = parse_confirmation(utterance)
    if verdict == "no":
        store.delete(f"pending:{token}")
        return {"status": "cancelled", "speak": "تم إلغاء العملية."}
    if verdict == "unclear":
        return {
            "status": "confirm_required",
            "confirm_token": token,
            "speak": "لم أفهم ردك، هل أؤكد التنفيذ؟ قل نعم أو لا.",
        }

    store.delete(f"pending:{token}")
    principal = Principal(pend["uid"], pend["role"], pend["tenant"], pend["halaqat_ids"], p.forward_headers)
    out = _run_tool(principal, TOOLS[pend["tool"]], pend["args"])
    if out["status"] == "ok":
        out["speak"] = "تم التنفيذ."
    if idem_key:
        store.set(idem_key, out, _DONE_TTL)
    return out
