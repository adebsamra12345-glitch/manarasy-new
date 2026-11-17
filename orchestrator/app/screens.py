"""سجل شاشات المنصة + موجّه حتمي (Deterministic Router) لأوامر التنقل والنوافذ وتسجيل الخروج.

المصدر الوحيد لحقيقة الشاشات لكل دور (مستخلص من frontend/src/App.jsx والأشرطة الجانبية).
يعمل قبل النموذج: أوامر الواجهة تُحل بمطابقة عربية مرنة بلا GPU، وما لا يُفهم يمرّر للنموذج (يرجع None).

الناتج: dict بالمفاتيح answer و ui_actions (قائمة إجراءات تنفذها الواجهة من قائمة بيضاء).
أنواع الإجراءات: navigate, open_modal, choices, confirm_ui, reply, send_message.
"""
import re
import time
from dataclasses import dataclass, field

from .agent_backend import BackendError, Principal, get_backend
from .agent_tools import NeedClarification, resolve_halaqa, resolve_student
from .arabic import normalize, parse_confirmation

ROLE_PREFIX = {
    "TENANT_ADMIN": "/admin",
    "CENTER_MANAGER": "/center-manager",
    "TEACHER": "/teacher",
}


@dataclass(frozen=True)
class Screen:
    id: str
    label: str
    path: str  # بلا بادئة الدور
    roles: frozenset
    synonyms: tuple = field(default_factory=tuple)


_T, _C, _A = "TEACHER", "CENTER_MANAGER", "TENANT_ADMIN"
_ALL = frozenset({_T, _C, _A})
_MGR = frozenset({_C, _A})

SCREENS: tuple[Screen, ...] = (
    Screen("dashboard", "لوحة التحكم", "dashboard", _ALL,
           ("لوحة التحكم", "لوحه التحكم", "الرئيسية", "الصفحة الرئيسية", "الداشبورد", "الرئيسيه")),
    Screen("rings", "الحلقات", "rings", _ALL, ("الحلقات", "حلقاتي", "قائمة الحلقات")),
    Screen("students", "الطلاب", "students", _ALL, ("الطلاب", "طلابي", "قائمة الطلاب")),
    Screen("sessions", "الجلسات", "sessions", _ALL, ("الجلسات", "جلسات")),
    Screen("profile", "الملف الشخصي", "profile", _ALL, ("الملف الشخصي", "ملفي الشخصي", "ملفي", "حسابي", "بروفايل")),
    Screen("attendance", "الحضور", "attendance", frozenset({_T}), ("الحضور", "تحضير", "الحضور اليومي")),
    Screen("recitation", "التسميع", "recitation", frozenset({_T}), ("التسميع", "تقييم التسميع")),
    Screen("progress", "متابعة التقدم", "progress", frozenset({_T}), ("متابعة التقدم", "التقدم")),
    Screen("teachers", "المعلمون", "teachers", _MGR, ("المعلمين", "المعلمون", "معلمين", "تعيين المعلمين")),
    Screen("rewards", "النقاط والمكافآت", "rewards", _MGR, ("النقاط", "المكافآت", "المكافات", "نقاط")),
    Screen("reports", "التقارير", "reports", _MGR, ("التقارير", "تقارير")),
    Screen("users", "المستخدمون", "users", frozenset({_A}), ("المستخدمين", "المستخدمون", "ادارة المستخدمين")),
    Screen("projects", "المراكز والمشاريع", "projects", frozenset({_A}), ("المشاريع", "المشروعات")),
    Screen("centers", "المراكز", "centers", frozenset({_A}), ("المراكز",)),
    Screen("settings", "الإعدادات", "settings", frozenset({_A}), ("الاعدادات", "الإعدادات", "اعدادات")),
)

_NAV_VERBS = {"افتح", "انقلني", "انقل", "خذني", "اذهب", "روح", "وديني", "ودني", "توجه", "انتقل",
              "اريد", "ابي", "بدي", "ادخل", "رجعني", "افتحلي"}
