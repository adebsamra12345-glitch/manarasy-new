import os
import json
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum
from django.db.models.functions import Coalesce
from core_system.tenants.models import Tenant
from tenant_modules.students_and_parents.models import Student
from tenant_modules.points_and_rewards.models import PointTransaction


def ensure_tenant_db(tenant):
    db_name = tenant.db_name
    if db_name not in settings.DATABASES:
        master_db = settings.DATABASES['default'].copy()
        master_db.update({
            'NAME': db_name,
            'USER': tenant.db_user or master_db.get('USER', 'manara_user'),
            'PASSWORD': tenant.db_password_hash or master_db.get('PASSWORD') or os.getenv('DB_PASSWORD', ''),
            'HOST': tenant.db_host or 'localhost',
            'PORT': tenant.db_port or 5432,
        })
        settings.DATABASES[db_name] = master_db
    return db_name


class Command(BaseCommand):
    help = "تسوية ومطابقة رصيد دفتر الأستاذ مع رصيد الطلاب الحالي دون تعديل أرصدتهم (Safe Reconciliation)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='اسم قاعدة بيانات التينانت أو الدومين الفرعي (اختياري)'
        )
        parser.add_argument(
            '--apply',
            action='store_true',
            help='تنفيذ قيود التسوية الافتتاحية فعلياً في قاعدة البيانات (بدونها يعمل الأمر بوضع المحاكاة Dry-Run)'
        )
        parser.add_argument(
            '--rollback',
            action='store_true',
            help='التراجع عن قيود التسوية الافتتاحية HISTORICAL_RECONCILIATION السابقة'
        )

    def handle(self, *args, **options):
        tenant_filter = options.get('tenant')
        apply_changes = options.get('apply')
        rollback_changes = options.get('rollback')

        qs = Tenant.objects.all()
        if tenant_filter:
            qs = qs.filter(db_name=tenant_filter) | qs.filter(subdomain=tenant_filter)
            if not qs.exists():
                self.stderr.write(f"التينانت المحدد '{tenant_filter}' غير موجود.")
                return

        if rollback_changes:
            self.stdout.write(self.style.WARNING("\nبدء عملية التراجع عن قيود التسوية الافتتاحية السابقة..."))
            for tenant in qs:
                db_name = ensure_tenant_db(tenant)
                with transaction.atomic(using=db_name):
                    deleted_count, _ = PointTransaction.objects.using(db_name).filter(
                        transaction_type='HISTORICAL_RECONCILIATION'
                    ).delete()
                    self.stdout.write(f"  [{tenant.name}]: تم حذف {deleted_count} قيد تسوية بنجاح.")
            self.stdout.write(self.style.SUCCESS("اكتمل التراجع بنجاح.\n"))
            return

        is_dry_run = not apply_changes
        mode_label = "وضع المحاكاة (DRY-RUN) - لن يتم تعديل أي بيانات" if is_dry_run else "وضع التطبيق الفعلي (APPLY) - سيتم إدراج قيود التسوية"

        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.MIGRATE_HEADING(f"أداة تسوية دفتر الأستاذ التاريخي ({mode_label})"))
        self.stdout.write("=" * 80)

        total_reconciled = 0
        total_already_matched = 0

        for tenant in qs:
            db_name = ensure_tenant_db(tenant)
            self.stdout.write(f"\nمعالجة المستأجر: {tenant.name} (DB: {db_name})...")

            students = Student.objects.using(db_name).all().order_by('full_name')
            t_reconciled = 0
            t_matched = 0

            for s in students:
                with transaction.atomic(using=db_name):
                    # In apply mode lock the row; in dry-run mode read directly
                    if apply_changes:
                        student_row = Student.objects.using(db_name).select_for_update().get(id=s.id)
                    else:
                        student_row = s

                    cached_balance = student_row.points
                    ledger_sum = PointTransaction.objects.using(db_name).filter(
                        student_id=student_row.id
                    ).aggregate(
                        total=Coalesce(Sum('amount'), 0)
                    )['total'] or 0

                    drift = cached_balance - ledger_sum

                    if drift == 0:
                        t_matched += 1
                        continue

                    # Drift detected: reconciliation entry needed
                    t_reconciled += 1
                    idemp_key = f"init_reconcile_{student_row.id}_{db_name}"

                    if is_dry_run:
                        self.stdout.write(
                            f"  [محاكاة] الطالب {student_row.full_name} | الرصيد: {cached_balance} | الدفتر: {ledger_sum} | سيتم إنشاء قيد بمقدار: {drift:+d}"
                        )
                    else:
                        # Apply reconciliation entry in append-only ledger
                        tx = PointTransaction.objects.using(db_name).create(
                            student=student_row,
                            amount=drift,
                            transaction_type='HISTORICAL_RECONCILIATION',
                            reason=f"قيد تسوية افتتاحي لمطابقة رصيد الطالب ({cached_balance}) مع دفتر الأستاذ (الفارق: {drift:+d})",
                            balance_before=ledger_sum,
                            balance_after=cached_balance,
                            idempotency_key=idemp_key,
                            reference_id=str(student_row.id),
                            reference_type='STUDENT_BASELINE',
                            metadata={
                                'reconciled_at': timezone.now().isoformat(),
                                'prior_ledger_sum': ledger_sum,
                                'drift': drift
                            }
                        )

                        # Verification of post-reconciliation 100% balance alignment
                        new_ledger_sum = PointTransaction.objects.using(db_name).filter(
                            student_id=student_row.id
                        ).aggregate(
                            total=Coalesce(Sum('amount'), 0)
                        )['total'] or 0

                        assert new_ledger_sum == student_row.points, (
                            f"CRITICAL RECONCILIATION INTEGRITY ERROR: student {student_row.id} points ({student_row.points}) != ledger ({new_ledger_sum})"
                        )

                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  [تمت التسوية] الطالب {student_row.full_name} | قيد: {tx.amount:+d} | الرصيد المحفوظ: {student_row.points} | مجموع الدفتر الجديد: {new_ledger_sum}"
                            )
                        )

            total_reconciled += t_reconciled
            total_already_matched += t_matched
            self.stdout.write(f"  -> النتيجة: {t_matched} طالب متطابق أصلاً، و {t_reconciled} طالب تمت تسوية دفترهم.")

        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("الملخص النهائي:")
        self.stdout.write(f"  إجمالي الطلاب المتطابقين دون تدخل: {total_already_matched}")
        self.stdout.write(f"  إجمالي قيود التسوية المنفذة/المقترحة: {total_reconciled}")
        if is_dry_run:
            self.stdout.write(self.style.NOTICE("  لم يتم تطبيق أي تغيير في قاعدة البيانات. لتطبيق التسوية فعلياً أعد تشغيل الأمر مع إضافة --apply."))
        else:
            self.stdout.write(self.style.SUCCESS("  تمت مطابقة رصيد دفتر الأستاذ مع أرصدة الطلاب بنسبة 100% لجميع الطلاب!"))
        self.stdout.write("=" * 80 + "\n")
