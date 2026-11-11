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
