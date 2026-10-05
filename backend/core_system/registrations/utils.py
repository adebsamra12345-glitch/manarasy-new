"""
دوال نقية (بلا اعتماد على Django) — سهلة الاختبار وقابلة لإعادة الاستخدام.
"""
import hashlib
import hmac
import os
import re
import secrets
import unicodedata

# ---------------------------------------------------------------- subdomain / db name
SUBDOMAIN_RE = re.compile(r'^[a-z][a-z0-9-]{1,28}[a-z0-9]$')          # 3..30 حرفاً، لا تبدأ برقم ولا تنتهي بشرطة
DB_NAME_RE = re.compile(r'^db_[a-z0-9_]{3,56}$')
RESERVED_SUBDOMAINS = frozenset({
    'www', 'api', 'app', 'admin', 'administrator', 'platform', 'super', 'root', 'mail', 'smtp', 'imap', 'ftp',
    'static', 'media', 'assets', 'cdn', 'dev', 'test', 'staging', 'demo', 'manarasy', 'manara', 'support',
    'help', 'status', 'billing', 'login', 'register', 'public', 'localhost', 'postgres', 'template0', 'template1',
})


def normalize_subdomain(value: str) -> str:
    return (value or '').strip().lower()


def is_valid_subdomain(value: str) -> bool:
    return bool(SUBDOMAIN_RE.match(value)) and '--' not in value and value not in RESERVED_SUBDOMAINS


def derive_db_name(subdomain: str) -> str:
    """اسم قاعدة المسجد يُشتق من الـ subdomain على الخادم فقط — لا يُقبل من العميل أبداً."""
    name = 'db_' + subdomain.replace('-', '_')
    if not DB_NAME_RE.match(name):
        raise ValueError('invalid database name')
    return name


# ---------------------------------------------------------------- upload tokens
def new_upload_token() -> tuple[str, str]:
    """(token للمستخدم لمرة واحدة, sha256 للتخزين)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def token_matches(raw: str, stored_hash: str) -> bool:
    if not raw or not stored_hash:
        return False
    return hmac.compare_digest(hash_token(raw), stored_hash)


# ---------------------------------------------------------------- file sniffing
ALLOWED_RECEIPT_TYPES = {
    # ext: (mime, extensions-aliases)
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
}
_EXT_ALIASES = {'jpeg': 'jpg', 'jpe': 'jpg'}

# عناصر PDF النشطة التي لا مكان لها في إيصال دفع (فحص تقريبي، يُكمَّل بعرض PDF داخل iframe sandbox)
_PDF_ACTIVE_MARKERS = (b'/JavaScript', b'/JS ', b'/JS\n', b'/JS\r', b'/JS(', b'/Launch', b'/EmbeddedFile')


def sniff_receipt_type(head: bytes) -> str | None:
    """يحدد نوع الملف من أول بايتات الملف (وليس من الامتداد ولا من Content-Type الذي يرسله العميل)."""
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if head.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if len(head) >= 12 and head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp'
    if b'%PDF-' in head[:1024]:
        return 'pdf'
    return None


def normalize_ext(filename: str) -> str:
    ext = os.path.splitext(filename or '')[1].lower().lstrip('.')
    return _EXT_ALIASES.get(ext, ext)


def pdf_has_active_content(data: bytes) -> bool:
    return any(marker in data for marker in _PDF_ACTIVE_MARKERS)


def sanitize_display_name(name: str, max_len: int = 120) -> str:
    """اسم للعرض فقط (لا يُستخدم أبداً كمسار على القرص)."""
    name = os.path.basename((name or '').replace('\\', '/'))
    name = unicodedata.normalize('NFKC', name)
    name = ''.join(ch for ch in name if ch.isprintable() and ch not in '<>:"|?*')
    name = name.strip(' .')
    return (name or 'receipt')[:max_len]


def generate_password(length: int = 14) -> str:
    alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        pw = ''.join(secrets.choice(alphabet) for _ in range(length))
        if any(c.islower() for c in pw) and any(c.isupper() for c in pw) and any(c.isdigit() for c in pw):
            return pw
