"""
الأمان والخصوصية:
1. مصادقة مفتاح الخدمة (Bearer) بمقارنة آمنة زمنياً (hmac.compare_digest).
2. إخفاء/حذف المعرّفات الشخصية (PII Redaction) قبل الإرسال للنموذج.
3. كشف وعزل محاولات Prompt Injection.
4. تعقيم المخرجات (Output Sanitization) ضد XSS ووسوم التفكير الداخلي <think>.
"""
import hmac
import html
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

_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_SCRIPT_OR_TAG_RE = re.compile(r"<\s*/?\s*(script|iframe|object|embed|style|link|meta|svg|on\w+)[^>]*>", re.IGNORECASE)
_ANY_HTML_TAG_RE = re.compile(r"<[^>]+>")


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


def sanitize_model_output(text: str) -> str:
    """
    تعقيم مخرجات النموذج قبل إرجاعها للتطبيق:
    - إزالة كتل <think>...</think> إن ظهرت
    - إزالة وسوم HTML/XSS الخطرة وتعقيم النص
    """
    if not text:
        return ""
    cleaned = _THINK_BLOCK_RE.sub("", text).strip()
    cleaned = _SCRIPT_OR_TAG_RE.sub("", cleaned)
    cleaned = _ANY_HTML_TAG_RE.sub("", cleaned)
    cleaned = html.unescape(cleaned)
    # إعادة التأكد من عدم بقاء أي أقواس وسوم HTML قابلة للتنفيذ في المتصفح
    cleaned = cleaned.replace("<", "‹").replace(">", "›")
    return cleaned.strip()

