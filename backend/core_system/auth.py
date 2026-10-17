"""ديكوريتر موحّد لحماية واجهات المساجد: يعتمد على request.profile الذي يجهّزه TenantJWTAuthMiddleware."""
from functools import wraps

from django.http import JsonResponse

STAFF_ROLES = ('TENANT_ADMIN', 'CENTER_MANAGER', 'TEACHER')


def tenant_auth(roles=None):
    """يتطلب مستخدم مسجد موثَّقاً داخل مسجد محدد، وبأحد الأدوار المسموحة إن حُدّدت."""
    allowed = set(roles) if roles else None

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            if request.method == 'OPTIONS':
                return view_func(request, *args, **kwargs)
            profile = getattr(request, 'profile', None)
            if profile is None:
                msg = getattr(request, 'auth_error', None) or 'التوثيق مطلوب'
                return JsonResponse({'status': 'error', 'message': msg}, status=401)
            if getattr(request, 'tenant', None) is None:
                return JsonResponse({'status': 'error', 'message': 'المسجد غير محدد'}, status=400)
            if not getattr(profile, 'is_active', True):
                return JsonResponse({'status': 'error', 'message': 'الحساب غير نشط'}, status=403)
            if allowed is not None and not (set(profile.get_roles()) & allowed):
                return JsonResponse({'status': 'error', 'message': 'لا تملك صلاحية لهذا الإجراء'}, status=403)
            return view_func(request, *args, **kwargs)
        return _wrapped
    return decorator


def get_tenant_db_and_obj(request):
    """قاعدة المسجد وكائنه كما حدّدهما TenantJWTAuthMiddleware. لا رجوع إلى القاعدة المركزية."""
    tenant = getattr(request, 'tenant', None)
    if tenant is None:
        raise ValueError('المسجد غير محدد في الطلب')
    return tenant.db_name, tenant


def get_tenant_db(request):
    return get_tenant_db_and_obj(request)[0]
