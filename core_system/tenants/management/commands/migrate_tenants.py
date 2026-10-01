from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings
from core_system.tenants.models import Tenant

class Command(BaseCommand):
    help = 'يطبق الترحيلات (Migrations) على جميع قواعد بيانات المساجد (Tenants) أو مسجد محدد.'

    def add_arguments(self, parser):
        # إضافة خيار اختياري لتطبيق الترحيل على مسجد واحد فقط
        parser.add_argument(
            '--tenant',
            type=str,
            help='اسم النطاق الفرعي (subdomain) لمسجد محدد لتطبيق الترحيل عليه فقط.',
        )

    def handle(self, *args, **kwargs):
        tenant_subdomain = kwargs.get('tenant')

        # جلب المساجد من القاعدة المركزية
        if tenant_subdomain:
            tenants = Tenant.objects.filter(subdomain=tenant_subdomain)
            if not tenants.exists():
                self.stderr.write(self.style.ERROR(f"المسجد ذو النطاق '{tenant_subdomain}' غير موجود."))
                return
        else:
            tenants = Tenant.objects.all()

        if not tenants.exists():
            self.stdout.write(self.style.WARNING("لا يوجد أي مساجد مسجلة حالياً في النظام."))
            return

        for tenant in tenants:
            self.stdout.write(self.style.SUCCESS(f"\n---> جاري تجهيز قاعدة المسجد: {tenant.name} ({tenant.db_name})"))
            
            # إضافة إعدادات قاعدة البيانات ديناميكياً في الذاكرة (تماماً كآلية الـ API)
            if tenant.db_name not in settings.DATABASES:
                new_db_config = settings.DATABASES['default'].copy()
                new_db_config.update({
                    'NAME': tenant.db_name,
                    'USER': tenant.db_user,
                    'PASSWORD': tenant.db_password_hash,
                    'HOST': tenant.db_host,
                    'PORT': tenant.db_port,
                })
                settings.DATABASES[tenant.db_name] = new_db_config

            # تنفيذ الترحيل (migrate) على قاعدة المسجد المحددة
            try:
                self.stdout.write(f"جاري تطبيق الترحيلات على '{tenant.db_name}'...")
                call_command('migrate', database=tenant.db_name)
                self.stdout.write(self.style.SUCCESS(f"تم ترحيل الجداول بنجاح لقاعدة: {tenant.db_name}"))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"فشل الترحيل لقاعدة {tenant.db_name}. الخطأ: {str(e)}"))

        self.stdout.write(self.style.SUCCESS("\n*** انتهت عملية الترحيل لجميع المساجد المستهدفة! ***"))