_QUESTION_WORDS = {"كم", "ماذا", "هل", "كيف", "لماذا", "متى", "من", "ما", "اين", "وين"}
_MARKERS = {"تبويب", "صفحه", "شاشه", "واجهه", "قسم", "قائمه"}
_FILLER = {"لي", "الي", "الى", "إلى", "على", "ال", "من", "فضلك", "لو", "سمحت", "ممكن", "الان", "اريد", "ان", "انت", "ي"}


def _strip_al(w: str) -> str:
    return w[2:] if w.startswith("ال") and len(w) > 4 else w


def _tokens(text: str) -> list[str]:
    return [_strip_al(w) for w in normalize(text).split()]


def _contains_seq(tokens: list[str], phrase: list[str]) -> bool:
    n = len(phrase)
    return n > 0 and any(tokens[i:i + n] == phrase for i in range(len(tokens) - n + 1))


def screens_for(role: str) -> list[Screen]:
    return [s for s in SCREENS if role in s.roles]


def route_for(role: str, screen: Screen) -> str:
    return f"{ROLE_PREFIX[role]}/{screen.path}"


def match_screen(tokens: list[str]) -> Screen | None:
    """أطول مرادف مطابق عبر كل الشاشات (بغض النظر عن الدور)؛ التحقق من الدور لاحقاً."""
    best, best_len = None, 0
    for s in SCREENS:
        for syn in s.synonyms:
            ph = _tokens(syn)
            if _contains_seq(tokens, ph) and len(ph) > best_len:
                best, best_len = s, len(ph)
    return best


# ─── حالة معلّقة بسيطة لإكمال معامل ناقص (تُنقل إلى Redis في P2) ───────────────
_SLOT_TTL = 300
_slots: dict[str, dict] = {}


def reset_slots() -> None:
    _slots.clear()


def _slot_get(key: str) -> dict | None:
    now = time.time()
    for k in [k for k, v in _slots.items() if v["exp"] < now]:
        _slots.pop(k, None)
    return _slots.get(key)


def _slot_set(key: str, intent: str, awaiting: str) -> None:
    _slots[key] = {"intent": intent, "awaiting": awaiting, "exp": time.time() + _SLOT_TTL}


# ─── أدوات بناء الإجراءات ────────────────────────────────────────────────────
def _nav(route: str) -> dict:
    return {"type": "navigate", "route": route}


def _out(answer: str, actions: list[dict] | None = None) -> dict:
    return {"answer": answer, "ui_actions": actions or []}


def _choices(question: str, options: list[dict]) -> dict:
    return _out(question, [{"type": "choices", "options": options}])


_GENERIC_HALAQA_WORDS = {"طلاب", "الطلاب", "حلقه", "حلقات", "جلسه", "جلسات"}


def _halaqa_choices(p: Principal, intent: str, session_key: str, question: str) -> dict:
    halaqat = get_backend().halaqat(p)
    if not halaqat:
        return _out("لا توجد حلقات متاحة ضمن نطاقك.")
    _slot_set(session_key, intent, "halaqa")
    opts = [{"label": h["name"], "action": {"type": "send_message", "text": h["name"]}} for h in halaqat[:8]]
    return _choices(question, opts)


def _halaqa_action(role: str, intent: str, h: dict) -> dict:
    base = f"{ROLE_PREFIX[role]}/rings/{h['id']}/sessions"
    if intent == "start_session":
        return _out(
            f"سأبدأ جلسة تسميع جديدة في «{h['name']}»، هل تؤكد؟",
            [{"type": "confirm_ui", "text": f"بدء جلسة تسميع جديدة في «{h['name']}»؟",
              "on_confirm": [_nav(base + "?new=1")]}],
        )
    return _out(f"فتحت لك جلسات «{h['name']}» السابقة.", [_nav(base)])


