import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from django.conf import settings
from django.core.management import call_command
from django.contrib.auth.hashers import make_password
from tenant_modules.centers_and_projects.models import Center

def create_tenant_database(tenant, raw_admin_password=None,center_lat=None, center_lng=None):
    """
    تتصل هذه الدالة بقاعدة البيانات لإنشاء قاعدة فيزيائية جديدة للمسجد
    باستخدام مستخدم وكلمة مرور قاعدة البيانات المركزية المحددة في ملف .env وإعدادات Django (manara_user)،
    ثم تطبق ملفات الترحيل الخاصة بقالب المسجد داخلها.
    """
    master_db = settings.DATABASES['default']
    
    # قراءة بيانات المستخدم وكلمة المرور من ملف .env / إعدادات Django
    db_user = os.getenv('DB_USER', master_db.get('USER', 'manara_user'))
    db_password = os.getenv('DB_PASSWORD', master_db.get('PASSWORD', 'M@nara_2026_Str0ng!'))
    db_host = os.getenv('DB_HOST', master_db.get('HOST', 'localhost'))
    db_port = os.getenv('DB_PORT', master_db.get('PORT', 5432))

    # تحديث بيانات المستخدم وكلمة المرور في سجل المستأجر لتتطابق مع مستخدم .env
    tenant.db_user = db_user
    tenant.db_password_hash = db_password
    if raw_admin_password:
        tenant.admin_password_hash = make_password(raw_admin_password)
    tenant.save(update_fields=['db_user', 'db_password_hash', 'admin_password_hash'])
    
    # 1. الاتصال بخادم PostgreSQL لإنشاء القاعدة الجديدة
    conn = psycopg2.connect(
        dbname='manara_db',
        user=db_user,
        password=db_password,
        host=db_host,
        port=db_port
    )
    
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    try:
        # إنشاء قاعدة البيانات وتخصيص المالك ليكون نفس المستخدم المعرف في .env (manara_user)
        cursor.execute(f"CREATE DATABASE {tenant.db_name} OWNER {db_user};")
        print(f"    - Physical database '{tenant.db_name}' created successfully with owner '{db_user}'.")
    except Exception as e:
        print(f"    - [WARNING] Database creation issue: {e}")
    finally:
        cursor.close()
        conn.close()

    # 2. إضافة القاعدة الجديدة ديناميكياً لإعدادات Django الحالية في الذاكرة
    new_db_config = master_db.copy()
    new_db_config.update({
        'NAME': tenant.db_name,
        'USER': db_user,
        'PASSWORD': db_password,
        'HOST': db_host,
        'PORT': db_port,
    })
    settings.DATABASES[tenant.db_name] = new_db_config

    # 3. تشغيل ملفات الترحيل (Migrations) لبناء جداول قالب المسجد
    print(f"    - Applying migrations for '{tenant.db_name}'...")
    call_command('migrate', database=tenant.db_name)

    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        # التأكد من عدم تكراره
        if not User.objects.using(tenant.db_name).filter(username='manager').exists():
            admin_user = User.objects.using(tenant.db_name).create(
                username='manager',
                password=make_password(raw_admin_password),
                is_staff=True,
                is_superuser=True,
                email=tenant.contact_email or ''
            )
            print(f"    - Default tenant manager account created for '{tenant.subdomain}'.")
        else:
            # في حال كان موجوداً مسبقاً، نجلبه لربطه بالمركز
            admin_user = User.objects.using(tenant.db_name).get(username='manager')
    except Exception as e:
        print(f"    - [WARNING] Could not create manager user in tenant DB: {e}")
    try:
    # 3. إنشاء المركز الافتراضي "المركز الرئيسي"
        if not Center.objects.using(tenant.db_name).filter(code='MAIN_CENTER').exists():
            Center.objects.using(tenant.db_name).create(
                name='المركز الرئيسي',
                code='MAIN_CENTER',
                address='المقر الرئيسي للمسجد',
                latitude=center_lat, 
                longitude=center_lng,
                manager=admin_user
            )
            print(f"    - Default center 'المركز الرئيسي' created.")
    except Exception as e:
        print(f"    - [WARNING] Could not create default setup in tenant DB: {e}")