"""
حماية الخصوصية والأمان في تطبيق Django قبل إرسال أي بيانات إلى الـ Orchestrator:
1. تجريد جميع المعرّفات الشخصية (PII: الهوية الوطنية، الهواتف، العناوين، الدخل، حالة اليتم).
2. تعقيم مخرجات النموذج ضد XSS قبل إرجاعها للواجهة الأمامية.
"""
import html
import re
from typing import Any

SENSITIVE_FIELDS = {
    'national_id',
    'phone',
    'father_phone',
    'mother_phone',
    'parent_phone',
    'current_residence',
    'address',
    'monthly_income',
    'income_level',
    'orphan_status',
    'is_orphan',
    'special_needs_notes',
    'registration_number',
    'password',
    'token',
    'access_token',
    'latitude',
    'longitude',
}

_PHONE_RE = re.compile(r'(?:\+?\d{1,3}[\s-]?)?(?:0?\d{9,11})\b')
_NATIONAL_ID_RE = re.compile(r'\b\d{10,14}\b')
_EMAIL_RE = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
_HTML_TAG_RE = re.compile(r'<[^>]+>')


def redact_pii_string(text: str) -> str:
    if not text:
        return ''
    cleaned = _EMAIL_RE.sub('[بريد_محجوب]', str(text))
    cleaned = _NATIONAL_ID_RE.sub('[هوية_محجوبة]', cleaned)
    cleaned = _PHONE_RE.sub('[هاتف_محجوب]', cleaned)
    return cleaned


def minimize_payload(data: Any) -> Any:
    """يحذف أي حقل حساس ويعيد الحد الأدنى فقط من البيانات غير الشخصية."""
    if isinstance(data, dict):
        return {
            k: minimize_payload(v)
            for k, v in data.items()
            if str(k).lower() not in SENSITIVE_FIELDS
        }
    if isinstance(data, list):
        return [minimize_payload(item) for item in data]
    if isinstance(data, str):
        return redact_pii_string(data)
    return data


def sanitize_output_for_ui(text: str) -> str:
    """تعقيم المخرجات قبل عرضها في الواجهة (حماية من XSS)."""
    if not text:
        return ''
    cleaned = _HTML_TAG_RE.sub('', str(text))
    cleaned = html.unescape(cleaned)
    cleaned = cleaned.replace('<', '‹').replace('>', '›')
    return cleaned.strip()

