"""
جلسة المسجد: Refresh Token في كوكي HttpOnly + تجديد التوكن + تسجيل الخروج.

التصميم:
- الـ access token يبقى قصيراً (JWT_ACCESS_TOKEN_LIFETIME_MINUTES) ويُرسَل في Authorization كما هو.
- الـ refresh token لا يراه JavaScript إطلاقاً: كوكي HttpOnly + Secure + SameSite=Strict،
  محصور بالمسار /api/tenants/ (يُرسَل فقط لـ refresh و logout).
- حماية CSRF: يشترط الطلب ترويسة X-Requested-With (غير بسيطة => preflight CORS => تُرفض أي أصول خارج القائمة).
- الصلاحيات والدور تُقرأ من قاعدة المسجد عند كل تجديد، فيتوقف التجديد فور تعطيل الحساب.
- لا يُصدَر refresh لجلسات الانتحال (impersonation).
"""
import uuid
from datetime import datetime, timedelta

import jwt
from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Tenant

REFRESH_COOKIE = 'manara_rt'
COOKIE_PATH = '/api/tenants/'
REVOKED_PREFIX = 'rt_revoked:'


def _secret():
    return getattr(settings, 'JWT_REFRESH_SECRET_KEY', None) or getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)


def _refresh_days():
    return int(getattr(settings, 'JWT_REFRESH_TOKEN_LIFETIME_DAYS', 7))


def make_refresh_token(tenant, user_id, username, sid=None):
    now = datetime.utcnow()
    payload = {
        'typ': 'refresh',
        'sid': sid or uuid.uuid4().hex,   # معرّف عائلة الجلسة: يبقى ثابتاً عبر التجديدات ويُبطَل عند الخروج
        'tenant_id': str(tenant.id),
        'user_id': str(user_id),
        'username': username,
        'iat': now,
        'exp': now + timedelta(days=_refresh_days()),
    }
    return jwt.encode(payload, _secret(), algorithm='HS256')


def set_refresh_cookie(response, token):
    response.set_cookie(
        REFRESH_COOKIE, token,
        max_age=_refresh_days() * 86400,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Strict',
        path=COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH, samesite='Strict')
    return response


def _decode_refresh(token):
    payload = jwt.decode(token, _secret(), algorithms=['HS256'])
    if payload.get('typ') != 'refresh':
        raise jwt.InvalidTokenError('not a refresh token')
    if cache.get(REVOKED_PREFIX + str(payload.get('sid'))):
        raise jwt.InvalidTokenError('revoked')
    return payload


def _ensure_tenant_db(tenant):
    db_name = tenant.db_name
    if db_name not in settings.DATABASES:
        cfg = settings.DATABASES['default'].copy()
        cfg.update({
            'NAME': db_name,
            'USER': tenant.db_user or cfg.get('USER'),
            'PASSWORD': tenant.db_password_hash or cfg.get('PASSWORD', ''),
            'HOST': tenant.db_host or 'localhost',
            'PORT': tenant.db_port or 5432,
        })
        settings.DATABASES[db_name] = cfg
    return db_name


def _err(message, status, clear=True):
    resp = JsonResponse({'status': 'error', 'message': message}, status=status)
    return clear_refresh_cookie(resp) if clear else resp


@csrf_exempt
def tenant_refresh_view(request):
    """POST: يقرأ كوكي الـ refresh ويُصدر access token جديداً (ويجدّد الكوكي)."""
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return _err('طلب غير صالح', 403, clear=False)

    raw = request.COOKIES.get(REFRESH_COOKIE)
    if not raw:
        return _err('لا توجد جلسة', 401, clear=False)
    try:
        rp = _decode_refresh(raw)
    except jwt.ExpiredSignatureError:
        return _err('انتهت الجلسة', 401)
    except jwt.InvalidTokenError:
        return _err('جلسة غير صالحة', 401)

    # توكن المسجد لا يجدَّد إلا لمسجده (إن حُدّد المسجد في الطلب)
    req_tenant = getattr(request, 'tenant', None)
    if req_tenant is not None and str(req_tenant.id) != str(rp.get('tenant_id')):
        return _err('جلسة غير صالحة', 401)

    tenant = Tenant.objects.filter(id=rp.get('tenant_id'), is_active=True).first()
    if tenant is None:
        return _err('المسجد غير نشط', 401)

    from django.contrib.auth import get_user_model
    from tenant_modules.users.models import UserProfile
    User = get_user_model()
    db_name = _ensure_tenant_db(tenant)

    user = None
    profile = None
    try:
        user = User.objects.using(db_name).get(id=rp['user_id'], is_active=True)
        profile = UserProfile.objects.using(db_name).select_related('center').get(user=user)
        if not profile.is_active:
            return _err('الحساب غير نشط', 403)
    except User.DoesNotExist:
        return _err('المستخدم غير موجود', 401)
    except UserProfile.DoesNotExist:
        profile = None  # حساب manager الأصلي قد لا يملك ملفاً شخصياً

    role = profile.role if profile else 'TENANT_ADMIN'
    roles = profile.get_roles() if profile else [role]
    center_id = str(profile.center.id) if profile and profile.center else None
    center_name = profile.center.name if profile and profile.center else None

    access_minutes = int(getattr(settings, 'JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 30))
    now = datetime.utcnow()
    access = jwt.encode({
        'tenant_id': str(tenant.id),
        'subdomain': tenant.subdomain,
        'username': user.username,
        'user_id': str(user.id),
        'role': role,
        'roles': roles,
        'center_id': center_id,
        'center_name': center_name,
        'exp': now + timedelta(minutes=access_minutes),
        'iat': now,
    }, getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY), algorithm='HS256')

    resp = JsonResponse({
        'status': 'success',
        'data': {
            'access_token': access,
            'token_type': 'Bearer',
            'expires_in_minutes': access_minutes,
            'user': {
                'id': str(user.id), 'username': user.username,
                'first_name': user.first_name, 'last_name': user.last_name,
                'role': role, 'roles': roles,
                'center_id': center_id, 'center_name': center_name,
            },
        },
    })
    # كوكي جديد (جلسة منزلقة) بنفس sid ليُبطَل كله عند الخروج
    return set_refresh_cookie(resp, make_refresh_token(tenant, user.id, user.username, sid=rp.get('sid')))


@csrf_exempt
def tenant_logout_view(request):
    """POST: يُبطل الـ refresh token الحالي ويمسح الكوكي."""
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)
    if request.headers.get('X-Requested-With') != 'XMLHttpRequest':
        return _err('طلب غير صالح', 403, clear=False)
    raw = request.COOKIES.get(REFRESH_COOKIE)
    if raw:
        try:
            p = jwt.decode(raw, _secret(), algorithms=['HS256'], options={'verify_exp': False})
            cache.set(REVOKED_PREFIX + str(p.get('sid')), 1, _refresh_days() * 86400)
        except jwt.InvalidTokenError:
            pass
    return clear_refresh_cookie(JsonResponse({'status': 'success'}))
