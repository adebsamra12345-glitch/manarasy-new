import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import IntegrityError
from django.conf import settings
from .models import Tenant
from .provisioning import create_tenant_database
import jwt
from datetime import datetime, timedelta
from django.contrib.auth.hashers import check_password

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise ValueError("صيغة البيانات في الطلب غير صالحة (Invalid JSON)")

@csrf_exempt
def health_check_view(request):
    print("\n==========================================")
    print(f"[START] Health Check requested: {request.method} {request.path}")
    print("==========================================")
    
    print("  [STEP 1] Checking system status and database connections...")
    try:
        tenant_count = Tenant.objects.count()
        print(f"  [STEP 2] Database connected successfully. Total tenants count: {tenant_count}")
        
        response_data = {
            "status": "success",
            "message": "السيرفر يعمل بنجاح والاتصال بقاعدة البيانات قائم",
            "data": {
                "system_status": "ONLINE",
                "timestamp": datetime.utcnow().isoformat(),
                "tenants_count": tenant_count
            }
        }
        print(f"[RESULT] Health check completed successfully: {response_data['status']}")
        return JsonResponse(response_data, status=200)
    except Exception as e:
        print(f"[ERROR] Health check failed: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            "status": "error",
            "message": "حدث خطأ أثناء فحص حالة السيرفر",
            "details": str(e)
        }, status=500)

@csrf_exempt
def tenant_list_create_view(request):
    print("\n==========================================")
    print(f"[START] Tenant API (core_system.tenants): Method={request.method}, Path={request.path}")
    print("==========================================")
    
    if request.method == 'GET':
        try:
            print("  [STEP 1] Fetching all tenants from Master DB...")
            tenants = Tenant.objects.all().order_by('-created_at')
            print(f"  [STEP 2] Found {tenants.count()} tenant(s).")
            
            result = []
            for t in tenants:
                result.append({
                    "id": str(t.id),
                    "name": t.name,
                    "subdomain": t.subdomain,
                    "custom_domain": t.custom_domain,
                    "db_name": t.db_name,
                    "db_host": t.db_host,
                    "db_port": t.db_port,
                    "db_user": t.db_user,
                    "is_active": t.is_active,
                    "contact_phone": t.contact_phone,
                    "contact_email": t.contact_email,
                    "created_at": t.created_at.isoformat() if t.created_at else None
                })
            
            print(f"[RESULT] Successfully returned {len(result)} tenant(s).")
            return JsonResponse({
                "status": "success",
                "message": "تم استرجاع قائمة المساجد/المستأجرين بنجاح",
                "count": len(result),
                "data": result
            }, status=200)

        except Exception as e:
            print(f"[ERROR] Failed to fetch tenants: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({
                "status": "error",
                "message": "حدث خطأ أثناء استرجاع قائمة المستأجرين",
                "details": str(e)
            }, status=500)

    elif request.method == 'POST':
        try:
            print("  [STEP 1] Extracting payload for Tenant creation...")
            data = parse_body(request)
            
            print("  [STEP 2] Validating required tenant fields...")
            required = ['name', 'subdomain', 'db_name', 'contact_phone', 'admin_password']
            missing = [f for f in required if not data.get(f)]
            if missing:
                err_msg = f"الحقول التالية مطلوبة: {', '.join(missing)}"
                print(f"  [ERROR] Validation failed: {err_msg}")
                return JsonResponse({
                    "status": "error",
                    "message": f"الحقول التالية مطلوبة: {', '.join(missing)}",
                    "details": "Missing required fields"
                }, status=400)

            raw_admin_password = data['admin_password']
            if len(raw_admin_password) < 6:
                return JsonResponse({
                    "status": "error",
                    "message": "كلمة المرور يجب أن لا تقل عن 6 أحرف/أرقام"
                }, status=400)
            
            master_db = settings.DATABASES['default']
            default_db_user = data.get('db_user', master_db.get('USER', 'manara_user'))
            default_db_password = data.get('db_password_hash', master_db.get('PASSWORD', 'M@nara_2026_Str0ng!'))

            print("  [STEP 3] Creating new Tenant record in Master DB...")
            tenant = Tenant.objects.create(
                name=data['name'],
                subdomain=data['subdomain'],
                custom_domain=data.get('custom_domain'),
                db_name=data['db_name'],
                db_host=data.get('db_host', 'localhost'),
                db_port=data.get('db_port', 5432),
                db_user=default_db_user,
                db_password_hash=default_db_password,
                contact_phone=data['contact_phone'],
                contact_email=data.get('contact_email'),
                is_active=data.get('is_active', True)
            )

            center_lat = data.get('center_latitude')
            center_lng = data.get('center_longitude')
            
            print(f"  [STEP 4] Tenant saved successfully. ID={tenant.id}")

            # ---> الاستدعاء الفعلي لدالة الإنشاء <---
            print("  [STEP 5] Provisioning physical database for tenant...")
            create_tenant_database(tenant, raw_admin_password=raw_admin_password,center_lat=center_lat, 
                center_lng=center_lng)
            
            res = {
                "id": str(tenant.id),
                "name": tenant.name,
                "subdomain": tenant.subdomain,
                "db_name": tenant.db_name,
                "default_username": "manager",
                "created_at": tenant.created_at.isoformat()
            }
            print(f"[RESULT] Tenant '{tenant.name}' registered & provisioned successfully.")
            return JsonResponse({
                "status": "success",
                "message": "تم إضافة المسجد وإنشاء قاعدة بياناته بنجاح",
                "data": res
            }, status=201)

        except IntegrityError as e:
            print(f"[ERROR] Integrity constraint error: {str(e)}")
            return JsonResponse({
                "status": "error",
                "message": "النطاق الفرعي (subdomain) أو قاعدة البيانات مستخدم بالفعل",
                "details": str(e)
            }, status=400)

        except ValueError as e:
            print(f"[ERROR] Value error: {str(e)}")
            return JsonResponse({"status": "error", "message": str(e)}, status=400)

        except Exception as e:
            print(f"[ERROR] Tenant creation failed: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({
                "status": "error",
                "message": "حدث خطأ غير متوقع عند حفظ المستأجر",
                "details": str(e)
            }, status=500)

    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