def _student_action(role: str, s: dict) -> dict:
    return _out(f"فتحت لك معلومات الطالب {s['full_name']}.", [_nav(f"{ROLE_PREFIX[role]}/students/{s['id']}/activity")])


def _resolve_or_ask(fn, p, query, *, intent, awaiting, session_key):
    """يحل الاسم؛ عند الغموض يرجع رداً (سؤال/خيارات) بدل تخمين."""
    try:
        return fn(p, query), None
    except NeedClarification as e:
        _slot_set(session_key, intent, awaiting)
        if e.options:
            opts = [{"label": o, "action": {"type": "send_message", "text": o}} for o in e.options]
            return None, _choices(e.question_ar, opts)
        return None, _out(e.question_ar)
    except BackendError as e:
        return None, _out("المنصة غير متاحة حالياً، حاول بعد قليل." if e.status >= 500 else f"رفضت المنصة الطلب: {e.message}")


# ─── كشف النوايا ─────────────────────────────────────────────────────────────
_RE_LOGOUT = re.compile(r"(تسجيل الخروج|سجل خروجي|سجلني خروج|سجل خروج|اخرجني|خروج من الحساب|خروج|logout|sign out)")
_RE_PASSWORD = re.compile(r"(كلمه المرور|كلمه السر|الرقم السري|الباسورد|باسورد|password)")
_RE_PASSWORD_CHANGE = re.compile(r"(تغيير|غير|اغير|تعديل|عدل|تحديث|نسيت|ضاعت|استرجاع|استعاده|اعاده تعيين|ساعد|مساعده|نافذه)")
_RE_NEW_SESSION = re.compile(r"(جلسه (تسميع )?جديده|ابدا جلسه|ابدء جلسه|بدء جلسه|ابدا تسميع)")
_RE_PREV_SESSIONS = re.compile(r"(الجلسات السابقه|جلسات سابقه|جلسات الحلقه|سجل الجلسات|جلسات حلقه)")
_RE_STUDENT_INFO = re.compile(r"(معلومات|بيانات|ملف|نشاط|تفاصيل) (ال)?طالب")

PASSWORD_GUIDE = (
    "لتغيير كلمة المرور: افتح «الملف الشخصي» من الشريط الجانبي، ثم اضغط «تغيير كلمة المرور»، "
    "أدخل كلمة المرور الحالية ثم الجديدة وأكّدها واحفظ."
)


def _extract_after(text: str, markers: tuple[str, ...]) -> str:
    n = normalize(text)
    for m in markers:
        i = n.find(m)
        if i >= 0:
            return n[i + len(m):].strip()
    return ""


def _strip_leading(tokens: list[str], drop: set[str]) -> list[str]:
    return [t for t in tokens if t not in drop]


