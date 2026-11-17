"""تصدير أدوار المحادثة المعتمدة بشرياً لتحسين النموذج (JSONL بصيغة gpu-stack/data/train.jsonl).

شروط صارمة: موافقة المسجد الحالية + لقطة موافقة المحادثة + review_status=approved.
الأسماء تُرمَّز {{PERSON_n}} والنص يُعاد إخفاء PII منه قبل الكتابة.
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from core_system.ai_assistant import conversations
from core_system.ai_assistant.models import AgentMessage
from core_system.ai_assistant.tenant_db import ensure_tenant_db
from core_system.tenants.models import Tenant


def _person_names(db: str) -> list[str]:
    from tenant_modules.halaqat.models import Halaqa
    from tenant_modules.students_and_parents.models import Student

    names: list[str] = []
    for full, father, mother in Student.objects.using(db).values_list('full_name', 'father_name', 'mother_name'):
        names += [full, father, mother]
    names += list(Halaqa.objects.using(db).values_list('teacher_name', flat=True))
    return [n for n in names if n]


class Command(BaseCommand):
    help = "يصدّر الأدوار المعتمدة (موافقة المسجد + مراجعة بشرية) إلى JSONL مُرمَّز الأسماء."

    def add_arguments(self, parser):
        parser.add_argument('--out', required=True, help='ملف JSONL ناتج')
        parser.add_argument('--tenant', help='اسم قاعدة مسجد واحد')

    def handle(self, *args, **opts):
        out = Path(opts['out'])
        qs = Tenant.objects.all()
        if opts.get('tenant'):
            qs = qs.filter(db_name=opts['tenant'])
        records, skipped = [], 0
        for idx, tenant in enumerate(qs):
            db = ensure_tenant_db(tenant)
            if not conversations.get_agent_settings(db).training_consent:
                skipped += 1
                self.stdout.write(f'{db}: لا موافقة على التدريب — تخطّي')
                continue
            names = _person_names(db)
            approved = (
                AgentMessage.objects.using(db)
                .select_related('conversation')
                .filter(sender='assistant', review_status='approved', conversation__training_consent=True)
            )
            for asst in approved:
                user = (
                    AgentMessage.objects.using(db)
                    .filter(conversation=asst.conversation, seq=asst.seq - 1, sender='user')
                    .first()
                )
                if user:
                    records.append(conversations.build_training_record(user, asst, names, idx))
        if not records and skipped == qs.count():
            raise CommandError('لا توجد مساجد موافقة على استخدام المحادثات للتدريب')
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open('w', encoding='utf-8') as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
        self.stdout.write(self.style.SUCCESS(f'كُتب {len(records)} سجلاً إلى {out}'))
