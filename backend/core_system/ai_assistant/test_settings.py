"""إعدادات اختبار مستقلة (SQLite) لطبقة تخزين المحادثات بلا حاجة لـ PostgreSQL:
    python manage.py test core_system.ai_assistant.test_storage --settings=core_system.ai_assistant.test_settings
"""
SECRET_KEY = 'test'
DEBUG = True
USE_TZ = True
INSTALLED_APPS = ['django.contrib.contenttypes', 'core_system.ai_assistant']
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
MIGRATION_MODULES = {'ai_assistant': 'migrations.tenant_template.ai_assistant'}
ROOT_URLCONF = ''
