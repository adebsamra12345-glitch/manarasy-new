"""تسجيل اتصال قاعدة مسجد في settings.DATABASES عند الحاجة (للأوامر الإدارية خارج دورة الطلب)."""
import os

from django.conf import settings


def ensure_tenant_db(tenant) -> str:
    db_name = tenant.db_name
    if db_name not in settings.DATABASES:
        cfg = settings.DATABASES['default'].copy()
        cfg.update({
            'NAME': db_name,
            'USER': tenant.db_user or cfg.get('USER', ''),
            'PASSWORD': tenant.db_password_hash or cfg.get('PASSWORD') or os.getenv('DB_PASSWORD', ''),
            'HOST': tenant.db_host or 'localhost',
            'PORT': tenant.db_port or 5432,
        })
        settings.DATABASES[db_name] = cfg
    return db_name
