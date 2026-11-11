from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Callable

from .arabic import normalize
from .backend import get_backend

STATUS_AR = {"present": "حضور", "absent": "غياب", "late": "تأخر", "excused": "غياب بعذر"}


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
    confirm_text: Callable | None = None  # صياغة سؤال التأكيد الصوتي


def resolve_student(p, query: str) -> dict:
    """يحل الاسم المنطوق إلى طالب ضمن نطاق المستخدم (Django يفلتر النطاق)؛ لا يخمّن عند الغموض."""
    q = normalize(query)
    if not q:
        raise NeedClarification("اسم الطالب", "لم أفهم اسم الطالب، هل تعيد الاسم من فضلك؟")
    scored = sorted(((SequenceMatcher(None, q, normalize(s["full_name"])).ratio()
                      + (0.25 if q in normalize(s["full_name"]).split() else 0), s["id"], s)
                     for s in get_backend().students(p)), key=lambda x: -x[0])
    good = [x for x in scored if x[0] >= 0.6]
    if not good:
        raise NeedClarification(query, f"لم أجد طالباً باسم «{query}»، هل تعيد الاسم؟")
    if len(good) > 1 and good[0][0] - good[1][0] < 0.15:
        names = [x[2]["full_name"] for x in good[:2]]
        raise NeedClarification(query, f"تقصد {names[0]} أم {names[1]}؟", names)
    return good[0][2]


# ---------- handlers ----------
def list_halaqat(p, a):
    return get_backend().halaqat(p)


def student_summary(p, a):
    s = resolve_student(p, a["student_query"])
    return {k: s.get(k) for k in ("id", "full_name", "halaqa_name", "points", "reached_page", "rating")}


def mark_attendance(p, a):
    s = resolve_student(p, a["student_query"])
    get_backend().mark_attendance(p, s, a["status"])
    return {"ok": True, "student_name": s["full_name"], "status": a["status"]}


def record_recitation_eval(p, a):
    s = resolve_student(p, a["student_query"])
    fields = {k: a.get(k) for k in ("grade", "page_number", "behavior_score", "notes", "surah_number")}
    get_backend().record_eval(p, s, fields)
    return {"ok": True, "student_name": s["full_name"], **{k: v for k, v in fields.items() if v is not None}}


def points_bonus(p, a):
    s = resolve_student(p, a["student_query"])
    get_backend().bonus(p, s, a["reason"])
    return {"ok": True, "student_name": s["full_name"], "added": 1}


def pending_requests(p, a):
    return get_backend().pending(p)


def approve_registration(p, a):
    return {"ok": True, **get_backend().approve(p, a["request_id"])}


def halaqa_overview(p, a):
    return get_backend().overview(p)


def _obj(props, req):
    return {"type": "object", "properties": props, "required": req}


_SQ = {"type": "string", "description": "اسم الطالب كما قاله المستخدم"}
_BOTH, _MGR = {"teacher", "manager"}, {"manager"}


def _name(p, a):
    return resolve_student(p, a["student_query"])["full_name"]


TOOLS: dict[str, Tool] = {t.name: t for t in [
    Tool("list_halaqat", "عرض الحلقات", _obj({}, []), _BOTH, False, list_halaqat),
    Tool("student_summary", "ملخص طالب ونقاطه", _obj({"student_query": _SQ}, ["student_query"]),
         _BOTH, False, student_summary),
    Tool("mark_attendance", "تسجيل حضور/غياب/تأخر طالب",
         _obj({"student_query": _SQ,
               "status": {"type": "string", "enum": ["present", "absent", "late", "excused"]}},
              ["student_query", "status"]),
         _BOTH, True, mark_attendance,
         lambda p, a: f"سأسجّل {STATUS_AR[a['status']]} للطالب {_name(p, a)}"),
    Tool("record_recitation_eval", "تسجيل تقييم تسميع (تقدير وصفحة)",
         _obj({"student_query": _SQ,
               "grade": {"type": "string", "description": "اسم التقدير مثل: ممتاز، جيد جداً، مقبول، إعادة"},
               "page_number": {"type": "integer", "minimum": 1, "maximum": 604},
               "behavior_score": {"type": "integer", "minimum": 0, "maximum": 10},
               "notes": {"type": "string"}},
              ["student_query", "grade"]),
         _BOTH, True, record_recitation_eval,
         lambda p, a: "سأسجّل تقييم تسميع بتقدير {}{} للطالب {}".format(
             a["grade"], f" للصفحة {a['page_number']}" if a.get("page_number") else "", _name(p, a))),
    Tool("points_bonus", "منح نقطة مكافأة سلوكية لطالب (+1)",
         _obj({"student_query": _SQ, "reason": {"type": "string", "description": "سبب المكافأة"}},
              ["student_query", "reason"]),
         _BOTH, True, points_bonus,
         lambda p, a: f"سأمنح نقطة مكافأة للطالب {_name(p, a)} بسبب {a['reason']}"),
    Tool("pending_requests", "طلبات التسجيل المعلقة", _obj({}, []), _MGR, False, pending_requests),
    Tool("halaqa_overview", "نظرة عامة على الحلقات", _obj({}, []), _MGR, False, halaqa_overview),
    Tool("approve_registration", "اعتماد طلب تسجيل طالب",
         _obj({"request_id": {"type": "string"}}, ["request_id"]),
         _MGR, True, approve_registration,
         lambda p, a: f"سأعتمد طلب التسجيل رقم {a['request_id']}"),
]}

CLARIFY_SPEC = {"type": "function", "function": {
    "name": "ask_clarification",
    "description": "استخدمها عند عدم فهم جزء من الطلب بدل التخمين",
    "parameters": _obj({"unclear_part": {"type": "string"}, "question_ar": {"type": "string"}},
                       ["unclear_part", "question_ar"])}}


def specs_for(role: str) -> list:
    out = [{"type": "function", "function": {"name": t.name, "description": t.description,
                                              "parameters": t.parameters}}
           for t in TOOLS.values() if role in t.roles]
    return out + [CLARIFY_SPEC]
