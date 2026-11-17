"""
الأمان والخصوصية:
1. مصادقة مفتاح الخدمة (Bearer) بمقارنة آمنة زمنياً (hmac.compare_digest).
2. إخفاء/حذف المعرّفات الشخصية (PII Redaction) قبل الإرسال للنموذج.
3. كشف وعزل محاولات Prompt Injection.
4. تعقيم المخرجات (Output Sanitization) ضد XSS ووسوم التفكير الداخلي <think>.
"""
import hmac
import html
import json
import re
from dataclasses import dataclass
from typing import Any

from fastapi import Header, HTTPException

from .config import get_settings

# أنماط البيانات الشخصية الحساسة (هواتف، هويات وطنية، بريد إلكتروني)
_PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s-]?)?(?:0?\d{9,11})\b")
_NATIONAL_ID_RE = re.compile(r"\b\d{10,14}\b")
_EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")

# مفاتيح القواميس التي لا يجوز إرسالها للنموذج إطلاقاً
SENSITIVE_KEYS = {
    "national_id",
    "phone",
    "father_phone",
    "mother_phone",
    "parent_phone",
    "current_residence",
    "address",
    "monthly_income",
    "income_level",
    "orphan_status",
    "is_orphan",
    "special_needs_notes",
    "registration_number",
    "password",
    "token",
    "access_token",
}

# أنماط شائعة لـ Prompt Injection بالعربية والإنجليزية
_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions", re.IGNORECASE),
    re.compile(r"system\s*prompt", re.IGNORECASE),
    re.compile(r"</?\s*(system|context|evaluation_data|metrics_summary)\s*>", re.IGNORECASE),
    re.compile(r"تجاهل\s+(كل\s+|جميع\s+)?التعليمات\s+السابقة"),
    re.compile(r"اكشف\s+(تعليمات\s+)?النظام"),
    re.compile(r"انسَ\s+(كل\s+)?ما\s+سبق"),
]

# أنماط إضافية خاصة بقيم نتائج الأدوات (بيانات غير موثوقة): تعليمات موجّهة للنموذج.
# مقيّدة بعبارات صريحة كي لا تُحجب أسماء سليمة تحوي كلمة «تجاهل» في سياق عادي.
_TOOL_INJECTION_PATTERNS = _INJECTION_PATTERNS + [
    re.compile(r"تجاهل\s+(?:كل\s+|جميع\s+)?(?:ال)?(?:تعليمات|أوامر|اوامر|قواعد)"),
    re.compile(r"(?:أخبر|اخبر|قل\s+ل)\s*(?:ـ)?\s*(?:ال)?مستخدم"),
    re.compile(r"(?:ignore|disregard|forget)\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\b", re.IGNORECASE),
    re.compile(r"(?:tell|inform)\s+the\s+user", re.IGNORECASE),
]
BLOCKED_CONTENT = "[محتوى محجوب]"

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_SCRIPT_OR_TAG_RE = re.compile(r"<\s*/?\s*(script|iframe|object|embed|style|link|meta|svg|on\w+)[^>]*>", re.IGNORECASE)
_ANY_HTML_TAG_RE = re.compile(r"<[^>]+>")

# أنماط الكلمات السرية والتوكنات لحماية المخرجات
_SECRET_PATTERNS = [
    re.compile(r"(?i)\b(password|passwd|pwd|token|api[_-]?key|secret)\s*(?:is|هي)?\s*[:=]?\s*\S+"),
    re.compile(r"(?i)\b(bearer\s+[a-zA-Z0-9_\-\.]{15,})"),
    re.compile(r"كلمة\s*(?:المرور|السر)(?:\s+هي)?\s*[:=]?\s*\S+"),
    re.compile(r"(?i)\b(eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{2,}\.[a-zA-Z0-9_-]+)\b"),
]


@dataclass
class ServiceCaller:
    user_id: str
    role: str
    tenant_id: str


def verify_service_key(
    authorization: str = Header(default=""),
    x_user_id: str = Header(default="anonymous"),
    x_user_role: str = Header(default="STUDENT"),
    x_tenant_id: str = Header(default="default"),
) -> ServiceCaller:
    """مصادقة بمفتاح خدمة (Bearer) يُقرأ من متغير بيئة، مع مقارنة آمنة زمنياً."""
    settings = get_settings()
    expected = settings.service_key.strip()
    if not expected:
        raise HTTPException(status_code=503, detail="Service key is not configured on orchestrator")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer service token")

    provided = authorization[7:].strip()
    if not provided or not hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid service token")

    role_norm = (x_user_role or "STUDENT").upper().strip()
    return ServiceCaller(
        user_id=(x_user_id or "anonymous").strip()[:64],
        role=role_norm,
        tenant_id=(x_tenant_id or "default").strip()[:64],
    )


def redact_pii_text(text: str) -> str:
    """إخفاء أرقام الهواتف والهويات الوطنية والبريد الإلكتروني من النصوص."""
    if not text:
        return ""
    cleaned = _EMAIL_RE.sub("[بريد_محجوب]", text)
    cleaned = _NATIONAL_ID_RE.sub("[هوية_محجوبة]", cleaned)
    cleaned = _PHONE_RE.sub("[هاتف_محجوب]", cleaned)
    return cleaned