def route_message(p: Principal, role: str, message: str, session_key: str) -> dict | None:
    """يرجع dict (answer + ui_actions) أو None إن كانت الرسالة تحتاج النموذج."""
    if role not in ROLE_PREFIX:
        return None
    norm = normalize(message)
    tokens = _tokens(message)
    if not tokens:
        return None
    raw_words = set(norm.split())
    is_question = bool(raw_words & _QUESTION_WORDS) and not (raw_words & _NAV_VERBS)

    # 1) إكمال معامل ناقص من سؤال سابق (إن لم تكن الرسالة أمراً جديداً صريحاً)
    slot = _slot_get(session_key)
    explicit = bool(
        _RE_LOGOUT.search(norm) or _RE_PASSWORD.search(norm) or _RE_NEW_SESSION.search(norm)
        or _RE_PREV_SESSIONS.search(norm) or _RE_STUDENT_INFO.search(norm)
        or (raw_words & _NAV_VERBS and match_screen(tokens))
    )
    if slot and not explicit:
        if parse_confirmation(message) == "no" and len(tokens) <= 2:
            _slots.pop(session_key, None)
            return _out("حسناً، تم الإلغاء.")
        if slot["awaiting"] == "halaqa":
            h, err = _resolve_or_ask(resolve_halaqa, p, message, intent=slot["intent"], awaiting="halaqa", session_key=session_key)
            if err:
                return err
            _slots.pop(session_key, None)
            return _halaqa_action(role, slot["intent"], h)
        if slot["awaiting"] == "student":
            s, err = _resolve_or_ask(resolve_student, p, message, intent=slot["intent"], awaiting="student", session_key=session_key)
            if err:
                return err
            _slots.pop(session_key, None)
            return _student_action(role, s)

    # 2) تسجيل الخروج: دائماً بتأكيد
    if _RE_LOGOUT.search(norm) and len(tokens) <= 6:
        return _out("هل تريد تسجيل الخروج؟",
                    [{"type": "confirm_ui", "text": "هل تريد تسجيل الخروج من حسابك؟", "on_confirm": [{"type": "logout"}]}])

    # 3) كلمة المرور: توجيه نصي أو فتح النافذة
    if _RE_PASSWORD.search(norm) and _RE_PASSWORD_CHANGE.search(norm):
        return _choices(
            "هل تريد أن أرشدك بالخطوات أم أفتح لك نافذة تغيير كلمة المرور؟",
            [
                {"label": "أرشدني بالخطوات", "action": {"type": "reply", "text": PASSWORD_GUIDE}},
                {"label": "افتح النافذة", "action": {"type": "open_modal", "modal": "change_password"}},
            ],
        )

    # 4) جلسة جديدة / الجلسات السابقة (تحتاج حلقة)
    for rx, intent in ((_RE_NEW_SESSION, "start_session"), (_RE_PREV_SESSIONS, "previous_sessions")):
        if rx.search(norm):
            name = _extract_after(message, ("حلقه", "حلقة"))
            if name and normalize(name) not in _GENERIC_HALAQA_WORDS:
                h, err = _resolve_or_ask(resolve_halaqa, p, name, intent=intent, awaiting="halaqa", session_key=session_key)
                return err if err else _halaqa_action(role, intent, h)
            q = "في أي حلقة تريد بدء جلسة التسميع الجديدة؟" if intent == "start_session" else "جلسات أي حلقة تريد فتحها؟"
            return _halaqa_choices(p, intent, session_key, q)

    # 5) معلومات طالب
    if _RE_STUDENT_INFO.search(norm):
        name = _extract_after(message, ("الطالب", "طالب"))
        name = " ".join(w for w in name.split() if w not in _FILLER)
        if not name:
            _slot_set(session_key, "open_student", "student")
            return _out("ما اسم الطالب؟")
        s, err = _resolve_or_ask(resolve_student, p, name, intent="open_student", awaiting="student", session_key=session_key)
        return err if err else _student_action(role, s)

    # 6) تنقل إلى تبويب: يلزم فعل تنقل أو كلمة (تبويب/صفحة)، أو أمر قصير باسم الشاشة فقط
    if is_question:
        return None
    screen = match_screen(tokens)
    if not screen:
        return None
    content = _strip_leading(tokens, _FILLER | {_strip_al(v) for v in _NAV_VERBS} | {_strip_al(m) for m in _MARKERS})
    has_verb = bool(raw_words & _NAV_VERBS)
    has_marker = bool({_strip_al(m) for m in _MARKERS} & set(tokens))
    matched_len = max(len(_tokens(s)) for s in screen.synonyms if _contains_seq(tokens, _tokens(s)))
    extra = len(content) - matched_len
    if extra > 2:  # جملة طويلة (مثل «اعرض طلاب حلقة الفاتحة الغائبين») => للنموذج
        return None
    bare = extra == 0 and len(tokens) <= 4
    if not (has_verb or has_marker or bare):
        return None
    if role not in screen.roles:
        return _out(f"تبويب «{screen.label}» غير متاح في حسابك. يمكنني نقلك إلى لوحة التحكم أو إلى أحد التبويبات المتاحة.")
    return _out(f"فتحت لك تبويب «{screen.label}».", [_nav(route_for(role, screen))])
