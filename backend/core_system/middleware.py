import jwt
from django.conf import settings
from django.http import JsonResponse

class TenantJWTAuthMiddleware:
    """
    Middleware for resolving Tenant Database and JWT Authentication.
    Attaches `request.db_name` and `request.profile` to the request object.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # 1. Resolve Tenant DB
        tenant_id = request.headers.get('Tenant-ID')
        db_name = 'default'
        
        if tenant_id:
            try:
                from core_system.tenants.models import Tenant
                tenant = Tenant.objects.using('default').get(id=tenant_id)
                db_name = tenant.db_name
                # Fallback for dynamic DB injection
                if db_name not in settings.DATABASES:
                    new_db = settings.DATABASES['default'].copy()
                    new_db.update({
                        'NAME': tenant.db_name,
                        'USER': tenant.db_user or settings.DATABASES['default'].get('USER'),
                        'PASSWORD': tenant.db_password_hash or settings.DATABASES['default'].get('PASSWORD'),
                        'HOST': tenant.db_host or 'localhost',
                        'PORT': tenant.db_port or 5432,
                    })
                    settings.DATABASES[db_name] = new_db
            except Exception:
                pass
        
        request.db_name = db_name
        
        # 2. JWT Authentication
        request.profile = None
        request.auth_error = None
        
        auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
            try:
                secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                payload = jwt.decode(token, secret, algorithms=['HS256'])
                user_id = payload.get('user_id')
                if user_id:
                    from tenant_modules.users.models import UserProfile
                    request.profile = UserProfile.objects.using(db_name).select_related('user').get(user__id=user_id)
            except jwt.ExpiredSignatureError:
                request.auth_error = 'رمز التوثيق منتهي الصلاحية'
            except jwt.InvalidTokenError:
                request.auth_error = 'رمز التوثيق غير صالح'
            except Exception as e:
                request.auth_error = 'خطأ في التوثيق أو الملف الشخصي غير موجود'
        else:
            request.auth_error = 'التوثيق مطلوب'

        response = self.get_response(request)
        return response