def scrub_sensitive_dict(data: Any) -> Any:
    """حذف الحقول الحساسة من القواميس والقوائم قبل تمريرها للنموذج."""
    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            if str(k).lower() in SENSITIVE_KEYS:
                continue
            out[k] = scrub_sensitive_dict(v)
        return out
    if isinstance(data, list):
        return [scrub_sensitive_dict(item) for item in data]
    if isinstance(data, str):
        return redact_pii_text(data)
    return data


def sanitize_user_input(text: str, max_chars: int = 4000) -> tuple[str, bool]:
    """
    يفصل مدخلات المستخدم، ويمنع إغلاق وسم <user_input>، ويكشف محاولات الـ Prompt Injection.
    يُرجع: (النص المنقّح، هل_تم_رصد_محاولة_حقن)
    """
    if not text:
        return "", False
    trimmed = text.strip()[:max_chars]
    # منع كسر وسم العزل
    trimmed = re.sub(r"</?\s*user_input\s*>", "", trimmed, flags=re.IGNORECASE)
    trimmed = redact_pii_text(trimmed)

    flagged = any(pattern.search(trimmed) for pattern in _INJECTION_PATTERNS)
    if flagged:
        for pattern in _INJECTION_PATTERNS:
            trimmed = pattern.sub("[تعليمة_مرفوضة]", trimmed)
    return trimmed, flagged


def filter_sensitive_tokens(text: str) -> str:
    """إخفاء أو حذف أي كلمة مرور أو توكن قد يتسرب في رد النموذج."""
    if not text:
        return ""
    cleaned = text
    for pattern in _SECRET_PATTERNS:
        cleaned = pattern.sub("[بيانات_محجوبة]", cleaned)
    return cleaned


def scrub_tool_text(value: str, max_chars: int = 200) -> tuple[str, bool]:
    """
    تعقيم قيمة نصية قادمة من أداة. عند رصد حقن تُقصّ القيمة عند أول موضع مطابق
    (يُبقى ما قبله إن كان سليماً) وإلا تُستبدل كلها بـ [محتوى محجوب].
    لا يبقى أي جزء من نص الحقن. يُرجع (النص، هل_رُصد_حقن).
    """
    text = redact_pii_text((value or "").strip()[:max_chars])
    text = re.sub(r"</?\s*(?:user_input|tool_result)\s*>", "", text, flags=re.IGNORECASE)
    starts = [m.start() for pat in _TOOL_INJECTION_PATTERNS if (m := pat.search(text))]
    flagged = bool(starts)
    if flagged:
        head = text[: min(starts)].strip().rstrip(".،,:;؛-–—!؟? \t\n")
        text = head if len(re.findall(r"\w", head)) >= 2 else BLOCKED_CONTENT
    return filter_sensitive_tokens(text), flagged


def scrub_tool_result_ex(result: Any) -> tuple[Any, bool]:
    """نسخة تُرجع أيضاً علم رصد الحقن (للسجل فقط، بدون أي نص)."""
    if isinstance(result, dict):
        out, flagged = {}, False
        for k, v in result.items():
            k_lower = str(k).lower()
            if k_lower in SENSITIVE_KEYS or "token" in k_lower or "password" in k_lower or "secret" in k_lower:
                continue
            if k_lower in {"notes", "comment", "raw_response", "extra_context", "description"}:
                if isinstance(v, str):
                    out[k], f = scrub_tool_text(v, max_chars=80)
                    flagged = flagged or f
                continue
            out[k], f = scrub_tool_result_ex(v)
            flagged = flagged or f
        return out, flagged
    if isinstance(result, list):
        items, flagged = [], False
        for item in result[:20]:
            c, f = scrub_tool_result_ex(item)
            items.append(c)
            flagged = flagged or f
        return items, flagged
    if isinstance(result, str):
        return scrub_tool_text(result, max_chars=200)
    return result, False


def scrub_tool_result(result: Any) -> Any:
    """
    تجهيز نتيجة الأداة للنموذج: إزالة الحقول الحساسة، تقليص الحقول الحرة،
    قصّ/حجب أي قيمة تحوي تعليمة حقن، وسقف 20 سجلاً.
    """
    return scrub_tool_result_ex(result)[0]


def wrap_tool_result_ex(result: Any) -> tuple[str, bool]:
    cleaned, flagged = scrub_tool_result_ex(result)
    return f"<tool_result>\n{json.dumps(cleaned, ensure_ascii=False)}\n</tool_result>", flagged


def wrap_tool_result(result: Any) -> str:
    """لف نتيجة الأداة بوسم <tool_result> بعد تعقيمها وإزالة الحقول الحرة."""
    return wrap_tool_result_ex(result)[0]


def sanitize_model_output(text: str) -> str:
    """
    تعقيم مخرجات النموذج قبل إرجاعها للتطبيق:
    - إزالة كتل <think>...</think> إن ظهرت
    - إزالة وسوم HTML/XSS الخطرة وتعقيم النص
    - حجب وتصفية كلمات المرور والتوكنات السرية
    """
    if not text:
        return ""
    cleaned = _THINK_BLOCK_RE.sub("", text).strip()
    cleaned = _SCRIPT_OR_TAG_RE.sub("", cleaned)
    cleaned = _ANY_HTML_TAG_RE.sub("", cleaned)
    cleaned = html.unescape(cleaned)
    cleaned = filter_sensitive_tokens(cleaned)
    # إعادة التأكد من عدم بقاء أي أقواس وسوم HTML قابلة للتنفيذ في المتصفح
    cleaned = cleaned.replace("<", "‹").replace(">", "›")
    return cleaned.strip()

