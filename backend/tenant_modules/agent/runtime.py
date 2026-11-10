# -*- coding: utf-8 -*-
"""وقت التشغيل لوكيل منارة: تطبيع + استخراج المتغيرات + مصنّفان محفوظان + صلاحيات من الكتالوج."""
import re, os, joblib
from .action_catalog import *

ROLE_AR = {"TENANT_ADMIN": "مدير المسجد", "CENTER_MANAGER": "مدير المركز", "TEACHER": "معلم", "STUDENT": "طالب"}
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "manara_agent.joblib")

# ---------- تطبيع ----------
def norm(s):
    s = re.sub(r"[ً-ْٰ]", "", s)
    s = re.sub("[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    s = s.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    s = re.sub(r"[.,؟?!،؛:]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# ---------- معاجم ----------
def lex(d):  # قيمة -> عبارات مطبّعة، مرتبة بالأطول أولاً
    pairs = [(norm(p), k) for k, ps in d.items() for p in ps]
    return sorted(pairs, key=lambda x: -len(x[0]))

LX_STATUS, LX_GRADE, LX_RTYPE = lex(ATTENDANCE), lex(GRADES), lex(RECITATION_TYPES)
NUMW = {1: "واحد", 2: "اثنين", 3: "ثلاثة", 4: "أربعة", 5: "خمسة", 6: "ستة", 7: "سبعة", 8: "ثمانية",
        9: "تسعة", 10: "عشرة", 15: "خمسة عشر", 20: "عشرين", 25: "خمسة وعشرين", 50: "خمسين"}
NUMW_N = sorted(((norm(w), n) for n, w in NUMW.items()), key=lambda x: -len(x[0]))
FIRST_N = {norm(x) for x in FIRST_NAMES}; LAST_N = {norm(x) for x in LAST_NAMES if x}
HALAQA_N = sorted(((norm(h), h) for h in HALAQA_NAMES), key=lambda x: -len(x[0]))
SURAH_N = sorted(((norm(n), (no, n, c)) for no, n, c in SURAHS), key=lambda x: -len(x[0]))
ITEM_N = {norm(i): i for i in REWARD_ITEMS}
ROLE_N = {norm(v): k for k, v in ROLE_AR.items()}


def find_phrase(t, lexicon):
    for p, k in lexicon:
        if re.search(r"(?<!\S)" + re.escape(p) + r"(?!\S)", t): return k, p
    return None, None


def numbers(t):
    """كل الأرقام في النص بترتيب ظهورها (أرقام أو كلمات)."""
    found, taken = [], []
    for m in re.finditer(r"\d+", t): found.append((m.start(), int(m.group()))); taken.append((m.start(), m.end()))
    for w, n in NUMW_N:  # الأطول أولاً، ولا تتداخل الأجزاء
        for m in re.finditer(r"(?<!\S)" + re.escape(w) + r"(?!\S)", t):
            if not any(a < m.end() and m.start() < b for a, b in taken):
                found.append((m.start(), n)); taken.append((m.start(), m.end()))
    return [n for _, n in sorted(found)]


def extract_student(t):
    w = t.split(); cands = [i for i, x in enumerate(w) if x in FIRST_N]
    if not cands: return None
    for i in cands:  # بعد كلمة "الطالب" لها الأولوية (تفادي «علي» = حرف جر)
        if i > 0 and w[i - 1] in ("الطالب", "الطالبه"): break
    else: i = cands[-1]
    name = [w[i]]
    if i + 1 < len(w) and w[i + 1] in LAST_N: name.append(w[i + 1])
    return " ".join(name)


def extract_slots(intent, text):
    t = norm(text); need = {s.rstrip("?") for s in INTENTS.get(intent, {}).get("slots", [])}
    sl = {}
    if "student" in need:
        n = extract_student(t)
        if n: sl["student"] = n
    if "halaqa" in need or intent == "open_halaqa_sessions":
        for p, h in HALAQA_N:
            if p in t: sl["halaqa"] = h; break
    if "status" in need:
        k, _ = find_phrase(t, LX_STATUS)
        if k: sl["status"] = k
    if "grade" in need:
        k, _ = find_phrase(t, LX_GRADE)
        if k: sl["grade"] = k
    if "recitation_type?" in INTENTS.get(intent, {}).get("slots", []):
        k, _ = find_phrase(t, LX_RTYPE)
        if k: sl["recitation_type"] = k
    if intent == "evaluate_recitation_range":
        for p, (no, nm, c) in SURAH_N:
            if p in t: sl.update(surah=nm, surah_no=no); t_rest = t.replace(p, " "); break
        else: t_rest = t
        ns = numbers(t_rest)
        if len(ns) >= 2: sl.update(ayah_from=ns[0], ayah_to=ns[1])
    elif "page?" in INTENTS.get(intent, {}).get("slots", []):
        ns = numbers(t)
        if ns: sl["page"] = ns[0]
    if "points" in need:
        ns = numbers(t)
        if ns: sl["points"] = ns[0]
    if "reward" in need:
        for p, i in ITEM_N.items():
            if p in t: sl["reward"] = i; break
    if "role" in need:
        for p, r in ROLE_N.items():
            if p in t: sl["role"] = r; break
    return sl


class Agent:
    def __init__(self, intent_clf, page_clf):
        self.intent_clf, self.page_clf = intent_clf, page_clf

    def predict(self, text, role):
        t = norm(text)
        scores = self.intent_clf.decision_function([t])[0]
        order = scores.argsort()[::-1]; cls = self.intent_clf.classes_
        intent, margin = cls[order[0]], float(scores[order[0]] - scores[order[1]])
        out = dict(intent=intent, slots={}, requires_confirmation=False, confidence=round(margin, 3))
        if intent == "navigate":
            page = self.page_clf.predict([t])[0]; roles = PAGES[page][0]
            out["slots"] = dict(page=page)
            if role in roles: out["action"] = dict(type="navigate", route=f"{ROLE_PREFIX[role]}/{page}")
            else: return self._deny(out, intent=("permission_denied"), slots=dict(page=page), role=role, page=page)
            return out
        if intent == "clarify":
            out["action"] = dict(type="reply", message="هل توضّح طلبك أكثر؟"); return out
        if intent == "out_of_scope":
            out["action"] = dict(type="reply", message="أنا مساعد منارة وأنفّذ أوامر المنصة فقط."); return out
        spec = INTENTS[intent]
        if role not in spec["roles"]:
            return self._deny(out, intent="permission_denied", slots=dict(blocked_intent=intent), role=role)
        out["slots"] = extract_slots(intent, text)
        out["action"] = dict(spec["action"])
        if "route" in out["action"]: out["action"]["route"] = out["action"]["route"].replace("{prefix}", ROLE_PREFIX[role])
        out["requires_confirmation"] = spec["confirm"]
        return out

    @staticmethod
    def _deny(out, intent, slots, role, page=None):
        msg = (f"عذراً، صفحة «{PAGES[page][1][0]}» غير متاحة لصلاحياتك كـ{ROLE_AR[role]}." if page
               else "عذراً، هذا الأمر غير متاح لصلاحياتك.")
        out.update(intent=intent, slots=slots, action=dict(type="reply", message=msg), requires_confirmation=False)
        return out



_agent = None
def get_agent():
    global _agent
    if _agent is None:
        d = joblib.load(MODEL_PATH)
        _agent = Agent(d["intent_clf"], d["page_clf"])
    return _agent
