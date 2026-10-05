"""
مصادقة أدمن المنصة — منفصلة تماماً عن مصادقة المساجد (core_system.middleware.TenantJWTAuthMiddleware):

  | الخاصية        | توكن المسجد            | توكن أدمن المنصة                    |
  |----------------|-------------------------|--------------------------------------|
  | مفتاح التوقيع  | JWT_SECRET_KEY/SECRET_KEY | مفتاح مشتق/منفصل (PLATFORM_JWT_SECRET) |
  | aud / iss      | غير موجودة              | manara-platform / manara             |
  | scope          | غير موجود               | platform                             |
  | مصدر الهوية    | auth_user بقاعدة المسجد | جدول platform_admins بالقاعدة المركزية |

أي فشل في واحد من هذه الفحوص = 401.
"""
import hashlib
import hmac
import uuid
from datetime import timedelta
from functools import wraps

import jwt
from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission

from .models import PlatformAdmin

PLATFORM_AUDIENCE = 'manara-platform'
PLATFORM_ISSUER = 'manara'
PLATFORM_SCOPE = 'platform'
_ALGORITHM = 'HS256'


def _signing_key() -> str:
    key = getattr(settings, 'PLATFORM_JWT_SECRET', '') or ''
    if key:
        return key
    # اشتقاق مفتاح مستقل عن SECRET_KEY كي لا يتطابق مع مفتاح توقيع توكنات المساجد
    return hmac.new(settings.SECRET_KEY.encode(), b'manara-platform-jwt-v1', hashlib.sha256).hexdigest()


def issue_platform_token(admin: PlatformAdmin) -> dict:
    now = timezone.now()
    lifetime = int(getattr(settings, 'PLATFORM_JWT_LIFETIME_MINUTES', 120))
    exp = now + timedelta(minutes=lifetime)
    payload = {
        'sub': str(admin.pk),
        'scope': PLATFORM_SCOPE,
        'aud': PLATFORM_AUDIENCE,
        'iss': PLATFORM_ISSUER,
        'jti': uuid.uuid4().hex,
        'iat': int(now.timestamp()),
        'exp': int(exp.timestamp()),
        'tv': admin.token_version,
    }
    return {
        'access_token': jwt.encode(payload, _signing_key(), algorithm=_ALGORITHM),
        'token_type': 'Bearer',
        'expires_in': lifetime * 60,
    }


def decode_platform_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            _signing_key(),
            algorithms=[_ALGORITHM],
            audience=PLATFORM_AUDIENCE,
            issuer=PLATFORM_ISSUER,
            options={'require': ['exp', 'iat', 'sub', 'aud', 'iss', 'jti']},
        )
    except jwt.ExpiredSignatureError:
        raise AuthenticationFailed('انتهت صلاحية الجلسة، سجّل الدخول من جديد')
    except jwt.InvalidTokenError:
        raise AuthenticationFailed('رمز التوثيق غير صالح')
    if payload.get('scope') != PLATFORM_SCOPE:
        raise AuthenticationFailed('رمز التوثيق غير صالح')
    return payload


def _admin_from_payload(payload: dict) -> PlatformAdmin:
    try:
        admin = PlatformAdmin.objects.get(pk=payload['sub'], is_active=True)
    except (PlatformAdmin.DoesNotExist, ValueError, TypeError):
        raise AuthenticationFailed('رمز التوثيق غير صالح')
    if admin.token_version != payload.get('tv'):
        raise AuthenticationFailed('تم إبطال هذه الجلسة، سجّل الدخول من جديد')
    return admin


class PlatformJWTAuthentication(BaseAuthentication):
    """Bearer <platform-jwt> — يتجاهل أي مخطط توثيق آخر (يرجع None) ويرفض أي توكن غير صالح."""

    def authenticate(self, request):
        parts = get_authorization_header(request).split()
        if not parts or parts[0].lower() != b'bearer':
            return None
        if len(parts) != 2:
            raise AuthenticationFailed('ترويسة التوثيق غير صالحة')
        try:
            token = parts[1].decode('ascii')
        except UnicodeError:
            raise AuthenticationFailed('رمز التوثيق غير صالح')
        payload = decode_platform_token(token)
        return _admin_from_payload(payload), payload

    def authenticate_header(self, request):
        return 'Bearer realm="manara-platform"'


class IsPlatformAdmin(BasePermission):
    message = 'هذه الواجهة مخصصة لأدمن المنصة فقط'

    def has_permission(self, request, view):
        user = request.user
        return isinstance(user, PlatformAdmin) and user.is_active


def platform_admin_required(view_func):
    """
    ديكوريتر للـ Django views القديمة (غير DRF) لحصرها بأدمن المنصة.
    يوضع **تحت** @csrf_exempt:

        @csrf_exempt
        @platform_admin_required
        def my_view(request): ...
    """
    @wraps(view_func)
    def _wrapped(request, *args, **kwargs):
        if request.method == 'OPTIONS':          # CORS preflight
            return view_func(request, *args, **kwargs)
        header = request.META.get('HTTP_AUTHORIZATION', '').split()
        if len(header) != 2 or header[0].lower() != 'bearer':
            return JsonResponse({'status': 'error', 'message': 'التوثيق مطلوب'}, status=401)
        try:
            payload = decode_platform_token(header[1])
            admin = _admin_from_payload(payload)
        except AuthenticationFailed as exc:
            return JsonResponse({'status': 'error', 'message': str(exc.detail)}, status=401)
        request.platform_admin = admin
        return view_func(request, *args, **kwargs)
    return _wrapped
