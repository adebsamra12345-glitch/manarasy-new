from django.core.management.base import BaseCommand

from core_system.ai_assistant import conversations
from core_system.ai_assistant.tenant_db import ensure_tenant_db
from core_system.tenants.models import Tenant


class Command(BaseCommand):
    help = "يحذف محادثات المساعد الأقدم من مدة الاحتفاظ (180 يوماً افتراضياً) لكل المساجد. يُجدوَل يومياً."

    def add_arguments(self, parser):
        parser.add_argument('--tenant', help='اسم قاعدة مسجد واحد (افتراضي: الكل)')

    def handle(self, *args, **opts):
        qs = Tenant.objects.all()
        if opts.get('tenant'):
            qs = qs.filter(db_name=opts['tenant'])
        total = 0
        for tenant in qs:
            db = ensure_tenant_db(tenant)
            try:
                n = conversations.purge_expired(db)
            except Exception as e:  # مسجد واحد لا يوقف البقية
                self.stderr.write(f'{db}: فشل ({e})')
                continue
            total += n
            self.stdout.write(f'{db}: حُذفت {n} محادثة')
        self.stdout.write(self.style.SUCCESS(f'المجموع: {total}'))
