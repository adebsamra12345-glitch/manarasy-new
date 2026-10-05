"""
إنشاء قاعدة بيانات مسجد (Database-per-Tenant) وتجهيزها.

الفروق عن النسخة السابقة:
  * اسم القاعدة/المستخدم يُتحقق منهما بـ regex ويُمرَّران عبر psycopg2.sql.Identifier (لا f-string في SQL).
  * الأخطاء تُرفع (ProvisioningError) بدل أن تُبتلع، فلا يُعلَّم المسجد "جاهزاً" وهو غير جاهز.
  * العملية idempotent: إعادة المحاولة بعد فشل جزئي تكمل من حيث توقفت (القاعدة موجودة ← تكمل migrate/seed).
  * تقبل hash جاهزاً لكلمة المرور (admin_password_hash) كي لا نحتفظ بكلمة المرور الخام في أي مكان.
  * لا طباعة لكلمات المرور في السجلات.
  * أصلحنا خطأ `admin_user` غير المعرَّف عند فشل إنشاء المدير.
"""
import logging
import os
import re

import psycopg2
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core.management import call_command
from django.db import transaction
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

logger = logging.getLogger(__name__)

_IDENT_RE = re.compile(r'^[a-z][a-z0-9_]{2,62}$')


class ProvisioningError(Exception):
    """فشل تجهيز قاعدة المسجد. الرسالة آمنة للعرض لأدمن المنصة (بلا أسرار)."""


def _check_identifier(value: str, what: str) -> str:
    if not value or not _IDENT_RE.match(value):
        raise ProvisioningError(f'{what} غير صالح')
    return value


def register_tenant_database(tenant):
    """يضيف إعدادات اتصال قاعدة المسجد إلى settings.DATABASES في ذاكرة العملية (نفس آلية الـ middleware)."""
    master_db = settings.DATABASES['default']
    if tenant.db_name not in settings.DATABASES:
        cfg = master_db.copy()
        cfg.update({
            'NAME': tenant.db_name,
            'USER': tenant.db_user or master_db.get('USER'),
            'PASSWORD': tenant.db_password_hash or master_db.get('PASSWORD'),
            'HOST': tenant.db_host or master_db.get('HOST', 'localhost'),
            'PORT': tenant.db_port or master_db.get('PORT', 5432),
        })
        settings.DATABASES[tenant.db_name] = cfg


def create_tenant_database(tenant, raw_admin_password=None, center_lat=None, center_lng=None, *,
                           admin_password_hash=None, admin_username='manager',
                           admin_first_name='', admin_email=None):
    master_db = settings.DATABASES['default']

    db_name = _check_identifier(tenant.db_name, 'اسم قاعدة البيانات')
    db_user = os.getenv('DB_USER', master_db.get('USER', 'manara_user'))
    db_password = os.getenv('DB_PASSWORD', master_db.get('PASSWORD'))
    db_host = os.getenv('DB_HOST', master_db.get('HOST', 'localhost'))
    db_port = os.getenv('DB_PORT', master_db.get('PORT', 5432))
    _check_identifier(db_user, 'مستخدم قاعدة البيانات')

    pw_hash = admin_password_hash or (make_password(raw_admin_password) if raw_admin_password else None)
    if not pw_hash:
        raise ProvisioningError('كلمة مرور مدير المسجد مفقودة')

    # سجل المستأجر (المخطط الحالي يخزّن بيانات اتصال المسجد في الجدول المركزي)
    tenant.db_user = db_user
    tenant.db_password_hash = db_password
    tenant.db_host = str(db_host)       # المسجَّل سابقاً كان يبقى 'localhost' حتى داخل Docker
    tenant.db_port = int(db_port)
    fields = ['db_user', 'db_password_hash', 'db_host', 'db_port']
    if admin_username == 'manager':
        tenant.admin_password_hash = pw_hash       # مسار الدخول الاحتياطي في tenant_login_view
        fields.append('admin_password_hash')
    tenant.save(update_fields=fields)

    # 1) إنشاء القاعدة الفيزيائية (إن لم تكن موجودة)
    conn = None
    try:
        conn = psycopg2.connect(dbname=master_db['NAME'], user=db_user, password=db_password,
                                host=db_host, port=db_port, connect_timeout=10)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        with conn.cursor() as cur:
            cur.execute('SELECT 1 FROM pg_database WHERE datname = %s', (db_name,))
            if cur.fetchone():
                logger.info('tenant database %s already exists; continuing (retry)', db_name)
            else:
                cur.execute(sql.SQL('CREATE DATABASE {} OWNER {}').format(
                    sql.Identifier(db_name), sql.Identifier(db_user)))
                logger.info('tenant database %s created', db_name)
    except psycopg2.Error as exc:
        raise ProvisioningError(f'تعذّر إنشاء قاعدة البيانات ({exc.__class__.__name__})') from exc
    finally:
        if conn is not None:
            conn.close()

    # 2) تسجيلها في الذاكرة ثم تطبيق ترحيلات قالب المسجد
    register_tenant_database(tenant)
    try:
        call_command('migrate', database=db_name, interactive=False, verbosity=0)
    except Exception as exc:                                   # noqa: BLE001
        raise ProvisioningError(f'فشل تطبيق الترحيلات ({exc.__class__.__name__})') from exc

    # 3) Seeding: مدير المسجد + المركز الرئيسي (get_or_create ⇒ آمن عند إعادة المحاولة)
    from tenant_modules.centers_and_projects.models import Center
    from tenant_modules.users.models import UserProfile
    User = get_user_model()
    try:
        with transaction.atomic(using=db_name):
            admin_user, _ = User.objects.using(db_name).get_or_create(
                username=admin_username,
                defaults={
                    'password': pw_hash,
                    'is_staff': True,
                    'is_superuser': True,
                    'email': admin_email or tenant.contact_email or '',
                    'first_name': admin_first_name or '',
                },
            )
            UserProfile.objects.using(db_name).get_or_create(
                user=admin_user,
                defaults={'role': 'TENANT_ADMIN', 'roles': ['TENANT_ADMIN'], 'phone': tenant.contact_phone},
            )
            Center.objects.using(db_name).get_or_create(
                code='MAIN_CENTER',
                defaults={
                    'name': 'المركز الرئيسي',
                    'address': 'المقر الرئيسي للمسجد',
                    'latitude': center_lat,
                    'longitude': center_lng,
                    'manager': admin_user,
                },
            )
    except Exception as exc:                                   # noqa: BLE001
        raise ProvisioningError(f'فشل تجهيز بيانات المسجد الأولية ({exc.__class__.__name__})') from exc

    return tenant
