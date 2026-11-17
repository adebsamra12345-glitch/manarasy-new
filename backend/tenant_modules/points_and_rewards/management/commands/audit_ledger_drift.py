import os
import json
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.conf import settings
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
    help = "تدقيق وفحص الفجوة بين رصيد الطلاب الحالي ومجموع قيود دفتر الأستاذ (Ledger Drift Audit)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--tenant',
            type=str,
            help='اسم قاعدة بيانات التينانت أو الدومين الفرعي (اختياري: لتشخيص تينانت محدد)'
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='تصدير تقرير التدقيق بصيغة JSON'
        )

    def handle(self, *args, **options):
        tenant_filter = options.get('tenant')
        as_json = options.get('json')

        qs = Tenant.objects.all()
        if tenant_filter:
            qs = qs.filter(db_name=tenant_filter) | qs.filter(subdomain=tenant_filter)
            if not qs.exists():
                self.stderr.write(f"التينانت المحدد '{tenant_filter}' غير موجود.")
                return

        audit_results = []
        overall_total_students = 0
        overall_matched = 0
        overall_drifted = 0
        overall_surplus_pts = 0
        overall_deficit_pts = 0

        for tenant in qs:
            db_name = ensure_tenant_db(tenant)
            students = Student.objects.using(db_name).select_related('halaqa').all()
            
            tenant_summary = {
                'tenant_name': tenant.name,
                'db_name': db_name,
                'total_students': students.count(),
                'matched_count': 0,
                'drifted_count': 0,
                'total_drift_points': 0,
                'drifts': []
            }

            for s in students:
                cached_balance = s.points
                ledger_sum = PointTransaction.objects.using(db_name).filter(
                    student_id=s.id
                ).aggregate(
                    total=Coalesce(Sum('amount'), 0)
                )['total'] or 0

                drift = cached_balance - ledger_sum

                if drift == 0:
                    tenant_summary['matched_count'] += 1
                else:
                    tenant_summary['drifted_count'] += 1
                    tenant_summary['total_drift_points'] += drift
                    if drift > 0:
                        overall_surplus_pts += drift
                    else:
                        overall_deficit_pts += abs(drift)

                    tenant_summary['drifts'].append({
                        'student_id': str(s.id),
                        'student_name': s.full_name,
                        'halaqa_name': s.halaqa.name if s.halaqa else 'غير محدد',
                        'cached_points': cached_balance,
                        'ledger_sum': ledger_sum,
                        'drift': drift,
                        'direction': 'SURPLUS (فائض برصيد الطالب)' if drift > 0 else 'DEFICIT (عجز برصيد الطالب)'
                    })

            overall_total_students += tenant_summary['total_students']
            overall_matched += tenant_summary['matched_count']
            overall_drifted += tenant_summary['drifted_count']
            audit_results.append(tenant_summary)

        if as_json:
            self.stdout.write(json.dumps({
                'overall_summary': {
                    'total_students': overall_total_students,
                    'matched': overall_matched,
                    'drifted': overall_drifted,
                    'overall_surplus_points': overall_surplus_pts,
                    'overall_deficit_points': overall_deficit_pts
                },
                'tenants': audit_results
            }, ensure_ascii=False, indent=2))
            return

        # Human-Readable Formatted Report
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(self.style.MIGRATE_HEADING("تقرير تدقيق سلامة الأرصدة ودفتر الأستاذ (Ledger Drift Audit Report)"))
        self.stdout.write("=" * 80)

        for t_res in audit_results:
            self.stdout.write(f"\n[المستأجر]: {t_res['tenant_name']} (DB: {t_res['db_name']})")
            self.stdout.write(f"  إجمالي الطلاب: {t_res['total_students']}")
            self.stdout.write(f"  متطابق بنسبة 100%: {self.style.SUCCESS(str(t_res['matched_count']))}")
            
            if t_res['drifted_count'] == 0:
                self.stdout.write(f"  حالات الانحراف (Drift): {self.style.SUCCESS('0 (سليم تماماً - لا يوجد أي انحراف)')}")
            else:
                self.stdout.write(f"  حالات الانحراف (Drift): {self.style.WARNING(str(t_res['drifted_count']))}")
                self.stdout.write(f"  إجمالي نقاط الفارق: {t_res['total_drift_points']:+d}")
                self.stdout.write("  تفاصيل حالات الانحراف:")
                self.stdout.write("  " + "-" * 76)
                self.stdout.write(f"  {'اسم الطالب':<25} | {'الرصيد الفعلي':<12} | {'مجموع الدفتر':<12} | {'الفارق':<10} | {'الحالة'}")
                self.stdout.write("  " + "-" * 76)
                for d in t_res['drifts']:
                    self.stdout.write(
                        f"  {d['student_name']:<25} | {d['cached_points']:<12} | {d['ledger_sum']:<12} | {d['drift']:+d}        | {d['direction']}"
                    )
                self.stdout.write("  " + "-" * 76)

        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("الملخص العام:")
        self.stdout.write(f"  إجمالي الطلاب المفحوصين: {overall_total_students}")
        self.stdout.write(f"  الطلاب المتطابقون: {self.style.SUCCESS(str(overall_matched))}")
        self.stdout.write(f"  الطلاب الذين لديهم انحراف: {self.style.WARNING(str(overall_drifted)) if overall_drifted > 0 else self.style.SUCCESS('0')}")
        self.stdout.write(f"  مجموع الفائض التاريخي (Surplus): +{overall_surplus_pts} نقطة")
        self.stdout.write(f"  مجموع العجز التاريخي (Deficit): -{overall_deficit_pts} نقطة")
        self.stdout.write("=" * 80 + "\n")
