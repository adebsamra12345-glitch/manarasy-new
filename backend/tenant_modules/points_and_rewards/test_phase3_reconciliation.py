import os
import sys
import uuid
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.core.management import call_command
from django.conf import settings
from django.db.models import Sum
from django.db.models.functions import Coalesce
from core_system.tenants.models import Tenant
from tenant_modules.users.models import UserProfile, User
from tenant_modules.centers_and_projects.models import Center
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.students_and_parents.models import Student
from tenant_modules.points_and_rewards.models import PointTransaction


def run_tests():
    print("=" * 70)
    print("RUNNING PHASE 3 DATA MIGRATION & RECONCILIATION INTEGRATION TESTS")
    print("=" * 70)

    tenant = Tenant.objects.first()
    assert tenant is not None, "A Tenant record is required"
    db_name = tenant.db_name

    if db_name not in settings.DATABASES:
        cfg = settings.DATABASES['default'].copy()
        cfg.update({
            'NAME': tenant.db_name,
            'USER': tenant.db_user or settings.DATABASES['default'].get('USER'),
            'PASSWORD': tenant.db_password_hash or settings.DATABASES['default'].get('PASSWORD'),
            'HOST': tenant.db_host or 'localhost',
            'PORT': tenant.db_port or 5432
        })
        settings.DATABASES[db_name] = cfg

    # -------------------------------------------------------------------------
    # TEST 1: Global Platform Ledger Drift Status (Must be 0 Drift)
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Verifying Platform-Wide Zero-Drift State...")
    students = Student.objects.using(db_name).all()
    assert students.count() > 0, "Platform must contain students"

    drift_count = 0
    for s in students:
        ledger_sum = PointTransaction.objects.using(db_name).filter(
            student_id=s.id
        ).aggregate(total=Coalesce(Sum('amount'), 0))['total'] or 0
        if s.points != ledger_sum:
            drift_count += 1

    assert drift_count == 0, f"Expected 0 drifted students, got {drift_count}"
    print(f"  --> PASSED: All {students.count()} students have 100% exact alignment between points and ledger.")

    # -------------------------------------------------------------------------
    # TEST 2: Re-running Reconciliation is Completely Idempotent
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Testing Idempotency of reconcile_student_ledger --apply...")
    initial_tx_count = PointTransaction.objects.using(db_name).count()
    call_command('reconcile_student_ledger', apply=True)
    post_tx_count = PointTransaction.objects.using(db_name).count()
    assert initial_tx_count == post_tx_count, f"Re-applying on zero drift must create 0 transactions! Got {post_tx_count - initial_tx_count} new"
    print("  --> PASSED: Re-running reconcile_student_ledger created 0 new records (Idempotent).")

    # -------------------------------------------------------------------------
    # TEST 3: Artificial Drift Simulation & Automatic Reconciliation Verification
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Testing Synthetic Drift Simulation and Auto-Reconciliation...")
    center, _ = Center.objects.using(db_name).get_or_create(code='P3_CTR', defaults={'name': 'مركز المحاكاة 3'})
    halaqa, _ = Halaqa.objects.using(db_name).get_or_create(name='حلقة المحاكاة 3', defaults={'center': center, 'teacher_name': 'معلم 3'})
    test_u, _ = User.objects.using(db_name).get_or_create(username='p3_synthetic_stu', defaults={'first_name': 'طالب', 'last_name': 'تجريبي 3'})
    
    sim_student, _ = Student.objects.using(db_name).get_or_create(
        user=test_u,
        defaults={'full_name': 'طالب محاكاة التسوية', 'national_id': '8877665544', 'halaqa': halaqa, 'points': 250}
    )
    # Force an unbacked balance of 250 points without ledger records
    PointTransaction.objects.using(db_name).filter(student=sim_student).delete()
    sim_student.points = 250
    sim_student.save(using=db_name)

    # Verify drift exists
    ledger_sum_before = PointTransaction.objects.using(db_name).filter(
        student_id=sim_student.id
    ).aggregate(total=Coalesce(Sum('amount'), 0))['total'] or 0
    assert ledger_sum_before == 0
    assert sim_student.points == 250

    # Run reconcile --apply
    call_command('reconcile_student_ledger', apply=True)

    # Verify balance was NOT altered, and ledger now matches 250
    sim_student.refresh_from_db()
    assert sim_student.points == 250, f"Student points must NOT be changed! Got {sim_student.points}"

    ledger_sum_after = PointTransaction.objects.using(db_name).filter(
        student_id=sim_student.id
    ).aggregate(total=Coalesce(Sum('amount'), 0))['total'] or 0
    assert ledger_sum_after == 250, f"Expected ledger total 250, got {ledger_sum_after}"

    reconcile_tx = PointTransaction.objects.using(db_name).filter(
        student=sim_student, transaction_type='HISTORICAL_RECONCILIATION'
    ).first()
    assert reconcile_tx is not None
    assert reconcile_tx.amount == 250
    assert reconcile_tx.balance_after == 250
    print(f"  --> PASSED: Synthetic drift of +250 resolved with zero point loss. Balance: {sim_student.points}, Ledger: {ledger_sum_after}.")

    # -------------------------------------------------------------------------
    # TEST 4: Clean up Synthetic Fixtures
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Cleaning up Synthetic Test Artifacts...")
    PointTransaction.objects.using(db_name).filter(student=sim_student).delete()
    sim_student.delete()
    test_u.delete()
    print("  --> PASSED: Test artifacts cleaned.")

    print("\n" + "=" * 70)
    print("ALL PHASE 3 RECONCILIATION TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == '__main__':
    run_tests()
