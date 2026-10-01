import os
import django
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings
from core_system.tenants.models import Tenant

for tenant in Tenant.objects.all():
    db_name = tenant.db_name
    print(f"Migrating tenant: {db_name}")
    
    # Inject DB into settings.DATABASES
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

    try:
        call_command('migrate', database=db_name)
        print(f"Successfully migrated {db_name}")
    except Exception as e:
        print(f"Failed to migrate {db_name}: {e}")
