import os
import traceback
import uuid

import jwt
from django.conf import settings
from django.core.files.storage import default_storage
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Tenant

ALLOWED_LOGO_TYPES = {
    # امتداد الملف -> (نوع MIME المقبول، بداية محتوى الملف الصحيحة)
    '.png': ('image/png', (b'\x89PNG\r\n\x1a\n',)),
    '.jpg': ('image/jpeg', (b'\xff\xd8\xff',)),
    '.jpeg': ('image/jpeg', (b'\xff\xd8\xff',)),
    '.webp': ('image/webp', (b'RIFF',)),
}
MAX_NAME_LENGTH = 150


def _error(message, status):
    return JsonResponse({"status": "error", "message": message}, status=status)


def _logo_url(request, tenant):
    if not tenant.logo:
        return None
    return request.build_absolute_uri(tenant.logo.url)


def _get_admin_tenant(request):
    """
    يتحقق من توكن JWT ويُرجع (tenant, None) إن كان المستخدم مدير المسجد،
    وإلا (None, JsonResponse) برسالة الخطأ المناسبة.
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None, _error("يجب تسجيل الدخول أولاً", 401)
    token = auth_header.split(' ', 1)[1]
    try:
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None, _error("انتهت صلاحية الجلسة أو أن الرمز غير صالح", 401)

    if str(payload.get('role', '')).lower() != 'tenant_admin':
        return None, _error("هذه الصفحة متاحة لمدير المسجد فقط", 403)

    tenant = Tenant.objects.filter(id=payload.get('tenant_id'), is_active=True).first()
    if not tenant:
        return None, _error("المسجد غير موجود أو أن حسابه غير نشط", 404)
    return tenant, None


def _validate_logo(file):
    ext = os.path.splitext(file.name or '')[1].lower()
    if ext not in ALLOWED_LOGO_TYPES:
        return "نوع الملف غير مدعوم. الأنواع المسموحة: PNG, JPG, WEBP"
    mime, signatures = ALLOWED_LOGO_TYPES[ext]
    if (file.content_type or '').lower() != mime:
        return "نوع الملف غير مدعوم. الأنواع المسموحة: PNG, JPG, WEBP"
    max_bytes = getattr(settings, 'TENANT_LOGO_MAX_BYTES', 2 * 1024 * 1024)
    if file.size > max_bytes:
        return f"حجم الشعار يجب ألا يتجاوز {max_bytes // (1024 * 1024)} ميجابايت"
    head = file.read(12)
    file.seek(0)
    if not head.startswith(signatures) or (ext == '.webp' and head[8:12] != b'WEBP'):
        return "محتوى الملف لا يطابق نوع الصورة"
    return None


def _settings_payload(request, tenant):
    return {
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "logo_url": _logo_url(request, tenant),
    }


@csrf_exempt
def tenant_settings_view(request):
    """
    GET  : إعدادات المسجد الحالية (اسم، نطاق فرعي، شعار)
    POST : تعديل الاسم و/أو رفع شعار جديد (multipart/form-data)
           الحقول: name (اختياري)، logo (ملف اختياري)، remove_logo ("true" لحذف الشعار)
    النطاق الفرعي للقراءة فقط ولا يمكن تعديله عبر هذا الـ API.
    """
    if request.method == 'OPTIONS':
        return JsonResponse({}, status=200)
    if request.method not in ('GET', 'POST'):
        return _error("Method not allowed", 405)

    try:
        tenant, err = _get_admin_tenant(request)
        if err:
            return err

        if request.method == 'GET':
            return JsonResponse({"status": "success", "data": _settings_payload(request, tenant)})

        name = request.POST.get('name')
        logo = request.FILES.get('logo')
        remove_logo = request.POST.get('remove_logo', '').lower() == 'true'

        if name is not None:
            name = name.strip()
            if not name:
                return _error("اسم المسجد مطلوب", 400)
            if len(name) > MAX_NAME_LENGTH:
                return _error(f"اسم المسجد يجب ألا يتجاوز {MAX_NAME_LENGTH} حرفاً", 400)

        if logo:
            logo_error = _validate_logo(logo)
            if logo_error:
                return _error(logo_error, 400)

        old_logo = tenant.logo.name if tenant.logo else None

        if name is not None:
            tenant.name = name
        if logo:
            ext = os.path.splitext(logo.name)[1].lower()
            logo.name = f"{tenant.id}_{uuid.uuid4().hex[:8]}{ext}"
            tenant.logo = logo
        elif remove_logo:
            tenant.logo = None
        tenant.save()

        # حذف الملف القديم بعد نجاح الحفظ عند الاستبدال أو الحذف
        if old_logo and (logo or remove_logo):
            default_storage.delete(old_logo)

        return JsonResponse({
            "status": "success",
            "message": "تم حفظ إعدادات المسجد بنجاح",
            "data": _settings_payload(request, tenant),
        })
    except Exception as e:
        print(f"[ERROR] Tenant settings failed: {str(e)}")
        print(traceback.format_exc())
        return _error("حدث خطأ غير متوقع أثناء حفظ الإعدادات", 500)


@csrf_exempt
def tenant_branding_view(request):
    """
    API عام (بدون مصادقة) لبطاقة تسجيل الدخول: اسم المسجد وشعاره فقط.
    GET ?subdomain=alhuda
    """
    if request.method == 'OPTIONS':
        return JsonResponse({}, status=200)
    if request.method != 'GET':
        return _error("Method not allowed", 405)

    subdomain = (request.GET.get('subdomain') or '').strip().lower()
    tenant = Tenant.objects.filter(subdomain=subdomain, is_active=True).first() if subdomain else None
    if not tenant:
        return _error("المسجد غير موجود", 404)
    return JsonResponse({
        "status": "success",
        "data": {"name": tenant.name, "logo_url": _logo_url(request, tenant)},
    })