@csrf_exempt
def tenant_detail_view(request, pk):
    print("\n==========================================")
    print(f"[START] Tenant Detail API (core_system.tenants): ID={pk}, Method={request.method}")
    print("==========================================")
    
    try:
        print(f"  [STEP 1] Querying tenant with ID: {pk}")
        t = Tenant.objects.get(id=pk)
        print(f"  [STEP 2] Tenant found: {t.name}")
        
        data = {
            "id": str(t.id),
            "name": t.name,
            "subdomain": t.subdomain,
            "custom_domain": t.custom_domain,
            "db_name": t.db_name,
            "db_host": t.db_host,
            "db_port": t.db_port,
            "db_user": t.db_user,
            "is_active": t.is_active,
            "contact_phone": t.contact_phone,
            "contact_email": t.contact_email,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat()
        }
        print(f"[RESULT] Tenant details returned successfully for ID={pk}")
        return JsonResponse({
            "status": "success",
            "message": "تم استرجاع تفاصيل المستأجر بنجاح",
            "data": data
        }, status=200)

    except Tenant.DoesNotExist:
        print(f"[ERROR] Tenant matching ID {pk} does not exist.")
        return JsonResponse({
            "status": "error",
            "message": "المستأجر غير موجود في النظام",
            "details": f"No Tenant found matching ID: {pk}"
        }, status=404)

    except Exception as e:
        print(f"[ERROR] Failed to fetch tenant details: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            "status": "error",
            "message": "حدث خطأ أثناء جلب تفاصيل المستأجر",
            "details": str(e)
        }, status=500)


