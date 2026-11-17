import re

_DIACRITICS = re.compile(r"[ً-ْـ]")
_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

# مفردات لهجية شائعة (سورية/قطرية) -> فصحى؛ تُطبَّق على كلمات كاملة
_DIALECT = {
    "هلق": "الان", "هلأ": "الان", "هلا": "الان", "الحين": "الان",
    "بدي": "اريد", "ابي": "اريد", "ابغى": "اريد", "ابغي": "اريد",
    "شو": "ماذا", "شنو": "ماذا", "ليش": "لماذا", "شلون": "كيف",
    "غايب": "غائب", "حطلي": "سجل", "سوي": "سجل", "سو": "سجل",
}

YES = {"نعم", "ايوه", "ايوا", "اي", "اجل", "تمام", "اكد", "اكيد", "موافق",
       "صح", "طيب", "ايه", "اه", "يلا", "ماشي", "اوكي", "حاضر", "نعم اكد"}
NO = {"لا", "كلا", "الغ", "الغي", "الغاء", "لا تسجل", "لا تؤكد", "مو", "مب",
      "وقف", "لا الغ", "لا الغي"}


def normalize(text: str) -> str:
    t = _DIACRITICS.sub("", text or "").translate(_AR_DIGITS)
    t = re.sub("[إأآٱ]", "ا", t)
    t = t.replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    t = re.sub(r"[^\w\s]", " ", t)
    words = [_DIALECT.get(w, w) for w in t.split()]
    return " ".join(words)


def _norm_set(words):
    return {normalize(w) for w in words}


_YES, _NO = _norm_set(YES), _norm_set(NO)


def parse_confirmation(utterance: str) -> str:
    """returns 'yes' | 'no' | 'unclear'. النفي يغلب دائماً (أمان)."""
    n = normalize(utterance)
    words = set(n.split())
    if n in _NO or words & {normalize(x) for x in ("لا", "كلا", "الغ", "الغي", "الغاء", "وقف")}:
        return "no"
    if n in _YES or words & _YES:
        return "yes"
    return "unclear"



# ─── العدد والمعدود ──────────────────────────────────────────────────────────
# (مفرد، مثنى مرفوع، مثنى منصوب/مجرور، جمع)
COUNTED_NOUNS = {
    "نقطة": ("نقطة", "نقطتان", "نقطتين", "نقاط"),
    "يوم": ("يوم", "يومان", "يومين", "أيام"),
    "صفحة": ("صفحة", "صفحتان", "صفحتين", "صفحات"),
    "طالب": ("طالب", "طالبان", "طالبين", "طلاب"),
    "حلقة": ("حلقة", "حلقتان", "حلقتين", "حلقات"),
    "تقييم": ("تقييم", "تقييمان", "تقييمين", "تقييمات"),
    "مرة": ("مرة", "مرتان", "مرتين", "مرات"),
}
_ONE = {"نقطة": "نقطة واحدة", "يوم": "يوم واحد", "صفحة": "صفحة واحدة", "طالب": "طالب واحد",
        "حلقة": "حلقة واحدة", "تقييم": "تقييم واحد", "مرة": "مرة واحدة"}


def ar_count(n: int, singular: str, dual: str, plural: str, tanween_singular: str | None = None,
             one: str | None = None, zero: str = "لا توجد") -> str:
    """
    العدد والمعدود: 0 => zero، 1 => المفرد (one أو singular)، 2 => المثنى،
    3-10 => الجمع (مع الرقم)، 11 فأكثر => المفرد المنصوب (tanween_singular أو singular).
    """
    n = int(n)
    if n == 0:
        return zero
    if n == 1:
        return one or singular
    if n == 2:
        return dual
    if 3 <= n <= 10:
        return f"{n} {plural}"
    return f"{n} {tanween_singular or singular}"


def count_phrase(n: int, noun: str) -> str:
    """مختصر لأحد المعدودات في COUNTED_NOUNS، مثل count_phrase(10, 'نقطة') => '10 نقاط'."""
    sing, dual, _dual_obl, plural = COUNTED_NOUNS[noun]
    return ar_count(n, sing, dual, plural, sing + "", one=_ONE[noun], zero=f"لا {plural}" if noun != "يوم" else "لا أيام")


_PREPS = {"في", "من", "على", "الى", "إلى", "عن", "بعد", "خلال", "مع", "قبل", "عند", "لدى", "بـ", "لـ"}
_ALL_FORMS = {}
for _n, (_s, _d, _do, _p) in COUNTED_NOUNS.items():
    for _f in (_n, _s, _p):
        _ALL_FORMS[_f] = _n
_FORMS_RE = "|".join(sorted(_ALL_FORMS, key=len, reverse=True))
# lookahead: يمنع فقط الحروف/الأرقام (فتسمح علامات الترقيم مثل ، . ؛ بعد المعدود)
_COUNT_RE = re.compile(r"(?<![\w/\-:.،,])([0-9٠-٩]{1,3})[ \t]+(" + _FORMS_RE + r")(?![ء-ي\w])")
# رقم يلي كلمة «صفحة/حلقة/رقم…» هو معرّف لا عدد: نتجنّب لمسه
_LABELS = {"صفحة", "الصفحة", "رقم", "حلقة", "الحلقة", "اليوم", "يوم", "الطالب", "طالب", "مرحلة", "جزء", "الجزء", "سورة", "السورة"}


def fix_arabic_counts(text: str) -> str:
    """
    معالجة لاحقة آمنة للرد النهائي: «<3..10> <معدود>» => الجمع، «2 <معدود>» => المثنى (يومان)،
    «1 <معدود>» => «طالب واحد». لا تلمس التواريخ (2026-11-15) ولا «صفحة 15»، ولا 11 فأكثر.
    """
    if not text:
        return text

    def _sub(m: re.Match) -> str:
        n = int(m.group(1).translate(_AR_DIGITS))
        noun = _ALL_FORMS[m.group(2)]
        before = text[: m.start()].split()
        prev = before[-1] if before else ""
        if prev in _LABELS:
            return m.group(0)
        sing, dual, dual_obl, plural = COUNTED_NOUNS[noun]
        if n == 1:
            return _ONE[noun]
        if n == 2:
            return dual_obl if prev in _PREPS else dual
        if 3 <= n <= 10:
            return f"{m.group(1)} {plural}"
        return m.group(0)

    return _COUNT_RE.sub(_sub, text)