@csrf_exempt
def tenant_login_view(request):
    """
    API لتسجيل الدخول الخاص بالمسجد
    يقبل: subdomain, username (الافتراضي manager), password
    """

    def extract_subdomain(request):
        """
        استخراج الـ subdomain من ترويسة Host في الطلب
        مثال: alhuda.manarasy.com -> alhuda
        أو alhuda.localhost:8000 -> alhuda
        """
        host = request.get_host().split(':')[0].lower()
        parts = host.split('.')
        
        # في حال كان الرابط على شكل: subdomain.manarasy.com أو subdomain.localhost
        if len(parts) >= 2 and parts[0] not in ['www', 'api', 'manarasy', 'localhost', '127']:
            print(parts[0])
            return parts[0]
        return None
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        data = parse_body(request)
        subdomain = extract_subdomain(request)
        if not subdomain:
            subdomain = data.get('subdomain', '').strip().lower()
        username = data.get('username', 'manager').strip()
        password = data.get('password', '')

        if not subdomain or not username or not password:
            return JsonResponse({
                "status": "error",
                "message": "اسم النطاق الفرعي للمسجد (subdomain)، اسم المستخدم، وكلمة المرور مطلوبان"
            }, status=400)

        # 1. التحقق من وجود المسجد وأنه نشط
        try:
            tenant = Tenant.objects.get(subdomain=subdomain, is_active=True)
        except Tenant.DoesNotExist:
            return JsonResponse({
                "status": "error",
                "message": "المسجد غير موجود أو أن حسابه غير نشط"
            }, status=404)

        # 2. تجهيز إعدادات قاعدة بيانات المستأجر ديناميكياً
        db_name = tenant.db_name
        if db_name not in settings.DATABASES:
            master_db = settings.DATABASES['default']
            new_db_config = master_db.copy()
            new_db_config.update({
                'NAME': db_name,
                'USER': tenant.db_user or master_db.get('USER', 'manara_user'),
                'PASSWORD': tenant.db_password_hash or master_db.get('PASSWORD', 'M@nara_2026_Str0ng!'),
                'HOST': tenant.db_host or 'localhost',
                'PORT': tenant.db_port or 5432,
            })
            settings.DATABASES[db_name] = new_db_config

        # 3. التحقق من كلمة المرور من قاعدة بيانات المسجد (auth_user)
        from django.contrib.auth import get_user_model
        from tenant_modules.users.models import UserProfile
        User = get_user_model()

        target_user = None
        role = "TENANT_ADMIN"
        is_authenticated = False

        try:
            target_user = User.objects.using(db_name).get(username=username, is_active=True)
            if check_password(password, target_user.password):
                is_authenticated = True
                try:
                    profile = UserProfile.objects.using(db_name).get(user=target_user)
                    if not profile.is_active:
                        return JsonResponse({
                            "status": "error",
                            "message": "هذا الحساب غير نشط أو ملغى التنشيط"
                        }, status=403)
                    role = profile.role
                except UserProfile.DoesNotExist:
                    role = 'TENANT_ADMIN' if username == 'manager' else 'STUDENT'
        except User.DoesNotExist:
            pass

        # خيار احتياطي لحساب manager الأصلي في حال كان مسجلاً بكلمة مرور المسجد
        if not is_authenticated and username == 'manager' and tenant.admin_password_hash:
            if check_password(password, tenant.admin_password_hash):
                is_authenticated = True
                role = "TENANT_ADMIN"

        if not is_authenticated:
            return JsonResponse({
                "status": "error",
                "message": "اسم المستخدم أو كلمة المرور غير صحيحة"
            }, status=401)

        # 4. توليد JWT Tokens
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        access_lifetime = getattr(settings, 'JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60)
        
        now = datetime.utcnow()
        payload = {
            "tenant_id": str(tenant.id),
            "subdomain": tenant.subdomain,
            "username": target_user.username if target_user else username,
            "user_id": str(target_user.id) if target_user else None,
            "role": role,
            "exp": now + timedelta(minutes=int(access_lifetime)),
            "iat": now
        }
        
        token = jwt.encode(payload, jwt_secret, algorithm="HS256")

        return JsonResponse({
            "status": "success",
            "message": "تم تسجيل الدخول بنجاح",
            "data": {
                "access_token": token,
                "token_type": "Bearer",
                "expires_in_minutes": access_lifetime,
                "tenant": {
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "subdomain": tenant.subdomain
                },
                "user": {
                    "id": str(target_user.id) if target_user else None,
                    "username": target_user.username if target_user else username,
                    "role": role
                }
            }
        }, status=200)

    except Exception as e:
        print(f"[ERROR] Login failed: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            "status": "error",
            "message": "حدث خطأ غير متوقع أثناء تسجيل الدخول",
            "details": str(e)
        }, status=500)
